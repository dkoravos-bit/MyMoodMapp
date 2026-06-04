// @ts-nocheck
/**
 * MyMoodMap — Home Dashboard
 * MFP-style: today's score, context tags, 7-day trend, quick log CTA,
 * pattern previews (what moves your score), fitness rings, cosmic data.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, DarkColors, Typography, Spacing, Radius, Shadows, Glass, getGlass, LightColors } from '@/constants/theme';
import { ScoreBubble } from '@/components/ui/GlassCard';
import { useTheme } from '@/contexts/ThemeContext';
import { StreakBadge } from '@/components/feature/StreakBadge';
import {
  getScoreColor,
  getScoreEmoji,
  getScoreLabel,
  getTimeOfDay,
  getTimeOfDayEmoji,
  CONTEXT_TAGS,
  computeTagCorrelations,
  computeTimePatterns,
  MoodLogEntry,
} from '@/constants/moodlog';
import { getWeeklyAvgScore, getScoreTrend } from '@/services/moodlog';
import {
  fetchFitnessDataAndSync,
  requestFitnessPermissions,
  getTodayFitness,
  summarizeFitnessData,
  getDateRangeFitness,
  generateMockData,
  fetchCloudFitnessData,
  syncFitnessDataToCloud,
} from '@/services/fitness';
import {
  buildAstrologyReport,
  getElementColor,
  getEnergyColor,
  getMoonEnergyColor,
  saveBirthdate,
} from '@/services/astrology';
import {
  fetchAndCacheSchumann,
  getCachedSchumannReading,
  getStatusColor,
  getStatusEmoji,
  getStatusLabel,
} from '@/services/schumannResonance';
import {
  fetchWeather,
  getMoodImpactColor,
  saveManualCity,
  clearManualCity,
  getManualCity,
  formatTemp,
} from '@/services/weather';
import { saveBirthdateStorage, getTempUnit, setTempUnit } from '@/services/storage';
import { useApp } from '@/hooks/useApp';
import { getIncomingBuddyRequests, getTherapistBuddiesForUser, TherapistBuddyRow } from '@/services/accountability';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';
import { isOwnerEmail } from '@/constants/config';
import { fetchCycleEntries, getCurrentCyclePhase, PHASE_INFO } from '@/services/cycleTracker';
import { WebMaxWidth } from '@/components/layout/WebLayout';

// ── Style factory — rebuilds when theme palette changes ──────────────────────
function makeStyles(C: typeof DarkColors, isDark = true) {
  const G = getGlass(isDark);
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xl },
    greeting: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    appName: { fontSize: Typography.fontSizes['2xl'], fontWeight: Typography.fontWeights.bold, color: C.textPrimary, includeFontPadding: false },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    streakPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.primarySoft, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
    streakNum: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.primary, includeFontPadding: false },
    insightsIconBtn: { width: 36, height: 36, borderRadius: Radius.full, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    ctaBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.primary, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.xl, ...Shadows.sm },
    ctaLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    ctaIconWrap: { width: 44, height: 44, borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    ctaTitle: { fontSize: Typography.fontSizes.md, fontWeight: Typography.fontWeights.bold, color: '#08091A', includeFontPadding: false },
    ctaSub: { fontSize: Typography.fontSizes.xs, color: 'rgba(8,9,26,0.65)', includeFontPadding: false },
    ctaArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(8,9,26,0.15)', alignItems: 'center', justifyContent: 'center' },
    // Glass card — frosted surface replaces opaque background
    todayCard: { flexDirection: 'row', gap: Spacing.lg, backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, marginBottom: Spacing.xl, ...Shadows.sm },
    todayScoreBig: { width: 76, height: 76, flexShrink: 0 }, // replaced by GlassSphere
    todayScoreEmoji: { fontSize: 22 },
    todayScoreNum: { fontSize: 24, fontWeight: '900', includeFontPadding: false },
    todayScoreLabel: { fontSize: 10, fontWeight: '600', includeFontPadding: false },
    todayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    todayTitle: { fontSize: Typography.fontSizes.sm, fontWeight: Typography.fontWeights.semibold, color: C.textPrimary, includeFontPadding: false },
    todayTime: { fontSize: 10, color: C.textMuted, includeFontPadding: false },
    todayTagRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, alignSelf: 'flex-start' },
    todayTagEmoji: { fontSize: 13 },
    todayTagLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '600', includeFontPadding: false },
    todayDims: { flexDirection: 'row', gap: Spacing.sm },
    todayLogMore: { fontSize: 10, color: C.primary, fontWeight: '600', includeFontPadding: false },
    section: { marginBottom: Spacing.xl, gap: Spacing.md },
    sectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    sectionTitle: { fontSize: Typography.fontSizes.xs, fontWeight: Typography.fontWeights.semibold, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false, flex: 1 },
    seeAllText: { fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '600', includeFontPadding: false },
    mockBadge: { backgroundColor: C.border, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
    mockBadgeText: { fontSize: 9, color: C.textMuted, includeFontPadding: false },
    trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
    trendBadgeText: { fontSize: 10, fontWeight: '600', includeFontPadding: false },
    chartCard: { backgroundColor: G.cardBgLight, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorderLight, gap: Spacing.md },
    chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 80, paddingTop: 18 },
    chartBarCol: { flex: 1, alignItems: 'center', gap: 3 },
    chartBarScore: { fontSize: 9, color: C.textMuted, fontWeight: '600', includeFontPadding: false },
    chartBar: { width: '100%', borderRadius: 4, minHeight: 4 },
    chartBarDay: { fontSize: 9, color: C.textMuted, includeFontPadding: false },
    chartNote: { fontSize: 10, color: C.textMuted, textAlign: 'center', includeFontPadding: false },
    correlationsCard: { backgroundColor: G.cardBgLight, borderRadius: Radius.xl, borderWidth: 1, borderColor: G.cardBorderLight, overflow: 'hidden' },
    corrRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: C.border },
    corrIcon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    corrEmoji: { fontSize: 18 },
    corrLabel: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: C.textPrimary, includeFontPadding: false },
    corrSample: { fontSize: 10, color: C.textMuted, includeFontPadding: false },
    corrDelta: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
    corrDeltaText: { fontSize: Typography.fontSizes.sm, fontWeight: '700', includeFontPadding: false },
    corrFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: Spacing.md },
    corrFooterText: { fontSize: 10, color: C.textMuted, flex: 1, includeFontPadding: false },
    patternPreviewCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: G.cardBorder },
    patternPreviewTitle: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    patternPreviewText: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
    patternProgress: { height: 6, width: '100%', backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' },
    patternProgressFill: { height: '100%', borderRadius: Radius.full, backgroundColor: C.primary },
    patternProgressLabel: { fontSize: 10, color: C.textMuted, includeFontPadding: false },
    timeCard: { backgroundColor: G.cardBgLight, borderRadius: Radius.xl, borderWidth: 1, borderColor: G.cardBorderLight, overflow: 'hidden' },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
    timeRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
    timeEmoji: { fontSize: 20, width: 24 },
    timeLabel: { fontSize: Typography.fontSizes.sm, color: C.textPrimary, fontWeight: '500', includeFontPadding: false },
    timeBarRow: { flexDirection: 'row', alignItems: 'center' },
    timeBarTrack: { width: 80, height: 5, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' },
    timeBarFill: { height: '100%', borderRadius: Radius.full },
    timeScore: { fontSize: Typography.fontSizes.sm, fontWeight: '700', width: 28, textAlign: 'right', includeFontPadding: false },
    timeSample: { fontSize: 10, color: C.textMuted, width: 22, textAlign: 'right', includeFontPadding: false },
    emotionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: C.border },
    emotionEmoji: { fontSize: 36 },
    emotionName: { fontSize: Typography.fontSizes.lg, fontWeight: '700', includeFontPadding: false },
    emotionNote: { fontSize: Typography.fontSizes.xs, color: C.textMuted, fontStyle: 'italic', lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
    emotionBars: { gap: 5 },
    emotionBarRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    emotionBarLabel: { fontSize: 10, color: C.textMuted, width: 10, includeFontPadding: false },
    emotionBarTrack: { width: 48, height: 4, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' },
    emotionBarFill: { height: '100%', borderRadius: Radius.full },
    fitnessCard: { backgroundColor: G.cardBgLight, borderRadius: Radius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: G.cardBorderLight, ...Shadows.sm },
    fitDivider: { width: 1, height: 56, backgroundColor: C.border },
    fitnessChevron: { alignItems: 'center', justifyContent: 'center', paddingLeft: 4 },
    locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.surface, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: C.border },
    locationBadgeWarn: { borderColor: C.warning + '50', backgroundColor: C.warning + '10' },
    locationBadgeText: { fontSize: 9, fontWeight: '700', includeFontPadding: false },
    locationSetupRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.primarySoft, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '30' },
    locationSetupText: { flex: 1, fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '600', includeFontPadding: false },
    cityInputPanel: { backgroundColor: C.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: C.primary + '40', gap: Spacing.md },
    cityInputHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    cityInputTitle: { flex: 1, fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    cityGpsBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.success + '15', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.success + '40' },
    cityGpsBtnText: { fontSize: Typography.fontSizes.sm, fontWeight: '600', includeFontPadding: false },
    cityInputOrRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    cityInputDivider: { flex: 1, height: 1, backgroundColor: C.border },
    cityInputOr: { fontSize: 10, color: C.textMuted, includeFontPadding: false },
    cityInputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    cityTextInput: { flex: 1, backgroundColor: C.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: C.textPrimary, fontSize: Typography.fontSizes.sm, borderWidth: 1, borderColor: C.border, minHeight: 44 },
    cityInputSaveBtn: { backgroundColor: C.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, height: 44, alignItems: 'center', justifyContent: 'center' },
    cityInputSaveBtnText: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: '#08091A', includeFontPadding: false },
    cityInputError: { fontSize: Typography.fontSizes.xs, color: C.error, includeFontPadding: false },
    weatherCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, ...Shadows.sm },
    weatherEmoji: { fontSize: 36 },
    weatherTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    weatherTemp: { fontSize: Typography.fontSizes.xl, fontWeight: '900', includeFontPadding: false },
    weatherImpactChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    weatherImpactText: { fontSize: 10, fontWeight: '600', includeFontPadding: false },
    weatherCondition: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    weatherReason: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
    weatherStats: { gap: 4, alignItems: 'flex-end' },
    schumannCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: G.cardBg, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1 },
    schumannEmoji: { fontSize: 28 },
    schumannFreq: { fontSize: Typography.fontSizes.sm, fontWeight: '700', includeFontPadding: false },
    schumannEffect: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    liveChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.error + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.error },
    liveText: { fontSize: 9, color: C.error, fontWeight: '600', includeFontPadding: false },
    astrologyCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: G.cardBg, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1 },
    astroEmoji: { fontSize: 28 },
    astroSign: { fontSize: Typography.fontSizes.sm, fontWeight: '700', includeFontPadding: false },
    astroForecast: { fontSize: 10, color: C.textMuted, lineHeight: 14, includeFontPadding: false },
    astroMoon: { fontSize: 20 },
    astrologySetup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: C.primary + '30', borderStyle: 'dashed' },
    astrologySetupEmoji: { fontSize: 28 },
    astrologySetupTitle: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: C.primary, includeFontPadding: false },
    astrologySetupSub: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    refreshIconBtn: { width: 26, height: 26, borderRadius: Radius.full, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.primary + '40' },
    unitToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: Radius.full, borderWidth: 1, borderColor: C.border, paddingHorizontal: 6, paddingVertical: 3 },
    unitToggleOpt: { fontSize: 10, fontWeight: '600', color: C.textMuted, paddingHorizontal: 3, includeFontPadding: false },
    unitToggleActive: { color: C.primary },
    unitToggleSep: { fontSize: 10, color: C.border, includeFontPadding: false },
    cycleCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: G.cardBg, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1 },
    cyclePhaseName: { fontSize: Typography.fontSizes.sm, fontWeight: '700', includeFontPadding: false },
    cyclePhaseDesc: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    cycleNext: { fontSize: 10, color: C.textMuted, fontStyle: 'italic', includeFontPadding: false },
    cycleSetupRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.error + '10', borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: C.error + '30', borderStyle: 'dashed' },
    cycleSetupTitle: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: C.error, includeFontPadding: false },
    cycleSetupSub: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    privacy: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: Spacing.md },
    privacyText: { fontSize: 10, color: C.textMuted, includeFontPadding: false },
  });
}

// In light mode, raw tag colours (e.g. teal #4ECDC4, amber #F5A623) are too light
// to read against light card surfaces. Darken them by blending with black.
function tagTextColor(tagColor: string, isDark: boolean): string {
  if (isDark) return tagColor;
  // Darken by ~35% — parse hex and scale down each channel
  try {
    const hex = tagColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const factor = 0.60; // multiply each channel to darken
    const dr = Math.round(r * factor);
    const dg = Math.round(g * factor);
    const db = Math.round(b * factor);
    return `rgb(${dr},${dg},${db})`;
  } catch {
    return tagColor;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  const {
    streak, fitnessData, setFitnessData,
    fitnessPermission, setFitnessPermission,
    birthdate, setBirthdate, moodLogEntries, todayMoodLogEntries,
    weatherData, setWeatherData, sex,
  } = useApp();

  const { user } = useAuth();
  const [pendingBuddyCount, setPendingBuddyCount] = React.useState(0);
  const [therapistBuddy, setTherapistBuddy] = React.useState<TherapistBuddyRow | null>(null);
  // Intake questionnaire reminder state
  const [hasActiveTherapist, setHasActiveTherapist] = React.useState(false);
  const [intakeCompleted, setIntakeCompleted] = React.useState<boolean | null>(null);
  // true = existing intake already includes therapist-mode answers
  const [intakeHasTherapistSection, setIntakeHasTherapistSection] = React.useState<boolean>(false);
  const [therapistName, setTherapistName] = React.useState<string>('your therapist');
  // Activity feed button visibility
  const [showActivityFeedBtn, setShowActivityFeedBtn] = React.useState(false);
  const [activityFeedOverdueCount, setActivityFeedOverdueCount] = React.useState(0);

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      getIncomingBuddyRequests(user.id).catch(() => []),
      getTherapistBuddiesForUser(user.id).catch(() => []),
    ]).then(([incoming, therapistRows]) => {
      setPendingBuddyCount(incoming.filter((r: any) => r.status === 'pending').length);
      setTherapistBuddy(therapistRows.length > 0 ? therapistRows[0] : null);
    });
  }, [user?.id]);

  // Check if Activity Feed button should appear:
  // Show when: user has active accountability buddies (either direction),
  // OR user is a therapist with active clients,
  // OR user is connected to a therapist (via therapist_clients)
  useEffect(() => {
    if (!user?.id) return;
    const checkActivityFeedVisibility = async () => {
      try {
        const supabase = getSupabaseClient();
        const now = Date.now();

        // Check: is this user someone's buddy (they monitor others)
        const { data: isBuddyOf } = await supabase
          .from('accountability_buddies')
          .select('id, notify_after_hours, user_profiles!accountability_buddies_user_id_fkey(last_logged_at)')
          .eq('buddy_id', user.id)
          .eq('status', 'active')
          .limit(10);

        // Check: does this user have active buddies they added
        const { data: myBuddies } = await supabase
          .from('accountability_buddies')
          .select('id, buddy_id, notify_after_hours, user_profiles!accountability_buddies_buddy_id_fkey(last_logged_at)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .not('buddy_id', 'is', null)
          .limit(10);

        // Check: is this user a therapist with active clients
        const { data: asTherapist } = await supabase
          .from('therapist_clients')
          .select('id, notify_after_hours, user_profiles!therapist_clients_client_id_fkey(last_logged_at)')
          .eq('therapist_id', user.id)
          .eq('status', 'active')
          .not('client_id', 'is', null)
          .limit(10);

        // Check: is this user a client of a therapist
        const { data: asClient } = await supabase
          .from('therapist_clients')
          .select('id')
          .eq('client_id', user.id)
          .eq('status', 'active')
          .limit(1);

        const totalConnections =
          (isBuddyOf?.length ?? 0) +
          (myBuddies?.length ?? 0) +
          (asTherapist?.length ?? 0) +
          (asClient?.length ?? 0);

        if (totalConnections === 0) {
          setShowActivityFeedBtn(false);
          return;
        }

        setShowActivityFeedBtn(true);

        // Count overdue people across all connection types
        let overdue = 0;
        const checkOverdue = (rows: any[], defaultHours: number) => {
          for (const row of rows ?? []) {
            const profile = Array.isArray(row.user_profiles)
              ? row.user_profiles[0]
              : row.user_profiles;
            const lastLogged = profile?.last_logged_at;
            if (!lastLogged) { overdue++; continue; }
            const hoursSince = (now - new Date(lastLogged).getTime()) / (1000 * 60 * 60);
            if (hoursSince > (row.notify_after_hours ?? defaultHours)) overdue++;
          }
        };
        checkOverdue(isBuddyOf ?? [], 24);
        checkOverdue(myBuddies ?? [], 24);
        checkOverdue(asTherapist ?? [], 48);
        setActivityFeedOverdueCount(overdue);
      } catch {}
    };
    checkActivityFeedVisibility();
  }, [user?.id]);

  // Check if user has an active therapist via therapist_clients table AND needs to complete intake
  useEffect(() => {
    if (!user?.id) return;
    const checkTherapistAndIntake = async () => {
      try {
        const supabase = getSupabaseClient();
        // Check for active therapist connection in therapist_clients
        const { data: tcRows } = await supabase
          .from('therapist_clients')
          .select('id, status, therapist_id, client_name')
          .eq('client_id', user.id)
          .eq('status', 'active')
          .limit(1);

        if (!tcRows || tcRows.length === 0) {
          setHasActiveTherapist(false);
          setIntakeCompleted(null);
          return;
        }

        setHasActiveTherapist(true);

        // Get therapist name
        const therapistId = tcRows[0].therapist_id;
        const { data: therapistProfile } = await supabase
          .from('user_profiles')
          .select('display_name, username, email')
          .eq('id', therapistId)
          .maybeSingle();
        if (therapistProfile) {
          setTherapistName(
            therapistProfile.display_name ??
            therapistProfile.username ??
            therapistProfile.email ??
            'your therapist'
          );
        }

        // Check if intake questionnaire is already completed
        const { data: intake } = await supabase
          .from('intake_questionnaires')
          .select('id, clinical_summary')
          .eq('user_id', user.id)
          .maybeSingle();

        setIntakeCompleted(!!intake);
        // Check whether they already answered the therapist-specific section
        if (intake) {
          const cs = (intake as any).clinical_summary;
          setIntakeHasTherapistSection(!!(cs?.therapist_mode === true));
        }
      } catch (e) {
        console.warn('[intake check]', e);
      }
    };
    checkTherapistAndIntake();
  }, [user?.id]);

  const [cycleEntries, setCycleEntries] = React.useState<any[]>([]);
  useEffect(() => {
    fetchCycleEntries().then(setCycleEntries);
  }, []);

  const [fitnessRefreshing, setFitnessRefreshing] = React.useState(false);
  const [showManualFitnessEntry, setShowManualFitnessEntry] = React.useState(false);
  const [schumannReading, setSchumannReading] = React.useState<any>(null);
  const [astrologyReport, setAstrologyReport] = React.useState<any>(null);
  const [tempUnit, setTempUnitState] = React.useState<'C' | 'F'>('F');
  const [showCityInput, setShowCityInput] = React.useState(false);
  const [cityInputText, setCityInputText] = React.useState('');
  const [cityInputLoading, setCityInputLoading] = React.useState(false);
  const [cityInputError, setCityInputError] = React.useState<string | null>(null);

  const hour = new Date().getHours();
  const localWeather = React.useMemo(() => ({
    timestamp: Date.now(),
    city: 'New York',
    temperature: 21,
    feelsLike: 19,
    humidity: 55,
    uvIndex: hour >= 6 && hour < 20 ? 4 : 0,
    windSpeed: 12,
    weatherCode: 1,
    condition: 'Partly cloudy',
    conditionEmoji: '⛅',
    isDay: hour >= 6 && hour < 20,
    moodImpact: 'neutral' as const,
    moodImpactReason: 'Moderate conditions — mild temperature and partial cloud cover.',
    forecast: [],
    pressureHPA: 1013,
    precipitationMM: 0,
  }), []);

  const displayFitnessData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const hasToday = fitnessData.some(d => d.date === todayStr);
    if (Platform.OS === 'web') {
      // On web, only use real cloud-synced data — no mock injection
      return fitnessData;
    }
    // On native, fall back to mock if cached data has no today entry
    return hasToday ? fitnessData : generateMockData(30);
  }, [fitnessData]);
  const todayFitness = getTodayFitness(displayFitnessData);
  const weekFitness = getDateRangeFitness(displayFitnessData, 7);
  const weekSummary = summarizeFitnessData(weekFitness);
  const weeklyAvg = getWeeklyAvgScore(moodLogEntries);
  const trend = getScoreTrend(moodLogEntries);
  const tagCorrelations = computeTagCorrelations(moodLogEntries).slice(0, 4);
  const timePatterns = computeTimePatterns(moodLogEntries);
  const todayBestEntry = todayMoodLogEntries.length > 0
    ? todayMoodLogEntries.reduce((best, e) => e.score > best.score ? e : best)
    : null;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleRefreshFitness = async () => {
    setFitnessRefreshing(true);
    try {
      if (Platform.OS === 'web') {
        // On web, pull fresh data from the cloud
        if (user?.id) {
          const cloudData = await fetchCloudFitnessData(user.id, 30);
          if (cloudData.length > 0) {
            setFitnessData(cloudData);
            setFitnessPermission({ granted: true, source: 'expo_health' });
          }
        }
      } else {
        const status = await requestFitnessPermissions();
        setFitnessPermission(status);
        const data = await fetchFitnessDataAndSync(30);
        setFitnessData(data);
      }
    } finally {
      setFitnessRefreshing(false);
    }
  };

  useEffect(() => { handleRefreshFitness(); }, [user?.id]);

  const toggleTempUnit = async () => {
    const next: 'C' | 'F' = tempUnit === 'C' ? 'F' : 'C';
    setTempUnitState(next);
    await setTempUnit(next);
  };

  useEffect(() => {
    const loadWeather = async () => {
      const [data, unit] = await Promise.all([fetchWeather(), getTempUnit()]);
      if (data) setWeatherData(data);
      setTempUnitState(unit);
    };
    loadWeather();
  }, []);

  const handleUseGPS = async () => {
    setCityInputError(null);
    setCityInputLoading(true);
    await clearManualCity();
    const data = await fetchWeather();
    if (data) {
      setWeatherData(data);
      if (data.locationSource === 'fallback') {
        setCityInputError('Could not detect location. Try entering your city manually.');
      } else {
        setShowCityInput(false);
      }
    }
    setCityInputLoading(false);
  };

  const handleSaveCity = async () => {
    const city = cityInputText.trim();
    if (!city) return;
    setCityInputLoading(true);
    setCityInputError(null);
    await saveManualCity(city);
    const data = await fetchWeather();
    if (data && data.locationSource === 'manual') {
      setWeatherData(data);
      setShowCityInput(false);
      setCityInputText('');
    } else {
      setCityInputError('City not found. Try a different spelling.');
    }
    setCityInputLoading(false);
  };

  useEffect(() => {
    const loadSchumann = async () => {
      const cached = await getCachedSchumannReading();
      if (cached) { setSchumannReading(cached); return; }
      const fresh = await fetchAndCacheSchumann();
      setSchumannReading(fresh);
    };
    loadSchumann();
  }, []);

  useEffect(() => {
    if (birthdate) {
      const report = buildAstrologyReport(birthdate);
      setAstrologyReport(report);
    }
  }, [birthdate]);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    const entries = moodLogEntries.filter(e => e.date === dateStr);
    const avg = entries.length ? Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length) : null;
    const isToday = i === 6;
    const dayLabel = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()];
    return { dateStr, avg, isToday, dayLabel };
  });

  const maxScore = Math.max(...last7Days.filter(d => d.avg != null).map(d => d.avg!), 50);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scroll, { alignItems: 'stretch' }]} showsVerticalScrollIndicator={false}>
      <WebMaxWidth>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.appName}>MyMoodMapp</Text>
          </View>
          <View style={styles.headerRight}>
            {streak.current > 0 ? (
              <View style={styles.streakPill}>
                <MaterialIcons name="local-fire-department" size={14} color={C.primary} />
                <Text style={styles.streakNum}>{streak.current}d</Text>
              </View>
            ) : null}
            {/* Activity Feed button — visible when user has any social connections */}
            {showActivityFeedBtn ? (
              <Pressable
                onPress={() => router.push('/buddy-activity' as any)}
                hitSlop={8}
                style={({ pressed }) => [styles.insightsIconBtn, { backgroundColor: C.success + '20' }, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="people" size={20} color={C.success} />
                {activityFeedOverdueCount > 0 ? (
                  <View style={{
                    position: 'absolute', top: -3, right: -3,
                    width: 16, height: 16, borderRadius: 8,
                    backgroundColor: C.error, alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: C.background,
                  }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff', includeFontPadding: false } as any}>
                      {activityFeedOverdueCount > 9 ? '9+' : activityFeedOverdueCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push('/(tabs)/mapp' as any)}
              hitSlop={8}
              style={({ pressed }) => [styles.insightsIconBtn, { backgroundColor: C.secondary + '20' }, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="explore" size={20} color={C.secondary} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/insights' as any)}
              hitSlop={8}
              style={({ pressed }) => [styles.insightsIconBtn, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="insights" size={20} color={C.primary} />
            </Pressable>
          </View>
        </View>

        {/* ── Therapist Intake Reminder Banner ─────────────────────────────── */}
        {hasActiveTherapist && intakeCompleted === false ? (
          // No intake at all — full therapist quiz
          <IntakeReminderBanner
            therapistName={therapistName}
            onPress={() => router.push({ pathname: '/quiz', params: { mode: 'therapist' } } as any)}
            onDismiss={() => setIntakeCompleted(true)}
            C={C}
          />
        ) : hasActiveTherapist && intakeCompleted === true && !intakeHasTherapistSection ? (
          // Already completed base intake — offer retake or therapist-only questions
          <IntakeUpdateBanner
            therapistName={therapistName}
            onTherapistOnly={() => router.push({ pathname: '/quiz', params: { mode: 'therapist-only' } } as any)}
            onRetakeFull={() => router.push({ pathname: '/quiz', params: { mode: 'therapist' } } as any)}
            onDismiss={() => setIntakeHasTherapistSection(true)}
            C={C}
          />
        ) : null}

        {/* Pending buddy request banner */}
        {pendingBuddyCount > 0 ? (
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
              <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>
                {pendingBuddyCount} pending buddy request{pendingBuddyCount !== 1 ? 's' : ''}
              </Text>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false } as any}>
                Tap to review and accept or decline
              </Text>
            </View>
            <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.secondary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#08091A', includeFontPadding: false } as any}>{pendingBuddyCount}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={C.secondary} />
          </Pressable>
        ) : null}

        {/* Therapist connection reminder */}
        {therapistBuddy ? (
          <TherapistReminderCard
            therapistBuddy={therapistBuddy}
            todayMoodLogEntries={todayMoodLogEntries}
            allMoodLogEntries={moodLogEntries}
            streak={streak}
            onLog={() => router.push('/(tabs)/checkin')}
            onAccountability={() => router.push('/accountability' as any)}
            C={C}
            styles={styles}
          />
        ) : null}

        {/* Swipeable period dashboard */}
        <PeriodDashboard
          moodLogEntries={moodLogEntries}
          todayMoodLogEntries={todayMoodLogEntries}
          todayBestEntry={todayBestEntry}
          onLog={() => router.push('/(tabs)/checkin')}
        />

        {/* 7-day score chart */}
        {moodLogEntries.length >= 3 ? (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>7-day trend</Text>
              <Pressable onPress={() => router.push({ pathname: '/(tabs)/insights', params: { period: 'weekly', view: 'report' } } as any)} hitSlop={8}>
                <Text style={styles.seeAllText}>Full report →</Text>
              </Pressable>
              <View style={[styles.trendBadge, { backgroundColor: trend === 'up' ? C.success + '20' : trend === 'down' ? C.error + '20' : C.border }]}>
                <MaterialIcons name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'trending-flat'} size={13} color={trend === 'up' ? C.success : trend === 'down' ? C.error : C.textMuted} />
                <Text style={[styles.trendBadgeText, { color: trend === 'up' ? C.success : trend === 'down' ? C.error : C.textMuted }]}>
                  {trend === 'up' ? 'Rising' : trend === 'down' ? 'Declining' : 'Stable'}{weeklyAvg != null ? `  ·  avg ${weeklyAvg}` : ''}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => router.push({ pathname: '/(tabs)/insights', params: { period: 'weekly', view: 'report' } } as any)} style={({ pressed }) => [styles.chartCard, pressed && { opacity: 0.85 }]}>
              <View style={styles.chartBars}>
                {last7Days.map((d, i) => {
                  const h = d.avg != null ? Math.max(6, Math.round((d.avg / maxScore) * 56)) : 4;
                  const color = d.avg != null ? getScoreColor(d.avg) : C.border;
                  return (
                    <View key={i} style={styles.chartBarCol}>
                      {d.avg != null ? <Text style={[styles.chartBarScore, { color }]}>{d.avg}</Text> : <Text style={styles.chartBarScore}> </Text>}
                      <View style={[styles.chartBar, { height: h, backgroundColor: d.isToday ? color : color + (d.avg != null ? '80' : '30'), borderWidth: d.isToday ? 1.5 : 0, borderColor: color }]} />
                      <Text style={[styles.chartBarDay, d.isToday && { color: C.textPrimary, fontWeight: '700' }]}>{d.isToday ? 'Now' : d.dayLabel}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                <Text style={styles.chartNote}>{moodLogEntries.length} total entries · tap for full report</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <MaterialIcons name="bar-chart" size={11} color={C.primary} />
                  <Text style={{ fontSize: 10, color: C.primary, fontWeight: '600', includeFontPadding: false }}>View report →</Text>
                </View>
              </View>
            </Pressable>
          </View>
        ) : null}

        {/* Pattern preview */}
        {tagCorrelations.length >= 2 ? (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>What moves your score</Text>
              <Pressable onPress={() => router.push('/(tabs)/insights' as any)}>
                <Text style={styles.seeAllText}>Full analysis →</Text>
              </Pressable>
            </View>
            <View style={styles.correlationsCard}>
              {tagCorrelations.map(c => {
                const tag = CONTEXT_TAGS.find(t => t.id === c.tagId);
                if (!tag) return null;
                const positive = c.deltaVsBaseline > 0;
                return (
                  <View key={c.tagId} style={styles.corrRow}>
                    <View style={[styles.corrIcon, { backgroundColor: tag.color + '20' }]}>
                      <Text style={styles.corrEmoji}>{tag.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.corrLabel}>{tag.label}</Text>
                      <Text style={styles.corrSample}>{c.sampleSize}x logged · avg score {c.avgScore}</Text>
                    </View>
                    <View style={[styles.corrDelta, { backgroundColor: positive ? C.success + '20' : C.error + '20' }]}>
                      <Text style={[styles.corrDeltaText, { color: positive ? C.success : C.error }]}>{positive ? '+' : ''}{c.deltaVsBaseline}</Text>
                    </View>
                  </View>
                );
              })}
              <View style={styles.corrFooter}>
                <MaterialIcons name="info-outline" size={12} color={C.textMuted} />
                <Text style={styles.corrFooterText}>Delta vs your personal baseline score</Text>
              </View>
            </View>
          </View>
        ) : moodLogEntries.length > 0 && moodLogEntries.length < 5 ? (
          <View style={styles.section}>
            <View style={styles.patternPreviewCard}>
              <MaterialIcons name="track-changes" size={20} color={C.textMuted} />
              <Text style={styles.patternPreviewTitle}>Pattern analysis unlocking...</Text>
              <Text style={styles.patternPreviewText}>Log {5 - moodLogEntries.length} more check-ins to see which tags reliably move your score up or down.</Text>
              <View style={styles.patternProgress}>
                <View style={[styles.patternProgressFill, { width: `${(moodLogEntries.length / 5) * 100}%` }]} />
              </View>
              <Text style={styles.patternProgressLabel}>{moodLogEntries.length}/5 entries</Text>
            </View>
          </View>
        ) : null}

        {/* Time of day patterns */}
        {timePatterns.length >= 2 ? (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Time of day patterns</Text>
              <Pressable onPress={() => router.push({ pathname: '/(tabs)/insights', params: { period: 'daily', view: 'timepat' } } as any)} hitSlop={8}>
                <Text style={styles.seeAllText}>Full analysis →</Text>
              </Pressable>
            </View>
            <View style={styles.timeCard}>
              {timePatterns.map((tp, i) => {
                const color = getScoreColor(tp.avgScore);
                const emojis: Record<string, string> = { morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙' };
                return (
                  <Pressable key={tp.timeOfDay} onPress={() => router.push({ pathname: '/(tabs)/insights', params: { period: 'daily', view: 'timepat', timeOfDay: tp.timeOfDay } } as any)} style={({ pressed }) => [styles.timeRow, i < timePatterns.length - 1 && styles.timeRowBorder, pressed && { opacity: 0.75, backgroundColor: color + '08' }]}>
                    <Text style={styles.timeEmoji}>{emojis[tp.timeOfDay]}</Text>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.timeLabel}>{tp.timeOfDay.charAt(0).toUpperCase() + tp.timeOfDay.slice(1)}</Text>
                      <View style={styles.timeBarRow}>
                        <View style={styles.timeBarTrack}>
                          <View style={[styles.timeBarFill, { width: `${tp.avgScore}%`, backgroundColor: color }]} />
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.timeScore, { color }]}>{tp.avgScore}</Text>
                    <Text style={styles.timeSample}>{tp.sampleSize}x</Text>
                    <MaterialIcons name="chevron-right" size={13} color={C.textMuted} style={{ marginLeft: 2 }} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Manual fitness entry modal — web only */}
        {showManualFitnessEntry && Platform.OS === 'web' ? (
          <ManualFitnessEntryModal
            userId={user?.id ?? ''}
            onSave={async (entry) => {
              if (user?.id) {
                await syncFitnessDataToCloud([entry], user.id);
                const updated = await fetchCloudFitnessData(user.id, 30);
                if (updated.length > 0) {
                  setFitnessData(updated);
                  setFitnessPermission({ granted: true, source: 'expo_health' });
                }
              }
              setShowManualFitnessEntry(false);
            }}
            onClose={() => setShowManualFitnessEntry(false)}
            C={C}
          />
        ) : null}

        {/* Fitness & Sleep — "Body Today" on native, "7-Day Health Summary" on web (real data only) */}
        {Platform.OS !== 'web' ? (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Body today</Text>
              {fitnessPermission.source === 'mock' ? (
                <View style={styles.mockBadge}><Text style={styles.mockBadgeText}>Demo data</Text></View>
              ) : fitnessPermission.source === 'healthkit' ? (
                <View style={[styles.mockBadge, { backgroundColor: C.success + '20' }]}>
                  <Text style={[styles.mockBadgeText, { color: C.success }]}>HealthKit</Text>
                </View>
              ) : fitnessPermission.source === 'pedometer' ? (
                <View style={[styles.mockBadge, { backgroundColor: C.primary + '20' }]}>
                  <Text style={[styles.mockBadgeText, { color: C.primary }]}>Live steps</Text>
                </View>
              ) : null}
              <Pressable onPress={handleRefreshFitness} disabled={fitnessRefreshing} hitSlop={8} style={({ pressed }) => [styles.refreshIconBtn, pressed && { opacity: 0.7 }]}>
                {fitnessRefreshing ? <MaterialIcons name="hourglass-top" size={14} color={C.primary} /> : <MaterialIcons name="refresh" size={14} color={C.primary} />}
              </Pressable>
              <Pressable onPress={() => router.push('/fitness-detail' as any)} hitSlop={8}>
                <Text style={styles.seeAllText}>Full report →</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => router.push('/fitness-detail' as any)} style={({ pressed }) => [styles.fitnessCard, pressed && { opacity: 0.88 }]}>
              <FitnessRing label="Steps" value={todayFitness?.steps ?? weekSummary.avgDailySteps ?? 0} goal={8000} color={C.primary} icon="directions-walk" />
              <View style={styles.fitDivider} />
              <FitnessRing label="Active" value={todayFitness?.activeMinutes ?? weekSummary.avgActiveMinutes ?? 0} goal={30} color={C.success} icon="fitness-center" unit="min" />
              <View style={styles.fitDivider} />
              <FitnessRing label="Sleep" value={todayFitness?.sleepHours ?? weekSummary.avgSleepHours ?? 0} goal={8} color="#7C83FF" icon="bedtime" unit="h" decimal />
              <View style={styles.fitDivider} />
              <FitnessRing label="HR" value={todayFitness?.restingHeartRate ?? weekSummary.avgRestingHR ?? 0} goal={0} color={C.error} icon="favorite" unit="bpm" noRing />
              <View style={styles.fitDivider} />
              <View style={styles.fitnessChevron}>
                <MaterialIcons name="chevron-right" size={18} color={C.textMuted} />
              </View>
            </Pressable>
          </View>
        ) : (
          // Web: show summary if real data exists, or manual entry + sync prompt
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>
                {weekSummary.totalSteps > 0 || weekSummary.avgRestingHR !== null || weekSummary.avgSleepHours !== null
                  ? '7-day health summary'
                  : 'Body & Health'}
              </Text>
              {weekSummary.totalSteps > 0 || weekSummary.avgRestingHR !== null || weekSummary.avgSleepHours !== null ? (
                <View style={[styles.mockBadge, { backgroundColor: C.primary + '20' }]}>
                  <Text style={[styles.mockBadgeText, { color: C.primary }]}>Synced</Text>
                </View>
              ) : null}
              {/* Refresh button — always visible on web */}
              <Pressable
                onPress={handleRefreshFitness}
                disabled={fitnessRefreshing}
                hitSlop={8}
                style={({ pressed }) => [styles.refreshIconBtn, pressed && { opacity: 0.7 }]}
              >
                {fitnessRefreshing
                  ? <MaterialIcons name="hourglass-top" size={14} color={C.primary} />
                  : <MaterialIcons name="refresh" size={14} color={C.primary} />}
              </Pressable>
              {weekSummary.totalSteps > 0 || weekSummary.avgRestingHR !== null || weekSummary.avgSleepHours !== null ? (
                <Pressable onPress={() => router.push('/fitness-detail' as any)} hitSlop={8}>
                  <Text style={styles.seeAllText}>Full report →</Text>
                </Pressable>
              ) : null}
            </View>

            {weekSummary.totalSteps > 0 || weekSummary.avgRestingHR !== null || weekSummary.avgSleepHours !== null ? (
              <>
                <Pressable onPress={() => router.push('/fitness-detail' as any)} style={({ pressed }) => [styles.fitnessCard, pressed && { opacity: 0.88 }]}>
                  <FitnessRing label="Avg Steps" value={weekSummary.avgDailySteps ?? 0} goal={8000} color={C.primary} icon="directions-walk" />
                  <View style={styles.fitDivider} />
                  <FitnessRing label="Avg Active" value={weekSummary.avgActiveMinutes ?? 0} goal={30} color={C.success} icon="fitness-center" unit="min" />
                  <View style={styles.fitDivider} />
                  <FitnessRing label="Avg Sleep" value={weekSummary.avgSleepHours ?? 0} goal={8} color="#7C83FF" icon="bedtime" unit="h" decimal />
                  <View style={styles.fitDivider} />
                  <FitnessRing label="Avg HR" value={weekSummary.avgRestingHR ?? 0} goal={0} color={C.error} icon="favorite" unit="bpm" noRing />
                  <View style={styles.fitDivider} />
                  <View style={styles.fitnessChevron}>
                    <MaterialIcons name="chevron-right" size={18} color={C.textMuted} />
                  </View>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4 }}>
                  <MaterialIcons name="smartphone" size={11} color={C.textMuted} />
                  <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>
                    Synced from mobile app · {weekFitness.length} days recorded
                  </Text>
                  <Pressable onPress={() => setShowManualFitnessEntry(true)} hitSlop={8}>
                    <Text style={{ fontSize: 10, color: C.primary, fontWeight: '600', includeFontPadding: false } as any}>+ Log manually</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              // No real fitness data — offer manual entry and sync instruction
              <View style={{ backgroundColor: C.surfaceElevated, borderRadius: Radius.xl, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
                {/* Manual entry CTA — primary action */}
                <Pressable
                  onPress={() => setShowManualFitnessEntry(true)}
                  style={({ pressed }) => [{
                    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
                    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border,
                    backgroundColor: C.primary + '08',
                  }, pressed && { opacity: 0.85 }]}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.primary + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.primary + '40' }}>
                    <MaterialIcons name="edit" size={20} color={C.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: C.primary, includeFontPadding: false } as any}>Log today's health data manually</Text>
                    <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false } as any}>Enter steps, sleep, and heart rate directly on the web</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={C.primary} />
                </Pressable>

                {/* Sync from phone — secondary */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.textMuted + '10', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="smartphone" size={20} color={C.textMuted} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>Or sync from your phone</Text>
                    <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: 16, includeFontPadding: false } as any}>
                      Open MyMoodMapp on iPhone/Android → data syncs automatically via Apple Health or Google Fit
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Weather card */}
        {(weatherData || localWeather) ? (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Weather & mood</Text>
              <Pressable onPress={toggleTempUnit} hitSlop={8} style={({ pressed }) => [styles.unitToggle, pressed && { opacity: 0.7 }]}>
                <Text style={[styles.unitToggleOpt, tempUnit === 'C' && styles.unitToggleActive]}>°C</Text>
                <Text style={styles.unitToggleSep}>|</Text>
                <Text style={[styles.unitToggleOpt, tempUnit === 'F' && styles.unitToggleActive]}>°F</Text>
              </Pressable>
              {weatherData?.locationSource === 'gps' ? (
                <Pressable onPress={() => setShowCityInput(true)} style={styles.locationBadge} hitSlop={8}>
                  <MaterialIcons name="my-location" size={10} color={C.success} />
                  <Text style={[styles.locationBadgeText, { color: C.success }]}>GPS · {weatherData.city}</Text>
                </Pressable>
              ) : weatherData?.locationSource === 'ip' ? (
                <Pressable onPress={() => setShowCityInput(true)} style={styles.locationBadge} hitSlop={8}>
                  <MaterialIcons name="location-searching" size={10} color={C.primary} />
                  <Text style={[styles.locationBadgeText, { color: C.primary }]}>{weatherData.city}</Text>
                </Pressable>
              ) : weatherData?.locationSource === 'manual' ? (
                <Pressable onPress={() => setShowCityInput(true)} style={styles.locationBadge} hitSlop={8}>
                  <MaterialIcons name="location-pin" size={10} color={C.primary} />
                  <Text style={[styles.locationBadgeText, { color: C.primary }]}>{weatherData.city}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => setShowCityInput(true)} style={[styles.locationBadge, styles.locationBadgeWarn]} hitSlop={8}>
                  <MaterialIcons name="location-off" size={10} color={C.warning} />
                  <Text style={[styles.locationBadgeText, { color: C.warning }]}>Set location</Text>
                </Pressable>
              )}
              <Pressable onPress={() => router.push('/weather-detail' as any)} hitSlop={8}>
                <Text style={styles.seeAllText}>Details →</Text>
              </Pressable>
            </View>

            <Pressable onPress={() => router.push('/weather-detail' as any)} style={({ pressed }) => [styles.weatherCard, { borderColor: getMoodImpactColor((weatherData || localWeather)!.moodImpact) + '50' }, pressed && { opacity: 0.88 }]}>
              <Text style={styles.weatherEmoji}>{(weatherData || localWeather)!.conditionEmoji}</Text>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.weatherTopRow}>
                  <Text style={[styles.weatherTemp, { color: getMoodImpactColor((weatherData || localWeather)!.moodImpact) }]}>{formatTemp((weatherData || localWeather)!.temperature, tempUnit)}</Text>
                  <View style={[styles.weatherImpactChip, { backgroundColor: getMoodImpactColor((weatherData || localWeather)!.moodImpact) + '20' }]}>
                    <Text style={[styles.weatherImpactText, { color: getMoodImpactColor((weatherData || localWeather)!.moodImpact) }]}>
                      {(weatherData || localWeather)!.moodImpact === 'positive' ? '😊 Mood boost' : (weatherData || localWeather)!.moodImpact === 'negative' ? '😔 Mood drag' : '😐 Neutral'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.weatherCondition}>{(weatherData || localWeather)!.condition} · {(weatherData || localWeather)!.city}</Text>
                <Text style={styles.weatherReason} numberOfLines={2}>{(weatherData || localWeather)!.moodImpactReason}</Text>
              </View>
              <View style={styles.weatherStats}>
                <WeatherStat label="UV" value={String((weatherData || localWeather)!.uvIndex)} C={C} />
                <WeatherStat label="Hum" value={`${(weatherData || localWeather)!.humidity}%`} C={C} />
                <WeatherStat label="Wind" value={`${(weatherData || localWeather)!.windSpeed}`} C={C} />
              </View>
              <MaterialIcons name="chevron-right" size={16} color={C.textMuted} style={{ marginLeft: 4 }} />
            </Pressable>

            {(!weatherData || weatherData.locationSource === 'fallback') && !showCityInput ? (
              <Pressable onPress={() => setShowCityInput(true)} style={({ pressed }) => [styles.locationSetupRow, pressed && { opacity: 0.8 }]}>
                <MaterialIcons name="location-on" size={14} color={C.primary} />
                <Text style={styles.locationSetupText}>Enter your city for accurate local weather</Text>
                <MaterialIcons name="chevron-right" size={14} color={C.primary} />
              </Pressable>
            ) : null}

            {showCityInput ? (
              <View style={styles.cityInputPanel}>
                <View style={styles.cityInputHeader}>
                  <MaterialIcons name="location-city" size={16} color={C.primary} />
                  <Text style={styles.cityInputTitle}>Set your location</Text>
                  <Pressable onPress={() => { setShowCityInput(false); setCityInputError(null); }} hitSlop={8}>
                    <MaterialIcons name="close" size={18} color={C.textMuted} />
                  </Pressable>
                </View>
                <Pressable onPress={handleUseGPS} disabled={cityInputLoading} style={({ pressed }) => [styles.cityGpsBtn, pressed && { opacity: 0.8 }]}>
                  <MaterialIcons name="my-location" size={16} color={C.success} />
                  <Text style={[styles.cityGpsBtnText, { color: C.success }]}>{cityInputLoading ? 'Detecting location...' : 'Use GPS / auto-detect'}</Text>
                </Pressable>
                <View style={styles.cityInputOrRow}>
                  <View style={styles.cityInputDivider} />
                  <Text style={styles.cityInputOr}>or enter city</Text>
                  <View style={styles.cityInputDivider} />
                </View>
                <View style={styles.cityInputRow}>
                  <TextInput
                    style={styles.cityTextInput}
                    placeholder="e.g. London, Tokyo, Chicago"
                    placeholderTextColor={C.textMuted}
                    value={cityInputText}
                    onChangeText={(t) => { setCityInputText(t); setCityInputError(null); }}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={handleSaveCity}
                  />
                  <Pressable onPress={handleSaveCity} disabled={cityInputLoading || !cityInputText.trim()} style={({ pressed }) => [styles.cityInputSaveBtn, (!cityInputText.trim() || cityInputLoading) && { opacity: 0.4 }, pressed && { opacity: 0.75 }]}>
                    <Text style={styles.cityInputSaveBtnText}>Save</Text>
                  </Pressable>
                </View>
                {cityInputError ? <Text style={styles.cityInputError}>{cityInputError}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Schumann meter */}
        {schumannReading ? (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Earth resonance</Text>
              <View style={styles.liveChip}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push('/schumann-detail' as any)} style={({ pressed }) => [styles.schumannCard, { borderColor: getStatusColor(schumannReading.status) + '50' }, pressed && { opacity: 0.85 }]}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: getStatusColor(schumannReading.status) + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MaterialIcons name="graphic-eq" size={26} color={getStatusColor(schumannReading.status)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.schumannFreq, { color: getStatusColor(schumannReading.status) }]}>{schumannReading.frequency} Hz · {getStatusLabel(schumannReading.status)}</Text>
                <Text style={styles.schumannEffect} numberOfLines={1}>{schumannReading.physicalEffects[0]?.effect}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={C.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {/* Astrology */}
        {astrologyReport ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cosmic alignment</Text>
            <Pressable onPress={() => router.push({ pathname: '/astrology-detail', params: { birthdate } } as any)} style={({ pressed }) => [styles.astrologyCard, { borderColor: getElementColor(astrologyReport.zodiacSign.element) + '40' }, pressed && { opacity: 0.85 }]}>
              <Text style={styles.astroEmoji}>{astrologyReport.zodiacSign.emoji}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.astroSign, { color: getElementColor(astrologyReport.zodiacSign.element) }]}>{astrologyReport.zodiacSign.symbol} {astrologyReport.zodiacSign.name}</Text>
                <Text style={styles.astroForecast} numberOfLines={2}>{astrologyReport.dailyPhysicalForecast}</Text>
              </View>
              <Text style={styles.astroMoon}>{astrologyReport.moonPhase.emoji}</Text>
              <MaterialIcons name="chevron-right" size={18} color={C.textMuted} />
            </Pressable>
          </View>
        ) : birthdate === null ? (
          <View style={styles.section}>
            <Pressable onPress={() => router.push('/(tabs)/profile' as any)} style={({ pressed }) => [styles.astrologySetup, pressed && { opacity: 0.85 }]}>
              <Text style={styles.astrologySetupEmoji}>🌌</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.astrologySetupTitle}>Add your birthdate</Text>
                <Text style={styles.astrologySetupSub}>Get cosmic alignment and physical forecasts</Text>
              </View>
              <MaterialIcons name="chevron-right" size={18} color={C.primary} />
            </Pressable>
          </View>
        ) : null}

        {/* Cycle tracker widget — visible for female users and owner account */}
        {(sex === 'female' || isOwnerEmail(user?.email)) ? <CycleTrackerWidget
          cycleEntries={cycleEntries}
          onPress={() => router.push('/cycle-tracker' as any)}
          styles={styles}
          C={C}
        /> : null}

        {/* Sound Lab Widget */}
        <SoundLabWidget
          onPress={(moduleId) => {
            const moduleMap: Record<string, string> = {
              sounds: 'soundscape',
              frequency: 'frequency',
              meditate: 'meditation',
              games: 'games',
            };
            const tab = moduleId ? (moduleMap[moduleId] ?? 'soundscape') : 'soundscape';
            router.push({ pathname: '/(tabs)/sound-lab', params: { module: tab } } as any);
          }}
          C={C}
        />

        <View style={styles.privacy}>
          <MaterialIcons name="lock-outline" size={12} color={C.textMuted} />
          <Text style={styles.privacyText}>All data stays on your device. Never shared.</Text>
        </View>
      </WebMaxWidth>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Swipeable Period Dashboard ──────────────────────────────────────────────
// CARD_W is computed reactively inside the component.
// Module-level Dimensions.get returns 0 on web SSR, breaking snap behaviour.

function makePdStyles(C: typeof DarkColors, cardW: number, isDark = true) {
  const G = getGlass(isDark);
  return StyleSheet.create({
    wrapper: { marginBottom: Spacing.xl },
    scroll: { marginHorizontal: -Spacing.lg },
    scrollContent: { paddingHorizontal: Spacing.lg, gap: 16, paddingRight: Spacing.lg },
    panel: { width: cardW },
    card: { flexDirection: 'row', gap: Spacing.lg, backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, ...Shadows.sm },
    cardLeft: { justifyContent: 'center', alignItems: 'center', padding: 4, overflow: 'visible' },
    cardRight: { flex: 1, gap: Spacing.sm },
    scoreCircle: { width: 80, height: 80, borderRadius: Radius.xl, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', gap: 1 },
    scoreEmoji: { fontSize: 22 },
    scoreNum: { fontSize: 26, fontWeight: '900', includeFontPadding: false },
    scoreLabel: { fontSize: 10, fontWeight: '700', includeFontPadding: false },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
    cardPeriodLabel: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    trendPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
    trendPillText: { fontSize: 10, fontWeight: '600', includeFontPadding: false },
    entryCount: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    topTagRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, alignSelf: 'flex-start' },
    topTagEmoji: { fontSize: 12 },
    topTagLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '600', includeFontPadding: false },
    dimRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'nowrap' },
    ctaBtn: { alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 5, backgroundColor: C.primarySoft, borderRadius: Radius.full, borderWidth: 1, borderColor: C.primary + '40' },
    ctaBtnText: { fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '700', includeFontPadding: false },
    emptyCard: { backgroundColor: G.cardBgLight, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: G.cardBorderLight, minHeight: 160, justifyContent: 'center' },
    emptyIcon: { fontSize: 32 },
    emptyLabel: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    emptyMsg: { fontSize: Typography.fontSizes.sm, color: C.textMuted, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
    emptyBtn: { paddingHorizontal: Spacing.lg, paddingVertical: 8, backgroundColor: C.primarySoft, borderRadius: Radius.full, borderWidth: 1, borderColor: C.primary + '40' },
    emptyBtnText: { fontSize: Typography.fontSizes.sm, color: C.primary, fontWeight: '700', includeFontPadding: false },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: Spacing.md },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.border },
    dotActive: { backgroundColor: C.primary, width: 18 },
    labelRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl, marginTop: Spacing.sm },
    periodLabel: { fontSize: Typography.fontSizes.xs, color: C.textMuted, fontWeight: '500', includeFontPadding: false },
    periodLabelActive: { color: C.primary, fontWeight: '700' },
  });
}

function PeriodDashboard({ moodLogEntries, todayMoodLogEntries, todayBestEntry, onLog }: {
  moodLogEntries: MoodLogEntry[]; todayMoodLogEntries: MoodLogEntry[];
  todayBestEntry: MoodLogEntry | null; onLog: () => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const { colors: C, isDark: pdIsDark } = useTheme();
  const router = useRouter();

  // Reactive card width — SSR on web returns 0 at module level, breaking snap.
  // On desktop web, constrain to max content width (960px) minus sidebar (220px) minus padding.
  const [cardW, setCardW] = useState(() => {
    const vw = Dimensions.get('window').width;
    const contentW = (Platform.OS === 'web' && vw >= 1024) ? Math.min(vw - 220, 960) : vw;
    return Math.max(contentW - 48, 280);
  });
  useEffect(() => {
    const update = () => {
      const vw = Dimensions.get('window').width;
      const contentW = (Platform.OS === 'web' && vw >= 1024) ? Math.min(vw - 220, 960) : vw;
      setCardW(Math.max(contentW - 48, 280));
    };
    update();
    const sub = Dimensions.addEventListener('change', update);
    return () => sub?.remove();
  }, []);

  const pdStyles = useMemo(() => makePdStyles(C, cardW, pdIsDark), [C, cardW, pdIsDark]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newPage = Math.round(e.nativeEvent.contentOffset.x / (cardW + 16));
    setPage(newPage);
  };

  const weekCutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const weekEntries = moodLogEntries.filter(e => e.date >= weekCutoff);
  const weekScore = weekEntries.length ? Math.round(weekEntries.reduce((s, e) => s + e.score, 0) / weekEntries.length) : null;
  const weekBody = weekEntries.length ? weekEntries.reduce((s, e) => s + e.dimensions.body, 0) / weekEntries.length : null;
  const weekMind = weekEntries.length ? weekEntries.reduce((s, e) => s + e.dimensions.mind, 0) / weekEntries.length : null;
  const weekEnergy = weekEntries.length ? weekEntries.reduce((s, e) => s + e.dimensions.energy, 0) / weekEntries.length : null;
  const weekTopTag = getTopTag(weekEntries);
  const weekLogs = new Set(weekEntries.map(e => e.date)).size;

  const monthCutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const monthEntries = moodLogEntries.filter(e => e.date >= monthCutoff);
  const monthScore = monthEntries.length ? Math.round(monthEntries.reduce((s, e) => s + e.score, 0) / monthEntries.length) : null;
  const monthBody = monthEntries.length ? monthEntries.reduce((s, e) => s + e.dimensions.body, 0) / monthEntries.length : null;
  const monthMind = monthEntries.length ? monthEntries.reduce((s, e) => s + e.dimensions.mind, 0) / monthEntries.length : null;
  const monthEnergy = monthEntries.length ? monthEntries.reduce((s, e) => s + e.dimensions.energy, 0) / monthEntries.length : null;
  const monthTopTag = getTopTag(monthEntries);
  const monthLogs = new Set(monthEntries.map(e => e.date)).size;

  const priorWeekCutoff = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
  const priorWeekEntries = moodLogEntries.filter(e => e.date >= priorWeekCutoff && e.date < weekCutoff);
  const priorWeekScore = priorWeekEntries.length ? Math.round(priorWeekEntries.reduce((s, e) => s + e.score, 0) / priorWeekEntries.length) : null;
  const weekTrend = weekScore !== null && priorWeekScore !== null ? weekScore - priorWeekScore : null;

  return (
    <View style={pdStyles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={cardW + 16}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={pdStyles.scrollContent}
        style={pdStyles.scroll}
      >
        <View style={pdStyles.panel}>
          {todayBestEntry ? (
            <PeriodScorePanel label="Today"
              score={todayMoodLogEntries.length ? Math.round(todayMoodLogEntries.reduce((s, e) => s + e.score, 0) / todayMoodLogEntries.length) : todayBestEntry.score}
              entryCount={todayMoodLogEntries.length} entryUnit="entries today"
              topTag={CONTEXT_TAGS.find(t => t.id === todayBestEntry.primaryTag)}
              body={todayMoodLogEntries.length ? todayMoodLogEntries.reduce((s, e) => s + e.dimensions.body, 0) / todayMoodLogEntries.length : todayBestEntry.dimensions.body}
              mind={todayMoodLogEntries.length ? todayMoodLogEntries.reduce((s, e) => s + e.dimensions.mind, 0) / todayMoodLogEntries.length : todayBestEntry.dimensions.mind}
              energy={todayMoodLogEntries.length ? todayMoodLogEntries.reduce((s, e) => s + e.dimensions.energy, 0) / todayMoodLogEntries.length : todayBestEntry.dimensions.energy}
              trendDelta={null} ctaLabel="+ Log again" onCta={onLog} pdStyles={pdStyles} C={C} bubbleSize="large" isDark={pdIsDark} />
          ) : (
            <QuickLogCTA onPress={onLog} C={C} />
          )}
        </View>
        <View style={pdStyles.panel}>
          {weekScore !== null ? (
            <PeriodScorePanel label="This Week" score={weekScore} entryCount={weekLogs} entryUnit="of 7 days logged" topTag={weekTopTag} body={weekBody!} mind={weekMind!} energy={weekEnergy!} trendDelta={weekTrend} ctaLabel="View patterns →" onCta={() => router.push({ pathname: '/(tabs)/insights', params: { period: 'weekly', view: 'report' } } as any)} pdStyles={pdStyles} C={C} bubbleSize="large" isDark={pdIsDark} />
          ) : (
            <EmptyPeriodPanel label="This Week" icon="📅" message="Log check-ins this week to see your 7-day average score." onCta={onLog} pdStyles={pdStyles} />
          )}
        </View>
        <View style={pdStyles.panel}>
          {monthScore !== null ? (
            <PeriodScorePanel label="This Month" score={monthScore} entryCount={monthLogs} entryUnit="of 30 days logged" topTag={monthTopTag} body={monthBody!} mind={monthMind!} energy={monthEnergy!} trendDelta={null} ctaLabel="Full report →" onCta={() => router.push({ pathname: '/(tabs)/insights', params: { period: 'monthly', view: 'report' } } as any)} pdStyles={pdStyles} C={C} bubbleSize="large" isDark={pdIsDark} />
          ) : (
            <EmptyPeriodPanel label="This Month" icon="📆" message="Keep logging daily to build your 30-day wellness picture." onCta={onLog} pdStyles={pdStyles} />
          )}
        </View>
      </ScrollView>
      <View style={pdStyles.dots}>
        {[0, 1, 2].map(i => (
          <Pressable key={i} hitSlop={8} onPress={() => scrollRef.current?.scrollTo({ x: i * (cardW + 16), animated: true })} style={[pdStyles.dot, page === i && pdStyles.dotActive]} />
        ))}
      </View>
      <View style={pdStyles.labelRow}>
        {['Today', 'This Week', 'This Month'].map((l, i) => (
          <Pressable key={l} onPress={() => scrollRef.current?.scrollTo({ x: i * (cardW + 16), animated: true })} hitSlop={6}>
            <Text style={[pdStyles.periodLabel, page === i && pdStyles.periodLabelActive]}>{l}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function getTopTag(entries: MoodLogEntry[]) {
  const tagCounts: Record<string, number> = {};
  entries.forEach(e => { tagCounts[e.primaryTag] = (tagCounts[e.primaryTag] || 0) + 1; });
  const topId = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return topId ? CONTEXT_TAGS.find(t => t.id === topId) : undefined;
}

function PeriodScorePanel({ label, score, entryCount, entryUnit, topTag, body, mind, energy, trendDelta, ctaLabel, onCta, pdStyles, C, bubbleSize, isDark }: {
  label: string; score: number; entryCount: number; entryUnit: string;
  topTag?: typeof CONTEXT_TAGS[number]; body: number; mind: number; energy: number;
  trendDelta: number | null; ctaLabel: string; onCta: () => void;
  pdStyles: ReturnType<typeof makePdStyles>; C: typeof DarkColors;
  bubbleSize?: 'small' | 'medium' | 'large'; isDark?: boolean;
}) {
  const scoreColor = getScoreColor(score);
  const trendUp = trendDelta !== null && trendDelta > 0;
  const trendDown = trendDelta !== null && trendDelta < 0;
  return (
    <View style={[pdStyles.card, { borderColor: scoreColor + '50' }]}>
      <View style={pdStyles.cardLeft}>
        {/* Canonical glowing amber score bubble */}
        <ScoreBubble
          score={score}
          emoji={getScoreEmoji(score)}
          label={getScoreLabel(score)}
          size={bubbleSize ?? 'medium'}
          color={scoreColor}
        />
      </View>
      <View style={pdStyles.cardRight}>
        <View style={pdStyles.cardTopRow}>
          <Text style={pdStyles.cardPeriodLabel}>{label}</Text>
          {trendDelta !== null ? (
            <View style={[pdStyles.trendPill, { backgroundColor: trendUp ? C.success + '20' : trendDown ? C.error + '20' : C.border }]}>
              <Text style={[pdStyles.trendPillText, { color: trendUp ? C.success : trendDown ? C.error : C.textMuted }]}>{trendUp ? '↑' : trendDown ? '↓' : '→'} {Math.abs(trendDelta)} vs prior week</Text>
            </View>
          ) : null}
        </View>
        <Text style={pdStyles.entryCount}>{entryCount} {entryUnit}</Text>
        {topTag ? (
          <View style={[pdStyles.topTagRow, { backgroundColor: topTag.color + (isDark !== false ? '15' : '22') }]}>
            <Text style={pdStyles.topTagEmoji}>{topTag.emoji}</Text>
            <Text style={[pdStyles.topTagLabel, { color: tagTextColor(topTag.color, isDark !== false) }]}>{topTag.label}</Text>
          </View>
        ) : null}
        <View style={pdStyles.dimRow}>
          <DimMini label="Body" value={(body + 1) / 2} color={C.primary} C={C} />
          <DimMini label="Mind" value={(mind + 1) / 2} color={C.secondary} C={C} />
          <DimMini label="Energy" value={energy} color={C.success} C={C} />
        </View>
        <Pressable onPress={onCta} style={({ pressed }) => [pdStyles.ctaBtn, pressed && { opacity: 0.7 }]}>
          <Text style={pdStyles.ctaBtnText}>{ctaLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EmptyPeriodPanel({ label, icon, message, onCta, pdStyles }: { label: string; icon: string; message: string; onCta: () => void; pdStyles: ReturnType<typeof makePdStyles> }) {
  return (
    <View style={pdStyles.emptyCard}>
      <Text style={pdStyles.emptyIcon}>{icon}</Text>
      <Text style={pdStyles.emptyLabel}>{label}</Text>
      <Text style={pdStyles.emptyMsg}>{message}</Text>
      <Pressable onPress={onCta} style={({ pressed }) => [pdStyles.emptyBtn, pressed && { opacity: 0.75 }]}>
        <Text style={pdStyles.emptyBtnText}>Log now</Text>
      </Pressable>
    </View>
  );
}

function DimMini({ label, value, color, C }: { label: string; value: number; color: string; C: typeof DarkColors }) {
  const s = useMemo(() => StyleSheet.create({
    item: { flex: 1, gap: 2, minWidth: 48 },
    label: { fontSize: 9, color: C.textMuted, includeFontPadding: false },
    track: { height: 4, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: Radius.full },
  }), [C]);
  return (
    <View style={s.item}>
      <Text style={s.label} numberOfLines={1}>{label}</Text>
      <View style={s.track}>
        <View style={[s.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function QuickLogCTA({ onPress, C }: { onPress: () => void; C: typeof DarkColors }) {
  const tod = getTimeOfDay();
  const prompts: Record<string, string> = { morning: 'How does this morning feel?', afternoon: 'Afternoon check-in — 8 sec', evening: 'End of day — how did it go?', night: 'Night check-in — how are you?' };
  const s = useMemo(() => StyleSheet.create({
    banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.primary, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.xl, ...Shadows.sm },
    left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    icon: { width: 44, height: 44, borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: Typography.fontSizes.md, fontWeight: Typography.fontWeights.bold, color: '#08091A', includeFontPadding: false },
    sub: { fontSize: Typography.fontSizes.xs, color: 'rgba(8,9,26,0.65)', includeFontPadding: false },
    arrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(8,9,26,0.15)', alignItems: 'center', justifyContent: 'center' },
  }), [C]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.banner, pressed && { opacity: 0.85 }]}>
      <View style={s.left}>
        <View style={s.icon}><Text style={{ fontSize: 22 }}>{getTimeOfDayEmoji(tod)}</Text></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.title}>{prompts[tod]}</Text>
          <Text style={s.sub}>3 quick questions · body, mind, context tag</Text>
        </View>
      </View>
      <View style={s.arrow}><MaterialIcons name="arrow-forward" size={18} color="#08091A" /></View>
    </Pressable>
  );
}

function CycleTrackerWidget({ cycleEntries, onPress, styles, C }: { cycleEntries: any[]; onPress: () => void; styles: ReturnType<typeof makeStyles>; C: typeof DarkColors }) {
  const [cycleStatus, setCycleStatus] = React.useState<any>(null);
  React.useEffect(() => {
    const status = getCurrentCyclePhase(cycleEntries);
    const info = PHASE_INFO[status.phase];
    setCycleStatus({ ...status, info });
  }, [cycleEntries]);

  if (cycleEntries.length === 0) {
    // Setup state
    return (
      <View style={styles.section}>
        <Pressable onPress={onPress} style={({ pressed }) => [styles.cycleSetupRow, pressed && { opacity: 0.85 }]}>
          <Text style={{ fontSize: 20 }}>🩸</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cycleSetupTitle}>Start cycle tracking</Text>
            <Text style={styles.cycleSetupSub}>Log your period to unlock phase insights and mood correlations</Text>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={C.error} />
        </Pressable>
      </View>
    );
  }

  if (!cycleStatus) return null;
  const { info, dayOfCycle, daysUntilNextPeriod } = cycleStatus;

  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Cycle phase</Text>
        <Pressable onPress={onPress} hitSlop={8}>
          <Text style={styles.seeAllText}>Full tracker →</Text>
        </Pressable>
      </View>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.cycleCard, { borderColor: info.color + '50' }, pressed && { opacity: 0.88 }]}>
        <Text style={{ fontSize: 28 }}>{info.emoji}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.cyclePhaseName, { color: info.color }]}>
            {info.label} phase{dayOfCycle ? ` · Day ${dayOfCycle}` : ''}
          </Text>
          <Text style={styles.cyclePhaseDesc} numberOfLines={1}>{info.description}</Text>
          {daysUntilNextPeriod !== null ? (
            <Text style={styles.cycleNext}>
              {daysUntilNextPeriod > 0
                ? `Next period in ~${daysUntilNextPeriod} days`
                : daysUntilNextPeriod === 0
                ? 'Period expected today'
                : 'Period may be late'}
            </Text>
          ) : null}
        </View>
        <MaterialIcons name="chevron-right" size={18} color={C.textMuted} />
      </Pressable>
    </View>
  );
}

function WeatherStat({ label, value, C }: { label: string; value: string; C: typeof DarkColors }) {
  return (
    <View style={{ alignItems: 'center', gap: 1, minWidth: 32 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: C.textSecondary, includeFontPadding: false } as any} numberOfLines={1}>{value}</Text>
      <Text style={{ fontSize: 9, color: C.textMuted, includeFontPadding: false } as any} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ─── Therapist Reminder Card ────────────────────────────────────────────────
function TherapistReminderCard({ therapistBuddy, todayMoodLogEntries, allMoodLogEntries, streak, onLog, onAccountability, C, styles }: {
  therapistBuddy: TherapistBuddyRow;
  todayMoodLogEntries: MoodLogEntry[];
  allMoodLogEntries: MoodLogEntry[];
  streak: { current: number; longest: number; lastDate: string };
  onLog: () => void;
  onAccountability: () => void;
  C: typeof DarkColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const todayLogged = todayMoodLogEntries.length > 0;
  const todayAvg = todayLogged
    ? Math.round(todayMoodLogEntries.reduce((s, e) => s + e.score, 0) / todayMoodLogEntries.length)
    : null;
  const therapistName = therapistBuddy.therapist_name ?? therapistBuddy.therapist_email ?? 'Your therapist';
  const accentColor = todayLogged ? C.success : C.secondary;
  const weekCutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const weekDaysLogged = new Set(allMoodLogEntries.filter(e => e.date >= weekCutoff).map(e => e.date)).size;

  return (
    <View style={{
      backgroundColor: accentColor + '12',
      borderRadius: Radius.xl,
      borderWidth: 1.5,
      borderColor: accentColor + '50',
      marginBottom: Spacing.xl,
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, paddingBottom: Spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: accentColor + '25', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="psychology" size={20} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>
            {todayLogged ? 'Therapist updated ✓' : 'Keep your therapist updated'}
          </Text>
          <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false } as any} numberOfLines={1}>
            {therapistName} has access to your logs
          </Text>
        </View>
        <Pressable onPress={onAccountability} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          <MaterialIcons name="chevron-right" size={18} color={accentColor} />
        </Pressable>
      </View>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }}>
        {/* Today status */}
        <View style={{ flex: 1, backgroundColor: C.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: 3, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 18 }}>{todayLogged ? '✅' : '⏰'}</Text>
          {todayLogged && todayAvg !== null ? (
            <Text style={{ fontSize: 14, fontWeight: '900', color: getScoreColor(todayAvg), includeFontPadding: false } as any}>{todayAvg}</Text>
          ) : (
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, includeFontPadding: false } as any}>—</Text>
          )}
          <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, includeFontPadding: false } as any}>Today</Text>
        </View>

        {/* Log streak */}
        <View style={{ flex: 1, backgroundColor: C.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: 3, borderWidth: 1, borderColor: C.border }}>
          <MaterialIcons name="local-fire-department" size={18} color={streak.current >= 3 ? '#FF8C00' : C.textMuted} />
          <Text style={{ fontSize: 14, fontWeight: '900', color: streak.current >= 3 ? '#FF8C00' : C.textPrimary, includeFontPadding: false } as any}>{streak.current}d</Text>
          <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, includeFontPadding: false } as any}>Streak</Text>
        </View>

        {/* Logs this week */}
        <View style={{ flex: 1, backgroundColor: C.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', gap: 3, borderWidth: 1, borderColor: C.border }}>
          <MaterialIcons name="calendar-view-week" size={18} color={C.secondary} />
          <Text style={{ fontSize: 14, fontWeight: '900', color: C.secondary, includeFontPadding: false } as any}>{weekDaysLogged}/7</Text>
          <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, includeFontPadding: false } as any}>This week</Text>
        </View>
      </View>

      {/* CTA when not yet logged today */}
      {!todayLogged ? (
        <Pressable
          onPress={onLog}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
            backgroundColor: accentColor, paddingVertical: 11, paddingHorizontal: Spacing.lg,
            marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
            borderRadius: Radius.lg,
          }, pressed && { opacity: 0.85 }]}
        >
          <MaterialIcons name="add-circle" size={16} color="#08091A" />
          <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: '#08091A', includeFontPadding: false } as any}>
            Log now — keep {therapistName.split(' ')[0]} in the loop
          </Text>
        </Pressable>
      ) : (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
          backgroundColor: C.success + '15', paddingVertical: 9, paddingHorizontal: Spacing.lg,
          marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
          borderRadius: Radius.lg, borderWidth: 1, borderColor: C.success + '35',
        }}>
          <MaterialIcons name="check-circle" size={14} color={C.success} />
          <Text style={{ fontSize: Typography.fontSizes.xs, fontWeight: '600', color: C.success, includeFontPadding: false } as any}>
            {todayAvg !== null ? `Score ${todayAvg} · ` : ''}{todayMoodLogEntries.length} log{todayMoodLogEntries.length !== 1 ? 's' : ''} shared with {therapistName.split(' ')[0]} today
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Mood Lab Widget — modules + live usage stats ──────────────────────────
function SoundLabWidget({ onPress, C }: { onPress: (moduleId?: string) => void; C: typeof DarkColors }) {
  const [usageStats, setUsageStats] = React.useState<{ sessions: number; minutes: number; avgLift: number | null } | null>(null);
  React.useEffect(() => {
    const load = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('sound_sessions')
          .select('duration_seconds,mood_delta')
          .limit(200);
        if (!data || data.length === 0) return;
        const sessions = data.length;
        const minutes = Math.round(data.reduce((s: number, r: any) => s + (r.duration_seconds ?? 0), 0) / 60);
        const withDelta = data.filter((r: any) => r.mood_delta !== null);
        const avgLift = withDelta.length
          ? Math.round(withDelta.reduce((s: number, r: any) => s + r.mood_delta, 0) / withDelta.length * 10) / 10
          : null;
        setUsageStats({ sessions, minutes, avgLift });
      } catch {}
    };
    load();
  }, []);

  const MODULES = [
    {
      id: 'sounds',
      icon: 'music-note' as const,
      emoji: '🎵',
      title: 'Sounds',
      subtitle: 'Ambient & nature',
      description: '24 soundscapes — rain, forest, white noise, ocean. Loops gaplessly in the background.',
      color: '#7C83FF',
      highlights: ['Rain & Ocean', 'White/Brown/Pink', 'Space & Fire', '🔒 Lockscreen'],
    },
    {
      id: 'frequency',
      icon: 'waves' as const,
      emoji: '🌊',
      title: 'Frequency',
      subtitle: 'Healing Hz',
      description: '28+ solfeggio, binaural & brainwave tones — generated locally, no internet needed.',
      color: '#4ADE80',
      highlights: ['528 Hz', '40 Hz Gamma', 'Binaural', 'Solfeggio'],
    },
    {
      id: 'meditate',
      icon: 'self-improvement' as const,
      emoji: '🧘',
      title: 'Meditate',
      subtitle: 'Guided sessions',
      description: '19 guided meditations from world-class teachers — sleep, anxiety, focus, and healing.',
      color: '#FB923C',
      highlights: ['Sleep', 'Anxiety', 'Mindfulness', 'Focus'],
    },
    {
      id: 'games',
      icon: 'games' as const,
      emoji: '🎮',
      title: 'Games',
      subtitle: 'Stress relief',
      description: '7 science-backed games that displace anxiety and activate the parasympathetic system.',
      color: '#F472B6',
      highlights: ['4-7-8 Breathing', 'Bubble Wrap', 'Pixel Art', 'MoodBeat + More'],
    },
  ];

  const s = useMemo(() => StyleSheet.create({
    section: { marginBottom: Spacing.xl },
    sectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    label: { flex: 1, fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
    openBtn: { fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '600', includeFontPadding: false },
    outerCard: {
      backgroundColor: C.surfaceElevated, borderRadius: Radius.xl,
      borderWidth: 1, borderColor: C.border, overflow: 'hidden',
    },
    heroBanner: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      padding: Spacing.lg, paddingBottom: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.border,
      backgroundColor: C.secondary + '08',
    },
    heroIconWrap: {
      width: 52, height: 52, borderRadius: Radius.xl,
      backgroundColor: C.secondary + '20', borderWidth: 1.5,
      borderColor: C.secondary + '40', alignItems: 'center', justifyContent: 'center',
    },
    heroInfo: { flex: 1, gap: 3 },
    heroTitle: { fontSize: Typography.fontSizes.lg, fontWeight: '900', color: C.textPrimary, includeFontPadding: false },
    heroSub: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: 16, includeFontPadding: false },
    moodTrackBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.primary + '15', borderRadius: Radius.full,
      paddingHorizontal: 8, paddingVertical: 4,
      borderWidth: 1, borderColor: C.primary + '30',
    },
    moodTrackText: { fontSize: 10, color: C.primary, fontWeight: '700', includeFontPadding: false },
    moduleGrid: { padding: Spacing.md, gap: Spacing.sm },
    moduleRow: { flexDirection: 'row', gap: Spacing.sm },
    moduleTile: {
      flex: 1, borderRadius: Radius.xl, padding: Spacing.md,
      borderWidth: 1.5, gap: Spacing.sm, minHeight: 130,
    },
    moduleTileTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    moduleIconBg: { width: 34, height: 34, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
    moduleTileTitle: { fontSize: Typography.fontSizes.sm, fontWeight: '800', includeFontPadding: false },
    moduleTileSub: { fontSize: 10, includeFontPadding: false },
    moduleTileDesc: { fontSize: 13, lineHeight: 18, includeFontPadding: false },
    moduleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 2 },
    moduleChip: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: Radius.full },
    moduleChipText: { fontSize: 9, fontWeight: '600', includeFontPadding: false },
    footer: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      padding: Spacing.md, borderTopWidth: 1, borderTopColor: C.border,
      backgroundColor: C.primary + '08',
    },
    footerText: { flex: 1, fontSize: 10, color: C.primary, fontWeight: '600', includeFontPadding: false },
  }), [C]);

  return (
    <View style={s.section}>
      <View style={s.sectionRow}>
        <Text style={s.label}>Mood Lab</Text>
        <Pressable onPress={() => onPress()} hitSlop={8}>
          <Text style={s.openBtn}>Open →</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => onPress()} style={({ pressed }) => [s.outerCard, pressed && { opacity: 0.92 }]}>
        {/* Hero banner */}
        <View style={s.heroBanner}>
          <View style={s.heroIconWrap}>
            <MaterialIcons name="spa" size={26} color={C.secondary} />
          </View>
          <View style={s.heroInfo}>
            <Text style={s.heroTitle}>Mood Lab</Text>
            <Text style={s.heroSub}>4 evidence-based tools · mood tracked after every session</Text>
          </View>
          <View style={s.moodTrackBadge}>
            <MaterialIcons name="track-changes" size={11} color={C.primary} />
            <Text style={s.moodTrackText}>Mood tracked</Text>
          </View>
        </View>

        {/* Usage stats row — only shown when data exists */}
        {usageStats && usageStats.sessions > 0 ? (
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md }}>
            {[
              { val: String(usageStats.sessions), label: 'Sessions', color: C.secondary },
              { val: `${usageStats.minutes}m`, label: 'Total time', color: '#4ADE80' },
              ...(usageStats.avgLift !== null ? [{
                val: (usageStats.avgLift >= 0 ? '+' : '') + String(usageStats.avgLift),
                label: 'Avg mood lift',
                color: usageStats.avgLift >= 0 ? '#4ADE80' : '#FF6B6B',
              }] : []),
            ].map((item, i) => (
              <View key={i} style={{
                flex: 1, alignItems: 'center', backgroundColor: C.surface,
                borderRadius: Radius.lg, paddingVertical: 10, gap: 2,
                borderWidth: 1, borderColor: C.border,
              }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: item.color, includeFontPadding: false } as any}>{item.val}</Text>
                <Text style={{ fontSize: 8, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center', includeFontPadding: false } as any}>{item.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* 2×2 module grid */}
        <View style={s.moduleGrid}>
          <View style={s.moduleRow}>
            {MODULES.slice(0, 2).map(mod => (
              <Pressable
                key={mod.id}
                onPress={() => onPress(mod.id)}
                style={({ pressed }) => [s.moduleTile, { backgroundColor: mod.color + '10', borderColor: mod.color + '35' }, pressed && { opacity: 0.8, borderColor: mod.color + '80' }]}
              >
                <View style={s.moduleTileTop}>
                  <View style={[s.moduleIconBg, { backgroundColor: mod.color + '25' }]}>
                    <MaterialIcons name={mod.icon} size={18} color={mod.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.moduleTileTitle, { color: mod.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{mod.title}</Text>
                    <Text style={[s.moduleTileSub, { color: mod.color + 'CC' }]} numberOfLines={1}>{mod.subtitle}</Text>
                  </View>
                </View>
                <Text style={[s.moduleTileDesc, { color: C.textSecondary }]} numberOfLines={3}>
                  {mod.description}
                </Text>
                <View style={s.moduleChips}>
                  {mod.highlights.map(h => (
                    <View key={h} style={[s.moduleChip, { backgroundColor: mod.color + '20' }]}>
                      <Text style={[s.moduleChipText, { color: mod.color }]}>{h}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            ))}
          </View>
          <View style={s.moduleRow}>
            {MODULES.slice(2, 4).map(mod => (
              <Pressable
                key={mod.id}
                onPress={() => onPress(mod.id)}
                style={({ pressed }) => [s.moduleTile, { backgroundColor: mod.color + '10', borderColor: mod.color + '35' }, pressed && { opacity: 0.8, borderColor: mod.color + '80' }]}
              >
                <View style={s.moduleTileTop}>
                  <View style={[s.moduleIconBg, { backgroundColor: mod.color + '25' }]}>
                    <MaterialIcons name={mod.icon} size={18} color={mod.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.moduleTileTitle, { color: mod.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{mod.title}</Text>
                    <Text style={[s.moduleTileSub, { color: mod.color + 'CC' }]} numberOfLines={1}>{mod.subtitle}</Text>
                  </View>
                </View>
                <Text style={[s.moduleTileDesc, { color: C.textSecondary }]} numberOfLines={3}>
                  {mod.description}
                </Text>
                <View style={s.moduleChips}>
                  {mod.highlights.map(h => (
                    <View key={h} style={[s.moduleChip, { backgroundColor: mod.color + '20' }]}>
                      <Text style={[s.moduleChipText, { color: mod.color }]}>{h}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Footer CTA */}
        <View style={s.footer}>
          <MaterialIcons name="open-in-new" size={14} color={C.primary} />
          <Text style={s.footerText}>
            Tap to open Mood Lab · all sessions track mood impact automatically
          </Text>
          <MaterialIcons name="chevron-right" size={16} color={C.primary} />
        </View>
      </Pressable>
    </View>
  );
}

// ─── Intake Update Banner (already completed base, therapist just connected) ──
function IntakeUpdateBanner({ therapistName, onTherapistOnly, onRetakeFull, onDismiss, C }: {
  therapistName: string;
  onTherapistOnly: () => void;
  onRetakeFull: () => void;
  onDismiss: () => void;
  C: typeof DarkColors;
}) {
  const s = React.useMemo(() => StyleSheet.create({
    wrap: {
      backgroundColor: '#0A1A14',
      borderRadius: Radius.xl,
      borderWidth: 2,
      borderColor: '#32D4C0',
      marginBottom: Spacing.xl,
      overflow: 'hidden',
    },
    accentBar: { height: 4, backgroundColor: '#32D4C0' },
    body: { padding: Spacing.lg, gap: Spacing.md },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    iconWrap: {
      width: 48, height: 48, borderRadius: 14,
      backgroundColor: '#32D4C020', alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: '#32D4C040', flexShrink: 0,
    },
    textBlock: { flex: 1, gap: 4 },
    title: { fontSize: Typography.fontSizes.md, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any,
    sub: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: Typography.fontSizes.xs * 1.55, includeFontPadding: false } as any,
    dismissBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
    optionsRow: { gap: 10 },
    primaryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: '#32D4C0', borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: Spacing.lg,
    },
    primaryBtnText: { fontSize: Typography.fontSizes.sm, fontWeight: '800', color: '#08091A', includeFontPadding: false } as any,
    secondaryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: 'transparent', borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: Spacing.lg,
      borderWidth: 1.5, borderColor: '#32D4C060',
    },
    secondaryBtnText: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: '#32D4C0', includeFontPadding: false } as any,
    noteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    noteText: { fontSize: 10, color: C.textMuted, includeFontPadding: false } as any,
  }), [C]);

  const displayName = therapistName.split('@')[0];

  return (
    <View style={s.wrap}>
      <View style={s.accentBar} />
      <View style={s.body}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.iconWrap}>
            <MaterialIcons name="assignment-turned-in" size={24} color="#32D4C0" />
          </View>
          <View style={s.textBlock}>
            <Text style={s.title}>Therapist connected — profile update available</Text>
            <Text style={s.sub}>
              <Text style={{ color: '#32D4C0', fontWeight: '700' } as any}>{displayName}</Text> has connected with you as your therapist. Your Wellbeing Profile is complete, but there are additional therapy-specific questions they need before your first session.
            </Text>
          </View>
          <Pressable onPress={onDismiss} hitSlop={8} style={({ pressed }) => [s.dismissBtn, pressed && { opacity: 0.6 }]}>
            <MaterialIcons name="close" size={15} color={C.textMuted} />
          </Pressable>
        </View>

        {/* Two options */}
        <View style={s.optionsRow}>
          {/* Primary — just the extra therapist questions */}
          <Pressable onPress={onTherapistOnly} style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85 }]}>
            <MaterialIcons name="add-circle" size={17} color="#08091A" />
            <Text style={s.primaryBtnText}>Answer therapist questions only (~2 min) →</Text>
          </Pressable>

          {/* Secondary — full retake */}
          <Pressable onPress={onRetakeFull} style={({ pressed }) => [s.secondaryBtn, pressed && { opacity: 0.8 }]}>
            <MaterialIcons name="refresh" size={16} color="#32D4C0" />
            <Text style={s.secondaryBtnText}>Retake full Wellbeing Profile (~5 min)</Text>
          </Pressable>
        </View>

        {/* Note */}
        <View style={s.noteRow}>
          <MaterialIcons name="lock-outline" size={11} color={C.textMuted} />
          <Text style={s.noteText}>Therapist section is shared with {displayName} · base answers remain private</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Intake Questionnaire Reminder Banner ──────────────────────────────────
function IntakeReminderBanner({ therapistName, onPress, onDismiss, C }: {
  therapistName: string;
  onPress: () => void;
  onDismiss: () => void;
  C: typeof DarkColors;
}) {
  const s = React.useMemo(() => StyleSheet.create({
    wrap: {
      backgroundColor: '#0D1A2E',
      borderRadius: Radius.xl,
      borderWidth: 2,
      borderColor: '#5E5CE6',
      marginBottom: Spacing.xl,
      overflow: 'hidden',
    },
    accentBar: {
      height: 4,
      backgroundColor: '#5E5CE6',
    },
    body: {
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: '#5E5CE620',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#5E5CE640',
      flexShrink: 0,
    },
    textBlock: { flex: 1, gap: 4 },
    title: {
      fontSize: Typography.fontSizes.md,
      fontWeight: '800',
      color: C.textPrimary,
      includeFontPadding: false,
    } as any,
    sub: {
      fontSize: Typography.fontSizes.xs,
      color: C.textSecondary,
      lineHeight: Typography.fontSizes.xs * 1.55,
      includeFontPadding: false,
    } as any,
    dismissBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bulletRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    bullet: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: '#5E5CE610',
      borderRadius: Radius.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: '#5E5CE630',
    },
    bulletText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#5E5CE6',
      includeFontPadding: false,
    } as any,
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#5E5CE6',
      borderRadius: Radius.lg,
      paddingVertical: 14,
      paddingHorizontal: Spacing.lg,
    },
    ctaText: {
      fontSize: Typography.fontSizes.sm,
      fontWeight: '800',
      color: '#fff',
      includeFontPadding: false,
    } as any,
    privacyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    privacyText: {
      fontSize: 10,
      color: C.textMuted,
      includeFontPadding: false,
    } as any,
  }), [C]);

  const displayName = therapistName.split('@')[0]; // strip email domain if it's an email

  return (
    <View style={s.wrap}>
      <View style={s.accentBar} />
      <View style={s.body}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.iconWrap}>
            <MaterialIcons name="assignment" size={24} color="#5E5CE6" />
          </View>
          <View style={s.textBlock}>
            <Text style={s.title}>Complete your Wellbeing Profile</Text>
            <Text style={s.sub}>
              <Text style={{ color: '#5E5CE6', fontWeight: '700' } as any}>{displayName}</Text> has connected with you as your therapist. Please complete the intake questionnaire so they can prepare for your first session.
            </Text>
          </View>
          <Pressable onPress={onDismiss} hitSlop={8} style={({ pressed }) => [s.dismissBtn, pressed && { opacity: 0.6 }]}>
            <MaterialIcons name="close" size={15} color={C.textMuted} />
          </Pressable>
        </View>

        {/* Bullet points */}
        <View style={s.bulletRow}>
          {[
            { icon: 'schedule', label: '~5 minutes' },
            { icon: 'lock', label: 'Private & secure' },
            { icon: 'psychology', label: 'Therapist sees results' },
            { icon: 'auto-awesome', label: 'Improves AI reports' },
          ].map((b, i) => (
            <View key={i} style={s.bullet}>
              <MaterialIcons name={b.icon as any} size={11} color="#5E5CE6" />
              <Text style={s.bulletText}>{b.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]}
        >
          <MaterialIcons name="assignment" size={17} color="#fff" />
          <Text style={s.ctaText}>Start My Wellbeing Profile →</Text>
        </Pressable>

        {/* Privacy note */}
        <View style={s.privacyRow}>
          <MaterialIcons name="lock-outline" size={11} color={C.textMuted} />
          <Text style={s.privacyText}>Base answers are private to you · therapist-specific section is shared with {displayName}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Manual Fitness Entry Modal (web only) ──────────────────────────────────
function ManualFitnessEntryModal({ userId, onSave, onClose, C }: {
  userId: string;
  onSave: (entry: import('@/services/fitness').DailyFitnessEntry) => Promise<void>;
  onClose: () => void;
  C: typeof DarkColors;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [steps, setSteps] = React.useState('');
  const [sleep, setSleep] = React.useState('');
  const [hr, setHr] = React.useState('');
  const [activeMin, setActiveMin] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSave = async () => {
    const parsedSteps = parseInt(steps) || 0;
    const parsedSleep = parseFloat(sleep) || null;
    const parsedHr = parseInt(hr) || null;
    const parsedActive = parseInt(activeMin) || 0;

    if (parsedSteps === 0 && parsedSleep === null && parsedHr === null) {
      setError('Please enter at least one value.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entry: import('@/services/fitness').DailyFitnessEntry = {
        date: today,
        steps: parsedSteps,
        activeMinutes: parsedActive || Math.round(parsedSteps / 100),
        restingHeartRate: parsedHr,
        avgHeartRate: parsedHr ? parsedHr + 15 : null,
        caloriesBurned: Math.round(parsedSteps * 0.04),
        workoutMinutes: parsedActive,
        sleepHours: parsedSleep,
        heartRateSamples: [],
      };
      await onSave(entry);
    } catch (e: any) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { label: 'Steps today', value: steps, onChange: setSteps, placeholder: 'e.g. 8500', color: C.primary, icon: 'directions-walk', keyboard: 'numeric' as const },
    { label: 'Sleep last night (hours)', value: sleep, onChange: setSleep, placeholder: 'e.g. 7.5', color: '#7C83FF', icon: 'bedtime', keyboard: 'decimal-pad' as const },
    { label: 'Resting heart rate (bpm)', value: hr, onChange: setHr, placeholder: 'e.g. 62', color: C.error, icon: 'favorite', keyboard: 'numeric' as const },
    { label: 'Active minutes', value: activeMin, onChange: setActiveMin, placeholder: 'e.g. 35', color: C.success, icon: 'fitness-center', keyboard: 'numeric' as const },
  ];

  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 100,
      alignItems: 'center', justifyContent: 'center',
      padding: Spacing.lg,
    }}>
      <View style={{
        width: '100%', maxWidth: 480,
        backgroundColor: C.surfaceElevated, borderRadius: Radius.xl,
        borderWidth: 1.5, borderColor: C.primary + '40',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.primary + '08' }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="edit" size={20} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>Log today's health</Text>
            <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>{today} · enter what you know, leave the rest blank</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="close" size={16} color={C.textMuted} />
          </Pressable>
        </View>

        {/* Fields */}
        <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
          {fields.map(f => (
            <View key={f.label} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name={f.icon as any} size={14} color={f.color} />
                <Text style={{ fontSize: Typography.fontSizes.xs, fontWeight: '700', color: f.color, includeFontPadding: false } as any}>{f.label}</Text>
              </View>
              <TextInput
                style={{
                  backgroundColor: C.surface, borderRadius: Radius.md,
                  paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
                  color: C.textPrimary, fontSize: Typography.fontSizes.sm,
                  borderWidth: 1.5, borderColor: f.value ? f.color + '60' : C.border,
                  minHeight: 44,
                }}
                placeholder={f.placeholder}
                placeholderTextColor={C.textMuted}
                value={f.value}
                onChangeText={(t) => { f.onChange(t); setError(null); }}
                keyboardType={f.keyboard}
              />
            </View>
          ))}

          {error ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.error + '15', borderRadius: Radius.md, padding: Spacing.sm }}>
              <MaterialIcons name="error-outline" size={14} color={C.error} />
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.error, includeFontPadding: false } as any}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: saving ? C.primary + '60' : C.primary,
              borderRadius: Radius.lg, paddingVertical: 14,
            }, pressed && { opacity: 0.85 }]}
          >
            {saving
              ? <MaterialIcons name="hourglass-top" size={18} color="#08091A" />
              : <MaterialIcons name="save" size={18} color="#08091A" />}
            <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: '#08091A', includeFontPadding: false } as any}>
              {saving ? 'Saving...' : 'Save health data'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function FitnessRing({ label, value, goal, color, icon, unit = 'steps', decimal = false, noRing = false }: {
  label: string; value: number; goal: number; color: string;
  icon: string; unit?: string; decimal?: boolean; noRing?: boolean;
}) {
  const { colors: C } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, alignItems: 'center', gap: 3 },
    iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    barTrack: { width: '100%', height: 4, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: Radius.full },
    val: { fontSize: Typography.fontSizes.sm, fontWeight: Typography.fontWeights.bold, includeFontPadding: false, width: '100%', textAlign: 'center' },
    unit: { fontSize: 9, color: C.textMuted, includeFontPadding: false },
    label: { fontSize: 9, color: C.textSecondary, includeFontPadding: false },
  }), [C]);
  const progress = goal > 0 ? Math.min(value / goal, 1) : 0;
  const displayVal = decimal && value > 0 ? value.toFixed(1) : value > 0 ? Math.round(value).toLocaleString() : '—';
  return (
    <View style={s.container}>
      <View style={[s.iconWrap, { backgroundColor: color + '18', borderWidth: 1.5, borderColor: color + '40' }]}>
        <MaterialIcons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[s.val, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{displayVal}</Text>
      <Text style={s.unit}>{unit}</Text>
      {!noRing && goal > 0 ? (
        <View style={s.barTrack}>
          <View style={[s.barFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: color }]} />
        </View>
      ) : null}
      <Text style={s.label}>{label}</Text>
    </View>
  );
}
