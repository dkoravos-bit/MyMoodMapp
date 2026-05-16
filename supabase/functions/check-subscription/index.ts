import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Map Stripe product IDs to subscription tiers
const PRODUCT_TIER_MAP: Record<string, string> = {
  "prod_URZOYtZGtX4wpE": "pro",
  "prod_URZO12L9oGdpQQ": "therapist_pro",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization header not provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email unavailable");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // First check local subscriptions table for fast lookup
    const { data: localSub } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Check if user has an admin-granted tier (not backed by Stripe) — don't overwrite it.
    // An admin-granted account has subscription_status = 'active' but no stripe_subscription_id.
    const { data: profileCheck } = await supabaseClient
      .from("user_profiles")
      .select("subscription_tier, subscription_status, stripe_subscription_id")
      .eq("id", user.id)
      .single();
    const hasAdminGrant =
      profileCheck?.subscription_status === "active" &&
      !profileCheck?.stripe_subscription_id &&
      profileCheck?.subscription_tier !== "free";
    if (hasAdminGrant) {
      logStep("Admin-granted tier detected, skipping Stripe sync", { tier: profileCheck!.subscription_tier });
      return new Response(JSON.stringify({
        subscribed: true,
        tier: profileCheck!.subscription_tier,
        product_id: null,
        subscription_end: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      // Sync to user_profiles
      await supabaseClient
        .from("user_profiles")
        .update({ subscription_tier: "free", subscription_status: "inactive" })
        .eq("id", user.id);
      return new Response(JSON.stringify({ subscribed: false, tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Stripe customer found", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 5,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let productId: string | null = null;
    let subscriptionEnd: string | null = null;
    let tier = "free";

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      const periodEnd = (subscription as any).current_period_end ||
        subscription.items.data[0]?.current_period_end;
      subscriptionEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
      productId = subscription.items.data[0].price.product as string;
      tier = PRODUCT_TIER_MAP[productId] ?? "pro";
      logStep("Active subscription found", { productId, tier, subscriptionEnd });

      // Sync to subscriptions table
      await supabaseClient.from("subscriptions").upsert({
        user_id: user.id,
        user_email: user.email,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_product_id: productId,
        status: subscription.status,
        current_period_end: subscriptionEnd,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      // Sync to user_profiles
      await supabaseClient
        .from("user_profiles")
        .update({
          subscription_tier: tier,
          subscription_status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
        })
        .eq("id", user.id);
    } else {
      logStep("No active subscription");
      // Sync to user_profiles
      await supabaseClient
        .from("user_profiles")
        .update({ subscription_tier: "free", subscription_status: "inactive" })
        .eq("id", user.id);
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      tier,
      product_id: productId,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
