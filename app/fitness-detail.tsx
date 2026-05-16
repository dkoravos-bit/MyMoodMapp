/**
 * Fitness & Sleep Detail Screen
 * Full breakdown: daily steps, sleep, heart rate (Apple Watch / Health Connect),
 * workout minutes, 30-day trend chart, sleep quality analysis, mood correlation.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import {
  DailyFitnessEntry,
  getDateRangeFitness,
  summarizeFitnessData,
} from '@/services/fitness';
import { getScoreColor } from '@/constants/moodlog';

const { width: SW } = Dimensions.get('window');
const CHART_W = SW - Spacing.lg * 2 - 32;

type Period = '7d' | '14d' | '30d';

export default function FitnessDetailScreen() {
  const router = useRouter();
  const { fitnessData, moodLogEntries, fitnessPermission } = useApp();
  const [period, setPeriod] = useState<Period>('7d');

  const days = period === '7d' ? 7 : period === '14d' ? 14 : 30;
  const filtered = useMemo(() => getDateRangeFitness(fitnessData, days), [fitnessData, days]);
  const summary = useMemo(() => summarizeFitnessData(filtered), [filtered]);

  // Sort oldest first for charts
  const chartData = useMemo(() =>
    [...filtered].sort((a, b) => a.date.localeCompare(b.date)),
    [filtered]
  );

  // Steps goal achievement
  const STEPS_GOAL = 8000;
  const daysMetGoal = filtered.filter(d => d.steps >= STEPS_GOAL).length;
  const stepsGoalPct = filtered.length ? Math.round((daysMetGoal / filtered.length) * 100) : 0;

  // Sleep quality analysis
  const sleepEntries = filtered.filter(d => d.sleepHours !== null);
  const optimalSleep = sleepEntries.filter(d => d.sleepHours! >= 7 && d.sleepHours! <= 9).length;
  const shortSleep = sleepEntries.filter(d => d.sleepHours! < 6).length;
  const longSleep = sleepEntries.filter(d => d.sleepHours! > 9).length;

  // Mood × steps correlation
  const moodByDate: Record<string, number> = {};
  moodLogEntries.forEach(e => {
    if (!moodByDate[e.date]) moodByDate[e.date] = e.score;
    else moodByDate[e.date] = Math.round((moodByDate[e.date] + e.score) / 2);
  });

  const correlationPairs = filtered
    .filter(d => moodByDate[d.date] !== undefined)
    .map(d => ({ steps: d.steps, sleep: d.sleepHours, score: moodByDate[d.date] }));

  const highStepsDays = correlationPairs.filter(p => p.steps >= STEPS_GOAL);
  const lowStepsDays = correlationPairs.filter(p => p.steps < 3000);
  const avgScoreHighSteps = highStepsDays.length
    ? Math.round(highStepsDays.reduce((s, p) => s + p.score, 0) / highStepsDays.length)
    : null;
  const avgScoreLowSteps = lowStepsDays.length
    ? Math.round(lowStepsDays.reduce((s, p) => s + p.score, 0) / lowStepsDays.length)
    : null;

  const goodSleepDays = correlationPairs.filter(p => p.sleep && p.sleep >= 7);
  const poorSleepDays = correlationPairs.filter(p => p.sleep && p.sleep < 6);
  const avgScoreGoodSleep = goodSleepDays.length
    ? Math.round(goodSleepDays.reduce((s, p) => s + p.score, 0) / goodSleepDays.length)
    : null;
  const avgScorePoorSleep = poorSleepDays.length
    ? Math.round(poorSleepDays.reduce((s, p) => s + p.score, 0) / poorSleepDays.length)
    : null;

  // Max values for scaling charts
  const maxSteps = Math.max(...chartData.map(d => d.steps), STEPS_GOAL);
  const maxSleep = Math.max(...chartData.map(d => d.sleepHours ?? 0), 9);

  const sourceLabel =
    fitnessPermission.source === 'expo_health' || fitnessPermission.source === 'healthkit'
      ? 'HealthKit · Apple Watch'
      : fitnessPermission.source === 'pedometer'
      ? 'Live step data'
      : 'Demo data';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Body & Sleep</Text>
          <Text style={styles.headerSub}>{sourceLabel} · {filtered.length} days</Text>
        </View>
        {(fitnessPermission.source === 'expo_health' || fitnessPermission.source === 'healthkit') ? (
          <View style={[styles.mockBadge, { backgroundColor: '#30D158' + '20', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <MaterialIcons name="favorite" size={10} color="#30D158" />
            <Text style={[styles.mockBadgeText, { color: '#30D158' }]}>HealthKit</Text>
          </View>
        ) : fitnessPermission.source === 'mock' ? (
          <View style={styles.mockBadge}><Text style={styles.mockBadgeText}>DEMO</Text></View>
        ) : fitnessPermission.source === 'pedometer' ? (
          <View style={[styles.mockBadge, { backgroundColor: Colors.primary + '20' }]}>
            <Text style={[styles.mockBadgeText, { color: Colors.primary }]}>PEDOMETER</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Period selector */}
        <View style={styles.periodRow}>
          {(['7d', '14d', '30d'] as Period[]).map(p => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={({ pressed }) => [styles.periodChip, period === p && styles.periodChipActive, pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.periodChipText, period === p && styles.periodChipTextActive]}>
                {p === '7d' ? '7 days' : p === '14d' ? '14 days' : '30 days'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Summary stats — single compact row */}
        <View style={styles.statsGrid}>
          <StatRow
            items={[
              { icon: 'directions-walk', label: 'Steps', value: summary.avgDailySteps > 0 ? (summary.avgDailySteps >= 1000 ? `${(summary.avgDailySteps / 1000).toFixed(1)}k` : String(summary.avgDailySteps)) : '—', color: Colors.primary, progress: summary.avgDailySteps > 0 ? Math.min(1, summary.avgDailySteps / STEPS_GOAL) : 0 },
              { icon: 'bedtime', label: 'Sleep', value: summary.avgSleepHours ? `${summary.avgSleepHours}h` : '—', color: '#7C83FF', progress: summary.avgSleepHours ? Math.min(1, summary.avgSleepHours / 9) : 0 },
              { icon: 'favorite', label: 'HR', value: summary.avgRestingHR ? `${summary.avgRestingHR}` : '—', color: Colors.error, progress: summary.avgRestingHR ? Math.max(0, 1 - (summary.avgRestingHR - 50) / 50) : 0 },
              { icon: 'fitness-center', label: 'Workouts', value: `${summary.workoutCount}/${filtered.length}`, color: Colors.success, progress: filtered.length ? summary.workoutCount / filtered.length : 0 },
            ]}
          />
        </View>

        {/* Steps chart */}
        {chartData.length >= 3 ? (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <MaterialIcons name="directions-walk" size={14} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Daily steps</Text>
              <View style={[styles.goalBadge, { backgroundColor: Colors.primary + '20', borderColor: Colors.primary + '40' }]}>
                <Text style={[styles.goalBadgeText, { color: Colors.primary }]}>{stepsGoalPct}% of days hit goal</Text>
              </View>
            </View>
            <View style={styles.barChartCard}>
              <View style={styles.barChart}>
                {chartData.map((d, i) => {
                  const pct = Math.max(0.02, d.steps / maxSteps);
                  const hitGoal = d.steps >= STEPS_GOAL;
                  const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString([], { weekday: 'narrow' });
                  const isToday = d.date === new Date().toISOString().split('T')[0];
                  return (
                    <View key={d.date} style={styles.barCol}>
                      <Text style={styles.barValue} numberOfLines={1}>
                        {d.steps >= 1000 ? `${(d.steps / 1000).toFixed(1)}k` : d.steps}
                      </Text>
                      <View style={styles.barTrack}>
                        <View style={[
                          styles.barFill,
                          { height: `${Math.round(pct * 100)}%`, backgroundColor: hitGoal ? Colors.success : Colors.primary + '80' },
                          isToday && { backgroundColor: Colors.primary },
                        ]} />
                      </View>
                      <Text style={[styles.barLabel, isToday && { color: Colors.primary, fontWeight: '700' }]}>
                        {isToday ? 'Now' : dayLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                  <Text style={styles.legendText}>Goal met ({STEPS_GOAL.toLocaleString()}+)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.primary + '80' }]} />
                  <Text style={styles.legendText}>Below goal</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* Sleep chart */}
        {sleepEntries.length >= 3 ? (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <MaterialIcons name="bedtime" size={14} color="#7C83FF" />
              <Text style={styles.sectionTitle}>Sleep duration</Text>
            </View>
            <View style={styles.barChartCard}>
              <View style={styles.barChart}>
                {chartData.filter(d => d.sleepHours !== null).slice(-days).map((d, i) => {
                  const pct = Math.max(0.02, (d.sleepHours ?? 0) / maxSleep);
                  const optimal = (d.sleepHours ?? 0) >= 7 && (d.sleepHours ?? 0) <= 9;
                  const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString([], { weekday: 'narrow' });
                  const isToday = d.date === new Date().toISOString().split('T')[0];
                  return (
                    <View key={d.date} style={styles.barCol}>
                      <Text style={styles.barValue}>{d.sleepHours?.toFixed(1)}h</Text>
                      <View style={styles.barTrack}>
                        <View style={[
                          styles.barFill,
                          { height: `${Math.round(pct * 100)}%`, backgroundColor: optimal ? '#7C83FF' : '#7C83FF50' },
                          isToday && { backgroundColor: '#7C83FF' },
                        ]} />
                      </View>
                      <Text style={[styles.barLabel, isToday && { color: '#7C83FF', fontWeight: '700' }]}>
                        {isToday ? 'Now' : dayLabel}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Sleep quality breakdown */}
              <View style={styles.sleepBreakdown}>
                <SleepBand label="Optimal (7–9h)" count={optimalSleep} total={sleepEntries.length} color="#7C83FF" emoji="😴" />
                <SleepBand label="Short (<6h)" count={shortSleep} total={sleepEntries.length} color={Colors.error} emoji="😵" />
                <SleepBand label="Long (>9h)" count={longSleep} total={sleepEntries.length} color={Colors.warning} emoji="🛌" />
              </View>
            </View>

            {/* Sleep insight */}
            {summary.avgSleepHours !== null ? (
              <View style={styles.insightBox}>
                <MaterialIcons name="lightbulb" size={13} color="#7C83FF" />
                <Text style={[styles.insightText, { color: '#7C83FF' }]}>
                  {summary.avgSleepHours >= 7 && summary.avgSleepHours <= 9
                    ? `Your average ${summary.avgSleepHours}h is within the optimal 7–9h range. Keep it consistent for best mood stability.`
                    : summary.avgSleepHours < 7
                      ? `Averaging ${summary.avgSleepHours}h — below the recommended 7–9h. Each hour of sleep deficit correlates with ~5–8 point drops in daily mood score.`
                      : `Averaging ${summary.avgSleepHours}h — slightly over the optimal range. Oversleeping can sometimes signal low mood or fatigue.`}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Heart rate section */}
        <HeartRateSection
          filtered={filtered}
          chartData={chartData}
          summary={summary}
          fitnessSource={fitnessPermission.source}
        />

        {/* Mood correlations */}
        {(avgScoreHighSteps !== null || avgScoreGoodSleep !== null) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How fitness affects your mood</Text>
            <View style={styles.corrGrid}>
              {avgScoreHighSteps !== null && avgScoreLowSteps !== null ? (
                <View style={styles.corrCard}>
                  <Text style={styles.corrCardTitle}>Steps × mood</Text>
                  <View style={styles.corrRow}>
                    <View style={styles.corrItem}>
                      <Text style={styles.corrEmoji}>🏃</Text>
                      <Text style={[styles.corrScore, { color: getScoreColor(avgScoreHighSteps) }]}>{avgScoreHighSteps}</Text>
                      <Text style={styles.corrLabel}>High-step days</Text>
                    </View>
                    <View style={styles.corrVs}>
                      <Text style={[styles.corrDelta, { color: avgScoreHighSteps > avgScoreLowSteps ? Colors.success : Colors.error }]}>
                        {avgScoreHighSteps > avgScoreLowSteps ? '+' : ''}{avgScoreHighSteps - avgScoreLowSteps} pts
                      </Text>
                    </View>
                    <View style={styles.corrItem}>
                      <Text style={styles.corrEmoji}>🛋️</Text>
                      <Text style={[styles.corrScore, { color: getScoreColor(avgScoreLowSteps) }]}>{avgScoreLowSteps}</Text>
                      <Text style={styles.corrLabel}>Low-step days</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {avgScoreGoodSleep !== null && avgScorePoorSleep !== null ? (
                <View style={styles.corrCard}>
                  <Text style={styles.corrCardTitle}>Sleep × mood</Text>
                  <View style={styles.corrRow}>
                    <View style={styles.corrItem}>
                      <Text style={styles.corrEmoji}>😴</Text>
                      <Text style={[styles.corrScore, { color: getScoreColor(avgScoreGoodSleep) }]}>{avgScoreGoodSleep}</Text>
                      <Text style={styles.corrLabel}>Good sleep</Text>
                    </View>
                    <View style={styles.corrVs}>
                      <Text style={[styles.corrDelta, { color: avgScoreGoodSleep > avgScorePoorSleep ? Colors.success : Colors.error }]}>
                        {avgScoreGoodSleep > avgScorePoorSleep ? '+' : ''}{avgScoreGoodSleep - avgScorePoorSleep} pts
                      </Text>
                    </View>
                    <View style={styles.corrItem}>
                      <Text style={styles.corrEmoji}>😵</Text>
                      <Text style={[styles.corrScore, { color: getScoreColor(avgScorePoorSleep) }]}>{avgScorePoorSleep}</Text>
                      <Text style={styles.corrLabel}>Poor sleep</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.corrNudge}>
            <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.corrNudgeText}>Keep logging mood check-ins alongside your fitness data to unlock step and sleep correlations.</Text>
          </View>
        )}

        {/* Weekly movement summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Movement summary</Text>
          <View style={styles.movCard}>
            <MovRow icon="local-fire-department" label="High activity days" value={`${summary.highExerciseDays} days`} color={Colors.primary} desc="8k+ steps or 30+ min workout" />
            <MovRow icon="directions-walk" label="Total steps" value={summary.totalSteps.toLocaleString()} color={Colors.success} desc={`${days}-day total`} />
            <MovRow icon="airline-seat-recline-normal" label="Low movement days" value={`${summary.lowExerciseDays} days`} color={Colors.error} desc="<3k steps & no workout" />
            {summary.avgActiveMinutes > 0 ? (
              <MovRow icon="timer" label="Avg active minutes" value={`${summary.avgActiveMinutes} min`} color={Colors.warning} desc="per day" />
            ) : null}
          </View>
        </View>

        {/* Privacy footer */}
        <View style={styles.privacyRow}>
          <MaterialIcons name="lock-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.privacyText}>
            {fitnessPermission.source === 'expo_health' || fitnessPermission.source === 'healthkit'
              ? 'Fitness and heart rate data is read from Apple Health / Health Connect and stays on your device.'
              : fitnessPermission.source === 'pedometer'
              ? 'Step counts are read from your device pedometer. Heart rate requires Health app access — grant it in Settings › Health › Apps.'
              : 'Currently showing demo data. Real data requires a physical device with Health/HealthKit access.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── HeartRateSection ─────────────────────────────────────────────────────────

function HeartRateSection({ filtered, chartData, summary, fitnessSource }: {
  filtered: DailyFitnessEntry[];
  chartData: DailyFitnessEntry[];
  summary: ReturnType<typeof summarizeFitnessData>;
  fitnessSource: string;
}) {
  const allSamples = useMemo(() => {
    const out: { date: string; bpm: number }[] = [];
    chartData.forEach(d => {
      (d.heartRateSamples ?? []).forEach(bpm => out.push({ date: d.date, bpm }));
    });
    return out;
  }, [chartData]);

  const hasHRData = summary.avgRestingHR !== null || allSamples.length > 0;

  if (!hasHRData) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <MaterialIcons name="favorite" size={14} color={Colors.error} />
          <Text style={styles.sectionTitle}>Heart rate</Text>
        </View>
        <View style={[styles.hrCard, { gap: Spacing.md }]}>
          <View style={{ alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.sm }}>
            <MaterialIcons name="favorite-border" size={32} color={Colors.textMuted} />
            <Text style={{ fontSize: Typography.fontSizes.sm, color: Colors.textMuted, textAlign: 'center', includeFontPadding: false }}>
              {fitnessSource === 'pedometer'
                ? 'Heart rate requires Health app access. Open Settings › Health › Apps and grant access.'
                : 'Heart rate requires a physical device with Apple Health or Health Connect.'}
            </Text>
          </View>
          <View style={[styles.insightBox, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '30' }]}>
            <MaterialIcons name="watch" size={13} color={Colors.primary} />
            <Text style={[styles.insightText, { color: Colors.primary }]}>
              Pair an Apple Watch or Android wearable and grant Health permissions to import real-time heart rate, resting HR, and workout data automatically.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const restingHR = summary.avgRestingHR;
  const maxHR = allSamples.length ? Math.max(...allSamples.map(s => s.bpm)) : null;
  const minHR = allSamples.length ? Math.min(...allSamples.map(s => s.bpm)) : null;
  const avgAllHR = allSamples.length
    ? Math.round(allSamples.reduce((s, x) => s + x.bpm, 0) / allSamples.length)
    : null;

  const dayHRData = chartData
    .map(d => ({
      date: d.date,
      resting: d.restingHeartRate,
      avg: d.avgHeartRate,
      max: (d.heartRateSamples ?? []).length > 0 ? Math.max(...d.heartRateSamples!) : null,
      dayLabel: new Date(d.date + 'T12:00:00').toLocaleDateString([], { weekday: 'narrow' }),
      isToday: d.date === new Date().toISOString().split('T')[0],
    }))
    .filter(d => d.resting !== null || d.avg !== null || d.max !== null);

  const hrBarMax = dayHRData.length > 0
    ? Math.max(...dayHRData.map(d => d.max ?? d.avg ?? d.resting ?? 100), 120)
    : 120;

  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <MaterialIcons name="favorite" size={14} color={Colors.error} />
        <Text style={styles.sectionTitle}>Heart rate</Text>
        {(fitnessSource === 'expo_health' || fitnessSource === 'healthkit') ? (
          <View style={[styles.goalBadge, { backgroundColor: Colors.success + '20', borderColor: Colors.success + '40' }]}>
            <Text style={[styles.goalBadgeText, { color: Colors.success }]}>❤️ Health · Apple Watch</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.hrCard}>
        {/* Resting HR + zones */}
        <View style={styles.hrMainRow}>
          <View style={styles.hrMetric}>
            <Text style={[styles.hrValue, { color: Colors.error }]}>{restingHR ?? '—'}</Text>
            <Text style={styles.hrUnit}>bpm resting</Text>
          </View>
          <View style={styles.hrZones}>
            <HRZone label="Athletic" range="< 60" active={(restingHR ?? 999) < 60} color={Colors.success} />
            <HRZone label="Normal" range="60–100" active={(restingHR ?? 0) >= 60 && (restingHR ?? 0) <= 100} color={Colors.primary} />
            <HRZone label="Elevated" range="> 100" active={(restingHR ?? 0) > 100} color={Colors.error} />
          </View>
        </View>

        {/* Min / Resting / Max / Readings */}
        {allSamples.length > 0 ? (
          <View style={hrSectionStyles.statsRow}>
            {minHR !== null ? (
              <View style={hrSectionStyles.statCell}>
                <Text style={[hrSectionStyles.statVal, { color: Colors.success }]}>{minHR}</Text>
                <Text style={hrSectionStyles.statLabel}>Min bpm</Text>
              </View>
            ) : null}
            <View style={hrSectionStyles.statCell}>
              <Text style={[hrSectionStyles.statVal, { color: Colors.primary }]}>{restingHR ?? avgAllHR ?? '—'}</Text>
              <Text style={hrSectionStyles.statLabel}>Resting</Text>
            </View>
            {maxHR !== null ? (
              <View style={hrSectionStyles.statCell}>
                <Text style={[hrSectionStyles.statVal, { color: Colors.error }]}>{maxHR}</Text>
                <Text style={hrSectionStyles.statLabel}>Peak bpm</Text>
              </View>
            ) : null}
            <View style={hrSectionStyles.statCell}>
              <Text style={[hrSectionStyles.statVal, { color: Colors.warning }]}>{allSamples.length}</Text>
              <Text style={hrSectionStyles.statLabel}>Readings</Text>
            </View>
          </View>
        ) : null}

        {/* Per-day HR bar chart */}
        {dayHRData.length >= 2 ? (
          <View style={hrSectionStyles.chartWrap}>
            <Text style={hrSectionStyles.chartTitle}>Daily resting heart rate</Text>
            <View style={styles.barChart}>
              {dayHRData.slice(-14).map(d => {
                const val = d.resting ?? d.avg ?? 0;
                const pct = Math.max(0.05, val / hrBarMax);
                const col = val < 60 ? Colors.success : val <= 80 ? Colors.primary : val <= 100 ? Colors.warning : Colors.error;
                return (
                  <View key={d.date} style={styles.barCol}>
                    <Text style={styles.barValue}>{val > 0 ? val : ''}</Text>
                    <View style={styles.barTrack}>
                      <View style={[
                        styles.barFill,
                        { height: `${Math.round(pct * 100)}%`, backgroundColor: col },
                        d.isToday && { borderWidth: 1, borderColor: col },
                      ]} />
                    </View>
                    <Text style={[styles.barLabel, d.isToday && { color: Colors.error, fontWeight: '700' }]}>
                      {d.isToday ? 'Now' : d.dayLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={[styles.chartLegend, { flexWrap: 'wrap' }]}>
              {[
                { color: Colors.success, label: '< 60 Athletic' },
                { color: Colors.primary, label: '60–80 Normal' },
                { color: Colors.warning, label: '80–100 Elevated' },
                { color: Colors.error, label: '> 100 High' },
              ].map(l => (
                <View key={l.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                  <Text style={styles.legendText}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {restingHR !== null ? (
          <Text style={styles.hrInsight}>
            {restingHR < 60
              ? 'Athletic resting heart rate — reflects strong cardiovascular fitness and recovery.'
              : restingHR <= 80
                ? 'Healthy resting heart rate. Regular cardio keeps this in the optimal zone.'
                : restingHR <= 100
                  ? 'Slightly elevated. Stress, caffeine, or dehydration can raise resting HR.'
                  : 'Elevated resting heart rate. Consider consulting a healthcare provider.'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const hrSectionStyles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCell: { flex: 1, alignItems: 'center', backgroundColor: Colors.background, borderRadius: Radius.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border, gap: 2 },
  statVal: { fontSize: Typography.fontSizes.lg, fontWeight: '900', includeFontPadding: false },
  statLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', includeFontPadding: false },
  chartWrap: { gap: Spacing.sm },
  chartTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, includeFontPadding: false },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatRow({ items }: { items: { icon: string; label: string; value: string; color: string; progress: number }[] }) {
  return (
    <View style={scStyles.row}>
      {items.map((item, i) => (
        <View key={i} style={[scStyles.cell, i < items.length - 1 && scStyles.cellBorder]}>
          <View style={scStyles.cellTop}>
            <MaterialIcons name={item.icon as any} size={13} color={item.color} />
            <Text style={[scStyles.value, { color: item.color }]}>{item.value}</Text>
          </View>
          <View style={scStyles.track}>
            <View style={[scStyles.fill, { width: `${Math.round(item.progress * 100)}%`, backgroundColor: item.color }]} />
          </View>
          <Text style={scStyles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
const scStyles = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: 0, overflow: 'hidden' },
  cell: { flex: 1, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, alignItems: 'center', gap: 4 },
  cellBorder: { borderRightWidth: 1, borderRightColor: Colors.border },
  cellTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  value: { fontSize: Typography.fontSizes.md, fontWeight: '900', includeFontPadding: false },
  track: { width: '100%', height: 3, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
  label: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', includeFontPadding: false },
});

function SleepBand({ label, count, total, color, emoji }: {
  label: string; count: number; total: number; color: string; emoji: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={sbStyles.row}>
      <Text style={sbStyles.emoji}>{emoji}</Text>
      <Text style={sbStyles.label}>{label}</Text>
      <View style={sbStyles.track}>
        <View style={[sbStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[sbStyles.pct, { color }]}>{pct}%</Text>
      <Text style={sbStyles.count}>{count}d</Text>
    </View>
  );
}
const sbStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  emoji: { fontSize: 14, width: 18 },
  label: { fontSize: 10, color: Colors.textSecondary, width: 88, includeFontPadding: false },
  track: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
  pct: { fontSize: 10, fontWeight: '700', width: 28, textAlign: 'right', includeFontPadding: false },
  count: { fontSize: 10, color: Colors.textMuted, width: 20, includeFontPadding: false },
});

function HRZone({ label, range, active, color }: { label: string; range: string; active: boolean; color: string }) {
  return (
    <View style={[hrZoneStyles.zone, active && { backgroundColor: color + '20', borderColor: color + '60' }]}>
      <Text style={[hrZoneStyles.label, active && { color }]}>{label}</Text>
      <Text style={hrZoneStyles.range}>{range}</Text>
    </View>
  );
}
const hrZoneStyles = StyleSheet.create({
  zone: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, gap: 2 },
  label: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, includeFontPadding: false },
  range: { fontSize: 9, color: Colors.textMuted, includeFontPadding: false },
});

function MovRow({ icon, label, value, color, desc }: {
  icon: string; label: string; value: string; color: string; desc: string;
}) {
  return (
    <View style={movStyles.row}>
      <MaterialIcons name={icon as any} size={18} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={movStyles.label}>{label}</Text>
        <Text style={movStyles.desc}>{desc}</Text>
      </View>
      <Text style={[movStyles.value, { color }]}>{value}</Text>
    </View>
  );
}
const movStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: Typography.fontSizes.sm, color: Colors.textPrimary, fontWeight: '500', includeFontPadding: false },
  desc: { fontSize: 10, color: Colors.textMuted, includeFontPadding: false },
  value: { fontSize: Typography.fontSizes.md, fontWeight: '700', includeFontPadding: false },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  headerTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  headerSub: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  mockBadge: { backgroundColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  mockBadgeText: { fontSize: 9, color: Colors.textMuted, fontWeight: '700', includeFontPadding: false },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  // Period
  periodRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  periodChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border },
  periodChipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  periodChipText: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, fontWeight: '500', includeFontPadding: false },
  periodChipTextActive: { color: Colors.primary, fontWeight: '700' },
  // Stats grid
  statsGrid: { marginBottom: Spacing.xl },
  // Sections
  section: { marginBottom: Spacing.xl, gap: Spacing.md },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { flex: 1, fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
  goalBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  goalBadgeText: { fontSize: 10, fontWeight: '600', includeFontPadding: false },
  // Bar chart
  barChartCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 100 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  barValue: { fontSize: 8, color: Colors.textMuted, includeFontPadding: false },
  barTrack: { flex: 1, width: '100%', backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, minHeight: 3 },
  barLabel: { fontSize: 9, color: Colors.textMuted, includeFontPadding: false },
  chartLegend: { flexDirection: 'row', gap: Spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: Colors.textMuted, includeFontPadding: false },
  // Sleep breakdown
  sleepBreakdown: { gap: Spacing.xs, marginTop: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  // Insight box
  insightBox: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: '#7C83FF15', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: '#7C83FF30' },
  insightText: { flex: 1, fontSize: Typography.fontSizes.xs, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
  // HR card
  hrCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  hrMainRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  hrMetric: { alignItems: 'center' },
  hrValue: { fontSize: 36, fontWeight: '900', includeFontPadding: false },
  hrUnit: { fontSize: 10, color: Colors.textMuted, includeFontPadding: false },
  hrZones: { flex: 1, flexDirection: 'row', gap: Spacing.sm },
  hrInsight: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
  // Correlations
  corrGrid: { gap: Spacing.md },
  corrCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  corrCardTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
  corrRow: { flexDirection: 'row', alignItems: 'center' },
  corrItem: { flex: 1, alignItems: 'center', gap: 4 },
  corrEmoji: { fontSize: 28 },
  corrScore: { fontSize: 26, fontWeight: '900', includeFontPadding: false },
  corrLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', includeFontPadding: false },
  corrVs: { alignItems: 'center', paddingHorizontal: Spacing.md },
  corrDelta: { fontSize: Typography.fontSizes.md, fontWeight: '900', includeFontPadding: false },
  corrNudge: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl },
  corrNudgeText: { flex: 1, fontSize: Typography.fontSizes.xs, color: Colors.textMuted, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
  // Movement card
  movCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, paddingHorizontal: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  // Privacy
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.sm },
  privacyText: { flex: 1, fontSize: 10, color: Colors.textMuted, lineHeight: 14, includeFontPadding: false },
});
