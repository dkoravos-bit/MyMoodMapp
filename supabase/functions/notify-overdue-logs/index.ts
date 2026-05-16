/**
 * notify-overdue-logs — Edge Function
 *
 * Scans accountability_buddies and therapist_clients for users who
 * haven't logged within their notify_after_hours window, then sends
 * Expo push notifications to the buddy / therapist.
 *
 * Designed to be called:
 *   - From client on app open (throttled via last_notified_at)
 *   - As a scheduled job if you set one up later
 *
 * POST /functions/v1/notify-overdue-logs
 * Auth: service-role or user JWT (we use service role internally)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const logStep = (step: string, details?: any) => {
  const d = details ? ` — ${JSON.stringify(details)}` : "";
  console.log(`[NOTIFY-OVERDUE] ${step}${d}`);
};

// ── Expo push helper ──────────────────────────────────────────────────────────
async function sendExpoPush(messages: {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}[]): Promise<void> {
  if (messages.length === 0) return;

  // Expo accepts up to 100 messages per batch
  const BATCH = 100;
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(batch),
      });
      const result = await res.json();
      logStep("Expo push batch sent", { count: batch.length, status: res.status, result });
    } catch (e) {
      logStep("Expo push batch error", { error: String(e) });
    }
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const now = new Date();
    const messages: { to: string; title: string; body: string; data?: Record<string, any> }[] = [];

    // ── 1. Accountability buddies ─────────────────────────────────────────────
    const { data: buddyRows, error: buddyErr } = await supabase
      .from("accountability_buddies")
      .select(`
        id,
        notify_after_hours,
        notifications_enabled,
        last_notified_at,
        buddy_name,
        user_id,
        buddy_id,
        user:user_profiles!accountability_buddies_user_id_fkey(
          id, email, display_name, last_logged_at, notification_token
        ),
        buddy:user_profiles!accountability_buddies_buddy_id_fkey(
          id, email, display_name, notification_token
        )
      `)
      .eq("status", "active")
      .eq("notifications_enabled", true)
      .not("buddy_id", "is", null);

    if (buddyErr) {
      logStep("Error fetching buddies", { error: buddyErr.message });
    } else {
      logStep("Buddy rows fetched", { count: buddyRows?.length ?? 0 });

      for (const row of (buddyRows ?? [])) {
        const user = (row as any).user;
        const buddy = (row as any).buddy;

        if (!user || !buddy) continue;

        const buddyToken: string | null = buddy.notification_token;
        if (!buddyToken || !buddyToken.startsWith("ExponentPushToken[")) continue;

        // Check if user hasn't logged within notify_after_hours
        const windowMs = (row.notify_after_hours ?? 24) * 60 * 60 * 1000;
        const lastLogged = user.last_logged_at ? new Date(user.last_logged_at).getTime() : 0;
        const hoursSinceLog = (now.getTime() - lastLogged) / (1000 * 60 * 60);

        if (hoursSinceLog < row.notify_after_hours) continue; // still within window

        // Throttle: don't notify the buddy more than once per window
        const lastNotified = row.last_notified_at ? new Date(row.last_notified_at).getTime() : 0;
        const hoursSinceNotify = (now.getTime() - lastNotified) / (1000 * 60 * 60);

        if (lastNotified > 0 && hoursSinceNotify < row.notify_after_hours) continue; // already notified

        const userName = user.display_name ?? user.email?.split("@")[0] ?? "Your buddy";
        const hoursLabel = Math.round(hoursSinceLog);

        messages.push({
          to: buddyToken,
          title: `${userName} hasn't logged today 👋`,
          body: `It's been ${hoursLabel}h since their last mood check-in. Send them some encouragement!`,
          data: { screen: "/(tabs)/profile", type: "buddy_overdue", userId: user.id },
        });

        // Update last_notified_at
        await supabase
          .from("accountability_buddies")
          .update({ last_notified_at: now.toISOString() })
          .eq("id", row.id);

        logStep("Buddy notification queued", {
          userId: user.id,
          buddyId: buddy.id,
          hoursSinceLog: hoursLabel,
        });
      }
    }

    // ── 2. Therapist clients ──────────────────────────────────────────────────
    const { data: clientRows, error: clientErr } = await supabase
      .from("therapist_clients")
      .select(`
        id,
        notify_after_hours,
        notifications_enabled,
        last_notified_at,
        client_name,
        client_id,
        therapist_id,
        therapist:user_profiles!therapist_clients_therapist_id_fkey(
          id, email, display_name, notification_token
        ),
        client:user_profiles!therapist_clients_client_id_fkey(
          id, email, display_name, last_logged_at
        )
      `)
      .eq("status", "active")
      .eq("notifications_enabled", true)
      .not("client_id", "is", null);

    if (clientErr) {
      logStep("Error fetching therapist clients", { error: clientErr.message });
    } else {
      logStep("Therapist client rows fetched", { count: clientRows?.length ?? 0 });

      for (const row of (clientRows ?? [])) {
        const therapist = (row as any).therapist;
        const client = (row as any).client;

        if (!therapist || !client) continue;

        const therapistToken: string | null = therapist.notification_token;
        if (!therapistToken || !therapistToken.startsWith("ExponentPushToken[")) continue;

        // Check overdue window
        const windowHours = row.notify_after_hours ?? 48;
        const lastLogged = client.last_logged_at ? new Date(client.last_logged_at).getTime() : 0;
        const hoursSinceLog = (now.getTime() - lastLogged) / (1000 * 60 * 60);

        if (hoursSinceLog < windowHours) continue;

        // Throttle
        const lastNotified = row.last_notified_at ? new Date(row.last_notified_at).getTime() : 0;
        const hoursSinceNotify = (now.getTime() - lastNotified) / (1000 * 60 * 60);

        if (lastNotified > 0 && hoursSinceNotify < windowHours) continue;

        const clientName = row.client_name ?? client.display_name ?? client.email?.split("@")[0] ?? "A client";
        const hoursLabel = Math.round(hoursSinceLog);

        messages.push({
          to: therapistToken,
          title: `${clientName} hasn't logged in ${hoursLabel}h`,
          body: `${clientName} hasn't checked in on MyMoodMap. You may want to follow up.`,
          data: {
            screen: "/therapist-dashboard",
            type: "client_overdue",
            clientId: client.id,
          },
        });

        // Update last_notified_at
        await supabase
          .from("therapist_clients")
          .update({ last_notified_at: now.toISOString() })
          .eq("id", row.id);

        logStep("Therapist notification queued", {
          therapistId: therapist.id,
          clientId: client.id,
          hoursSinceLog: hoursLabel,
        });
      }
    }

    // ── 3. Send all queued push notifications ─────────────────────────────────
    logStep("Sending push notifications", { total: messages.length });
    await sendExpoPush(messages);

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent: messages.length,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("Unhandled error", { message: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
