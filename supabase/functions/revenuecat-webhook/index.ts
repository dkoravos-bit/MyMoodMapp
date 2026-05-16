/**
 * RevenueCat Webhook Handler
 *
 * Syncs IAP subscription state (iOS / Android) into Supabase,
 * mirroring the same schema used by the Stripe webhook.
 *
 * Supported events:
 *   INITIAL_PURCHASE, RENEWAL, NON_RENEWING_PURCHASE
 *   CANCELLATION, EXPIRATION, BILLING_ISSUE
 *   SUBSCRIBER_ALIAS, PRODUCT_CHANGE
 *
 * RevenueCat dashboard → Integrations → Webhooks → set URL to:
 *   https://<project>.backend.onspace.ai/functions/v1/revenuecat-webhook
 *
 * Optional: set Authorization header value as REVENUECAT_WEBHOOK_AUTH_HEADER secret.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RC-WEBHOOK] ${step}${d}`);
};

// Map RevenueCat product identifiers → subscription tiers.
// Add your actual product IDs from App Store Connect / Google Play here.
const PRODUCT_TIER_MAP: Record<string, string> = {
  // iOS
  "com.mymoodmapp.pro.monthly": "pro",
  "com.mymoodmapp.therapist_pro.monthly": "therapist_pro",
  // Android
  "mymoodmapp_pro_monthly": "pro",
  "mymoodmapp_therapist_pro_monthly": "therapist_pro",
  // Fallback patterns (matched by includes)
  "therapist": "therapist_pro",
};

function tierFromProductId(productId: string): string {
  if (!productId) return "pro";
  if (PRODUCT_TIER_MAP[productId]) return PRODUCT_TIER_MAP[productId];
  if (productId.toLowerCase().includes("therapist")) return "therapist_pro";
  return "pro"; // default for any other paid product
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    // ── Optional webhook auth header validation ─────────────────────────────
    const expectedAuth = Deno.env.get("REVENUECAT_WEBHOOK_AUTH_HEADER");
    if (expectedAuth) {
      const incoming = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
      if (incoming !== expectedAuth) {
        logStep("ERROR", { message: "Invalid auth header" });
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
    }

    const body = await req.json();
    logStep("Event received", { type: body.event?.type, app_user_id: body.event?.app_user_id });

    const event = body.event;
    if (!event) {
      return new Response(JSON.stringify({ error: "No event in body" }), { status: 400 });
    }

    const eventType: string = event.type ?? "";
    const appUserId: string = event.app_user_id ?? ""; // Supabase user ID (set via logIn)
    const productId: string = event.product_id ?? event.entitlement_id ?? "";
    const expiresAt: number | null = event.expiration_at_ms ?? null;

    // ── Resolve user profile by RevenueCat app_user_id (= Supabase user id) ─
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, email")
      .eq("id", appUserId)
      .maybeSingle();

    if (!profile) {
      logStep("User profile not found", { appUserId });
      // Return 200 so RevenueCat doesn't keep retrying for unknown users
      return new Response(JSON.stringify({ received: true, skipped: "user_not_found" }), { status: 200 });
    }

    const userId = profile.id;
    const expirationDate = expiresAt ? new Date(expiresAt).toISOString() : null;

    switch (eventType) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "NON_RENEWING_PURCHASE":
      case "PRODUCT_CHANGE": {
        const tier = tierFromProductId(productId);
        logStep("Activating subscription", { userId, tier, productId });

        await supabase.from("subscriptions").upsert({
          user_id: userId,
          user_email: profile.email,
          stripe_customer_id: `rc_${appUserId}`, // prefix to distinguish from Stripe
          stripe_subscription_id: event.original_transaction_id ?? event.transaction_id ?? null,
          stripe_product_id: productId,
          status: "active",
          current_period_end: expirationDate,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        await supabase.from("user_profiles").update({
          subscription_tier: tier,
          subscription_status: "active",
          stripe_customer_id: `rc_${appUserId}`,
          stripe_subscription_id: event.original_transaction_id ?? null,
        }).eq("id", userId);

        logStep("Subscription activated", { userId, tier });
        break;
      }

      case "CANCELLATION":
      case "EXPIRATION":
      case "BILLING_ISSUE": {
        logStep("Deactivating subscription", { userId, eventType });

        await supabase.from("subscriptions").upsert({
          user_id: userId,
          user_email: profile.email,
          stripe_customer_id: `rc_${appUserId}`,
          status: eventType === "BILLING_ISSUE" ? "past_due" : "canceled",
          current_period_end: expirationDate,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        await supabase.from("user_profiles").update({
          subscription_tier: "free",
          subscription_status: eventType === "BILLING_ISSUE" ? "past_due" : "inactive",
        }).eq("id", userId);

        logStep("Subscription deactivated", { userId });
        break;
      }

      default:
        logStep("Unhandled event type", { eventType });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
