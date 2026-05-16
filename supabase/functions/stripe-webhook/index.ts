import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Map Stripe product IDs to subscription tiers
const PRODUCT_TIER_MAP: Record<string, string> = {
  "prod_URZOYtZGtX4wpE": "pro",
  "prod_URZO12L9oGdpQQ": "therapist_pro",
};

async function syncSubscription(
  customerEmail: string,
  customerId: string,
  subscription: Stripe.Subscription,
  overrideStatus?: string
) {
  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", customerEmail)
    .single();

  if (!userProfile) {
    logStep("User profile not found", { customerEmail });
    return;
  }

  const periodEnd = (subscription as any).current_period_end ||
    subscription.items.data[0]?.current_period_end;

  const productId = subscription.items.data[0]?.price.product as string;
  const status = overrideStatus ?? subscription.status;
  const tier = status === "active" ? (PRODUCT_TIER_MAP[productId] ?? "pro") : "free";

  await supabase.from("subscriptions").upsert({
    user_id: userProfile.id,
    user_email: customerEmail,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_product_id: productId,
    status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  // Update user_profiles subscription tier
  await supabase.from("user_profiles").update({
    subscription_tier: tier,
    subscription_status: status,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
  }).eq("id", userProfile.id);

  logStep("Subscription synced", { userId: userProfile.id, tier, status });
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    logStep("ERROR", { message: "No Stripe signature" });
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    logStep("Event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { sessionId: session.id, email: session.customer_email });

        if (session.mode === "subscription" && session.subscription && session.customer_email) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          await syncSubscription(
            session.customer_email,
            session.customer as string,
            subscription
          );
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep(`Subscription ${event.type.split(".")[2]}`, { subscriptionId: subscription.id });

        const customer = await stripe.customers.retrieve(subscription.customer as string);
        const customerEmail = "email" in customer ? customer.email : null;
        if (customerEmail) {
          await syncSubscription(customerEmail, subscription.customer as string, subscription);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice paid", { invoiceId: invoice.id, email: invoice.customer_email });

        if (invoice.subscription && invoice.customer_email) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await syncSubscription(
            invoice.customer_email,
            invoice.customer as string,
            subscription
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });

        const customer = await stripe.customers.retrieve(subscription.customer as string);
        const customerEmail = "email" in customer ? customer.email : null;
        if (customerEmail) {
          await syncSubscription(
            customerEmail,
            subscription.customer as string,
            subscription,
            "canceled"
          );
        }
        break;
      }

      default:
        logStep("Unhandled event", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
