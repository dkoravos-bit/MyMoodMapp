import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { DarkColors, Typography, Spacing, Radius, getGlass } from '@/constants/theme';
import { ScoreBubble } from '@/components/ui/GlassCard';
import { StreakBadge } from '@/components/feature/StreakBadge';
import { VibeButton } from '@/components/ui/VibeButton';
import { useApp } from '@/hooks/useApp';
import { setPremiumStatus } from '@/services/storage';
import { summarizeFitnessData } from '@/services/fitness';
import { NotificationScheduler } from '@/components/feature/NotificationScheduler';
import { exportMoodCSV, exportWellnessReport } from '@/services/exportReport';
import {
  getCachedInsights,
  generateInsights,
  loadReportsFromCloud,
  SavedReport,
  InsightPeriod,
  WellnessInsights,
  BehaviorRecommendation,
  IntakeSummaryContext,
  TagCorrelationContext,
  TimePatternContext,
} from '@/services/insights';
import {
  computeTagCorrelations,
  computeTimePatterns,
  getScoreColor,
  getScoreLabel,
  getScoreEmoji,
  CONTEXT_TAGS,
} from '@/constants/moodlog';
import { buildAstrologyReport } from '@/services/astrology';
import { getCachedSchumannReading, fetchAndCacheSchumann } from '@/services/schumannResonance';
import {
  fetchCycleEntries,
  computeCycleMoodCorrelation,
  getCurrentCyclePhase,
} from '@/services/cycleTracker';
import { getDateRangeFitness } from '@/services/fitness';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startCheckout, openCustomerPortal, SUBSCRIPTION_PLANS } from '@/services/subscription';
import {
  getRevenueCatOfferings,
  purchaseRevenueCat,
  restoreRevenueCatPurchases,
  type RCPackage,
} from '@/services/revenuecat';
import { isOwnerEmail } from '@/constants/config';
import { getTherapistBuddiesForUser, TherapistBuddyRow, getIncomingBuddyRequests } from '@/services/accountability';
import { getSupabaseClient } from '@/template';
import { WebMaxWidth } from '@/components/layout/WebLayout';

// ── Style factory — rebuilds on every theme toggle ───────────────────────────
function makeProfileStyles(C: typeof DarkColors, isDark = true) {
  const G = getGlass(isDark);
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
    profileHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xl, backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: G.cardBorder },
    avatarWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.primary + '25', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.primary + '40' },
    avatarText: { fontSize: Typography.fontSizes.xl, fontWeight: '900', color: C.primary, includeFontPadding: false },
    displayName: { fontSize: Typography.fontSizes.lg, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    emailText: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.surfaceElevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: C.border },
    tierText: { fontSize: 10, fontWeight: '700', color: C.textMuted, includeFontPadding: false },
    statsGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
    section: { marginBottom: Spacing.xl, gap: Spacing.md },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontSize: Typography.fontSizes.sm, fontWeight: Typography.fontWeights.semibold, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
    proLockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.primarySoft, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, borderColor: C.primary + '40' },
    proLockedText: { fontSize: 10, color: C.primary, fontWeight: '700', includeFontPadding: false },
    insightsCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.secondarySoft, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1, borderColor: C.secondary + '40' },
    therapistCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.secondary + '12', borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl, borderWidth: 1.5, borderColor: C.secondary + '50' },
    insightsCtaLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, overflow: 'hidden' },
    insightsCtaTitle: { fontSize: Typography.fontSizes.md, fontWeight: Typography.fontWeights.semibold, color: C.textPrimary, includeFontPadding: false, flexShrink: 1 },
    insightsCtaSubtitle: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false, flexShrink: 1 },
    exportCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md },
    exportDesc: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
    exportBtns: { flexDirection: 'row', gap: Spacing.md },
    exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.primarySoft, borderRadius: Radius.lg, paddingVertical: 12, borderWidth: 1, borderColor: C.primary + '40' },
    exportBtnLocked: { backgroundColor: C.surface, borderColor: C.border },
    exportBtnText: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.primary, includeFontPadding: false },
    premiumCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: C.primary + '40', marginBottom: Spacing.xl },
    premiumHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    premiumTitle: { fontSize: Typography.fontSizes.xl, fontWeight: Typography.fontWeights.bold, color: C.textPrimary, includeFontPadding: false },
    premiumSubtitle: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, marginBottom: Spacing.md, includeFontPadding: false },
    premiumFeatureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: 5 },
    premiumFeatureText: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, flex: 1, lineHeight: Typography.fontSizes.sm * 1.4, includeFontPadding: false },
    tierCompareBlock: { borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden', gap: 0 },
    tierCompareHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
    tierCompareTitle: { fontSize: Typography.fontSizes.sm, fontWeight: '800', includeFontPadding: false },
    tierCompareDesc: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: Typography.fontSizes.sm * 1.5, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, includeFontPadding: false },
    tierCta: { margin: Spacing.md, marginTop: Spacing.sm, borderRadius: Radius.lg, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5 },
    tierCtaText: { fontSize: Typography.fontSizes.sm, fontWeight: '800', includeFontPadding: false },
    premiumNote: { fontSize: Typography.fontSizes.xs, color: C.textMuted, textAlign: 'center', includeFontPadding: false },
    iapDisclosure: { fontSize: 10, color: C.textMuted, textAlign: 'center', lineHeight: 15, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, includeFontPadding: false },
    premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.primarySoft, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.xl },
    premiumBadgeText: { fontSize: Typography.fontSizes.sm, color: C.primary, fontWeight: Typography.fontWeights.medium, includeFontPadding: false },
    manageBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: C.primary + '25', borderWidth: 1, borderColor: C.primary + '50' },
    manageBtnText: { fontSize: 11, color: C.primary, fontWeight: '700', includeFontPadding: false },
    settingsCard: { backgroundColor: G.cardBgLight, borderRadius: Radius.lg, borderWidth: 1, borderColor: G.cardBorderLight, overflow: 'hidden' },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
    settingLabel: { fontSize: Typography.fontSizes.md, color: C.textPrimary, fontWeight: Typography.fontWeights.medium, includeFontPadding: false },
    settingDesc: { fontSize: Typography.fontSizes.sm, color: C.textMuted, marginTop: 2, includeFontPadding: false },
    privacyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: C.border },
    privacyText: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, flex: 1, includeFontPadding: false },
    toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: C.border, justifyContent: 'center', paddingHorizontal: 3, flexShrink: 0 },
    toggleOn: { backgroundColor: C.primary },
    toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.textMuted },
    toggleThumbOn: { backgroundColor: '#fff', marginLeft: 20 },
    intakeRequiredBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: C.primary + '20', borderWidth: 1, borderColor: C.primary + '40' },
    intakeRequiredText: { fontSize: 10, fontWeight: '700', color: C.primary, includeFontPadding: false },
    therapistBuddyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: C.secondary + '12', borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1.5, borderColor: C.secondary + '50', marginBottom: Spacing.xl, paddingRight: 40 },
    therapistBuddyBannerIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.secondary + '25', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
    therapistBuddyBannerTitle: { fontSize: Typography.fontSizes.md, fontWeight: '800', color: C.textPrimary, includeFontPadding: false },
    therapistBuddyBannerSub: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
    therapistBuddyBannerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 6, flexWrap: 'wrap' },
    therapistBuddyBannerCta: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.secondary, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 8 },
    therapistBuddyBannerCtaText: { fontSize: 12, fontWeight: '700', color: '#08091A', includeFontPadding: false },
    therapistBuddyBannerDismiss: { paddingHorizontal: Spacing.sm, paddingVertical: 6 },
    therapistBuddyBannerDismissText: { fontSize: 12, color: C.textMuted, fontWeight: '600', includeFontPadding: false },
    therapistBuddyBannerClose: { position: 'absolute', top: Spacing.md, right: Spacing.md },
    accountActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
    accountBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, minHeight: 48 },
    accountBtnText: { fontSize: Typography.fontSizes.sm, fontWeight: '600', includeFontPadding: false },
    reportsSection: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, marginBottom: Spacing.xl, gap: Spacing.md },
    reportsSectionHeader: { gap: 4 },
    reportsSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    reportsSectionTitle: { flex: 1, fontSize: Typography.fontSizes.md, fontWeight: '800', color: C.textPrimary, includeFontPadding: false },
    reportsSectionSub: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    reportsRefreshBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.secondarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.secondary + '40' },
    reportsGenerateRow: { flexDirection: 'row', gap: Spacing.sm },
    reportsGenBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: Radius.lg, backgroundColor: C.surfaceElevated, borderWidth: 1.5, borderColor: C.border },
    reportsGenBtnText: { fontSize: 12, fontWeight: '700', color: C.secondary, includeFontPadding: false },
    reportsPatternsLink: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primarySoft, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 9, borderWidth: 1, borderColor: C.primary + '30' },
    reportsPatternsLinkText: { flex: 1, fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '600', includeFontPadding: false },
    reportsEmptyCard: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
    reportsEmptyText: { fontSize: Typography.fontSizes.sm, color: C.textMuted, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
    reportsLockedCard: { alignItems: 'center', gap: Spacing.sm, backgroundColor: C.background, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: C.border },
    reportsLockedTitle: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: C.primary, includeFontPadding: false },
    reportsLockedSub: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
    reportsList: { gap: Spacing.md },
    reportCard: { backgroundColor: C.background, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.border, gap: Spacing.sm },
    reportCardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    reportTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
    reportTypeBadgeText: { fontSize: 10, fontWeight: '700', includeFontPadding: false },
    reportScoreBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
    reportScoreText: { fontSize: 11, fontWeight: '900', includeFontPadding: false },
    reportCardDate: { flex: 1, fontSize: 10, color: C.textMuted, textAlign: 'right', includeFontPadding: false },
    reportCardHeadline: { fontSize: Typography.fontSizes.sm, color: C.textPrimary, lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
    reportCardBody: { gap: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: C.border },
    reportCelebRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, backgroundColor: C.primarySoft, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: C.primary + '30' },
    reportCelebText: { flex: 1, fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '600', lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
    reportAdviceBox: { backgroundColor: C.surfaceElevated, borderRadius: Radius.md, padding: Spacing.sm, gap: Spacing.xs },
    reportAdviceHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 },
    reportAdviceTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.primary, includeFontPadding: false },
    reportAdviceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    reportAdviceNum: { fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '700', width: 14, includeFontPadding: false },
    reportAdviceText: { flex: 1, fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
    reportWatchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, backgroundColor: C.warning + '12', borderRadius: Radius.md, padding: Spacing.sm },
    reportWatchText: { flex: 1, fontSize: Typography.fontSizes.xs, color: C.warning, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
  });
}

