/**
 * Stripe subscription service
 * Handles checkout, subscription checks, and customer portal.
 */

import { getSupabaseClient } from '@/template';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { FunctionsHttpError } from '@supabase/supabase-js';

// Product/price IDs
export const SUBSCRIPTION_PLANS = {
  pro: {
    priceId: 'price_1TSgFzGlgVGOe4h7riJt7as1',
    productId: 'prod_URZOYtZGtX4wpE',
    name: 'Pro',
    price: '$3.99/mo',
    description: 'Individual',
  },
  therapist_pro: {
    priceId: 'price_1TSgG6GlgVGOe4h753sG8r11',
    productId: 'prod_URZO12L9oGdpQQ',
    name: 'Therapist Pro',
    price: '$9.99/mo',
    description: 'Unlimited clients',
  },
} as const;

export type SubscriptionTier = 'free' | 'pro' | 'therapist_pro';

export interface SubscriptionStatus {
  subscribed: boolean;
  tier: SubscriptionTier;
  productId: string | null;
  subscriptionEnd: string | null;
}

async function invokeFn(fnName: string, body?: object): Promise<any> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const text = await error.context?.text();
        msg = text || msg;
      } catch {}
    }
    throw new Error(msg);
  }
  return data;
}

export async function checkSubscription(): Promise<SubscriptionStatus> {
  try {
    const data = await invokeFn('check-subscription');
    return {
      subscribed: data.subscribed ?? false,
      tier: data.tier ?? 'free',
      productId: data.product_id ?? null,
      subscriptionEnd: data.subscription_end ?? null,
    };
  } catch {
    return { subscribed: false, tier: 'free', productId: null, subscriptionEnd: null };
  }
}

export async function startCheckout(priceId: string): Promise<{ error?: string }> {
  try {
    const data = await invokeFn('create-checkout', { price_id: priceId });
    if (!data?.url) return { error: 'No checkout URL returned.' };
    await WebBrowser.openBrowserAsync(data.url);
    return {};
  } catch (e: any) {
    return { error: e.message ?? 'Checkout failed.' };
  }
}

export async function openCustomerPortal(): Promise<{ error?: string }> {
  try {
    const data = await invokeFn('customer-portal');
    if (!data?.url) return { error: 'No portal URL returned.' };
    await WebBrowser.openBrowserAsync(data.url);
    return {};
  } catch (e: any) {
    return { error: e.message ?? 'Could not open billing portal.' };
  }
}
