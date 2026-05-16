// @ts-nocheck
/**
 * RevenueCat service — handles native IAP on iOS and Android.
 *
 * On web, all methods are no-ops that return null/false so the app
 * gracefully falls back to the Stripe checkout flow.
 *
 * Entitlement identifiers (must match RevenueCat dashboard exactly):
 *   "pro"            → Pro tier ($3.99/mo)
 *   "therapist_pro"  → Therapist Pro tier ($9.99/mo)
 */

import { Platform } from 'react-native';
import type { SubscriptionTier } from './subscription';

// react-native-purchases is native-only. Lazily require via Platform guard.
// Using require() instead of await import() so Metro can statically shim it.
let _Purchases: any = null;
function getPurchases(): any {
  if (Platform.OS === 'web') return null;
  if (_Purchases) return _Purchases;
  try {
    _Purchases = require('react-native-purchases').default;
  } catch {
    _Purchases = null;
  }
  return _Purchases;
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

// Public (not secret) API keys from RevenueCat dashboard.
// These are safe to embed in client code — they have read-only entitlement access.
const RC_API_KEY_IOS     = 'appl_REPLACE_WITH_YOUR_IOS_PUBLIC_KEY';
const RC_API_KEY_ANDROID = 'goog_REPLACE_WITH_YOUR_ANDROID_PUBLIC_KEY';

const PRO_ENTITLEMENT_ID          = 'pro';
const THERAPIST_PRO_ENTITLEMENT_ID = 'therapist_pro';

let _initialized = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Lazily import and configure the RevenueCat SDK (native only).
 * Safe to call multiple times — configures only once.
 */
export async function initRevenueCat(userId?: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (_initialized) {
    // If a userId is provided after initial configure, log in.
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

    // Delay configure by 3 seconds after mount — prevents native bridge crash
    // on iOS 26 where Purchases.configure() during early startup throws ObjC exception
    await new Promise(resolve => setTimeout(resolve, 3000));
    if (Platform.OS === 'web') return false;

    await Purchases.configure({ apiKey, appUserID: userId ?? null });
    _initialized = true;

    // Keep RevenueCat user in sync with Supabase auth user
    if (userId) {
      try { await Purchases.logIn(userId); } catch {}
    }

    return true;
  } catch (e) {
    console.warn('[RevenueCat] init error:', e);
    return false;
  }
}

/**
 * Check the current user's active RevenueCat entitlements.
 * Returns { isActive: false, tier: 'free', ... } on error or web.
 */
export async function getRevenueCatSubscription(): Promise<RCSubscriptionStatus> {
  const empty: RCSubscriptionStatus = { isActive: false, tier: 'free', expirationDate: null, entitlementIdentifier: null };
  if (Platform.OS === 'web') return empty;

  try {
    const Purchases = getPurchases();
    if (!Purchases) return empty;
    const info = await Purchases.getCustomerInfo();

    // Check therapist_pro first (more privileged)
    const therapistEnt = info.entitlements.active[THERAPIST_PRO_ENTITLEMENT_ID];
    if (therapistEnt) {
      return {
        isActive: true,
        tier: 'therapist_pro',
        expirationDate: therapistEnt.expirationDate ?? null,
        entitlementIdentifier: THERAPIST_PRO_ENTITLEMENT_ID,
      };
    }

    const proEnt = info.entitlements.active[PRO_ENTITLEMENT_ID];
    if (proEnt) {
      return {
        isActive: true,
        tier: 'pro',
        expirationDate: proEnt.expirationDate ?? null,
        entitlementIdentifier: PRO_ENTITLEMENT_ID,
      };
    }

    return empty;
  } catch (e) {
    console.warn('[RevenueCat] getCustomerInfo error:', e);
    return empty;
  }
}

/**
 * Fetch the RevenueCat "default" offering packages for display in the paywall.
 */
export async function getRevenueCatOfferings(): Promise<{
  pro: RCPackage | null;
  therapistPro: RCPackage | null;
}> {
  if (Platform.OS === 'web') return { pro: null, therapistPro: null };

  try {
    const Purchases = getPurchases();
    if (!Purchases) return { pro: null, therapistPro: null };
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return { pro: null, therapistPro: null };

    // Match packages by entitlement/product identifier convention.
    // Packages whose identifier contains "therapist" → Therapist Pro.
    // The rest → Pro.
    let pro: RCPackage | null = null;
    let therapistPro: RCPackage | null = null;

    for (const pkg of current.availablePackages) {
      const id = (pkg.identifier + pkg.product.identifier).toLowerCase();
      if (id.includes('therapist')) {
        therapistPro = pkg as unknown as RCPackage;
      } else {
        pro = pkg as unknown as RCPackage;
      }
    }

    return { pro, therapistPro };
  } catch (e) {
    console.warn('[RevenueCat] getOfferings error:', e);
    return { pro: null, therapistPro: null };
  }
}

/**
 * Purchase a RevenueCat package.
 * Returns { success, tier, error }.
 */
export async function purchaseRevenueCat(pkg: RCPackage): Promise<{
  success: boolean;
  tier: SubscriptionTier;
  error?: string;
}> {
  if (Platform.OS === 'web') return { success: false, tier: 'free', error: 'Not supported on web.' };

  try {
    const Purchases = getPurchases();
    if (!Purchases) return { success: false, tier: 'free', error: 'Not supported on web.' };
    const { customerInfo } = await Purchases.purchasePackage(pkg as any);

    const therapistEnt = customerInfo.entitlements.active[THERAPIST_PRO_ENTITLEMENT_ID];
    const proEnt       = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];

    const tier: SubscriptionTier = therapistEnt ? 'therapist_pro' : proEnt ? 'pro' : 'free';
    return { success: tier !== 'free', tier };
  } catch (e: any) {
    // USER_CANCELLED — don't treat as error
    if (e?.userCancelled === true || e?.code === '1') {
      return { success: false, tier: 'free' };
    }
    console.warn('[RevenueCat] purchase error:', e);
    return { success: false, tier: 'free', error: e?.message ?? 'Purchase failed.' };
  }
}

/**
 * Restore previous purchases (required by App Store guidelines).
 */
export async function restoreRevenueCatPurchases(): Promise<{
  restored: boolean;
  tier: SubscriptionTier;
  error?: string;
}> {
  if (Platform.OS === 'web') return { restored: false, tier: 'free' };

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

/**
 * Log out current RevenueCat user (call on Supabase sign-out).
 */
export async function logoutRevenueCat(): Promise<void> {
  if (Platform.OS === 'web' || !_initialized) return;
  try {
    const Purchases = getPurchases();
    if (!Purchases) return;
    await Purchases.logOut();
  } catch {}
}
