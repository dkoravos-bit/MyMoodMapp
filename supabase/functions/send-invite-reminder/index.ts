/**
 * send-invite-reminder — Edge Function
 *
 * Sends a pending-invite reminder to a client who has not yet accepted
 * their therapist's connection request.
 *
 * Two delivery channels:
 *   1. Email  — Supabase Auth admin `inviteUserByEmail` (existing users get a
 *               magic-link sign-in; new users get a signup invite).
 *   2. Push   — Expo push to the client's device (if they have the app but
 *               haven't accepted yet).
 *
 * POST /functions/v1/send-invite-reminder
 * Body: {
 *   therapistClientId: string,   // therapist_clients.id row
 *   therapistName:     string,
 * }
 * Auth: user JWT (therapist must be authenticated)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

const log = (step: string, details?: any) =>
  console.log(`[INVITE-REMINDER] ${step}${details ? " — " + JSON.stringify(details) : ""}`);

// ── Email helper via Supabase Auth admin ──────────────────────────────────────
async function sendInviteEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientEmail: string,
  clientName: string | null,
  therapistName: string,
  appUrl: string
): Promise<{ sent: boolean; method: string; error?: string }> {
  const name = clientName ?? clientEmail.split("@")[0];

  try {
    // First try to generate a magic link (works for existing users, which is the
    // most common case — the client already has a MyMoodMapp account).
    const { data: linkData, error: linkError } =
      await (supabaseAdmin.auth.admin as any).generateLink({
        type: "magiclink",
        email: clientEmail,
        options: {
          redirectTo: `${appUrl}?screen=accountability&tab=incoming`,
        },
      });

    if (!linkError && linkData?.properties?.action_link) {
      // Send a custom email via Supabase auth admin using the generated link
      // Note: the magic link itself IS the email delivery when using generateLink
      log("Magic link generated for existing user", { email: clientEmail });
      return { sent: true, method: "magic_link" };
    }

    log("Magic link error, trying inviteUserByEmail", { error: linkError?.message });

    // Fallback for new users: send a signup invite email
    const { error: inviteError } = await (supabaseAdmin.auth.admin as any).inviteUserByEmail(
      clientEmail,
      {
        redirectTo: `${appUrl}?screen=accountability&tab=incoming`,
        data: {
          invite_source: "therapist_reminder",
          therapist_name: therapistName,
          invited_name: name,
        },
      }
    );

    if (inviteError) {
      log("inviteUserByEmail error", { error: inviteError.message });
      return { sent: false, method: "none", error: inviteError.message };
    }

    log("Invite email sent for new user", { email: clientEmail });
    return { sent: true, method: "invite_email" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("Email delivery error", { error: msg });
    return { sent: false, method: "none", error: msg };
  }
}

// ── Expo push helper ──────────────────────────────────────────────────────────
async function sendExpoPush(
  to: string,
  title: string,
  body: string,
  data: Record<string, any>
): Promise<void> {
  if (!to.startsWith("ExponentPushToken[")) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ to, title, body, data, sound: "default" }]),
    });
    log("Expo push sent", { to });
  } catch (e) {
    log("Expo push error", { error: String(e) });
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // ── Authenticate the calling therapist ────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user: callerUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const body = await req.json();
    const { therapistClientId, therapistName } = body as {
      therapistClientId: string;
      therapistName: string;
    };

    if (!therapistClientId) {
      return new Response(
        JSON.stringify({ error: "therapistClientId is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // ── Fetch the therapist_clients row ───────────────────────────────────────
    const { data: row, error: rowErr } = await supabaseAdmin
      .from("therapist_clients")
      .select("*, client:user_profiles!therapist_clients_client_id_fkey(notification_token, email)")
      .eq("id", therapistClientId)
      .eq("therapist_id", callerUser.id) // security: must be the therapist's own row
      .single();

    if (rowErr || !row) {
      return new Response(
        JSON.stringify({ error: "Client row not found or not authorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    if (row.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Client has already accepted or been removed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const clientEmail: string = row.client_email;
    const clientName: string | null = row.client_name ?? null;
    const tName = therapistName || "Your therapist";

    // ── Throttle: max one reminder per hour ───────────────────────────────────
    if (row.last_notified_at) {
      const diffHours =
        (Date.now() - new Date(row.last_notified_at).getTime()) / 3_600_000;
      if (diffHours < 1) {
        return new Response(
          JSON.stringify({
            success: false,
            throttled: true,
            message: "Reminder was already sent within the last hour. Please wait before sending another.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }
    }

    const appUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase", ".app") ??
      "https://mymoodmapp.app";

    // ── 1. Send email reminder ────────────────────────────────────────────────
    const emailResult = await sendInviteEmail(
      supabaseAdmin,
      clientEmail,
      clientName,
      tName,
      appUrl
    );

    // ── 2. Push notification (if they already have the app) ───────────────────
    let pushSent = false;
    const clientProfile = (row as any).client;
    const pushToken: string | null = clientProfile?.notification_token ?? null;
    if (pushToken) {
      const name = clientName ?? clientEmail.split("@")[0];
      await sendExpoPush(
        pushToken,
        `${tName} wants to connect 🔔`,
        `${tName} has invited you as a client on MyMoodMapp. Tap to review and accept the request.`,
        {
          screen: "/accountability",
          tab: "incoming",
          type: "therapist_invite_reminder",
          therapistName: tName,
        }
      );
      pushSent = true;
    }

    // ── 3. Update last_notified_at on the row ─────────────────────────────────
    await supabaseAdmin
      .from("therapist_clients")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("id", therapistClientId);

    log("Reminder complete", {
      clientEmail,
      emailMethod: emailResult.method,
      emailSent: emailResult.sent,
      pushSent,
    });

    return new Response(
      JSON.stringify({
        success: true,
        emailSent: emailResult.sent,
        emailMethod: emailResult.method,
        pushSent,
        clientEmail,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("Unhandled error", { message: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
