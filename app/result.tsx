/**
 * MyMoodMapp — Intake Assessment Result
 * Displays the therapist-facing clinical summary after completing the intake questionnaire.
 * Structured for how therapists think: severity → function → history → strengths → goals → flags.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/template';

// ── Severity colour helpers ────────────────────────────────────────────────────

function getPHQ9Color(score: number): string {
  if (score <= 4) return Colors.success;
  if (score <= 9) return '#FFD166';
  if (score <= 14) return '#FF8C42';
  if (score <= 19) return Colors.error;
  return '#CC0000';
}

function getGAD7Color(score: number): string {
  if (score <= 4) return Colors.success;
  if (score <= 9) return '#FFD166';
  if (score <= 14) return '#FF8C42';
  return Colors.error;
}

function getPHQ9Label(score: number): string {
  if (score <= 4) return 'Minimal';
  if (score <= 9) return 'Mild';
  if (score <= 14) return 'Moderate';
  if (score <= 19) return 'Moderately severe';
  return 'Severe';
}

function getGAD7Label(score: number): string {
  if (score <= 4) return 'Minimal';
  if (score <= 9) return 'Mild';
  if (score <= 14) return 'Moderate';
  return 'Severe';
}

function getSleepLabel(score: number): string {
  if (score <= 1) return 'Good';
  if (score <= 3) return 'Moderate';
  return 'Poor — flag for therapist';
}

function getSleepColor(score: number): string {
  if (score <= 1) return Colors.success;
  if (score <= 3) return '#FFD166';
  return Colors.error;
}

function getAuditLabel(score: number): string {
  if (score <= 2) return 'Low risk';
  if (score <= 5) return 'Moderate — may warrant discussion';
  return 'High — recommend screening';
}

function getAuditColor(score: number): string {
  if (score <= 2) return Colors.success;
  if (score <= 5) return '#FFD166';
  return Colors.error;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummarySection({
  icon, iconColor, title, children,
}: { icon: string; iconColor: string; title: string; children: React.ReactNode }) {
  return (
    <View style={ssStyles.card}>
      <View style={ssStyles.header}>
        <View style={[ssStyles.iconWrap, { backgroundColor: iconColor + '20' }]}>
          <MaterialIcons name={icon as any} size={16} color={iconColor} />
        </View>
        <Text style={ssStyles.title}>{title}</Text>
      </View>
      <View style={ssStyles.body}>{children}</View>
    </View>
  );
}
const ssStyles = StyleSheet.create({
  card: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrap: { width: 32, height: 32, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: Colors.textPrimary, flex: 1, includeFontPadding: false },
  body: { gap: Spacing.sm },
});

function ScoreMeter({ label, score, max, color, sublabel }: { label: string; score: number; max: number; color: string; sublabel: string }) {
  const pct = Math.min((score / max) * 100, 100);
  return (
    <View style={mStyles.row}>
      <View style={mStyles.left}>
        <Text style={mStyles.label}>{label}</Text>
        <Text style={[mStyles.sublabel, { color }]}>{sublabel}</Text>
      </View>
      <View style={mStyles.right}>
        <View style={mStyles.track}>
          <View style={[mStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
        <Text style={[mStyles.score, { color }]}>{score}/{max}</Text>
      </View>
    </View>
  );
}
const mStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  left: { width: 90 },
  right: { flex: 1, gap: 4 },
  label: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  sublabel: { fontSize: 10, fontWeight: '600', includeFontPadding: false },
  track: { height: 8, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
  score: { fontSize: Typography.fontSizes.xs, fontWeight: '700', includeFontPadding: false },
});

function FlagRow({ positive, text, color }: { positive: boolean; text: string; color?: string }) {
  const c = positive ? (color ?? Colors.error) : Colors.success;
  return (
    <View style={flagStyles.row}>
      <MaterialIcons name={positive ? 'flag' : 'check-circle'} size={14} color={c} />
      <Text style={[flagStyles.text, { color: c }]}>{text}</Text>
    </View>
  );
}
const flagStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 3 },
  text: { flex: 1, fontSize: Typography.fontSizes.sm, lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
});

function AreaChip({ label }: { label: string }) {
  return (
    <View style={chipStyles.chip}>
      <Text style={chipStyles.text}>{label}</Text>
    </View>
  );
}
const chipStyles = StyleSheet.create({
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.primarySoft, borderWidth: 1, borderColor: Colors.primary + '40' },
  text: { fontSize: Typography.fontSizes.xs, color: Colors.primary, fontWeight: '600', includeFontPadding: false },
});

function QuoteBlock({ text, emptyText }: { text: string; emptyText: string }) {
  if (!text?.trim()) {
    return <Text style={qbStyles.empty}>{emptyText}</Text>;
  }
  return (
    <View style={qbStyles.block}>
      <MaterialIcons name="format-quote" size={14} color={Colors.textMuted} />
      <Text style={qbStyles.text}>{text.trim()}</Text>
    </View>
  );
}
const qbStyles = StyleSheet.create({
  block: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.background, borderRadius: Radius.lg, padding: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.primary + '60' },
  text: { flex: 1, fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.65, fontStyle: 'italic', includeFontPadding: false },
  empty: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, fontStyle: 'italic', includeFontPadding: false },
});

// ── Main result screen ────────────────────────────────────────────────────────

export default function ResultScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      try {
        // Try AsyncStorage first (fast path — always set right after quiz completes)
        const raw = await AsyncStorage.getItem('intake_summary');
        if (raw) {
          setSummary(JSON.parse(raw));
          setLoading(false);
          return;
        }
        // AsyncStorage empty (web reload, new device) — fetch from Supabase
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('intake_questionnaires')
            .select('clinical_summary')
            .eq('user_id', user.id)
            .maybeSingle();
          if (data?.clinical_summary) {
            const parsed = data.clinical_summary as Record<string, any>;
            await AsyncStorage.setItem('intake_summary', JSON.stringify(parsed));
            setSummary(parsed);
          }
        }
      } catch {}
      setLoading(false);
    };
    loadSummary();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your summary...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!summary) {
    // No data found anywhere — redirect back to quiz
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <MaterialIcons name="assignment" size={48} color={Colors.textMuted} />
          <Text style={styles.loadingText}>No profile found</Text>
          <Pressable
            onPress={() => router.replace('/quiz' as any)}
            style={({ pressed }) => [styles.retakeBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.retakeBtnText}>Take the quiz →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const phq9 = summary.phq9_total ?? 0;
  const gad7 = summary.gad7_total ?? 0;
  const sleepScore = summary.sleep_score ?? 0;
  const auditTotal = summary.audit_total ?? 0;
  const hasFlags = summary.safety_flag || summary.trauma_flag || phq9 >= 15 || gad7 >= 15;
  const lifeAreas: string[] = summary.life_areas_affected ?? [];

  const handleShare = async () => {
    const lines = [
      `MyMoodMapp — Intake Assessment Summary`,
      `Presenting concern: ${summary.presenting_concern || 'Not provided'}`,
      `Depression (PHQ-9): ${phq9}/27 — ${getPHQ9Label(phq9)}`,
      `Anxiety (GAD-7): ${gad7}/21 — ${getGAD7Label(gad7)}`,
      `Duration: ${summary.duration}`,
      `Support: ${summary.support_level}`,
      `Goal: ${summary.goal_feel || 'Not provided'}`,
    ];
    await Share.share({ message: lines.join('\n') });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>My Wellbeing Profile</Text>
          <Text style={styles.pageTitle}>Your personal summary</Text>
        </View>
        <Pressable onPress={handleShare} hitSlop={8} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}>
          <MaterialIcons name="share" size={18} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Scope disclaimer */}
        <View style={styles.disclaimerCard}>
          <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.disclaimerText}>
            This is not a diagnosis. Your answers create a personal wellness persona used to personalise your AI reports — nothing more.
          </Text>
        </View>

        {/* Safety flags — shown prominently if present */}
        {hasFlags ? (
          <View style={styles.flagCard}>
            <View style={styles.flagHeader}>
              <MaterialIcons name="warning-amber" size={16} color={Colors.warning} />
              <Text style={styles.flagTitle}>Attention — important flags</Text>
            </View>
            {summary.safety_flag ? (
              <FlagRow positive text="You reported thoughts of self-harm. Please reach out to a trusted person or a crisis line if you are struggling." color={Colors.error} />
            ) : null}
            {summary.trauma_flag ? (
              <FlagRow positive text="You indicated difficult past experiences that still affect you. Be gentle with yourself — professional support can help." color={Colors.warning} />
            ) : null}
            {phq9 >= 15 ? (
              <FlagRow positive text={`Your PHQ-9 score suggests ${getPHQ9Label(phq9).toLowerCase()} depression symptoms. Consider speaking with a mental health professional.`} color={Colors.error} />
            ) : null}
            {gad7 >= 15 ? (
              <FlagRow positive text={`Your GAD-7 score suggests ${getGAD7Label(gad7).toLowerCase()} anxiety symptoms. Consider speaking with a mental health professional.`} color={Colors.error} />
            ) : null}
          </View>
        ) : null}

        {/* Severity indicators */}
        <SummarySection icon="analytics" iconColor={Colors.primary} title="Severity indicators">
          <ScoreMeter label="PHQ-9" score={phq9} max={27} color={getPHQ9Color(phq9)} sublabel={getPHQ9Label(phq9)} />
          <ScoreMeter label="GAD-7" score={gad7} max={21} color={getGAD7Color(gad7)} sublabel={getGAD7Label(gad7)} />
          <ScoreMeter label="Sleep" score={sleepScore} max={6} color={getSleepColor(sleepScore)} sublabel={getSleepLabel(sleepScore)} />
          <ScoreMeter label="AUDIT-C" score={auditTotal} max={12} color={getAuditColor(auditTotal)} sublabel={getAuditLabel(auditTotal)} />
          <View style={styles.scaleCreditRow}>
            <Text style={styles.scaleCredit}>PHQ-9 and GAD-7 are in the public domain. AUDIT-C © WHO.</Text>
          </View>
        </SummarySection>

        {/* Presenting concern */}
        <SummarySection icon="record-voice-over" iconColor={Colors.secondary} title="Presenting concern — in their words">
          <QuoteBlock text={summary.presenting_concern} emptyText="Not provided" />
        </SummarySection>

        {/* Functional impact */}
        {lifeAreas.length > 0 ? (
          <SummarySection icon="grid-view" iconColor="#FF8C42" title="Functional impact">
            <Text style={styles.bodyText}>Life domains most affected:</Text>
            <View style={styles.chipRow}>
              {lifeAreas.map((a, i) => <AreaChip key={i} label={a} />)}
            </View>
            {summary.hard_first ? (
              <>
                <Text style={styles.bodyText}>First thing that feels hard each day:</Text>
                <QuoteBlock text={summary.hard_first} emptyText="" />
              </>
            ) : null}
          </SummarySection>
        ) : null}

        {/* History */}
        <SummarySection icon="history" iconColor="#7C83FF" title="History snapshot">
          <View style={styles.histRow}>
            <MaterialIcons name="schedule" size={14} color={Colors.textMuted} />
            <Text style={styles.histLabel}>Duration:</Text>
            <Text style={styles.histValue}>{summary.duration ?? 'Not answered'}</Text>
          </View>
          <View style={styles.histRow}>
            <MaterialIcons name="psychology" size={14} color={Colors.textMuted} />
            <Text style={styles.histLabel}>Prior therapy:</Text>
            <Text style={styles.histValue}>{summary.prior_therapy ?? 'Not answered'}</Text>
          </View>
          {summary.prior_therapy_notes?.trim() ? (
            <>
              <Text style={styles.bodyText}>Notes on prior therapy:</Text>
              <QuoteBlock text={summary.prior_therapy_notes} emptyText="" />
            </>
          ) : null}
        </SummarySection>

        {/* Support system */}
        <SummarySection icon="group" iconColor={Colors.success} title="Support system">
          <View style={styles.histRow}>
            <MaterialIcons name="people" size={14} color={Colors.textMuted} />
            <Text style={styles.histLabel}>Support level:</Text>
            <Text style={styles.histValue}>{summary.support_level ?? 'Not answered'}</Text>
          </View>
          <View style={[styles.supportBar, {
            borderColor: summary.support_level?.includes('alone') ? Colors.error + '40' : Colors.success + '40',
            backgroundColor: summary.support_level?.includes('alone') ? Colors.error + '10' : Colors.success + '10',
          }]}>
            <MaterialIcons
              name={summary.support_level?.includes('alone') ? 'person-outline' : 'group'}
              size={14}
              color={summary.support_level?.includes('alone') ? Colors.error : Colors.success}
            />
            <Text style={[styles.supportBarText, { color: summary.support_level?.includes('alone') ? Colors.error : Colors.success }]}>
              {summary.support_level?.includes('alone')
                ? 'Client may be isolated — consider exploring social support in early sessions'
                : 'Some support network present'}
            </Text>
          </View>
        </SummarySection>

        {/* Strengths */}
        <SummarySection icon="star" iconColor={Colors.primary} title="Strengths & resources">
          {summary.whats_working?.trim() ? (
            <>
              <Text style={styles.bodyText}>What is working:</Text>
              <QuoteBlock text={summary.whats_working} emptyText="" />
            </>
          ) : null}
          {summary.tried_helps?.trim() ? (
            <>
              <Text style={styles.bodyText}>What has helped in the past:</Text>
              <QuoteBlock text={summary.tried_helps} emptyText="" />
            </>
          ) : null}
          {summary.self_knowledge?.trim() ? (
            <>
              <Text style={styles.bodyText}>Self-described strengths:</Text>
              <QuoteBlock text={summary.self_knowledge} emptyText="" />
            </>
          ) : null}
          {!summary.whats_working?.trim() && !summary.tried_helps?.trim() && !summary.self_knowledge?.trim() ? (
            <Text style={styles.mutedNote}>Strengths questions were skipped — explore in session</Text>
          ) : null}
        </SummarySection>

        {/* Goals */}
        <SummarySection icon="flag" iconColor={Colors.secondary} title="Goals — in their words">
          {summary.goal_feel?.trim() ? (
            <>
              <Text style={styles.bodyText}>What would feel different if therapy worked:</Text>
              <QuoteBlock text={summary.goal_feel} emptyText="" />
            </>
          ) : null}
          {summary.goal_better?.trim() ? (
            <>
              <Text style={styles.bodyText}>What "better" looks like:</Text>
              <QuoteBlock text={summary.goal_better} emptyText="" />
            </>
          ) : null}
          {!summary.goal_feel?.trim() && !summary.goal_better?.trim() ? (
            <Text style={styles.mutedNote}>Goals not articulated yet — explore in session</Text>
          ) : null}
        </SummarySection>

        {/* Support/therapy preferences — only if therapist mode */}
        {summary.therapist_mode ? (
          <SummarySection icon="note-alt" iconColor={Colors.secondary} title="For your therapist">
            {summary.pref_style?.trim() ? (
              <>
                <Text style={styles.bodyText}>Preferred working style:</Text>
                <QuoteBlock text={summary.pref_style} emptyText="" />
              </>
            ) : null}
            {summary.pref_pace?.trim() ? (
              <>
                <Text style={styles.bodyText}>Topics to approach slowly or avoid at first:</Text>
                <QuoteBlock text={summary.pref_pace} emptyText="" />
              </>
            ) : null}
            {summary.pref_therapist?.trim() ? (
              <>
                <Text style={styles.bodyText}>Preferred style in a support relationship:</Text>
                <QuoteBlock text={summary.pref_therapist} emptyText="" />
              </>
            ) : null}
            {summary.support_why?.trim() ? (
              <>
                <Text style={styles.bodyText}>What they are hoping to get from therapy:</Text>
                <QuoteBlock text={summary.support_why} emptyText="" />
              </>
            ) : null}
          </SummarySection>
        ) : null}

        {/* What happens next */}
        <View style={styles.moodDataCard}>
          <MaterialIcons name="auto-awesome" size={16} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.moodDataTitle}>Your AI reports are now personalised</Text>
            <Text style={styles.moodDataSub}>Log your mood daily — reports will incorporate your wellness persona for deeper, more relevant insights</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/profile' as any)}
            style={({ pressed }) => [styles.viewDashBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.viewDashBtnText}>Reports →</Text>
          </Pressable>
        </View>

        {/* CTA */}
        <View style={styles.ctaRow}>
          <Pressable
            onPress={() => router.replace('/(tabs)/checkin' as any)}
            style={({ pressed }) => [styles.primaryCta, pressed && { opacity: 0.85 }]}
          >
            <MaterialIcons name="add-circle" size={18} color="#08091A" />
            <Text style={styles.primaryCtaText}>Start daily mood logging</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(tabs)' as any)}
            style={({ pressed }) => [styles.secondaryCta, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.secondaryCtaText}>Go to dashboard</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg, padding: Spacing.xl },
  loadingText: { fontSize: Typography.fontSizes.md, color: Colors.textMuted, includeFontPadding: false, textAlign: 'center' },
  retakeBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: 14 },
  retakeBtnText: { fontSize: Typography.fontSizes.md, fontWeight: '800', color: '#08091A', includeFontPadding: false },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  eyebrow: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
  pageTitle: { fontSize: Typography.fontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary, includeFontPadding: false },
  shareBtn: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary + '40' },
  scroll: { padding: Spacing.lg, paddingBottom: 48, gap: Spacing.lg },
  disclaimerCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  disclaimerText: { flex: 1, fontSize: Typography.fontSizes.xs, color: Colors.textMuted, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
  flagCard: { backgroundColor: Colors.warning + '10', borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1.5, borderColor: Colors.warning + '40', gap: Spacing.md },
  flagHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flagTitle: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: Colors.warning, includeFontPadding: false },
  scaleCreditRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  scaleCredit: { fontSize: 9, color: Colors.textMuted, includeFontPadding: false },
  bodyText: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: Colors.textSecondary, includeFontPadding: false },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  histLabel: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, width: 90, includeFontPadding: false },
  histValue: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: Colors.textPrimary, flex: 1, includeFontPadding: false },
  supportBar: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  supportBarText: { flex: 1, fontSize: Typography.fontSizes.xs, fontWeight: '600', lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
  mutedNote: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, fontStyle: 'italic', includeFontPadding: false },
  moodDataCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.primarySoft, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primary + '40' },
  moodDataTitle: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: Colors.primary, includeFontPadding: false },
  moodDataSub: { fontSize: Typography.fontSizes.xs, color: Colors.textSecondary, marginTop: 2, includeFontPadding: false },
  viewDashBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, backgroundColor: Colors.primary + '25', borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary + '50' },
  viewDashBtnText: { fontSize: Typography.fontSizes.xs, color: Colors.primary, fontWeight: '700', includeFontPadding: false },
  ctaRow: { gap: Spacing.md },
  primaryCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 15 },
  primaryCtaText: { fontSize: Typography.fontSizes.md, fontWeight: '800', color: '#08091A', includeFontPadding: false },
  secondaryCta: { alignItems: 'center', paddingVertical: 10 },
  secondaryCtaText: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, fontWeight: '600', includeFontPadding: false },
});