export default function ProfileScreen() {
  const { colors: C, isDark, toggleTheme } = useTheme();

  const styles = useMemo(() => makeProfileStyles(C, isDark), [C, isDark]);
  const router = useRouter();
  const { showAlert } = useAlert();
  const { user, logout } = useAuth();
  const {
    archetypeId, moodLog, streak, isPremium, setIsPremium,
    setArchetypeId, setMoodLog, setTodayMood, setStreak, refreshAll,
    fitnessData,
    moodLogEntries, birthdate, setBirthdate,
    userRole, subscriptionTier, sex, weatherData, displayName,
    tempUnit, setTempUnit,
  } = useApp();

  // Also track owner/therapist from stored email in case user obj is briefly null during auth init
  const [storedIsTherapist, setStoredIsTherapist] = React.useState(false);
  useEffect(() => {
    AsyncStorage.getItem('supabase_user_email').then(email => {
      if (isOwnerEmail(email)) setStoredIsTherapist(true);
    }).catch(() => {});
    // Also store email when user is available
    if (user?.email) {
      AsyncStorage.setItem('supabase_user_email', user.email).catch(() => {});
      if (isOwnerEmail(user.email)) setStoredIsTherapist(true);
    }
  }, [user?.email]);

  const [exporting, setExporting] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [rcPackages, setRcPackages] = useState<{ pro: RCPackage | null; therapistPro: RCPackage | null }>({ pro: null, therapistPro: null });
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [intakeSummaryData, setIntakeSummaryData] = useState<Record<string, any> | null>(null);

  const [intakeCompleted, setIntakeCompleted] = useState(false);
  const [hasTherapistBuddy, setHasTherapistBuddy] = useState(false);
  const [therapistBuddies, setTherapistBuddies] = useState<TherapistBuddyRow[]>([]);
  const [showTherapistBanner, setShowTherapistBanner] = useState(false);
  const [pendingBuddyRequests, setPendingBuddyRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const loadIntakeAndBuddies = async () => {
      const [localRaw, rows, dismissed, incomingRaw] = await Promise.all([
        AsyncStorage.getItem('intake_summary'),
        getTherapistBuddiesForUser(user.id).catch(() => [] as TherapistBuddyRow[]),
        AsyncStorage.getItem('therapist_banner_dismissed'),
        getIncomingBuddyRequests(user.id, user.email).catch(() => []),
      ]);

      // Pending incoming requests banner
      const pendingRequests = incomingRaw.filter((r: any) => r.status === 'pending');
      setPendingBuddyRequests(pendingRequests);

      let resolvedRaw = localRaw;

      // Always fetch from Supabase to get the authoritative cross-platform version.
      // If Supabase has a newer/different record (e.g. quiz taken on another device),
      // update AsyncStorage cache with the cloud version.
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('intake_questionnaires')
          .select('clinical_summary, updated_at')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.clinical_summary) {
          resolvedRaw = JSON.stringify(data.clinical_summary);
          // Refresh local cache with cloud version
          await AsyncStorage.setItem('intake_summary', resolvedRaw);
        } else if (localRaw) {
          // Supabase has no record but AsyncStorage does — back-sync to cloud
          const parsed = JSON.parse(localRaw);
          await supabase.from('intake_questionnaires').upsert({
            user_id: user.id,
            clinical_summary: parsed,
            presenting_concern: parsed.presenting_concern ?? null,
            phq9_total: parsed.phq9_total ?? 0,
            phq9_scores: [],
            gad7_total: parsed.gad7_total ?? 0,
            gad7_scores: [],
            auditc_total: parsed.audit_total ?? 0,
            auditc_scores: [],
            sleep_scores: [],
            trauma_flag: parsed.trauma_flag ?? false,
            safety_flag: parsed.safety_flag ?? false,
            contextual: {},
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        }
      } catch {}

      const completed = !!resolvedRaw;
      setIntakeCompleted(completed);
      if (resolvedRaw) {
        try { setIntakeSummaryData(JSON.parse(resolvedRaw)); } catch {}
      }
      // Surface pending incoming requests regardless of active status
      setPendingBuddyRequests(pendingRequests);

      const hasTherapist = rows.length > 0;
      setTherapistBuddies(rows);
      setHasTherapistBuddy(hasTherapist);
      if (hasTherapist && !dismissed) {
        const summary = resolvedRaw ? JSON.parse(resolvedRaw) : null;
        if (!summary?.therapist_mode) setShowTherapistBanner(true);
      }
    };
    loadIntakeAndBuddies();
  }, [user?.id]);

  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [generatingPeriod, setGeneratingPeriod] = useState<InsightPeriod | null>(null);
  const [aiConsentGiven, setAiConsentGiven] = useState<boolean | null>(null);
  const [showAiConsentModal, setShowAiConsentModal] = useState(false);
  const [pendingReportPeriod, setPendingReportPeriod] = useState<InsightPeriod | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Group reports by Month → Date hierarchy
  const groupedReports = useMemo(() => {
    const monthMap = new Map<string, Map<string, SavedReport[]>>();
    savedReports.forEach(report => {
      const d = new Date(report.generated_at);
      const monthKey = d.toLocaleDateString([], { year: 'numeric', month: 'long' });
      const dateKey = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map());
      const dateMap = monthMap.get(monthKey)!;
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
      dateMap.get(dateKey)!.push(report);
    });
    return Array.from(monthMap.entries()).map(([month, dateMap]) => ({
      month,
      dates: Array.from(dateMap.entries()).map(([date, reports]) => ({ date, reports })),
    }));
  }, [savedReports]);

  // Auto-expand the most recent month and date on first load
  useEffect(() => {
    if (groupedReports.length > 0) {
      const firstMonth = groupedReports[0].month;
      const firstDate = groupedReports[0].dates[0]?.date;
      setExpandedMonths(prev => { const s = new Set(prev); s.add(firstMonth); return s; });
      if (firstDate) setExpandedDates(prev => { const s = new Set(prev); s.add(firstDate); return s; });
    }
  }, [groupedReports.length]);

  const toggleMonth = useCallback((month: string) => {
    setExpandedMonths(prev => {
      const s = new Set(prev);
      if (s.has(month)) { s.delete(month); } else { s.add(month); }
      return s;
    });
  }, []);

  const toggleDate = useCallback((dateKey: string) => {
    setExpandedDates(prev => {
      const s = new Set(prev);
      if (s.has(dateKey)) { s.delete(dateKey); } else { s.add(dateKey); }
      return s;
    });
  }, []);

  const isOwner = isOwnerEmail(user?.email);
  const isProOrTherapist = subscriptionTier === 'pro' || subscriptionTier === 'therapist_pro' || isOwner;
  // Robust check: catches userRole set from cloud profile, subscriptionTier, and owner email override.
  // Using useMemo so it re-evaluates reactively whenever any dependency changes after async load.
  const isTherapist = React.useMemo(
    () => userRole === 'therapist' || subscriptionTier === 'therapist_pro' || isOwnerEmail(user?.email) || storedIsTherapist,
    [userRole, subscriptionTier, user?.email, storedIsTherapist]
  );

  const loadReports = useCallback(async () => {
    if (!isProOrTherapist) return;
    setReportsLoading(true);
    const reports = await loadReportsFromCloud(20);
    setSavedReports(reports);
    setReportsLoading(false);
  }, [isProOrTherapist]);

  useEffect(() => { loadReports(); }, [loadReports]);

  // Load AI consent state once
  useEffect(() => {
    AsyncStorage.getItem('ai_consent_given').then(val => {
      setAiConsentGiven(val === 'true');
    }).catch(() => setAiConsentGiven(false));
  }, []);

  const dismissTherapistBanner = async () => {
    setShowTherapistBanner(false);
    await AsyncStorage.setItem('therapist_banner_dismissed', '1');
  };

  const handleProfilePrompt = () => {
    if (!intakeCompleted) {
      showAlert('Complete your Wellbeing Profile first', 'AI reports are personalised using your Wellbeing Profile. Complete it now to unlock report generation.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Complete profile', onPress: () => router.push('/quiz' as any) },
      ]);
      return true;
    }
    if (hasTherapistBuddy) {
      AsyncStorage.getItem('intake_summary').then(raw => {
        if (raw) {
          const summary = JSON.parse(raw);
          if (!summary.therapist_mode) {
            showAlert('Update your profile for your therapist', 'You have a therapist connected. Would you like to add therapist-specific questions?', [
              { text: 'Not now', style: 'cancel' },
              { text: 'Add therapist section', onPress: () => router.push({ pathname: '/quiz', params: { mode: 'therapist' } } as any) },
            ]);
          }
        }
      });
    }
    return false;
  };

  const handleGenerateReport = async (period: InsightPeriod) => {
    if (!isProOrTherapist) { showAlert('Pro feature', 'Upgrade to Pro to generate AI Wellness Reports.'); return; }
    if (handleProfilePrompt()) return;
    // Check AI consent — show modal if not yet granted
    if (!aiConsentGiven) {
      setPendingReportPeriod(period);
      setShowAiConsentModal(true);
      return;
    }
    if (aiConsentGiven === false) {
      showAlert('AI Reports Disabled', 'You have not given consent to send data to AI services. Enable AI Reports in Settings to generate reports.');
      return;
    }
    setGeneratingPeriod(period);
    try {
      const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
      const intakeSummaryRaw = await AsyncStorage.getItem('intake_summary');
      const intakeSummary: IntakeSummaryContext | null = intakeSummaryRaw ? JSON.parse(intakeSummaryRaw) : null;
      const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      const filteredEntries = moodLogEntries.filter((e: any) => e.date >= cutoff);
      const tagCtx: TagCorrelationContext[] = computeTagCorrelations(filteredEntries).map((c: any) => {
        const tag = CONTEXT_TAGS.find((t: any) => t.id === c.tagId);
        return { tagId: c.tagId, tagLabel: tag?.label ?? c.tagId, sampleSize: c.sampleSize, avgScore: c.avgScore, deltaVsBaseline: c.deltaVsBaseline, avgBody: c.avgBody, avgMind: c.avgMind };
      });
      const timeCtx: TimePatternContext[] = computeTimePatterns(filteredEntries).map((t: any) => ({ timeOfDay: t.timeOfDay, avgScore: t.avgScore, sampleSize: t.sampleSize }));
      let astrologyContext = null;
      if (birthdate) {
        const report = buildAstrologyReport(birthdate);
        astrologyContext = { sunSign: report.zodiacSign.name, element: report.zodiacSign.element, rulingPlanet: report.zodiacSign.rulingPlanet, physicalAreas: report.zodiacSign.physicalAreas, moonPhase: report.moonPhase.phase, moonEnergyLevel: report.moonPhase.energyLevel, retrogrades: report.planets.filter((p: any) => p.retrograde).map((p: any) => p.planet), energyScore: report.overallEnergyScore, overallEnergy: report.overallEnergy, dailyForecast: report.dailyPhysicalForecast };
      }
      let schumannContext = null;
      try {
        const sr = await getCachedSchumannReading() ?? await fetchAndCacheSchumann();
        schumannContext = { frequency: sr.frequency, status: sr.status, kIndex: sr.kIndex, trend: sr.trend, physicalEffects: sr.physicalEffects.map((e: any) => `${e.system}: ${e.effect}`) };
      } catch {}
      let cycleCtx = null;
      if (sex === 'female') {
        const cycleEntries = await fetchCycleEntries();
        const cycleCorrs = computeCycleMoodCorrelation(cycleEntries, moodLogEntries);
        const cycleStatus = getCurrentCyclePhase(cycleEntries);
        if (cycleStatus && cycleCorrs.length > 0) cycleCtx = { currentPhase: cycleStatus.phase, dayOfCycle: cycleStatus.dayOfCycle, daysUntilNextPeriod: cycleStatus.daysUntilNextPeriod, avgCycleLength: cycleStatus.avgCycleLength, phaseMoodCorrelations: cycleCorrs };
      }
      const weatherCtx = weatherData ? { condition: weatherData.condition, temperature: weatherData.temperature, humidity: weatherData.humidity, uvIndex: weatherData.uvIndex, moodImpact: weatherData.moodImpact, moodImpactReason: weatherData.moodImpactReason, pressureHPA: weatherData.pressureHPA } : null;
      const result = await generateInsights(period, moodLog, [], fitnessData, intakeSummary, tagCtx, timeCtx, astrologyContext, schumannContext, weatherCtx, cycleCtx);
      if (result) { await loadReports(); showAlert('Report ready', `Your ${period} wellness report has been saved.`); }
      else showAlert('Failed', 'Could not generate report. Check your connection and try again.');
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Report generation failed.');
    } finally {
      setGeneratingPeriod(null);
    }
  };

  const { refreshSubscription, subscriptionEnd } = useApp();

  // Load RevenueCat offerings on native
  useEffect(() => {
    if (Platform.OS === 'web') return;
    getRevenueCatOfferings().then(setRcPackages).catch(() => {});
  }, []);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('subscription/success')) { refreshSubscription(); showAlert('Subscription activated!', 'Your plan has been upgraded. Enjoy all features.'); }
    });
    return () => sub.remove();
  }, []);

  const handleUpgrade = async (priceId: string, planName: string) => {
    if (Platform.OS === 'web') {
      // Web: Stripe checkout
      setCheckingOut(true);
      try {
        const { error } = await startCheckout(priceId);
        if (error) showAlert('Checkout failed', error);
        await refreshSubscription();
      } finally {
        setCheckingOut(false);
      }
      return;
    }

    // iOS / Android: Apple/Google IAP via RevenueCat ONLY
    // Stripe checkout must never be shown on native builds (App Store rule 3.1.1)
    setCheckingOut(true);
    try {
      const isTherapist = planName.toLowerCase().includes('therapist');
      let pkg = isTherapist ? rcPackages.therapistPro : rcPackages.pro;

      // If offerings not yet loaded, do a fresh fetch
      if (!pkg) {
        const freshPkgs = await getRevenueCatOfferings();
        setRcPackages(freshPkgs);
        pkg = isTherapist ? freshPkgs.therapistPro : freshPkgs.pro;
      }

      if (!pkg) {
        showAlert(
          'Store unavailable',
          'Could not connect to the App Store. Please check your internet connection and try again.',
        );
        return;
      }

      const { success, tier, error } = await purchaseRevenueCat(pkg);
      if (error) {
        showAlert('Purchase failed', error);
        return;
      }
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
        showAlert('No purchases found', 'No active subscriptions were found for this Apple ID / Google account.');
      }
    } finally {
      setRestoringPurchases(false);
    }
  };

  const handleManageSubscription = async () => {
    if (Platform.OS !== 'web') {
      // iOS/Android: NEVER open Stripe portal (App Store rule 3.1.1)
      // Direct users to OS subscription settings exclusively
      const url = Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
      Linking.openURL(url).catch(() => {});
      return;
    }
    // Web only: Stripe customer portal
    const { error } = await openCustomerPortal();
    if (error) showAlert('Error', error);
    await refreshSubscription();
  };

  const fitnessSummary = summarizeFitnessData(fitnessData);
  const totalCheckins = moodLogEntries.length;
  const avgScore = moodLogEntries.length ? Math.round(moodLogEntries.reduce((s, e) => s + e.score, 0) / moodLogEntries.length) : null;

  // Weekly summary data
  const weekCutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const weekEntries = moodLogEntries.filter(e => e.date >= weekCutoff);
  const weekAvg = weekEntries.length ? Math.round(weekEntries.reduce((s, e) => s + e.score, 0) / weekEntries.length) : null;
  const weekDaysLogged = new Set(weekEntries.map(e => e.date)).size;
  const weekBest = weekEntries.length ? Math.max(...weekEntries.map(e => e.score)) : null;
  const weekWorst = weekEntries.length ? Math.min(...weekEntries.map(e => e.score)) : null;
  const priorWeekCutoff = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
  const priorWeekEntries = moodLogEntries.filter(e => e.date >= priorWeekCutoff && e.date < weekCutoff);
  const priorWeekAvg = priorWeekEntries.length ? Math.round(priorWeekEntries.reduce((s, e) => s + e.score, 0) / priorWeekEntries.length) : null;
  const weekDelta = weekAvg !== null && priorWeekAvg !== null ? weekAvg - priorWeekAvg : null;
  const weekBarDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const ds = d.toISOString().split('T')[0];
    const dayEntries = moodLogEntries.filter(e => e.date === ds);
    const avg = dayEntries.length ? Math.round(dayEntries.reduce((s, e) => s + e.score, 0) / dayEntries.length) : null;
    return { ds, dayLabel: ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()], isToday: i === 6, avg };
  });

  const handleExportCSV = async () => {
    if (!isProOrTherapist) { showAlert('Pro feature', 'Upgrade to Pro to export your data.'); return; }
    setExporting(true);
    try { await exportMoodCSV(moodLogEntries); }
    catch (e: any) { showAlert('Export failed', e.message ?? 'Could not export data.'); }
    finally { setExporting(false); }
  };

  const handleExportReport = async () => {
    if (!isProOrTherapist) { showAlert('Pro feature', 'Upgrade to Pro to generate a full wellness report.'); return; }
    setExporting(true);
    try {
      const insights = await getCachedInsights('monthly');
      const displayName = user?.username ?? user?.email?.split('@')[0] ?? 'Client';
      await exportWellnessReport(moodLogEntries, fitnessData, insights, displayName, 30);
    } catch (e: any) { showAlert('Export failed', e.message ?? 'Could not generate report.'); }
    finally { setExporting(false); }
  };

  const handleLogout = () => {
    showAlert('Sign out?', 'Your data is saved to your account and will sync when you sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  };

  const handleClearData = () => {
    showAlert('Clear all local data?', 'This removes your device cache. Cloud data is preserved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          await AsyncStorage.clear();
          setArchetypeId(null); setMoodLog([]); setTodayMood(null);
          setStreak({ current: 0, longest: 0, lastDate: '' }); setIsPremium(false);
          showAlert('Cleared', 'Local data removed. Restart to reload from your account.');
        },
      },
    ]);
  };

  const handleAiConsentAllow = async () => {
    await AsyncStorage.setItem('ai_consent_given', 'true');
    setAiConsentGiven(true);
    setShowAiConsentModal(false);
    if (pendingReportPeriod) {
      setPendingReportPeriod(null);
      // Trigger the report with consent now granted
      handleGenerateReport(pendingReportPeriod);
    }
  };

  const handleAiConsentDecline = async () => {
    await AsyncStorage.setItem('ai_consent_given', 'false');
    setAiConsentGiven(false);
    setShowAiConsentModal(false);
    setPendingReportPeriod(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* AI Data Consent Modal — shown before first AI report generation */}
      {showAiConsentModal ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 999, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg }}>
          <View style={{ backgroundColor: C.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1.5, borderColor: C.secondary + '50', maxWidth: 420, width: '100%', gap: Spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <View style={{ width: 44, height: 44, borderRadius: Radius.lg, backgroundColor: C.secondary + '20', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="psychology" size={22} color={C.secondary} />
              </View>
              <Text style={{ fontSize: Typography.fontSizes.lg, fontWeight: '800', color: C.textPrimary, flex: 1, includeFontPadding: false } as any}>AI-Powered Insights</Text>
            </View>
            <Text style={{ fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false } as any}>
              {'To generate your personalised mood report, MyMoodMapp sends your mood scores, tags, and journal entries to Anthropic\'s Claude AI. Your data is processed securely and not used to train AI models. No personally identifiable information (name or email) is shared.'}
            </Text>
            <View style={{ backgroundColor: C.background, borderRadius: Radius.lg, padding: Spacing.md, gap: 6, borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="check-circle" size={13} color={C.success} />
                <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false } as any}>Mood scores, tags, and journal text only</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="block" size={13} color={C.success} />
                <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false } as any}>Your name and email are never shared</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="security" size={13} color={C.success} />
                <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false } as any}>Data not used to train AI models</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="info" size={13} color={C.secondary} />
                <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>Processed by Anthropic (anthropic.com/privacy)</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <Pressable onPress={handleAiConsentDecline} style={({ pressed }) => [{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: C.border }, pressed && { opacity: 0.7 }]}>
                <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '600', color: C.textMuted, includeFontPadding: false } as any}>No Thanks</Text>
              </Pressable>
              <Pressable onPress={handleAiConsentAllow} style={({ pressed }) => [{ flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: Radius.lg, backgroundColor: C.secondary }, pressed && { opacity: 0.85 }]}>
                <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: '#fff', includeFontPadding: false } as any}>Allow AI Reports</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={[styles.scroll, { alignItems: 'stretch' }]} showsVerticalScrollIndicator={false}>
      <WebMaxWidth>

        {/* Header */}
        <Pressable
          onPress={() => router.push('/account' as any)}
          style={({ pressed }) => [styles.profileHeader, pressed && { opacity: 0.75 }]}
          accessibilityLabel="View account and subscription"
        >
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{(user?.username ?? user?.email ?? 'U')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.displayName}>{displayName ?? user?.username ?? user?.email?.split('@')[0] ?? 'User'}</Text>
            <Text style={styles.emailText} numberOfLines={1} ellipsizeMode="tail">{user?.email ?? ''}</Text>
          </View>
          <View style={styles.tierBadge}>
            {isOwner ? (
              <><MaterialIcons name="verified" size={10} color={C.primary} /><Text style={[styles.tierText, { color: C.primary }]}>Owner</Text></>
            ) : subscriptionTier === 'free' ? (
              <Text style={styles.tierText}>Free</Text>
            ) : subscriptionTier === 'pro' ? (
              <><MaterialIcons name="star" size={10} color={C.primary} /><Text style={[styles.tierText, { color: C.primary }]}>Pro</Text></>
            ) : (
              <><MaterialIcons name="psychology" size={10} color={C.secondary} /><Text style={[styles.tierText, { color: C.secondary }]}>Therapist Pro</Text></>
            )}
          </View>
          <MaterialIcons name="chevron-right" size={18} color={C.textMuted} style={{ marginLeft: -4 }} />
        </Pressable>

        {/* Pending buddy requests banner */}
        {pendingBuddyRequests.length > 0 ? (
          <Pressable
            onPress={() => router.push('/accountability' as any)}
            style={({ pressed }) => [{
              flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
              backgroundColor: C.secondary + '15',
              borderRadius: Radius.xl, padding: Spacing.md,
              marginBottom: Spacing.xl,
              borderWidth: 1.5, borderColor: C.secondary + '50',
            }, pressed && { opacity: 0.8 }]}
          >
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.secondary + '25', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="group" size={18} color={C.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>
                {pendingBuddyRequests.length} pending buddy request{pendingBuddyRequests.length !== 1 ? 's' : ''}
              </Text>
              <Text style={{ fontSize: 12, color: C.textSecondary, includeFontPadding: false } as any}>
                Tap to review, accept or decline
              </Text>
            </View>
            <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.secondary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#08091A', includeFontPadding: false } as any}>{pendingBuddyRequests.length}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={C.secondary} />
          </Pressable>
        ) : null}

        {/* Therapist buddy banner */}
        {showTherapistBanner ? (
          <View style={styles.therapistBuddyBanner}>
            <View style={styles.therapistBuddyBannerIconWrap}>
              <MaterialIcons name="psychology" size={20} color={C.secondary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.therapistBuddyBannerTitle}>Your therapist is on MyMoodMapp</Text>
              <Text style={styles.therapistBuddyBannerSub}>
                {therapistBuddies[0]?.therapist_name ? `${therapistBuddies[0].therapist_name} has connected with you as your accountability buddy.` : 'A therapist has connected with you as your accountability buddy.'}{' '}
                Complete the therapist section of your Wellbeing Profile so they can prepare for your sessions.
              </Text>
              <View style={styles.therapistBuddyBannerActions}>
                <Pressable onPress={() => { dismissTherapistBanner(); router.push({ pathname: '/quiz', params: { mode: 'therapist' } } as any); }} style={({ pressed }) => [styles.therapistBuddyBannerCta, pressed && { opacity: 0.8 }]}>
                  <MaterialIcons name="favorite" size={13} color="#08091A" />
                  <Text style={styles.therapistBuddyBannerCtaText}>Complete therapist profile</Text>
                </Pressable>
                <Pressable onPress={dismissTherapistBanner} hitSlop={8} style={({ pressed }) => [styles.therapistBuddyBannerDismiss, pressed && { opacity: 0.6 }]}>
                  <Text style={styles.therapistBuddyBannerDismissText}>Not now</Text>
                </Pressable>
              </View>
            </View>
            <Pressable onPress={dismissTherapistBanner} hitSlop={10} style={styles.therapistBuddyBannerClose}>
              <MaterialIcons name="close" size={16} color={C.secondary} />
            </Pressable>
          </View>
        ) : null}

        {/* Therapist Dashboard — always visible for therapist accounts */}
        {isTherapist ? (
          <Pressable onPress={() => router.push('/therapist-dashboard' as any)} style={({ pressed }) => [styles.therapistCta, { marginBottom: Spacing.xl }, pressed && { opacity: 0.85 }]}>
            <View style={styles.insightsCtaLeft}>
              <View style={{ width: 42, height: 42, borderRadius: Radius.lg, backgroundColor: C.secondary + '25', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="psychology" size={22} color={C.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightsCtaTitle}>Therapist Dashboard</Text>
                <Text style={styles.insightsCtaSubtitle}>Manage clients · view wellness reports · track overdue logs</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={C.secondary} />
          </Pressable>
        ) : null}

        {/* Weekly Summary Card */}
        <WeeklySummaryCard
          weekAvg={weekAvg}
          weekDaysLogged={weekDaysLogged}
          weekBest={weekBest}
          weekWorst={weekWorst}
          weekDelta={weekDelta}
          weekBarDays={weekBarDays}
          C={C}
          styles={styles}
        />

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatBox label="Check-ins" value={totalCheckins} color={C.primary} icon="event-note" />
          <StatBox label="Day streak" value={streak.current} color={C.success} icon="local-fire-department" />
          <StatBox label="Avg score" value={avgScore !== null ? String(avgScore) : '—'} color={avgScore !== null ? (avgScore >= 65 ? C.success : avgScore >= 45 ? C.warning : C.error) : C.textMuted} icon="analytics" />
          <StatBox label="Avg steps" value={fitnessSummary.avgDailySteps > 0 ? fitnessSummary.avgDailySteps.toLocaleString() : '—'} color={C.warning} icon="directions-walk" />
        </View>

        {sex === 'female' ? (
          <Pressable onPress={() => router.push('/cycle-tracker' as any)} style={({ pressed }) => [styles.insightsCta, { backgroundColor: C.error + '10', borderColor: C.error + '40' }, pressed && { opacity: 0.85 }]}>
            <View style={styles.insightsCtaLeft}>
              <MaterialIcons name="water-drop" size={22} color={C.error} />
              <View><Text style={styles.insightsCtaTitle}>Cycle Tracker</Text><Text style={styles.insightsCtaSubtitle}>Track your period · phase insights · mood correlation</Text></View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={C.error} />
          </Pressable>
        ) : null}

        <Pressable onPress={() => router.push('/accountability' as any)} style={({ pressed }) => [styles.insightsCta, { backgroundColor: C.surfaceElevated, borderColor: C.primary + '40' }, pressed && { opacity: 0.85 }]}>
          <View style={styles.insightsCtaLeft}>
            <MaterialIcons name="group" size={22} color={C.primary} />
            <View><Text style={styles.insightsCtaTitle}>Accountability Buddy</Text><Text style={styles.insightsCtaSubtitle}>Get notified if you miss your daily log</Text></View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={C.primary} />
        </Pressable>

        <Pressable onPress={() => router.push('/buddy-activity' as any)} style={({ pressed }) => [styles.insightsCta, { backgroundColor: C.surfaceElevated, borderColor: C.success + '40' }, pressed && { opacity: 0.85 }]}>
          <View style={styles.insightsCtaLeft}>
            <MaterialIcons name="feed" size={22} color={C.success} />
            <View><Text style={styles.insightsCtaTitle}>Activity Feed</Text><Text style={styles.insightsCtaSubtitle}>See when your buddies{isTherapist ? ' & clients' : ''} last logged</Text></View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={C.success} />
        </Pressable>

        <Pressable onPress={() => router.push('/(tabs)/mapp' as any)} style={({ pressed }) => [styles.insightsCta, { backgroundColor: C.surfaceElevated, borderColor: C.secondary + '40' }, pressed && { opacity: 0.85 }]}>
          <View style={styles.insightsCtaLeft}>
            <MaterialIcons name="explore" size={22} color={C.secondary} />
            <View><Text style={styles.insightsCtaTitle}>Mapp</Text><Text style={styles.insightsCtaSubtitle}>Compass · terrain · correlations · forecast · Mood Print</Text></View>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={C.secondary} />
        </Pressable>

        {/* Wellbeing Profile */}
        <WellbeingProfileCard
          intakeCompleted={intakeCompleted}
          intakeSummaryData={intakeSummaryData}
          hasTherapistBuddy={hasTherapistBuddy}
          expanded={profileExpanded}
          onToggleExpanded={() => setProfileExpanded(e => !e)}
          onRetake={() => router.push('/quiz' as any)}
          onAddTherapistSection={() => router.push({ pathname: '/quiz', params: { mode: 'therapist' } } as any)}
          styles={styles}
          C={C}
        />

        {/* AI Reports Hub */}
        <View style={styles.reportsSection}>
          <View style={styles.reportsSectionHeader}>
            <View style={styles.reportsSectionTitleRow}>
              <MaterialIcons name="psychology" size={18} color={C.secondary} />
              <Text style={styles.reportsSectionTitle}>AI Wellness Reports</Text>
              {!isProOrTherapist ? (
                <View style={styles.proLockedBadge}><MaterialIcons name="lock" size={10} color={C.primary} /><Text style={styles.proLockedText}>Pro</Text></View>
              ) : (
                <Pressable onPress={loadReports} disabled={reportsLoading} style={({ pressed }) => [styles.reportsRefreshBtn, pressed && { opacity: 0.7 }]}>
                  {reportsLoading ? <ActivityIndicator size="small" color={C.secondary} /> : <MaterialIcons name="refresh" size={14} color={C.secondary} />}
                </Pressable>
              )}
            </View>
            <Text style={styles.reportsSectionSub}>Generate and save full AI analyses · view history</Text>
          </View>

          <View style={styles.reportsGenerateRow}>
            {(['daily', 'weekly', 'monthly'] as InsightPeriod[]).map(p => {
              const isGen = generatingPeriod === p;
              const labels = { daily: 'Today', weekly: '7 days', monthly: '30 days' };
              const icons: Record<InsightPeriod, string> = { daily: 'today', weekly: 'calendar-view-week', monthly: 'calendar-month' };
              return (
                <Pressable key={p} onPress={() => handleGenerateReport(p)} disabled={!!generatingPeriod}
                  style={({ pressed }) => [styles.reportsGenBtn, isProOrTherapist && { borderColor: C.secondary + '60', backgroundColor: C.secondarySoft }, !isProOrTherapist && { opacity: 0.55 }, pressed && { opacity: 0.75 }, isGen && { borderColor: C.secondary }]}>
                  {isGen ? <ActivityIndicator size="small" color={C.secondary} /> : <MaterialIcons name={icons[p] as any} size={14} color={isProOrTherapist ? C.secondary : C.textMuted} />}
                  <Text style={[styles.reportsGenBtnText, !isProOrTherapist && { color: C.textMuted }]}>{labels[p]}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={() => router.push('/(tabs)/insights' as any)} style={({ pressed }) => [styles.reportsPatternsLink, pressed && { opacity: 0.8 }]}>
            <MaterialIcons name="bar-chart" size={14} color={C.primary} />
            <Text style={styles.reportsPatternsLinkText}>View Patterns tab for tag & time analysis</Text>
            <MaterialIcons name="chevron-right" size={14} color={C.primary} />
          </Pressable>

          {isProOrTherapist ? (
            reportsLoading && savedReports.length === 0 ? (
              <View style={styles.reportsEmptyCard}><ActivityIndicator size="small" color={C.secondary} /><Text style={styles.reportsEmptyText}>Loading saved reports…</Text></View>
            ) : savedReports.length === 0 ? (
              <View style={styles.reportsEmptyCard}><MaterialIcons name="psychology" size={28} color={C.textMuted} /><Text style={styles.reportsEmptyText}>No reports yet — tap a button above to generate your first AI analysis.</Text></View>
            ) : (
              <View style={styles.reportsList}>
                {groupedReports.map(({ month, dates }) => {
                  const monthOpen = expandedMonths.has(month);
                  const totalInMonth = dates.reduce((n, d) => n + d.reports.length, 0);
                  return (
                    <View key={month} style={[folderStyles.monthFolder, { borderColor: C.secondary + '30', backgroundColor: C.surfaceElevated }]}>
                      {/* Month header — Pressable rendered outside any overflow:hidden container */}
                      <Pressable
                        onPress={() => toggleMonth(month)}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          folderStyles.monthHeader,
                          { borderBottomWidth: monthOpen ? 1 : 0, borderBottomColor: C.border },
                          pressed && { opacity: 0.75 },
                        ]}
                      >
                        <View style={[folderStyles.monthIconWrap, { backgroundColor: C.secondary + '18' }]}>
                          <MaterialIcons name="folder" size={16} color={C.secondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[folderStyles.monthLabel, { color: C.textPrimary }]}>{month}</Text>
                          <Text style={[folderStyles.monthMeta, { color: C.textMuted }]}>{totalInMonth} report{totalInMonth !== 1 ? 's' : ''} · {dates.length} day{dates.length !== 1 ? 's' : ''}</Text>
                        </View>
                        <MaterialIcons name={monthOpen ? 'expand-less' : 'expand-more'} size={20} color={C.textMuted} />
                      </Pressable>

                      {monthOpen ? (
                        <View style={folderStyles.monthBody}>
                          {dates.map(({ date, reports: dateReports }) => {
                            const dateOpen = expandedDates.has(date);
                            return (
                              <View key={date} style={[folderStyles.dateFolder, { borderColor: C.border, backgroundColor: C.background }]}>
                                {/* Date sub-folder header */}
                                <Pressable
                                  onPress={() => toggleDate(date)}
                                  accessibilityRole="button"
                                  style={({ pressed }) => [
                                    folderStyles.dateHeader,
                                    { borderBottomWidth: dateOpen ? 1 : 0, borderBottomColor: C.border },
                                    pressed && { opacity: 0.75 },
                                  ]}
                                >
                                  <View style={[folderStyles.dateIconWrap, { backgroundColor: C.primary + '15' }]}>
                                    <MaterialIcons name="event" size={13} color={C.primary} />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={[folderStyles.dateLabel, { color: C.textPrimary }]}>{date}</Text>
                                    <Text style={[folderStyles.dateMeta, { color: C.textMuted }]}>{dateReports.length} report{dateReports.length !== 1 ? 's' : ''}</Text>
                                  </View>
                                  <View style={folderStyles.dateScores}>
                                    {dateReports.slice(0, 3).map(r => {
                                      const sc = getScoreColor((r.report_data as WellnessInsights).overallScore);
                                      return (
                                        <View key={r.id} style={[folderStyles.scoreChip, { backgroundColor: sc + '20', borderColor: sc + '50' }]}>
                                          <Text style={[folderStyles.scoreChipText, { color: sc }]}>{(r.report_data as WellnessInsights).overallScore}</Text>
                                        </View>
                                      );
                                    })}
                                  </View>
                                  <MaterialIcons name={dateOpen ? 'expand-less' : 'expand-more'} size={18} color={C.textMuted} />
                                </Pressable>

                                {dateOpen ? (
                                  <View style={folderStyles.dateBody}>
                                    {dateReports.map(report => {
                                      const isExpanded = expandedReportId === report.id;
                                      const insights: WellnessInsights = report.report_data;
                                      const scoreColor = getScoreColor(insights.overallScore);
                                      const trendIcon = insights.overallTrend === 'improving' ? 'trending-up' : insights.overallTrend === 'declining' ? 'trending-down' : 'trending-flat';
                                      const trendColor = insights.overallTrend === 'improving' ? C.success : insights.overallTrend === 'declining' ? C.error : C.textSecondary;
                                      const typeLabel = report.report_type === 'daily' ? 'Today' : report.report_type === 'weekly' ? '7-day' : '30-day';
                                      const typeIcon = report.report_type === 'daily' ? 'today' : report.report_type === 'weekly' ? 'calendar-view-week' : 'calendar-month';
                                      const genTime = new Date(report.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                      return (
                                        <Pressable key={report.id} onPress={() => setExpandedReportId(isExpanded ? null : report.id)} style={({ pressed }) => [styles.reportCard, folderStyles.reportCardInFolder, { borderColor: C.border, backgroundColor: C.surfaceElevated }, pressed && { opacity: 0.9 }]}>
                                          <View style={styles.reportCardHeader}>
                                            <View style={[styles.reportTypeBadge, { backgroundColor: C.secondary + '18', borderColor: C.secondary + '40' }]}>
                                              <MaterialIcons name={typeIcon as any} size={12} color={C.secondary} />
                                              <Text style={[styles.reportTypeBadgeText, { color: C.secondary }]}>{typeLabel}</Text>
                                            </View>
                                            <View style={[styles.reportScoreBadge, { backgroundColor: scoreColor + '15', borderColor: scoreColor + '40' }]}>
                                              <Text style={[styles.reportScoreText, { color: scoreColor }]}>{insights.overallScore}</Text>
                                            </View>
                                            <MaterialIcons name={trendIcon as any} size={14} color={trendColor} />
                                            <Text style={styles.reportCardDate}>{genTime}</Text>
                                            <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={18} color={C.textMuted} />
                                          </View>
                                          <Text style={styles.reportCardHeadline} numberOfLines={isExpanded ? undefined : 2}>{insights.headline}</Text>
                                          {isExpanded ? (
                                            <View style={styles.reportCardBody}>
                                              {/* Quick summary */}
                                              {insights.quickSummary ? (
                                                <View style={[styles.reportCelebRow, { backgroundColor: C.primary + '10', borderColor: C.primary + '25' }]}>
                                                  <MaterialIcons name="record-voice-over" size={12} color={C.primary} />
                                                  <Text style={[styles.reportCelebText, { fontStyle: 'italic' }]}>{insights.quickSummary}</Text>
                                                </View>
                                              ) : null}
                                              <View style={styles.reportCelebRow}><MaterialIcons name="celebration" size={12} color={C.primary} /><Text style={styles.reportCelebText}>{insights.celebrationNote}</Text></View>
                                              {(insights as any).journalInsight ? (
                                                <View style={[styles.reportCelebRow, { backgroundColor: '#A78BFA10', borderColor: '#A78BFA30' }]}>
                                                  <MaterialIcons name="menu-book" size={12} color="#A78BFA" />
                                                  <Text style={[styles.reportCelebText, { color: '#A78BFA', fontStyle: 'italic' }]}>{(insights as any).journalInsight}</Text>
                                                </View>
                                              ) : null}
                                              <ReportSection icon="mood" title="Mood patterns" text={insights.moodInsight} color={C.primary} />
                                              {(insights as any).scoreDriversInsight ? <ReportSection icon="bar-chart" title="What moves your score" text={(insights as any).scoreDriversInsight} color={C.success} /> : null}
                                              {insights.fitnessInsight ? <ReportSection icon="fitness-center" title="Body & movement" text={insights.fitnessInsight} color={C.success} /> : null}
                                              {insights.sleepInsight ? <ReportSection icon="bedtime" title="Sleep" text={insights.sleepInsight} color="#7C83FF" /> : null}
                                              {insights.weatherInsight ? <ReportSection icon="wb-sunny" title="Weather" text={insights.weatherInsight} color="#FFD166" /> : null}
                                              {insights.astrologyInsight ? <ReportSection icon="auto-awesome" title="Cosmic" text={insights.astrologyInsight} color="#A78BFA" /> : null}
                                              {/* Behaviour Recommendations in saved reports */}
                                              {Array.isArray((insights as any).behaviorRecommendations) && (insights as any).behaviorRecommendations.length > 0 ? (
                                                <View style={styles.reportAdviceBox}>
                                                  <View style={styles.reportAdviceHeader}>
                                                    <MaterialIcons name="psychology" size={13} color={C.secondary} />
                                                    <Text style={[styles.reportAdviceTitle, { color: C.secondary }]}>Behaviour Recommendations</Text>
                                                  </View>
                                                  {((insights as any).behaviorRecommendations as BehaviorRecommendation[]).map((rec, ri) => (
                                                    <View key={ri} style={[styles.reportAdviceRow, { alignItems: 'flex-start', paddingVertical: 4, borderTopWidth: ri > 0 ? 1 : 0, borderTopColor: C.border }]}>
                                                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.secondary + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                                                        <Text style={{ fontSize: 9, fontWeight: '900', color: C.secondary, includeFontPadding: false } as any}>#{rec.priority}</Text>
                                                      </View>
                                                      <View style={{ flex: 1, gap: 2 }}>
                                                        <Text style={{ fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{rec.title}</Text>
                                                        <Text style={[styles.reportAdviceText, { color: C.textSecondary }]}>{rec.summary}</Text>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                                          <MaterialIcons name="lightbulb" size={10} color={C.primary} />
                                                          <Text style={{ fontSize: 10, color: C.textMuted, flex: 1, includeFontPadding: false } as any} numberOfLines={2}>{rec.notObviousInsight}</Text>
                                                        </View>
                                                      </View>
                                                    </View>
                                                  ))}
                                                </View>
                                              ) : null}
                                              {insights.actionableAdvice?.length > 0 ? (
                                                <View style={styles.reportAdviceBox}>
                                                  <View style={styles.reportAdviceHeader}><MaterialIcons name="lightbulb" size={13} color={C.primary} /><Text style={styles.reportAdviceTitle}>Action steps</Text></View>
                                                  {insights.actionableAdvice.map((a: string, i: number) => (
                                                    <View key={i} style={styles.reportAdviceRow}><Text style={styles.reportAdviceNum}>{i + 1}.</Text><Text style={styles.reportAdviceText}>{a}</Text></View>
                                                  ))}
                                                </View>
                                              ) : null}
                                              {insights.watchOut ? (
                                                <View style={styles.reportWatchRow}><MaterialIcons name="warning-amber" size={12} color={C.warning} /><Text style={styles.reportWatchText}>{insights.watchOut}</Text></View>
                                              ) : null}
                                            </View>
                                          ) : null}
                                        </Pressable>
                                      );
                                    })}
                                  </View>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )
          ) : (
            <View style={styles.reportsLockedCard}>
              <MaterialIcons name="lock" size={20} color={C.primary} />
              <Text style={styles.reportsLockedTitle}>Pro feature</Text>
              <Text style={styles.reportsLockedSub}>Upgrade to Pro to generate and save AI Wellness Reports.</Text>
            </View>
          )}
        </View>

        {/* Export section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Export for therapist</Text>
            {!isProOrTherapist ? <View style={styles.proLockedBadge}><MaterialIcons name="lock" size={10} color={C.primary} /><Text style={styles.proLockedText}>Pro</Text></View> : null}
          </View>
          <View style={styles.exportCard}>
            <Text style={styles.exportDesc}>Share your mood history, wellness report, and correlations directly with your therapist or care provider.</Text>
            <View style={styles.exportBtns}>
              <Pressable onPress={handleExportCSV} disabled={exporting} style={({ pressed }) => [styles.exportBtn, !isProOrTherapist && styles.exportBtnLocked, pressed && { opacity: 0.8 }]}>
                {exporting ? <ActivityIndicator size="small" color={C.primary} /> : <><MaterialIcons name="table-chart" size={16} color={isProOrTherapist ? C.primary : C.textMuted} /><Text style={[styles.exportBtnText, !isProOrTherapist && { color: C.textMuted }]}>Export CSV</Text></>}
              </Pressable>
              <Pressable onPress={handleExportReport} disabled={exporting} style={({ pressed }) => [styles.exportBtn, !isProOrTherapist && styles.exportBtnLocked, pressed && { opacity: 0.8 }]}>
                {exporting ? <ActivityIndicator size="small" color={C.secondary} /> : <><MaterialIcons name="description" size={16} color={isProOrTherapist ? C.secondary : C.textMuted} /><Text style={[styles.exportBtnText, { color: isProOrTherapist ? C.secondary : C.textMuted }]}>Full Report</Text></>}
              </Pressable>
            </View>
          </View>
        </View>

        {/* Premium upgrade / active badge */}
        {!isProOrTherapist ? (
          <View style={styles.premiumCard}>
            <View style={styles.premiumHeader}><MaterialIcons name="star" size={20} color={C.primary} /><Text style={styles.premiumTitle}>Upgrade to Pro</Text></View>
            <Text style={styles.premiumSubtitle}>Unlock the full MyMoodMapp experience</Text>
            <View style={styles.tierCompareBlock}>
              <View style={[styles.tierCompareHeader, { borderColor: C.primary + '50', backgroundColor: C.primarySoft }]}>
                <MaterialIcons name="star" size={14} color={C.primary} />
                <Text style={[styles.tierCompareTitle, { color: C.primary }]}>
                  {'Pro — '}
                  {Platform.OS !== 'web' && rcPackages.pro
                    ? rcPackages.pro.product.priceString + '/mo'
                    : '$3.99/mo'}
                </Text>
              </View>
              {['Unlimited mood history & AI insights', 'Export mood data & wellness reports', 'Unlimited accountability buddies (free: 1 buddy included)', 'Advanced fitness × mood correlations', 'Predictive alerts & deeper pattern reports'].map(f => (
                <View key={f} style={styles.premiumFeatureRow}><MaterialIcons name="check-circle" size={14} color={C.success} /><Text style={styles.premiumFeatureText}>{f}</Text></View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingTop: 4 }}>
                <MaterialIcons name="card-giftcard" size={13} color={C.primary} />
                <Text style={{ fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '700', includeFontPadding: false } as any}>30-day free trial — no credit card required</Text>
              </View>
              <Pressable onPress={() => handleUpgrade(SUBSCRIPTION_PLANS.pro.priceId, 'Pro')} disabled={checkingOut} style={({ pressed }) => [styles.tierCta, { borderColor: C.primary, backgroundColor: C.primary }, pressed && { opacity: 0.85 }, checkingOut && { opacity: 0.6 }]}>
                {checkingOut ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.tierCtaText, { color: '#fff' }]}>Start 30-day free trial →</Text>}
              </Pressable>
              {Platform.OS === 'ios' ? (
                <Text style={styles.iapDisclosure}>
                  {'Free for 30 days, then '}
                  {rcPackages.pro ? rcPackages.pro.product.priceString : '$3.99'}
                  {'/month. Payment charged to your Apple ID at confirmation. Subscription auto-renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel in Settings → Apple ID → Subscriptions.'}
                </Text>
              ) : null}
            </View>
            <View style={[styles.tierCompareBlock, { marginTop: Spacing.md }]}>
              <View style={[styles.tierCompareHeader, { borderColor: C.secondary + '50', backgroundColor: C.secondarySoft }]}>
                <MaterialIcons name="psychology" size={14} color={C.secondary} />
                <Text style={[styles.tierCompareTitle, { color: C.secondary }]}>
                  {'Therapist Pro — '}
                  {Platform.OS !== 'web' && rcPackages.therapistPro
                    ? rcPackages.therapistPro.product.priceString + '/mo'
                    : '$9.99/mo'}
                </Text>
              </View>
              <Text style={styles.tierCompareDesc}>Everything in Pro, built for mental health professionals.</Text>
              {['Act as accountability buddy to unlimited clients', 'Full client dashboard with 14-day mood trend', 'Unlimited client slots with invite-link onboarding', 'Private therapist notes per client', 'All Pro features included'].map(f => (
                <View key={f} style={styles.premiumFeatureRow}><MaterialIcons name="check-circle" size={14} color={C.secondary} /><Text style={styles.premiumFeatureText}>{f}</Text></View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingTop: 4 }}>
                <MaterialIcons name="card-giftcard" size={13} color={C.secondary} />
                <Text style={{ fontSize: Typography.fontSizes.xs, color: C.secondary, fontWeight: '700', includeFontPadding: false } as any}>30-day free trial — no credit card required</Text>
              </View>
              <Pressable onPress={() => handleUpgrade(SUBSCRIPTION_PLANS.therapist_pro.priceId, 'Therapist Pro')} disabled={checkingOut} style={({ pressed }) => [styles.tierCta, { borderColor: C.secondary, backgroundColor: C.secondary }, pressed && { opacity: 0.85 }, checkingOut && { opacity: 0.6 }]}>
                {checkingOut ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.tierCtaText, { color: '#fff' }]}>Start 30-day free trial →</Text>}
              </Pressable>
              {Platform.OS === 'ios' ? (
                <Text style={styles.iapDisclosure}>
                  {'Free for 30 days, then '}
                  {rcPackages.therapistPro ? rcPackages.therapistPro.product.priceString : '$9.99'}
                  {'/month. Payment charged to your Apple ID at confirmation. Subscription auto-renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel in Settings → Apple ID → Subscriptions.'}
                </Text>
              ) : null}
            </View>
            <Text style={styles.premiumNote}>
              {Platform.OS === 'web'
                ? 'No credit card required. Cancel before day 31 and pay nothing.'
                : 'Subscription managed by Apple. Cancel anytime in Settings → Apple ID → Subscriptions before day 31.'}
            </Text>
            {Platform.OS !== 'web' ? (
              <Pressable onPress={handleRestorePurchases} disabled={restoringPurchases} style={({ pressed }) => [{ alignSelf: 'center', marginTop: 4 }, pressed && { opacity: 0.6 }]}>
                {restoringPurchases ? <ActivityIndicator size="small" color={C.textMuted} /> : <Text style={[styles.premiumNote, { textDecorationLine: 'underline' }]}>Restore purchases</Text>}
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.premiumBadge}>
            <MaterialIcons name="star" size={16} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumBadgeText}>{subscriptionTier === 'therapist_pro' ? 'Therapist Pro — all features unlocked' : 'Pro active — all features unlocked'}</Text>
              {subscriptionEnd ? <Text style={[styles.premiumBadgeText, { fontSize: 10, opacity: 0.7, marginTop: 2 }]}>Renews {new Date(subscriptionEnd).toLocaleDateString()}</Text> : null}
            </View>
            <Pressable onPress={handleManageSubscription} style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.7 }]}>
              <Text style={styles.manageBtnText}>
                {Platform.OS === 'ios' ? 'Manage in Settings' : Platform.OS === 'android' ? 'Manage in Google Play' : 'Manage'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={18} color={isDark ? C.secondary : C.primary} />
                  <Text style={styles.settingLabel}>{isDark ? 'Dark mode' : 'Light mode'}</Text>
                </View>
                <Text style={styles.settingDesc}>{isDark ? 'Switch to a bright, clean light theme' : 'Switch back to the immersive dark theme'}</Text>
              </View>
              <Pressable onPress={toggleTheme} style={[styles.toggle, !isDark && styles.toggleOn]} hitSlop={8} accessibilityLabel="Toggle dark/light mode">
                <View style={[styles.toggleThumb, !isDark && styles.toggleThumbOn]} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Reminders */}
        <RemindersWidget C={C} styles={styles} />

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.settingsCard}>
            {[
              { icon: 'lock', text: 'Data is encrypted and stored in your account.' },
              { icon: 'block', text: 'We never sell or share your personal data.' },
              { icon: 'cloud-done', text: 'Your mood history syncs across devices via your account.' },
            ].map((item, i) => (
              <View key={i} style={[styles.privacyRow, i === 0 && { borderTopWidth: 0 }]}>
                <MaterialIcons name={item.icon as any} size={16} color={C.success} />
                <Text style={styles.privacyText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Legal links */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.md }}>
          <Pressable
            onPress={() => router.push('/privacy' as any)}
            style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border }, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="privacy-tip" size={14} color={C.textMuted} />
            <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '600', includeFontPadding: false } as any}>Privacy Policy</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/terms' as any)}
            style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border }, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="description" size={14} color={C.textMuted} />
            <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '600', includeFontPadding: false } as any}>Terms of Service</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/support' as any)}
            style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border }, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="help-outline" size={14} color={C.textMuted} />
            <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '600', includeFontPadding: false } as any}>Support</Text>
          </Pressable>
        </View>

        {/* Account actions */}
        <View style={styles.accountActions}>
          <Pressable onPress={handleClearData} style={[styles.accountBtn, { borderColor: C.border }]}>
            <MaterialIcons name="delete-outline" size={16} color={C.textMuted} />
            <Text style={[styles.accountBtnText, { color: C.textMuted }]}>Clear local data</Text>
          </Pressable>
          <Pressable onPress={handleLogout} style={[styles.accountBtn, { borderColor: C.error + '50' }]}>
            <MaterialIcons name="logout" size={16} color={C.error} />
            <Text style={[styles.accountBtnText, { color: C.error }]}>Sign out</Text>
          </Pressable>
        </View>
      </WebMaxWidth>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Weekly Summary Card ─────────────────────────────────────────────────────
function WeeklySummaryCard({ weekAvg, weekDaysLogged, weekBest, weekWorst, weekDelta, weekBarDays, C, styles }: {
  weekAvg: number | null; weekDaysLogged: number; weekBest: number | null; weekWorst: number | null;
  weekDelta: number | null; weekBarDays: { ds: string; dayLabel: string; isToday: boolean; avg: number | null }[];
  C: typeof DarkColors; styles: ReturnType<typeof makeProfileStyles>;
}) {
  const hasData = weekAvg !== null;
  const scoreColor = weekAvg !== null ? getScoreColor(weekAvg) : C.textMuted;
  const trendUp = weekDelta !== null && weekDelta > 0;
  const trendDown = weekDelta !== null && weekDelta < 0;
  const maxBar = weekBarDays.some(d => d.avg !== null) ? Math.max(...weekBarDays.filter(d => d.avg !== null).map(d => d.avg!), 50) : 100;
  return (
    <View style={[wsStyles.card, {
      borderColor: hasData ? scoreColor + '50' : C.border,
      backgroundColor: C.surfaceElevated,
      // Outer glow matching the reference "This Week" card
      shadowColor: hasData ? scoreColor : '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: hasData ? 0.30 : 0.10,
      shadowRadius: 18,
      elevation: 8,
    }]}>
      <View style={wsStyles.header}>
        <View style={[wsStyles.iconWrap, { backgroundColor: C.primary + '18' }]}>
          <MaterialIcons name="calendar-view-week" size={16} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[wsStyles.title, { color: C.textPrimary }]}>This Week</Text>
          <Text style={[wsStyles.sub, { color: C.textMuted }]}>{hasData ? `${weekDaysLogged} of 7 days logged` : 'No entries this week'}</Text>
        </View>
        {weekDelta !== null ? (
          <View style={[wsStyles.trendPill, { backgroundColor: trendUp ? C.success + '20' : trendDown ? C.error + '20' : C.border }]}>
            <MaterialIcons name={trendUp ? 'trending-up' : trendDown ? 'trending-down' : 'trending-flat'} size={12} color={trendUp ? C.success : trendDown ? C.error : C.textMuted} />
            <Text style={[wsStyles.trendText, { color: trendUp ? C.success : trendDown ? C.error : C.textMuted }]}>{trendUp ? '+' : ''}{weekDelta} vs last week</Text>
          </View>
        ) : null}
      </View>
      {hasData ? (
        <>
          <View style={wsStyles.statsRow}>
          <ScoreBubble
            score={weekAvg!}
            emoji={getScoreEmoji(weekAvg!)}
            label={getScoreLabel(weekAvg!)}
            size="large"
          />
            <View style={wsStyles.statsCols}>
              <View style={[wsStyles.statChip, { backgroundColor: C.background, borderColor: C.border }]}>
                <Text style={[wsStyles.statVal, { color: C.success }]}>{weekBest ?? '—'}</Text>
                <Text style={[wsStyles.statLbl, { color: C.textMuted }]}>Best</Text>
              </View>
              <View style={[wsStyles.statChip, { backgroundColor: C.background, borderColor: C.border }]}>
                <Text style={[wsStyles.statVal, { color: C.error }]}>{weekWorst ?? '—'}</Text>
                <Text style={[wsStyles.statLbl, { color: C.textMuted }]}>Worst</Text>
              </View>
              <View style={[wsStyles.statChip, { backgroundColor: C.background, borderColor: C.border }]}>
                <Text style={[wsStyles.statVal, { color: C.primary }]}>{weekDaysLogged}/7</Text>
                <Text style={[wsStyles.statLbl, { color: C.textMuted }]}>Days</Text>
              </View>
            </View>
          </View>
          <View style={[wsStyles.chartCard, { backgroundColor: C.background, borderColor: C.border }]}>
            <View style={wsStyles.chartBars}>
              {weekBarDays.map((d, i) => {
                const barH = d.avg != null ? Math.max(4, Math.round((d.avg / maxBar) * 44)) : 3;
                const color = d.avg != null ? getScoreColor(d.avg) : C.border;
                return (
                  <View key={i} style={wsStyles.barCol}>
                    {d.avg != null ? <Text style={[wsStyles.barScore, { color }]}>{d.avg}</Text> : <Text style={wsStyles.barScore}> </Text>}
                    <View style={[wsStyles.bar, { height: barH, backgroundColor: d.isToday ? color : color + (d.avg != null ? '80' : '25'), borderWidth: d.isToday ? 1.5 : 0, borderColor: color }]} />
                    <Text style={[wsStyles.barDay, d.isToday && { color: C.textPrimary, fontWeight: '700' }]}>{d.isToday ? 'Now' : d.dayLabel}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </>
      ) : (
        <View style={wsStyles.emptyRow}>
          <MaterialIcons name="add-chart" size={16} color={C.textMuted} />
          <Text style={[wsStyles.emptyText, { color: C.textMuted }]}>Log check-ins this week to see your 7-day summary here.</Text>
        </View>
      )}
    </View>
  );
}

// ── Folder hierarchy styles ────────────────────────────────────────────────
// IMPORTANT: No overflow:'hidden' on monthFolder or dateFolder — that blocks
// Pressable events on React Native Web. position:'relative' + zIndex creates
// a proper stacking context so Pressable headers receive pointer events above
// the card background paint on web.
const folderStyles = StyleSheet.create({
  monthFolder: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    position: 'relative',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    minHeight: 52,
  },
  monthIconWrap: {
    width: 34, height: 34, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  monthLabel: { fontSize: Typography.fontSizes.md, fontWeight: '700', includeFontPadding: false },
  monthMeta: { fontSize: Typography.fontSizes.xs, includeFontPadding: false, marginTop: 1 },
  monthBody: { padding: Spacing.sm, gap: Spacing.sm },
  dateFolder: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    position: 'relative',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    minHeight: 48,
  },
  dateIconWrap: {
    width: 28, height: 28, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dateLabel: { fontSize: Typography.fontSizes.sm, fontWeight: '600', includeFontPadding: false },
  dateMeta: { fontSize: 10, includeFontPadding: false, marginTop: 1 },
  dateScores: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  scoreChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1 },
  scoreChipText: { fontSize: 10, fontWeight: '800', includeFontPadding: false },
  dateBody: { padding: Spacing.sm, gap: Spacing.sm },
  reportCardInFolder: { borderRadius: Radius.md },
});

const wsStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
    // Glass card with colored outer glow — this IS the reference "This Week" card
    // The glow shadow color is dynamic (scoreColor) so it’s applied inline
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrap: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: Typography.fontSizes.md, fontWeight: '700', includeFontPadding: false },
  sub: { fontSize: Typography.fontSizes.xs, includeFontPadding: false },
  trendPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  trendText: { fontSize: 10, fontWeight: '600', includeFontPadding: false },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  scoreCircle: { width: 72, height: 72, borderRadius: Radius.xl, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 1, flexShrink: 0 },
  scoreNum: { fontSize: 20, fontWeight: '900', includeFontPadding: false },
  scoreLabel: { fontSize: 9, fontWeight: '700', includeFontPadding: false },
  statsCols: { flex: 1, flexDirection: 'row', gap: Spacing.sm },
  statChip: { flex: 1, alignItems: 'center', borderRadius: Radius.md, paddingVertical: 8, borderWidth: 1, gap: 2 },
  statVal: { fontSize: Typography.fontSizes.lg, fontWeight: '900', includeFontPadding: false },
  statLbl: { fontSize: 9, includeFontPadding: false },
  chartCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.sm },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 68, paddingTop: 14 },
  barCol: { flex: 1, alignItems: 'center', gap: 2 },
  barScore: { fontSize: 8, color: '#888', fontWeight: '600', includeFontPadding: false },
  bar: { width: '100%', borderRadius: 3, minHeight: 3 },
  barDay: { fontSize: 8, color: '#888', includeFontPadding: false },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  emptyText: { flex: 1, fontSize: Typography.fontSizes.xs, lineHeight: 18, includeFontPadding: false },
});

function StatBox({ label, value, color, icon }: { label: string; value: number | string; color: string; icon: string }) {
  const { colors: C2, isDark } = useTheme();
  const G2 = getGlass(isDark);
  return (
    <View style={{
      flex: 1, backgroundColor: G2.cardBgLight, borderRadius: Radius.lg,
      padding: Spacing.sm, paddingVertical: Spacing.md,
      alignItems: 'center', gap: 2,
      borderWidth: 1, borderColor: color + '30',
      shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4,
    }}>
      <MaterialIcons name={icon as any} size={16} color={color} />
      <Text style={{ fontSize: Typography.fontSizes.lg, fontWeight: Typography.fontWeights.bold, color, includeFontPadding: false }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
      <Text style={{ fontSize: 10, color: C2.textMuted, textAlign: 'center', includeFontPadding: false, width: '100%' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
    </View>
  );
}

function getPHQ9Color(s: number) { return s <= 4 ? '#4ADE80' : s <= 9 ? '#FFD166' : s <= 14 ? '#FF8C42' : '#EF4444'; }
function getGAD7Color(s: number) { return s <= 4 ? '#4ADE80' : s <= 9 ? '#FFD166' : s <= 14 ? '#FF8C42' : '#EF4444'; }
function getPHQ9Label(s: number) { return s <= 4 ? 'Minimal' : s <= 9 ? 'Mild' : s <= 14 ? 'Moderate' : s <= 19 ? 'Moderately severe' : 'Severe'; }
function getGAD7Label(s: number) { return s <= 4 ? 'Minimal' : s <= 9 ? 'Mild' : s <= 14 ? 'Moderate' : 'Severe'; }
function getSleepLabel(s: number) { return s <= 1 ? 'Good' : s <= 3 ? 'Moderate' : 'Poor'; }
function getSleepColor(s: number) { return s <= 1 ? '#4ADE80' : s <= 3 ? '#FFD166' : '#EF4444'; }
function getAuditLabel(s: number) { return s <= 2 ? 'Low risk' : s <= 5 ? 'Moderate' : 'High'; }
function getAuditColor(s: number) { return s <= 2 ? '#4ADE80' : s <= 5 ? '#FFD166' : '#EF4444'; }

function WellbeingProfileCard({ intakeCompleted, intakeSummaryData, hasTherapistBuddy, expanded, onToggleExpanded, onRetake, onAddTherapistSection, styles, C }: {
  intakeCompleted: boolean; intakeSummaryData: Record<string, any> | null; hasTherapistBuddy: boolean;
  expanded: boolean; onToggleExpanded: () => void; onRetake: () => void; onAddTherapistSection: () => void;
  styles: ReturnType<typeof makeProfileStyles>; C: typeof DarkColors;
}) {
  if (!intakeCompleted || !intakeSummaryData) {
    return (
      <Pressable onPress={onRetake} style={({ pressed }) => [styles.insightsCta, { backgroundColor: C.surfaceElevated, borderColor: C.primary + '40' }, pressed && { opacity: 0.85 }]}>
        <View style={styles.insightsCtaLeft}>
          <MaterialIcons name="favorite" size={22} color={C.primary} />
          <View>
            <Text style={styles.insightsCtaTitle}>My Wellbeing Profile</Text>
            <Text style={styles.insightsCtaSubtitle}>Required for AI reports · takes ~5 minutes</Text>
          </View>
        </View>
        <View style={styles.intakeRequiredBadge}><Text style={styles.intakeRequiredText}>Required</Text></View>
      </Pressable>
    );
  }
  const d = intakeSummaryData;
  const phq9 = d.phq9_total ?? 0; const gad7 = d.gad7_total ?? 0;
  const sleep = d.sleep_score ?? 0; const audit = d.audit_total ?? 0;
  const hasFlags = d.safety_flag || d.trauma_flag || phq9 >= 15 || gad7 >= 15;
  return (
    <View style={[wpStyles.container, { borderColor: C.primary + '40', backgroundColor: C.surfaceElevated }]}>
      <Pressable onPress={onToggleExpanded} style={({ pressed }) => [wpStyles.header, pressed && { opacity: 0.8 }]}>
        <View style={[wpStyles.iconWrap, { backgroundColor: C.primary + '18' }]}>
          <MaterialIcons name="favorite" size={20} color={C.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[wpStyles.title, { color: C.textPrimary }]}>My Wellbeing Profile</Text>
          <Text style={[wpStyles.sub, { color: C.textMuted }]}>{d.therapist_mode ? 'Full profile complete · includes therapist section' : 'Profile complete · tap to view your summary'}</Text>
        </View>
        <MaterialIcons name="check-circle" size={18} color={C.success} />
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={C.textMuted} />
      </Pressable>
      {expanded ? (
        <View style={[wpStyles.body, { borderTopColor: C.border }]}>
          {hasFlags ? (
            <View style={[wpStyles.flagCard, { borderColor: C.warning + '40', backgroundColor: C.warning + '10' }]}>
              <View style={wpStyles.flagHeader}>
                <MaterialIcons name="warning-amber" size={14} color={C.warning} />
                <Text style={[wpStyles.flagTitle, { color: C.warning }]}>Important flags</Text>
              </View>
              {d.safety_flag ? <Text style={[wpStyles.flagText, { color: C.error }]}>• You reported thoughts of self-harm. Please reach out if struggling.</Text> : null}
              {d.trauma_flag ? <Text style={[wpStyles.flagText, { color: C.warning }]}>• Difficult past experiences that still affect you today.</Text> : null}
              {phq9 >= 15 ? <Text style={[wpStyles.flagText, { color: C.error }]}>• PHQ-9 score suggests {getPHQ9Label(phq9).toLowerCase()} depression symptoms.</Text> : null}
              {gad7 >= 15 ? <Text style={[wpStyles.flagText, { color: C.error }]}>• GAD-7 score suggests {getGAD7Label(gad7).toLowerCase()} anxiety symptoms.</Text> : null}
            </View>
          ) : null}
          <View style={[wpStyles.section, { backgroundColor: C.background, borderColor: C.border }]}>
            <Text style={[wpStyles.sectionTitle, { color: C.textMuted }]}>Severity indicators</Text>
            <WpMeter label="PHQ-9" score={phq9} max={27} color={getPHQ9Color(phq9)} sublabel={getPHQ9Label(phq9)} C={C} />
            <WpMeter label="GAD-7" score={gad7} max={21} color={getGAD7Color(gad7)} sublabel={getGAD7Label(gad7)} C={C} />
            <WpMeter label="Sleep" score={sleep} max={6} color={getSleepColor(sleep)} sublabel={getSleepLabel(sleep)} C={C} />
            <WpMeter label="AUDIT-C" score={audit} max={12} color={getAuditColor(audit)} sublabel={getAuditLabel(audit)} C={C} />
            <Text style={[wpStyles.credit, { color: C.textMuted }]}>PHQ-9 and GAD-7 are in the public domain. AUDIT-C © WHO.</Text>
            <Text style={[wpStyles.credit, { color: C.error + 'AA', marginTop: 4 }]}>These scores are screening tools only — not clinical diagnoses. Consult a qualified mental health professional for medical advice.</Text>
          </View>
          {d.presenting_concern ? (
            <View style={[wpStyles.section, { backgroundColor: C.background, borderColor: C.border }]}>
              <Text style={[wpStyles.sectionTitle, { color: C.textMuted }]}>Presenting concern</Text>
              <WpQuote text={d.presenting_concern} C={C} />
            </View>
          ) : null}
          <View style={[wpStyles.section, { backgroundColor: C.background, borderColor: C.border }]}>
            <Text style={[wpStyles.sectionTitle, { color: C.textMuted }]}>History</Text>
            {d.duration ? <WpRow label="Duration" value={d.duration} C={C} /> : null}
            {d.prior_therapy ? <WpRow label="Prior therapy" value={d.prior_therapy} C={C} /> : null}
            {d.support_level ? <WpRow label="Support level" value={d.support_level} C={C} /> : null}
          </View>
          {(d.whats_working || d.goal_feel) ? (
            <View style={[wpStyles.section, { backgroundColor: C.background, borderColor: C.border }]}>
              <Text style={[wpStyles.sectionTitle, { color: C.textMuted }]}>Strengths & goals</Text>
              {d.whats_working ? (<><Text style={[wpStyles.fieldLabel, { color: C.textSecondary }]}>What is working:</Text><WpQuote text={d.whats_working} C={C} /></>) : null}
              {d.goal_feel ? (<><Text style={[wpStyles.fieldLabel, { color: C.textSecondary }]}>Goals:</Text><WpQuote text={d.goal_feel} C={C} /></>) : null}
            </View>
          ) : null}
          {d.therapist_mode && d.pref_style ? (
            <View style={[wpStyles.section, { backgroundColor: C.secondary + '08', borderColor: C.secondary + '30' }]}>
              <Text style={[wpStyles.sectionTitle, { color: C.secondary }]}>For your therapist</Text>
              {d.pref_style ? <WpRow label="Preferred style" value={d.pref_style} C={C} /> : null}
              {d.support_why ? (<><Text style={[wpStyles.fieldLabel, { color: C.textSecondary }]}>Therapy goal:</Text><WpQuote text={d.support_why} C={C} /></>) : null}
            </View>
          ) : null}
          <View style={wpStyles.actions}>
            <Pressable onPress={onRetake} style={({ pressed }) => [wpStyles.retakeBtn, { borderColor: C.border, backgroundColor: C.surfaceElevated }, pressed && { opacity: 0.75 }]}>
              <MaterialIcons name="refresh" size={15} color={C.textMuted} />
              <Text style={[wpStyles.retakeBtnText, { color: C.textMuted }]}>Retake full quiz</Text>
            </Pressable>
            {hasTherapistBuddy && !d.therapist_mode ? (
              <Pressable onPress={onAddTherapistSection} style={({ pressed }) => [wpStyles.retakeBtn, { borderColor: C.secondary + '50', backgroundColor: C.secondary + '10', flex: 1 }, pressed && { opacity: 0.75 }]}>
                <MaterialIcons name="psychology" size={15} color={C.secondary} />
                <Text style={[wpStyles.retakeBtnText, { color: C.secondary }]}>Add therapist section</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const wpStyles = StyleSheet.create({
  container: { borderRadius: Radius.xl, borderWidth: 1, marginBottom: Spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontSize: Typography.fontSizes.md, fontWeight: '700', includeFontPadding: false },
  sub: { fontSize: Typography.fontSizes.xs, includeFontPadding: false },
  body: { borderTopWidth: 1, padding: Spacing.md, gap: Spacing.md },
  flagCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  flagHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flagTitle: { fontSize: Typography.fontSizes.sm, fontWeight: '700', includeFontPadding: false },
  flagText: { fontSize: Typography.fontSizes.xs, lineHeight: 18, includeFontPadding: false },
  section: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  sectionTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, includeFontPadding: false },
  fieldLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '600', includeFontPadding: false },
  credit: { fontSize: 9, includeFontPadding: false },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  meterLeft: { width: 68 },
  meterLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '700', includeFontPadding: false },
  meterSub: { fontSize: 9, fontWeight: '600', includeFontPadding: false },
  meterTrack: { flex: 1, height: 6, borderRadius: Radius.full, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: Radius.full },
  meterScore: { fontSize: 10, fontWeight: '700', width: 32, textAlign: 'right', includeFontPadding: false },
  quoteBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderRadius: Radius.md, padding: Spacing.sm, borderLeftWidth: 3 },
  quoteText: { flex: 1, fontSize: Typography.fontSizes.xs, lineHeight: 18, fontStyle: 'italic', includeFontPadding: false },
  rowItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  rowLabel: { fontSize: Typography.fontSizes.xs, width: 90, includeFontPadding: false },
  rowValue: { flex: 1, fontSize: Typography.fontSizes.xs, fontWeight: '600', includeFontPadding: false },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, minHeight: 44 },
  retakeBtnText: { fontSize: Typography.fontSizes.xs, fontWeight: '700', includeFontPadding: false },
});

function WpMeter({ label, score, max, color, sublabel, C }: { label: string; score: number; max: number; color: string; sublabel: string; C: typeof DarkColors }) {
  const pct = Math.min((score / max) * 100, 100);
  return (
    <View style={wpStyles.meterRow}>
      <View style={wpStyles.meterLeft}>
        <Text style={[wpStyles.meterLabel, { color: C.textPrimary }]}>{label}</Text>
        <Text style={[wpStyles.meterSub, { color }]}>{sublabel}</Text>
      </View>
      <View style={[wpStyles.meterTrack, { backgroundColor: C.border }]}>
        <View style={[wpStyles.meterFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[wpStyles.meterScore, { color }]}>{score}/{max}</Text>
    </View>
  );
}

function WpQuote({ text, C }: { text: string; C: typeof DarkColors }) {
  return (
    <View style={[wpStyles.quoteBlock, { backgroundColor: C.background, borderLeftColor: C.primary + '60' }]}>
      <MaterialIcons name="format-quote" size={12} color={C.textMuted} />
      <Text style={[wpStyles.quoteText, { color: C.textSecondary }]}>{text.trim()}</Text>
    </View>
  );
}

function WpRow({ label, value, C }: { label: string; value: string; C: typeof DarkColors }) {
  return (
    <View style={wpStyles.rowItem}>
      <Text style={[wpStyles.rowLabel, { color: C.textMuted }]}>{label}:</Text>
      <Text style={[wpStyles.rowValue, { color: C.textPrimary }]}>{value}</Text>
    </View>
  );
}

function ReportSection({ icon, title, text, color }: { icon: string; title: string; text: string; color: string }) {
  const { colors: C2 } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.xs }}>
      <MaterialIcons name={icon as any} size={13} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C2.textPrimary, includeFontPadding: false, marginBottom: 2 }}>{title}</Text>
        <Text style={{ fontSize: Typography.fontSizes.xs, color: C2.textSecondary, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false }}>{text}</Text>
      </View>
    </View>
  );
}

// ── Reminders Widget — collapsible, includes notification scheduler + Apple Watch section ──
function RemindersWidget({ C, styles }: { C: typeof DarkColors; styles: ReturnType<typeof makeProfileStyles> }) {
  const [expanded, setExpanded] = React.useState(false);
  const { isDark } = useTheme();
  const G = getGlass(isDark);
  return (
    <View style={[{ borderRadius: Radius.xl, borderWidth: 1, borderColor: G.cardBorder, backgroundColor: G.cardBg, marginBottom: Spacing.xl, overflow: 'hidden' }]}>
      <Pressable
        onPress={() => setExpanded(e => !e)}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg }, pressed && { opacity: 0.75 }]}
      >
        <View style={{ width: 36, height: 36, borderRadius: Radius.md, backgroundColor: C.primary + '18', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="notifications" size={18} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>Reminders</Text>
          <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>Daily check-in alerts · Apple Watch logging</Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color={C.textMuted} />
      </Pressable>
      {expanded ? (
        <View style={{ borderTopWidth: 1, borderTopColor: G.cardBorder, padding: Spacing.lg, gap: Spacing.lg }}>
          {/* Notification Scheduler */}
          <NotificationScheduler />
          {/* Apple Watch section */}
          {Platform.OS !== 'web' ? (
            <View style={{ gap: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <MaterialIcons name="watch" size={16} color={C.secondary} />
                <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>Log Directly from Apple Watch</Text>
              </View>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: 18, includeFontPadding: false } as any}>
                When a check-in reminder arrives on your Apple Watch, you can log your mood instantly without opening the app — just tap the notification action button.
              </Text>
              <View style={{ gap: Spacing.sm }}>
                {[
                  { emoji: '🟢', label: 'Great', desc: 'Logs score 90 instantly' },
                  { emoji: '😊', label: 'Good', desc: 'Logs score 75 instantly' },
                  { emoji: '😐', label: 'Fine', desc: 'Logs score 55 instantly' },
                  { emoji: '😕', label: 'Not Great', desc: 'Logs score 40 instantly' },
                  { emoji: '😞', label: 'Low', desc: 'Logs score 25 instantly' },
                ].map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.surface, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{item.label}</Text>
                      <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>{item.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.primarySoft, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '30' }}>
                <MaterialIcons name="info-outline" size={14} color={C.primary} />
                <Text style={{ flex: 1, fontSize: Typography.fontSizes.xs, color: C.primary, lineHeight: 17, includeFontPadding: false } as any}>
                  Enable notifications and set a reminder time above. The watch action buttons appear automatically on your wrist when the notification arrives.
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
