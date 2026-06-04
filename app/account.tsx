/**
 * MyMoodMapp — Account Screen
 * Shows subscription status, upgrade options, and manage/cancel links.
 * iOS/Android: RevenueCat IAP ONLY — Stripe checkout is web-only (App Store rule 3.1.1)
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/template';
import { useAuth } from '@/template';
import { useApp } from '@/hooks/useApp';
import { DarkColors, Typography, Spacing, Radius, Shadows, getGlass } from '@/constants/theme';
import { isOwnerEmail } from '@/constants/config';
import { startCheckout, openCustomerPortal, SUBSCRIPTION_PLANS } from '@/services/subscription';
import {
  getRevenueCatOfferings,
  purchaseRevenueCat,
  restoreRevenueCatPurchases,
  type RCPackage,
} from '@/services/revenuecat';
import { getSupabaseClient } from '@/template';

function makeStyles(C: typeof DarkColors, isDark = true) {
  const G = getGlass(isDark);
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing['2xl'] },
    backBtn: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: G.btnBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: G.btnBorder },
    headerTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '800', color: C.textPrimary, includeFontPadding: false },

    // Avatar card
    avatarCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: G.cardBorder, alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xl, shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
    avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.primary + '25', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: C.primary + '60' },
    avatarLetter: { fontSize: 28, fontWeight: '900', color: C.primary, includeFontPadding: false },
    avatarName: { fontSize: Typography.fontSizes.xl, fontWeight: '800', color: C.textPrimary, textAlign: 'center', includeFontPadding: false },
    avatarEmail: { fontSize: Typography.fontSizes.sm, color: C.textMuted, textAlign: 'center', includeFontPadding: false },
    avatarTierBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1.5, marginTop: 2 },
    avatarTierText: { fontSize: Typography.fontSizes.sm, fontWeight: '700', includeFontPadding: false },

    // Section
    sectionTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md, includeFontPadding: false },

    // Active plan card
    activePlanCard: { borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1.5, marginBottom: Spacing.xl, ...Shadows.sm, gap: Spacing.md },
    activePlanRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    activePlanIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    activePlanName: { fontSize: Typography.fontSizes.lg, fontWeight: '800', includeFontPadding: false },
    activePlanSub: { fontSize: Typography.fontSizes.xs, includeFontPadding: false },
    activePlanDivider: { height: 1, backgroundColor: C.border },
    renewalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    renewalText: { flex: 1, fontSize: Typography.fontSizes.sm, color: C.textSecondary, includeFontPadding: false },
    renewalDate: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },

    // Manage / cancel button
    manageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: G.btnBg, borderRadius: Radius.lg, paddingVertical: 13, borderWidth: 1.5, borderColor: G.btnBorder },
    manageBtnText: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.lg, paddingVertical: 13, borderWidth: 1, borderColor: C.error + '50' },
    cancelBtnText: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.error, includeFontPadding: false },

    // Upgrade section
    upgradeSection: { marginBottom: Spacing.xl, gap: Spacing.md },
    planCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, borderWidth: 1.5, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 12, elevation: 6 },
    planCardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border },
    planCardIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    planCardName: { fontSize: Typography.fontSizes.lg, fontWeight: '800', includeFontPadding: false },
    planCardPrice: { fontSize: Typography.fontSizes.xs, fontWeight: '600', includeFontPadding: false },
    planCardFeatures: { padding: Spacing.lg, gap: Spacing.sm },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    featureText: { flex: 1, fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: Typography.fontSizes.sm * 1.4, includeFontPadding: false },
    planCta: { margin: Spacing.md, marginTop: 0, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center' },
    planCtaText: { fontSize: Typography.fontSizes.md, fontWeight: '800', color: '#08091A', includeFontPadding: false },
    trialNote: { fontSize: Typography.fontSizes.xs, color: C.textMuted, textAlign: 'center', paddingBottom: Spacing.md, includeFontPadding: false },
    iapDisclosure: { fontSize: 10, color: C.textMuted, textAlign: 'center', lineHeight: 15, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, includeFontPadding: false },

    // Free tier info
    freePlanCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.sm, marginBottom: Spacing.xl },
    freePlanTitle: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    freePlanFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    freePlanFeatureText: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, includeFontPadding: false },

    // Owner badge
    ownerCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.primary + '12', borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1.5, borderColor: C.primary + '40', marginBottom: Spacing.xl },
    ownerCardText: { flex: 1, fontSize: Typography.fontSizes.sm, color: C.textPrimary, lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
    ownerCardSub: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
  });
}

export default function AccountScreen() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const { displayName, subscriptionTier, subscriptionEnd, refreshSubscription } = useApp();

  const [checkingOut, setCheckingOut] = useState(false);
  const [managingPortal, setManagingPortal] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [rcPackages, setRcPackages] = useState<{ pro: RCPackage | null; therapistPro: RCPackage | null }>({ pro: null, therapistPro: null });

  // Load RevenueCat offerings on native only
  useEffect(() => {
    if (Platform.OS === 'web') return;
    getRevenueCatOfferings().then(setRcPackages).catch(() => {});
  }, []);

  const isOwner = isOwnerEmail(user?.email);
  const isPro = subscriptionTier === 'pro';
  const isTherapistPro = subscriptionTier === 'therapist_pro';
  const isActivePaid = (isPro || isTherapistPro) && !isOwner;
  const isFree = subscriptionTier === 'free';

  const nameDisplay = displayName ?? user?.username ?? user?.email?.split('@')[0] ?? 'User';
  const initial = nameDisplay[0]?.toUpperCase() ?? 'U';

  const tierLabel = isOwner
    ? 'Owner'
    : isTherapistPro
    ? 'Therapist Pro'
    : isPro
    ? 'Pro'
    : 'Free';

  const tierColor = isOwner || isTherapistPro ? C.secondary : isPro ? C.primary : C.textMuted;

  // ── Purchase handler — Web: Stripe | Native: RevenueCat IAP ONLY ─────────
  const handleUpgrade = async (priceId: string, planName: string) => {
    if (Platform.OS === 'web') {
      // Web only: Stripe checkout is permitted
      setCheckingOut(true);
      const { error } = await startCheckout(priceId);
      setCheckingOut(false);
      if (error) { showAlert('Checkout failed', error); return; }
      await refreshSubscription();
      return;
    }

    // iOS / Android: Apple/Google IAP via RevenueCat ONLY
    // Stripe checkout must NEVER appear on native (App Store rule 3.1.1)
    setCheckingOut(true);
    try {
      const isTherapistPlan = planName.toLowerCase().includes('therapist');
      let pkg = isTherapistPlan ? rcPackages.therapistPro : rcPackages.pro;

      if (!pkg) {
        const freshPkgs = await getRevenueCatOfferings();
        setRcPackages(freshPkgs);
        pkg = isTherapistPlan ? freshPkgs.therapistPro : freshPkgs.pro;
      }

      if (!pkg) {
        showAlert(
          'Store unavailable',
          'Could not connect to the App Store. Please check your internet connection and try again.',
        );
        return;
      }

      const { success, tier, error } = await purchaseRevenueCat(pkg);
      if (error) { showAlert('Purchase failed', error); return; }
      if (success) {
        await refreshSubscription();
        showAlert('Subscription activated!', 'Your 30-day free trial has started.');
      }
    } finally {
      setCheckingOut(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (Platform.OS === 'web') return;
    setRestoringPurchases(true);
    try {
      const { restored, tier, error } = await restoreRevenueCatPurchases();
      if (error) { showAlert('Restore failed', error); return; }
      if (restored) {
        await refreshSubscription();
        showAlert('Purchases restored!', `Your ${tier === 'therapist_pro' ? 'Therapist Pro' : 'Pro'} subscription has been restored.`);
      } else {
        showAlert('No purchases found', 'No active subscriptions were found for this Apple ID.');
      }
    } finally {
      setRestoringPurchases(false);
    }
  };

  const handleManage = async () => {
    if (Platform.OS !== 'web') {
      // On native, direct users to OS subscription settings — never Stripe portal
      const url = Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
      Linking.openURL(url).catch(() => {});
      return;
    }
    setManagingPortal(true);
    const { error } = await openCustomerPortal();
    setManagingPortal(false);
    if (error) showAlert('Error', error);
    await refreshSubscription();
  };

  const handleCancel = () => {
    const cancelMsg = Platform.OS === 'ios'
      ? 'To cancel, go to Settings → Apple ID → Subscriptions and cancel MyMoodMapp before your next renewal date.'
      : Platform.OS === 'android'
      ? 'To cancel, go to Google Play → Subscriptions and cancel MyMoodMapp before your next renewal date.'
      : 'You can cancel via the billing portal. You will keep access until the end of your current billing period.';

    showAlert(
      'Cancel subscription',
      cancelMsg,
      Platform.OS === 'web'
        ? [
            { text: 'Keep plan', style: 'cancel' },
            { text: 'Open billing portal', style: 'destructive', onPress: handleManage },
          ]
        : [{ text: 'OK', style: 'cancel' }]
    );
  };

  // Listen for Stripe redirect back from checkout (web only)
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('subscription/success')) {
        refreshSubscription();
        showAlert('Subscription activated!', 'Your plan has been upgraded. Enjoy all features.');
      }
    });
    return () => sub.remove();
  }, []);

  const handleDeleteAccount = () => {
    showAlert(
      'Delete account?',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: () => {
            showAlert(
              'Are you sure?',
              'All your mood logs, reports, settings, and subscription data will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const supabase = getSupabaseClient();
                      const { error } = await supabase.functions.invoke('delete-account', { body: {} });
                      if (error) throw error;
                      await supabase.auth.signOut();
                    } catch (e: any) {
                      showAlert(
                        'Account deletion initiated',
                        'Your account has been marked for deletion. All data will be removed within 24 hours. You have been signed out.',
                      );
                      const supabase = getSupabaseClient();
                      await supabase.auth.signOut().catch(() => {});
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="arrow-back" size={20} color={C.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>My Account</Text>
        </View>

        {/* Avatar + identity card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{initial}</Text>
          </View>
          <Text style={styles.avatarName}>{nameDisplay}</Text>
          <Text style={styles.avatarEmail}>{user?.email ?? ''}</Text>
          <View style={[styles.avatarTierBadge, { borderColor: tierColor + '50', backgroundColor: tierColor + '15' }]}>
            {isOwner ? <MaterialIcons name="verified" size={13} color={tierColor} /> :
              isTherapistPro ? <MaterialIcons name="psychology" size={13} color={tierColor} /> :
              isPro ? <MaterialIcons name="star" size={13} color={tierColor} /> :
              <MaterialIcons name="person" size={13} color={tierColor} />}
            <Text style={[styles.avatarTierText, { color: tierColor }]}>{tierLabel}</Text>
          </View>
        </View>

        {/* Owner bypass */}
        {isOwner ? (
          <View style={styles.ownerCard}>
            <MaterialIcons name="verified" size={24} color={C.primary} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.ownerCardText}>Owner account — all features unlocked</Text>
              <Text style={styles.ownerCardSub}>Full Therapist Pro access, no billing required.</Text>
            </View>
          </View>
        ) : null}

        {/* Active paid plan */}
        {isActivePaid ? (
          <>
            <Text style={styles.sectionTitle}>Current plan</Text>
            <View style={[styles.activePlanCard, {
              borderColor: isTherapistPro ? C.secondary + '60' : C.primary + '60',
              backgroundColor: isTherapistPro ? C.secondary + '08' : C.primary + '08',
            }]}>
              <View style={styles.activePlanRow}>
                <View style={[styles.activePlanIconWrap, { backgroundColor: isTherapistPro ? C.secondary + '25' : C.primary + '25' }]}>
                  <MaterialIcons
                    name={isTherapistPro ? 'psychology' : 'star'}
                    size={22}
                    color={isTherapistPro ? C.secondary : C.primary}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.activePlanName, { color: isTherapistPro ? C.secondary : C.primary }]}>
                    {isTherapistPro ? 'Therapist Pro' : 'Pro'}
                  </Text>
                  <Text style={[styles.activePlanSub, { color: isTherapistPro ? C.secondary + 'CC' : C.primary + 'CC' }]}>
                    {isTherapistPro ? '$9.99 / month' : '$3.99 / month'}
                  </Text>
                </View>
                <View style={{ backgroundColor: C.success + '20', borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: C.success + '40' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.success, includeFontPadding: false }}>Active</Text>
                </View>
              </View>

              {subscriptionEnd ? (
                <>
                  <View style={styles.activePlanDivider} />
                  <View style={styles.renewalRow}>
                    <MaterialIcons name="autorenew" size={16} color={C.textMuted} />
                    <Text style={styles.renewalText}>Renews on</Text>
                    <Text style={styles.renewalDate}>
                      {new Date(subscriptionEnd).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                </>
              ) : null}

              <Pressable
                onPress={handleManage}
                disabled={managingPortal}
                style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.75 }]}
              >
                {managingPortal
                  ? <ActivityIndicator size="small" color={C.textPrimary} />
                  : <>
                    <MaterialIcons name="open-in-new" size={16} color={C.textPrimary} />
                    <Text style={styles.manageBtnText}>
                      {Platform.OS === 'ios'
                        ? 'Manage in Settings → Apple ID'
                        : Platform.OS === 'android'
                        ? 'Manage in Google Play'
                        : 'Manage billing & invoices'}
                    </Text>
                  </>}
              </Pressable>

              <Pressable
                onPress={handleCancel}
                disabled={managingPortal}
                style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="cancel" size={16} color={C.error} />
                <Text style={styles.cancelBtnText}>
                  {Platform.OS === 'ios'
                    ? 'Cancel in Settings → Apple ID → Subscriptions'
                    : 'Cancel subscription'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {/* Free plan + upgrade */}
        {isFree && !isOwner ? (
          <>
            <Text style={styles.sectionTitle}>Current plan</Text>
            <View style={styles.freePlanCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <MaterialIcons name="person" size={18} color={C.textMuted} />
                <Text style={styles.freePlanTitle}>Free plan</Text>
              </View>
              {[
                'Unlimited mood logging',
                'Basic check-in history',
                '1 accountability buddy',
                'Dashboard & pattern overview',
              ].map(f => (
                <View key={f} style={styles.freePlanFeatureRow}>
                  <MaterialIcons name="check" size={14} color={C.success} />
                  <Text style={styles.freePlanFeatureText}>{f}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Upgrade your plan</Text>
            <View style={styles.upgradeSection}>

              {/* Pro */}
              <View style={[styles.planCard, { borderColor: C.primary + '50' }]}>
                <View style={[styles.planCardHeader, { backgroundColor: C.primarySoft }]}>
                  <View style={[styles.planCardIconWrap, { backgroundColor: C.primary + '30' }]}>
                    <MaterialIcons name="star" size={20} color={C.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.planCardName, { color: C.primary }]}>Pro</Text>
                    <Text style={[styles.planCardPrice, { color: C.primary + 'CC' }]}>
                      {Platform.OS !== 'web' && rcPackages.pro
                        ? rcPackages.pro.product.priceString + '/mo'
                        : '$3.99/mo'}{' '}· 30-day free trial
                    </Text>
                  </View>
                </View>
                <View style={styles.planCardFeatures}>
                  {[
                    'Unlimited mood history & AI insights',
                    'Export mood data & wellness reports',
                    'Unlimited accountability buddies',
                    'Advanced fitness × mood correlations',
                    'Predictive alerts & deeper pattern reports',
                  ].map(f => (
                    <View key={f} style={styles.featureRow}>
                      <MaterialIcons name="check-circle" size={14} color={C.success} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  onPress={() => handleUpgrade(SUBSCRIPTION_PLANS.pro.priceId, 'Pro')}
                  disabled={checkingOut}
                  style={({ pressed }) => [styles.planCta, { backgroundColor: C.primary }, pressed && { opacity: 0.85 }, checkingOut && { opacity: 0.6 }]}
                >
                  {checkingOut
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.planCtaText}>Start 30-day free trial →</Text>}
                </Pressable>
                {Platform.OS === 'ios' ? (
                  <Text style={styles.iapDisclosure}>
                    {'Free for 30 days, then '}
                    {rcPackages.pro ? rcPackages.pro.product.priceString : '$3.99'}
                    {'/month. Payment charged to your Apple ID at confirmation. Subscription auto-renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel in Settings → Apple ID → Subscriptions.'}
                  </Text>
                ) : (
                  <Text style={styles.trialNote}>Cancel anytime. No charge for 30 days.</Text>
                )}
                {Platform.OS !== 'web' ? (
                  <Pressable
                    onPress={handleRestorePurchases}
                    disabled={restoringPurchases}
                    style={({ pressed }) => [{ alignSelf: 'center', marginBottom: Spacing.sm }, pressed && { opacity: 0.6 }]}
                  >
                    {restoringPurchases
                      ? <ActivityIndicator size="small" color={C.textMuted} />
                      : <Text style={[styles.trialNote, { textDecorationLine: 'underline' }]}>Restore purchases</Text>}
                  </Pressable>
                ) : null}
              </View>

              {/* Therapist Pro */}
              <View style={[styles.planCard, { borderColor: C.secondary + '50' }]}>
                <View style={[styles.planCardHeader, { backgroundColor: C.secondarySoft }]}>
                  <View style={[styles.planCardIconWrap, { backgroundColor: C.secondary + '30' }]}>
                    <MaterialIcons name="psychology" size={20} color={C.secondary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.planCardName, { color: C.secondary }]}>Therapist Pro</Text>
                    <Text style={[styles.planCardPrice, { color: C.secondary + 'CC' }]}>
                      {Platform.OS !== 'web' && rcPackages.therapistPro
                        ? rcPackages.therapistPro.product.priceString + '/mo'
                        : '$9.99/mo'}{' '}· for professionals
                    </Text>
                  </View>
                </View>
                <View style={styles.planCardFeatures}>
                  {[
                    'Everything in Pro',
                    'Act as accountability buddy to unlimited clients',
                    'Full client dashboard with 14-day mood trend',
                    'Unlimited client slots via invite-link onboarding',
                    'Private therapist notes per client',
                  ].map(f => (
                    <View key={f} style={styles.featureRow}>
                      <MaterialIcons name="check-circle" size={14} color={C.secondary} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  onPress={() => handleUpgrade(SUBSCRIPTION_PLANS.therapist_pro.priceId, 'Therapist Pro')}
                  disabled={checkingOut}
                  style={({ pressed }) => [styles.planCta, { backgroundColor: C.secondary }, pressed && { opacity: 0.85 }, checkingOut && { opacity: 0.6 }]}
                >
                  {checkingOut
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.planCtaText}>Start 30-day free trial →</Text>}
                </Pressable>
                {Platform.OS === 'ios' ? (
                  <Text style={styles.iapDisclosure}>
                    {'Free for 30 days, then '}
                    {rcPackages.therapistPro ? rcPackages.therapistPro.product.priceString : '$9.99'}
                    {'/month. Payment charged to your Apple ID at confirmation. Subscription auto-renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel in Settings → Apple ID → Subscriptions.'}
                  </Text>
                ) : (
                  <Text style={styles.trialNote}>For licensed mental health professionals.</Text>
                )}
              </View>
            </View>
          </>
        ) : null}

        {/* Delete account — required by App Store guideline 5.1.1(v) */}
        <View style={{ marginTop: Spacing.xl, marginBottom: Spacing.md, paddingTop: Spacing.xl, borderTopWidth: 1, borderTopColor: C.border }}>
          <Text style={[styles.sectionTitle, { marginBottom: Spacing.md }]}>Account</Text>
          <Pressable
            onPress={handleDeleteAccount}
            style={({ pressed }) => [{
              flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
              backgroundColor: C.error + '10', borderRadius: Radius.xl,
              padding: Spacing.lg, borderWidth: 1, borderColor: C.error + '40',
            }, pressed && { opacity: 0.75 }]}
          >
            <MaterialIcons name="delete-forever" size={22} color={C.error} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '700', color: C.error, includeFontPadding: false }}>Delete account</Text>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false, marginTop: 2 }}>Permanently remove all your data</Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={C.error} />
          </Pressable>
        </View>

        {/* Compare tiers if already on Pro but not Therapist Pro */}
        {isPro && !isOwner ? (
          <>
            <Text style={[styles.sectionTitle, { marginTop: Spacing.sm }]}>Upgrade to Therapist Pro</Text>
            <View style={[styles.planCard, { borderColor: C.secondary + '50', marginBottom: Spacing.xl }]}>
              <View style={[styles.planCardHeader, { backgroundColor: C.secondarySoft }]}>
                <View style={[styles.planCardIconWrap, { backgroundColor: C.secondary + '30' }]}>
                  <MaterialIcons name="psychology" size={20} color={C.secondary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.planCardName, { color: C.secondary }]}>Therapist Pro</Text>
                  <Text style={[styles.planCardPrice, { color: C.secondary + 'CC' }]}>
                    {Platform.OS !== 'web' && rcPackages.therapistPro
                      ? rcPackages.therapistPro.product.priceString + '/mo'
                      : '$9.99/mo'}
                  </Text>
                </View>
              </View>
              <View style={styles.planCardFeatures}>
                {[
                  'Unlimited client slots with client dashboard',
                  'Therapist notes and mood trend view per client',
                  'Invite-link client onboarding',
                ].map(f => (
                  <View key={f} style={styles.featureRow}>
                    <MaterialIcons name="check-circle" size={14} color={C.secondary} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={() => handleUpgrade(SUBSCRIPTION_PLANS.therapist_pro.priceId, 'Therapist Pro')}
                disabled={checkingOut}
                style={({ pressed }) => [styles.planCta, { backgroundColor: C.secondary }, pressed && { opacity: 0.85 }, checkingOut && { opacity: 0.6 }]}
              >
                {checkingOut
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.planCtaText}>Upgrade to Therapist Pro →</Text>}
              </Pressable>
              {Platform.OS === 'ios' ? (
                <Text style={styles.iapDisclosure}>
                  {'Free for 30 days, then '}
                  {rcPackages.therapistPro ? rcPackages.therapistPro.product.priceString : '$9.99'}
                  {'/month. Payment charged to your Apple ID at confirmation. Cancel in Settings → Apple ID → Subscriptions.'}
                </Text>
              ) : (
                <Text style={styles.trialNote}>For licensed mental health professionals.</Text>
              )}
            </View>
          </>
        ) : null}

        {/* Legal links */}
        <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl }}>
          <Pressable
            onPress={() => router.push('/terms' as any)}
            style={({ pressed }) => [{ flex: 1, alignItems: 'center', paddingVertical: 10 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 11, color: C.textMuted, textDecorationLine: 'underline', includeFontPadding: false }}>Terms of Service</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/privacy' as any)}
            style={({ pressed }) => [{ flex: 1, alignItems: 'center', paddingVertical: 10 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 11, color: C.textMuted, textDecorationLine: 'underline', includeFontPadding: false }}>Privacy Policy</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/support' as any)}
            style={({ pressed }) => [{ flex: 1, alignItems: 'center', paddingVertical: 10 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={{ fontSize: 11, color: C.textMuted, textDecorationLine: 'underline', includeFontPadding: false }}>Support</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 10, color: C.textMuted, textAlign: 'center', marginBottom: Spacing.md, includeFontPadding: false }}>© {new Date().getFullYear()} MyMoodMapp. All rights reserved.</Text>

      </ScrollView>
    </SafeAreaView>
  );
}
