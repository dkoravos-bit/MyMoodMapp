// revenuecat.native.ts
// Native version (iOS + Android) — uses react-native-purchases for IAP.
// Metro/Expo automatically selects this file over revenuecat.ts on native.
// On web, revenuecat.ts (web-safe stub) is used instead.
// @ts-nocheck
/**
 * RevenueCat service — handles native IAP on iOS and Android.
 *
 * Entitlement identifiers (must match RevenueCat dashboard exactly):
 *   "pro"            → Pro tier ($3.99/mo)
 *   "therapist_pro"  → Therapist Pro tier ($9.99/mo)
 */

import { Platform } from 'react-native';
import type { SubscriptionTier } from './subscription';

// react-native-purchases — safe to import here because this file is ONLY
// bundled on native platforms (Metro picks .native.ts over .ts on iOS/Android).
let _Purchases: any = null;
function getPurchases(): any {
  if (_Purchases) return _Purchases;
  try {
    _Purchases = require('react-native-purchases').default;
  } catch {
    _Purchases = null;
  }
  return _Purchases;
}

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

export interface RCOffering {
  identifier: string;
  availablePackages: RCPackage[];
  monthly: RCPackage | null;
}

export interface RCSubscriptionStatus {
  isActive: boolean;
  tier: SubscriptionTier;
  expirationDate: string | null;
  entitlementIdentifier: string | null;
}

const RC_API_KEY_IOS     = 'appl_REPLACE_WITH_YOUR_IOS_PUBLIC_KEY';
const RC_API_KEY_ANDROID = 'goog_REPLACE_WITH_YOUR_ANDROID_PUBLIC_KEY';

const PRO_ENTITLEMENT_ID           = 'pro';
const THERAPIST_PRO_ENTITLEMENT_ID = 'therapist_pro';

let _initialized = false;

export async function initRevenueCat(userId?: string): Promise<boolean> {
  if (_initialized) {
    if (userId) {
      try {
        const Purchases = getPurchases();
        if (Purchases) await Purchases.logIn(userId);
      } catch {}
    }
    return true;
  }
  try {
    const Purchases = getPurchases();
    if (!Purchases) return false;
    const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
    // 3-second delay prevents native bridge crash on iOS 26
    await new Promise(resolve => setTimeout(resolve, 3000));
    await Purchases.configure({ apiKey, appUserID: userId ?? null });
    _initialized = true;
    if (userId) { try { await Purchases.logIn(userId); } catch {} }
    return true;
  } catch (e) {
    console.warn('[RevenueCat] init error:', e);
    return false;
  }
}

export async function getRevenueCatSubscription(): Promise<RCSubscriptionStatus> {
  const empty: RCSubscriptionStatus = { isActive: false, tier: 'free', expirationDate: null, entitlementIdentifier: null };
  try {
    const Purchases = getPurchases();
    if (!Purchases) return empty;
    const info = await Purchases.getCustomerInfo();
    const therapistEnt = info.entitlements.active[THERAPIST_PRO_ENTITLEMENT_ID];
    if (therapistEnt) return { isActive: true, tier: 'therapist_pro', expirationDate: therapistEnt.expirationDate ?? null, entitlementIdentifier: THERAPIST_PRO_ENTITLEMENT_ID };
    const proEnt = info.entitlements.active[PRO_ENTITLEMENT_ID];
    if (proEnt) return { isActive: true, tier: 'pro', expirationDate: proEnt.expirationDate ?? null, entitlementIdentifier: PRO_ENTITLEMENT_ID };
    return empty;
  } catch (e) {
    console.warn('[RevenueCat] getCustomerInfo error:', e);
    return empty;
  }
}

export async function getRevenueCatOfferings(): Promise<{ pro: RCPackage | null; therapistPro: RCPackage | null }> {
  try {
    const Purchases = getPurchases();
    if (!Purchases) return { pro: null, therapistPro: null };
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return { pro: null, therapistPro: null };
    let pro: RCPackage | null = null;
    let therapistPro: RCPackage | null = null;
    for (const pkg of current.availablePackages) {
      const id = (pkg.identifier + pkg.product.identifier).toLowerCase();
      if (id.includes('therapist')) { therapistPro = pkg as unknown as RCPackage; }
      else { pro = pkg as unknown as RCPackage; }
    }
    return { pro, therapistPro };
  } catch (e) {
    console.warn('[RevenueCat] getOfferings error:', e);
    return { pro: null, therapistPro: null };
  }
}

export async function purchaseRevenueCat(pkg: RCPackage): Promise<{ success: boolean; tier: SubscriptionTier; error?: string }> {
  try {
    const Purchases = getPurchases();
    if (!Purchases) return { success: false, tier: 'free', error: 'Not available.' };
    const { customerInfo } = await Purchases.purchasePackage(pkg as any);
    const therapistEnt = customerInfo.entitlements.active[THERAPIST_PRO_ENTITLEMENT_ID];
    const proEnt       = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
    const tier: SubscriptionTier = therapistEnt ? 'therapist_pro' : proEnt ? 'pro' : 'free';
    return { success: tier !== 'free', tier };
  } catch (e: any) {
    if (e?.userCancelled === true || e?.code === '1') return { success: false, tier: 'free' };
    console.warn('[RevenueCat] purchase error:', e);
    return { success: false, tier: 'free', error: e?.message ?? 'Purchase failed.' };
  }
}

export async function restoreRevenueCatPurchases(): Promise<{ restored: boolean; tier: SubscriptionTier; error?: string }> {
  try {
    const Purchases = getPurchases();
    if (!Purchases) return { restored: false, tier: 'free' };
    const info = await Purchases.restorePurchases();
    const therapistEnt = info.entitlements.active[THERAPIST_PRO_ENTITLEMENT_ID];
    const proEnt       = info.entitlements.active[PRO_ENTITLEMENT_ID];
    const tier: SubscriptionTier = therapistEnt ? 'therapist_pro' : proEnt ? 'pro' : 'free';
    return { restored: tier !== 'free', tier };
  } catch (e: any) {
    console.warn('[RevenueCat] restore error:', e);
    return { restored: false, tier: 'free', error: e?.message ?? 'Restore failed.' };
  }
}

export async function logoutRevenueCat(): Promise<void> {
  if (!_initialized) return;
  try {
    const Purchases = getPurchases();
    if (!Purchases) return;
    await Purchases.logOut();
  } catch {}
}
