// revenuecat.ts
// Web-safe base version — all methods are no-ops.
// On native, revenuecat.native.ts is automatically selected instead.
// This file contains ZERO native package imports.

import type { SubscriptionTier } from './subscription';

export interface RCPackage {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    title: string;
    description: string;
    priceString: string;
    introductoryPrice?: {
      priceString: string;
      periodNumberOfUnits: number;
      periodUnit: string;
    } | null;
  };
  offeringIdentifier: string;
}

export interface RCSubscriptionStatus {
  isActive: boolean;
  tier: SubscriptionTier;
  expirationDate: string | null;
  entitlementIdentifier: string | null;
}

export async function initRevenueCat(_userId?: string): Promise<boolean> {
  return false;
}

export async function getRevenueCatSubscription(): Promise<RCSubscriptionStatus> {
  return { isActive: false, tier: 'free', expirationDate: null, entitlementIdentifier: null };
}

export async function getRevenueCatOfferings(): Promise<{
  pro: RCPackage | null;
  therapistPro: RCPackage | null;
}> {
  return { pro: null, therapistPro: null };
}

export async function purchaseRevenueCat(_pkg: RCPackage): Promise<{
  success: boolean;
  tier: SubscriptionTier;
  error?: string;
}> {
  return { success: false, tier: 'free', error: 'Not supported on web. Use Stripe checkout.' };
}

export async function restoreRevenueCatPurchases(): Promise<{
  restored: boolean;
  tier: SubscriptionTier;
  error?: string;
}> {
  return { restored: false, tier: 'free', error: 'Not supported on web.' };
}

export async function logoutRevenueCat(): Promise<void> {
  // No-op
}
