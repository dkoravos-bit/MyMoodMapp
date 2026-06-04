
/**
 * MyMoodMapp — Patterns & Insights Tab
 * MFP-inspired: inputs vs outputs correlations, time-of-day patterns,
 * tag impact analysis, AI wellness report.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, DarkColors, Typography, Spacing, Radius, Shadows, getGlass } from '@/constants/theme';
import { ScoreBubble } from '@/components/ui/GlassCard';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/hooks/useApp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  generateInsights,
  getCachedInsights,
  InsightPeriod,
  WellnessInsights,
  BehaviorRecommendation,
  CorrelationFinding,
  IntakeSummaryContext,
  TagCorrelationContext,
  TimePatternContext,
} from '@/services/insights';
import { getDateRangeFitness, summarizeFitnessData } from '@/services/fitness';
import * as Speech from 'expo-speech';
import {
  CONTEXT_TAGS,
  computeTagCorrelations,
  computeTimePatterns,
  getScoreColor,
  getScoreLabel,
  getScoreEmoji,
  TagCorrelation,
  MoodLogEntry,
} from '@/constants/moodlog';
import { buildAstrologyReport } from '@/services/astrology';
import {
  fetchCycleEntries,
  computeCycleMoodCorrelation,
  getCurrentCyclePhase,
  PHASE_INFO,
  CycleMoodCorrelation,
} from '@/services/cycleTracker';
import { getCachedSchumannReading, fetchAndCacheSchumann } from '@/services/schumannResonance';
import { WebMaxWidth } from '@/components/layout/WebLayout';

const PERIODS: { id: InsightPeriod; label: string; days: number }[] = [
  { id: 'daily', label: 'Today', days: 1 },
  { id: 'weekly', label: '7 days', days: 7 },
  { id: 'monthly', label: '30 days', days: 30 },
];

type PatternsView = 'tags' | 'time' | 'report';

export default function InsightsScreen() {
  const { moodLog, fitnessData, birthdate, moodLogEntries, weatherData, sex, subscriptionTier } = useApp();
  const { colors: C } = useTheme();
  const { isDark } = useTheme();
  const styles = useMemo(() => makeInsightsStyles(C, isDark), [C, isDark]);
  const isProOrTherapist = subscriptionTier === 'pro' || subscriptionTier === 'therapist_pro';
  const emotionLog: any[] = [];
  const router = useRouter();
  const [intakeSummary, setIntakeSummary] = React.useState<IntakeSummaryContext | null>(null);
  const [intakeCompleted, setIntakeCompleted] = React.useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem('intake_summary').then(raw => {
      if (raw) { setIntakeSummary(JSON.parse(raw)); setIntakeCompleted(true); }
    });
  }, []);

  const params = useLocalSearchParams<{ period?: string; view?: string }>();
  const [period, setPeriod] = useState<InsightPeriod>(
    (params.period as InsightPeriod) ?? 'weekly'
  );
  const [view, setView] = useState<PatternsView>(
    (params.view as PatternsView) ?? 'report'
  );

  // Sync URL params whenever the tab is navigated to with new params
  React.useEffect(() => {
    if (params.period && params.period !== period) {
      setPeriod(params.period as InsightPeriod);
      setInsights(null);
      setGenerated(false);
      setError(null);
    }
    if (params.view && params.view !== view) {
      setView(params.view as PatternsView);
    }
  }, [params.period, params.view]);
  const [insights, setInsights] = useState<WellnessInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [cycleEntries, setCycleEntries] = useState<any[]>([]);

  React.useEffect(() => {
    if (sex === 'female') {
      fetchCycleEntries().then(setCycleEntries);
    }
  }, [sex]);

  const cycleMoodCorrelations: CycleMoodCorrelation[] = React.useMemo(() => {
    if (sex !== 'female' || cycleEntries.length === 0) return [];
    return computeCycleMoodCorrelation(cycleEntries, moodLogEntries);
  }, [sex, cycleEntries, moodLogEntries]);

  const cycleStatus = React.useMemo(() => {
    if (sex !== 'female' || cycleEntries.length === 0) return null;
    return getCurrentCyclePhase(cycleEntries);
  }, [sex, cycleEntries]);

  const selectedPeriod = PERIODS.find(p => p.id === period)!;
  const days = selectedPeriod.days;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  const filteredEntries = moodLogEntries.filter(e => e.date >= cutoff);
  const filteredFitness = getDateRangeFitness(fitnessData, days);
  const fitnessSummary = summarizeFitnessData(filteredFitness);
  const tagCorrelations = computeTagCorrelations(filteredEntries);
  const timePatterns = computeTimePatterns(filteredEntries);

  const avgScore = filteredEntries.length
    ? Math.round(filteredEntries.reduce((s, e) => s + e.score, 0) / filteredEntries.length)
    : null;

  // Build daily bar chart data for 7-day and 30-day periods
  const chartDays = days > 1 ? Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayEntries = moodLogEntries.filter(e => e.date === dateStr);
    const avg = dayEntries.length
      ? Math.round(dayEntries.reduce((s, e) => s + e.score, 0) / dayEntries.length)
      : null;
    const isToday = i === days - 1;
    const dayLabel = days === 7
      ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()]
      : String(d.getDate());
    return { dateStr, avg, isToday, dayLabel };
  }) : [];
  const chartMax = chartDays.length
    ? Math.max(...chartDays.filter(d => d.avg != null).map(d => d.avg!), 50)
    : 100;
  const avgBody = filteredEntries.length
    ? filteredEntries.reduce((s, e) => s + e.dimensions.body, 0) / filteredEntries.length
    : null;
  const avgMind = filteredEntries.length
    ? filteredEntries.reduce((s, e) => s + e.dimensions.mind, 0) / filteredEntries.length
    : null;

  const tagUsage: Record<string, number> = {};
  filteredEntries.forEach(e => {
    [e.primaryTag, ...e.additionalTags].forEach(t => { tagUsage[t] = (tagUsage[t] || 0) + 1; }); // Corrected line
  });
  const topTags = Object.entries(tagUsage).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const buildWeatherCtx = () => {
    if (!weatherData) return null;
    return {
      condition: weatherData.condition,
      temperature: weatherData.temperature,
      humidity: weatherData.humidity,
      uvIndex: weatherData.uvIndex,
      moodImpact: weatherData.moodImpact,
      moodImpactReason: weatherData.moodImpactReason,
      pressureHPA: weatherData.pressureHPA,
    };
  };

  const handleClearCache = async () => {
    try {
      await AsyncStorage.multiRemove([
        'mymoodmapp_insights_daily',
        'mymoodmapp_insights_weekly',
        'mymoodmapp_insights_monthly',
      ]);
      setInsights(null);
      setGenerated(false);
      setError(null);
    } catch {}
  };

  const handleGenerate = async () => {
    setLoading(true); setError(null);

    const cached = await getCachedInsights(period);
    if (cached) { setInsights(cached); setGenerated(true); setLoading(false); return; }

    let astrologyContext = null;
    if (birthdate) {
      const report = buildAstrologyReport(birthdate);
      astrologyContext = {
        sunSign: report.zodiacSign.name, element: report.zodiacSign.element,
        rulingPlanet: report.zodiacSign.rulingPlanet, physicalAreas: report.zodiacSign.physicalAreas,
        moonPhase: report.moonPhase.phase, moonEnergyLevel: report.moonPhase.energyLevel,
        retrogrades: report.planets.filter(p => p.retrograde).map(p => p.planet),
        energyScore: report.overallEnergyScore, overallEnergy: report.overallEnergy,
        dailyForecast: report.dailyPhysicalForecast,
      };
    }
    let schumannContext = null;
    try {
      const sr = await getCachedSchumannReading() ?? await fetchAndCacheSchumann();
      schumannContext = { frequency: sr.frequency, status: sr.status, kIndex: sr.kIndex, trend: sr.trend, physicalEffects: sr.physicalEffects.map((e: any) => `${e.system}: ${e.effect}`) };
    } catch {}

    const cycleCtx = cycleStatus && cycleMoodCorrelations ? {
      currentPhase: cycleStatus.phase,
      dayOfCycle: cycleStatus.dayOfCycle,
      daysUntilNextPeriod: cycleStatus.daysUntilNextPeriod,
      avgCycleLength: cycleStatus.avgCycleLength,
      phaseMoodCorrelations: cycleMoodCorrelations,
    } : null;
    const tagCtx: TagCorrelationContext[] = tagCorrelations.map(c => {
      const tag = CONTEXT_TAGS.find(t => t.id === c.tagId);
      return { tagId: c.tagId, tagLabel: tag?.label ?? c.tagId, sampleSize: c.sampleSize, avgScore: c.avgScore, deltaVsBaseline: c.deltaVsBaseline, avgBody: c.avgBody, avgMind: c.avgMind };
    });
    const timeCtx: TimePatternContext[] = timePatterns.map(t => ({ timeOfDay: t.timeOfDay, avgScore: t.avgScore, sampleSize: t.sampleSize }));
    // Pass moodLogEntries (rich MoodLogEntry[] with score/dimensions/tags/journal)
    // NOT moodLog (legacy MoodEntry[] with only mood/note — no score data)
    const result = await generateInsights(period, moodLogEntries as any, emotionLog, fitnessData, intakeSummary, tagCtx, timeCtx, astrologyContext, schumannContext, buildWeatherCtx(), cycleCtx);
    if (result) { setInsights(result); setGenerated(true); }
    else setError('Could not generate insights. Check your connection and try again.');
    setLoading(false);
  };

  const handleRefresh = async () => {
    setLoading(true); setError(null);
    let astrologyContext = null;
    if (birthdate) {
      const report = buildAstrologyReport(birthdate);
      astrologyContext = { sunSign: report.zodiacSign.name, element: report.zodiacSign.element, rulingPlanet: report.zodiacSign.rulingPlanet, physicalAreas: report.zodiacSign.physicalAreas, moonPhase: report.moonPhase.phase, moonEnergyLevel: report.moonPhase.energyLevel, retrogrades: report.planets.filter(p => p.retrograde).map(p => p.planet), energyScore: report.overallEnergyScore, overallEnergy: report.overallEnergy, dailyForecast: report.dailyPhysicalForecast };
    }
    let schumannContext = null;
    try {
      const sr = await getCachedSchumannReading() ?? await fetchAndCacheSchumann();
      schumannContext = { frequency: sr.frequency, status: sr.status, kIndex: sr.kIndex, trend: sr.trend, physicalEffects: sr.physicalEffects.map((e: any) => `${e.system}: ${e.effect}`) };
    } catch {}
    const cycleCtx = cycleStatus && cycleMoodCorrelations ? {
      currentPhase: cycleStatus.phase,
      dayOfCycle: cycleStatus.dayOfCycle,
      daysUntilNextPeriod: cycleStatus.daysUntilNextPeriod,
      avgCycleLength: cycleStatus.avgCycleLength,
      phaseMoodCorrelations: cycleMoodCorrelations,
    } : null;
    const tagCtx2: TagCorrelationContext[] = tagCorrelations.map(c => {
      const tag = CONTEXT_TAGS.find(t => t.id === c.tagId);
      return { tagId: c.tagId, tagLabel: tag?.label ?? c.tagId, sampleSize: c.sampleSize, avgScore: c.avgScore, deltaVsBaseline: c.deltaVsBaseline, avgBody: c.avgBody, avgMind: c.avgMind };
    });
    const timeCtx2: TimePatternContext[] = timePatterns.map(t => ({ timeOfDay: t.timeOfDay, avgScore: t.avgScore, sampleSize: t.sampleSize }));
    // Pass moodLogEntries (rich data with score/dimensions/tags) not moodLog (legacy)
    const result = await generateInsights(period, moodLogEntries as any, emotionLog, fitnessData, intakeSummary, tagCtx2, timeCtx2, astrologyContext, schumannContext, buildWeatherCtx(), cycleCtx);
    if (result) setInsights(result);
    else setError('Refresh failed.');
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scroll, { alignItems: 'stretch' }]} showsVerticalScrollIndicator={false}>
      <WebMaxWidth>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Patterns</Text>
          <View style={styles.aiBadge}>
            <MaterialIcons name="auto-awesome" size={12} color={Colors.primary} />
            <Text style={styles.aiBadgeText}>AI-powered</Text>
          </View>
          <Pressable
            onPress={handleClearCache}
            hitSlop={8}
            style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1, padding: 4 }]}
            accessibilityLabel="Clear report cache"
          >
            <MaterialIcons name="refresh" size={16} color={C.textMuted} />
          </Pressable>
        </View>

        {/* Period tabs */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <Pressable
              key={p.id}
              onPress={() => { setPeriod(p.id); setInsights(null); setGenerated(false); setError(null); }}
              style={[styles.periodTab, period === p.id && styles.periodTabActive]}
            >
              <Text style={[styles.periodTabText, period === p.id && styles.periodTabTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Summary score */}
        {avgScore !== null ? (
          <View style={styles.avgScoreRow}>
            {/* Canonical shared score bubble */}
            <ScoreBubble
              score={avgScore}
              emoji={getScoreEmoji(avgScore)}
              label={`avg ${filteredEntries.length}`}
              size="large"
              color={getScoreColor(avgScore)}
            />
            <View style={styles.avgScoreRight}>
              <Text style={styles.avgScorePeriodLabel}>
                {period === 'daily' ? "Today's average" : period === 'weekly' ? '7-day average' : '30-day average'}
              </Text>
              <Text style={{ fontSize: 21, fontWeight: '800', color: getScoreColor(avgScore), letterSpacing: 0.3, includeFontPadding: false } as any}>{getScoreLabel(avgScore)}</Text>
              <Text style={styles.avgScoreMeta}>{filteredEntries.length} entries logged</Text>
              <View style={styles.dimRow}>
                {avgBody !== null ? <DimChip label="Body" val={(avgBody + 1) / 2} color={Colors.primary} /> : null}
                {avgMind !== null ? <DimChip label="Mind" val={(avgMind + 1) / 2} color={Colors.secondary} /> : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Trend bar chart — 7-day and 30-day */}
        {chartDays.length > 0 && (period === 'weekly' || period === 'monthly') ? (
          <View style={styles.chartSection}>
            <View style={styles.chartHeaderRow}>
              <Text style={styles.chartTitle}>{period === 'weekly' ? '7-day score trend' : '30-day score trend'}</Text>
              {avgScore !== null ? (
                <View style={styles.chartAvgBadge}>
                  <Text style={[styles.chartAvgText, { color: getScoreColor(avgScore) }]}>avg {avgScore}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.chartCard}>
              <View style={[styles.chartBars, period === 'monthly' && styles.chartBarsDense]}>
                {chartDays.map((d, i) => {
                  const barH = d.avg != null ? Math.max(4, Math.round((d.avg / chartMax) * (period === 'monthly' ? 44 : 56))) : 3;
                  const color = d.avg != null ? getScoreColor(d.avg) : Colors.border;
                  const showLabel = period === 'weekly' || i % 5 === 0 || i === chartDays.length - 1;
                  return (
                    <View key={i} style={[styles.chartBarCol, period === 'monthly' && styles.chartBarColDense]}>
                      {period === 'weekly' ? (
                        d.avg != null
                          ? <Text style={[styles.chartBarScore, { color }]}>{d.avg}</Text>
                          : <Text style={styles.chartBarScore}> </Text>
                      ) : null}
                      <View style={[styles.chartBar, {
                        height: barH,
                        backgroundColor: d.isToday ? color : color + (d.avg != null ? '90' : '30'),
                        borderWidth: d.isToday ? 1.5 : 0,
                        borderColor: color,
                      }]} />
                      {showLabel ? (
                        <Text style={[styles.chartBarDay, period === 'monthly' && styles.chartBarDaySmall, d.isToday && { color: Colors.textPrimary, fontWeight: '700' }]}>
                          {d.isToday ? (period === 'weekly' ? 'Now' : '·') : d.dayLabel}
                        </Text>
                      ) : <Text style={styles.chartBarDay}> </Text>}
                    </View>
                  );
                })}
              </View>
              {/* Y-axis guide lines */}
              <View style={styles.chartGuide}>
                {[100, 65, 35].map(v => (
                  <View key={v} style={styles.chartGuideLine}>
                    <Text style={styles.chartGuideLabel}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* View toggle */}
        <View style={styles.viewToggle}>
          {(['report', 'tags', 'time'] as PatternsView[]).map(v => (
            <Pressable key={v} onPress={() => setView(v)} style={[styles.viewTab, view === v && styles.viewTabActive]}>
              <Text style={[styles.viewTabText, view === v && styles.viewTabTextActive]}>
                {v === 'report' ? '🧠 AI Report' : v === 'tags' ? '📊 Tags' : '🕐 Time'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* TAGS view */}
        {view === 'tags' ? (
          <>
            {tagCorrelations.length >= 2 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tag impact on your score</Text>
                <Text style={styles.sectionSub}>Delta vs your personal baseline</Text>
                <View style={styles.corrCard}>
                  {tagCorrelations.map((c, i) => (
                    <TagCorrRow key={c.tagId} corr={c} isLast={i === tagCorrelations.length - 1} />
                  ))}
                </View>
              </View>
            ) : null}

            {topTags.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Most logged contexts</Text>
                <View style={styles.topTagsCard}>
                  {topTags.map(([id, count]) => {
                    const tag = CONTEXT_TAGS.find(t => t.id === id);
                    if (!tag) return null;
                    const maxCount = topTags[0][1];
                    return (
                      <View key={id} style={styles.topTagRow}>
                        <Text style={styles.topTagEmoji}>{tag.emoji}</Text>
                        <View style={{ flex: 1, gap: 3 }}>
                          <View style={styles.topTagLabelRow}>
                            <Text style={styles.topTagLabel}>{tag.label}</Text>
                            <Text style={styles.topTagCount}>{count}x</Text>
                          </View>
                          <View style={styles.topTagBar}>
                            <View style={[styles.topTagFill, { width: `${(count / maxCount) * 100}%`, backgroundColor: tag.color + '80' }]} />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {filteredEntries.length === 0 ? (
              <EmptyState icon="tag" message="Log some check-ins with context tags to see which inputs move your score." />
            ) : tagCorrelations.length < 2 ? (
              <View style={styles.nudgeCard}>
                <MaterialIcons name="track-changes" size={18} color={Colors.textMuted} />
                <Text style={styles.nudgeText}>Log {Math.max(0, 3 - filteredEntries.length)} more check-ins to unlock tag correlation analysis.</Text>
              </View>
            ) : null}
          </>
        ) : null}

        {/* TIME view */}
        {view === 'time' ? (
          <>
            {timePatterns.length >= 2 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Score by time of day</Text>
                <View style={styles.timeCard}>
                  {(['morning', 'afternoon', 'evening', 'night'] as const).map(tod => {
                    const tp = timePatterns.find(t => t.timeOfDay === tod);
                    const emojis = { morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙' };
                    return (
                      <View key={tod} style={styles.timeDetailRow}>
                        <Text style={styles.timeDetailEmoji}>{emojis[tod]}</Text>
                        <View style={{ flex: 1, gap: 4 }}>
                          <View style={styles.timeDetailHeader}>
                            <Text style={styles.timeDetailLabel}>{tod.charAt(0).toUpperCase() + tod.slice(1)}</Text>
                            {tp ? (
                              <Text style={[styles.timeDetailScore, { color: getScoreColor(tp.avgScore) }]}>
                                {tp.avgScore} avg · {tp.sampleSize}x
                              </Text>
                            ) : (
                              <Text style={styles.timeDetailNoData}>No data yet</Text>
                            )}
                          </View>
                          {tp ? (
                            <View style={styles.timeDetailBar}>
                              <View style={[styles.timeDetailFill, { width: `${tp.avgScore}%`, backgroundColor: getScoreColor(tp.avgScore) }]} />
                            </View>
                          ) : (
                            <View style={[styles.timeDetailBar, { opacity: 0.3 }]}>
                              <View style={[styles.timeDetailFill, { width: '10%', backgroundColor: Colors.border }]} />
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
                {timePatterns.length >= 2 ? (
                  <View style={styles.insightBox}>
                    <MaterialIcons name="lightbulb" size={13} color={Colors.primary} />
                    <Text style={styles.insightBoxText}>
                      Your best time is {timePatterns[0].timeOfDay} (avg {timePatterns[0].avgScore}).
                      {timePatterns[timePatterns.length - 1].avgScore < timePatterns[0].avgScore - 10
                        ? ` Your ${timePatterns[timePatterns.length - 1].timeOfDay} scores drop by ${timePatterns[0].avgScore - timePatterns[timePatterns.length - 1].avgScore} points on average.`
                        : ' Your mood is fairly consistent across the day.'}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <EmptyState icon="schedule" message="Log at different times of day (morning, afternoon, evening) to see your time-of-day patterns." />
            )}

            {filteredEntries.length >= 5 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Score distribution</Text>
                <View style={styles.distCard}>
                  {[
                    { label: 'Thriving (80–100)', range: [80, 100], color: '#95E06C' },
                    { label: 'Good (65–79)', range: [65, 79], color: '#4ECDC4' },
                    { label: 'Okay (50–64)', range: [50, 64], color: '#FFD166' },
                    { label: 'Low (35–49)', range: [35, 49], color: '#FF8C42' },
                    { label: 'Struggling (0–34)', range: [0, 34], color: '#FF6B6B' },
                  ].map(band => {
                    const count = filteredEntries.filter(e => e.score >= band.range[0] && e.score <= band.range[1]).length;
                    const pct = filteredEntries.length ? Math.round((count / filteredEntries.length) * 100) : 0;
                    return (
                      <View key={band.label} style={styles.distRow}>
                        <View style={[styles.distDot, { backgroundColor: band.color }]} />
                        <Text style={styles.distLabel}>{band.label}</Text>
                        <View style={styles.distBarWrap}>
                          <View style={[styles.distBarFill, { width: `${pct}%`, backgroundColor: band.color + '80' }]} />
                        </View>
                        <Text style={[styles.distPct, { color: pct > 0 ? band.color : Colors.textMuted }]}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {/* AI REPORT view */}
        {view === 'report' ? (
          <AIReportSection
            isProOrTherapist={isProOrTherapist}
            moodLogEntries={moodLogEntries}
            filteredEntries={filteredEntries}
            tagCorrelations={tagCorrelations}
            timePatterns={timePatterns}
            fitnessSummary={fitnessSummary}
            weatherData={weatherData}
            sex={sex}
            cycleStatus={cycleStatus}
            cycleMoodCorrelations={cycleMoodCorrelations}
            period={period}
            generated={generated}
            insights={insights}
            loading={loading}
            error={error}
            intakeCompleted={intakeCompleted}
            intakeSummary={intakeSummary}
            onGenerate={handleGenerate}
            onRefresh={handleRefresh}
            onGoToProfile={() => router.push('/(tabs)/profile' as any)}
            onGoToQuiz={() => router.push('/quiz' as any)}
            C={C}
            isDark={isDark}
          />
        ) : null}

        {/* Cycle × Mood Correlation — female users only */}
        {sex === 'female' && cycleMoodCorrelations.length >= 2 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cycle phase vs mood</Text>
            <Text style={styles.sectionSub}>Your avg score by cycle phase</Text>
            <View style={styles.cycleCorrelationCard}>
              {cycleMoodCorrelations.map((c, i) => {
                const info = PHASE_INFO[c.phase];
                const maxScore = Math.max(...cycleMoodCorrelations.map(x => x.avgScore), 50);
                const barPct = Math.round((c.avgScore / maxScore) * 100);
                return (
                  <View key={c.phase} style={[styles.cycleCorrelationRow, i < cycleMoodCorrelations.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
                    <Text style={{ fontSize: 20, width: 28 }}>{info.emoji}</Text>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.cycleCorrelationHeader}>
                        <Text style={[styles.cyclePhaseName, { color: info.color }]}>{info.label}</Text>
                        <Text style={styles.cycleEntryCount}>{c.entryCount}x logged</Text>
                      </View>
                      <View style={styles.cycleBarTrack}>
                        <View style={[styles.cycleBarFill, { width: `${barPct}%`, backgroundColor: info.color + '90' }]} />
                      </View>
                      {c.avgBody !== null || c.avgMind !== null ? (
                        <View style={styles.cycleDimRow}>
                          {c.avgBody !== null ? (
                            <Text style={styles.cycleDimText}>Body {Math.round(((c.avgBody + 1) / 2) * 100)}%</Text>
                          ) : null}
                          {c.avgMind !== null ? (
                            <Text style={styles.cycleDimText}>Mind {Math.round(((c.avgMind + 1) / 2) * 100)}%</Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                    <View style={[styles.cycleScoreBadge, { backgroundColor: info.color + '20' }]}>
                      <Text style={[styles.cycleScoreText, { color: info.color }]}>{c.avgScore}</Text>
                    </View>
                  </View>
                );
              })}
              {cycleStatus ? (
                <View style={styles.cycleCurrentPhaseRow}>
                  <MaterialIcons name="info-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.cycleCurrentPhaseText}>
                    Currently in {PHASE_INFO[cycleStatus.phase].label} phase{cycleStatus.dayOfCycle ? ` (day ${cycleStatus.dayOfCycle})` : ''} · Generate AI Report for deeper cycle insights
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : sex === 'female' && cycleEntries.length > 0 && cycleMoodCorrelations.length < 2 ? (
          <View style={styles.section}>
            <View style={styles.nudgeCard}>
              <Text style={{ fontSize: 16 }}>🩸</Text>
              <Text style={styles.nudgeText}>Log more mood check-ins to see how your cycle phases affect your score.</Text>
            </View>
          </View>
        ) : null}

        {/* Fitness quick stats */}
        {fitnessSummary.avgDailySteps > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fitness this period</Text>
            <View style={styles.fitnessGrid}>
              <FitStat label="Avg steps" value={fitnessSummary.avgDailySteps.toLocaleString()} icon="directions-walk" color={Colors.primary} />
              <FitStat label="Workouts" value={String(fitnessSummary.workoutCount)} icon="fitness-center" color={Colors.success} />
              {fitnessSummary.avgSleepHours ? <FitStat label="Avg sleep" value={`${fitnessSummary.avgSleepHours.toFixed(1)}h`} icon="bedtime" color={'#7C83FF'} /> : null}
              {fitnessSummary.avgRestingHR ? <FitStat label="Resting HR" value={`${fitnessSummary.avgRestingHR} bpm`} icon="favorite" color={Colors.error} /> : null}
            </View>
          </View>
        ) : null}

      </WebMaxWidth>
      </ScrollView>
    </SafeAreaView>
  );
}

function DimChip({ label, val, color }: { label: string; val: number; color: string }) {
  const { colors: C } = useTheme();
  return (
    <View style={[{ paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, backgroundColor: color + '18', borderColor: color + '40' }]}>
      <Text style={[{ fontSize: 13, fontWeight: '600', includeFontPadding: false, color }]}>{label} {Math.round(val * 100)}%</Text>
    </View>
  );
}

function TagCorrRow({ corr, isLast }: { corr: TagCorrelation; isLast: boolean }) {
  const { colors: C } = useTheme();
  const tcStyles = useMemo(() => makeTcStyles(C), [C]);
  const tag = CONTEXT_TAGS.find(t => t.id === corr.tagId);
  if (!tag) return null;
  const pos = corr.deltaVsBaseline > 0;
  const barW = Math.min(100, Math.abs(corr.deltaVsBaseline) * 3);
  return (
    <View style={[tcStyles.row, !isLast && tcStyles.rowBorder]}>
      <View style={[tcStyles.iconWrap, { backgroundColor: tag.color + '20' }]}>
        <Text>{tag.emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={tcStyles.topRow}>
          <Text style={tcStyles.tagLabel}>{tag.label}</Text>
          <View style={[tcStyles.deltaBadge, { backgroundColor: pos ? Colors.success + '20' : Colors.error + '20' }]}>
            <Text style={[tcStyles.deltaText, { color: pos ? Colors.success : Colors.error }]}>
              {pos ? '+' : ''}{corr.deltaVsBaseline}
            </Text>
          </View>
        </View>
        <View style={tcStyles.barRow}>
          <View style={[tcStyles.bar, { width: `${barW}%`, backgroundColor: pos ? Colors.success + '60' : Colors.error + '60' }]} />
        </View>
        <Text style={tcStyles.meta}>{corr.sampleSize}x logged · avg score {corr.avgScore}</Text>
      </View>
    </View>
  );
}
function makeTcStyles(C: typeof DarkColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
    iconWrap: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    tagLabel: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: C.textPrimary, flex: 1, includeFontPadding: false },
    deltaBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
    deltaText: { fontSize: Typography.fontSizes.xs, fontWeight: '700', includeFontPadding: false },
    barRow: { height: 6, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' },
    bar: { height: '100%', borderRadius: Radius.full },
    meta: { fontSize: 13, color: C.textSecondary, includeFontPadding: false },
  });
}

function FitStat({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const { colors: C } = useTheme();
  const fitStyles = useMemo(() => makeFitStyles(C), [C]);
  return (
    <View style={fitStyles.item}>
      <MaterialIcons name={icon as any} size={14} color={color} />
      <Text style={[fitStyles.value, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
      <Text style={fitStyles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
    </View>
  );
}
function makeFitStyles(C: typeof DarkColors) {
  return StyleSheet.create({
    item: { flex: 1, alignItems: 'center', gap: 2, backgroundColor: C.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.sm, paddingVertical: Spacing.md, borderWidth: 1, borderColor: C.border },
    value: { fontSize: Typography.fontSizes.sm, fontWeight: '700', includeFontPadding: false, width: '100%', textAlign: 'center' },
    label: { fontSize: 13, color: C.textSecondary, textAlign: 'center', includeFontPadding: false, width: '100%' },
  });
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  const { colors: C } = useTheme();
  const emptyStyles = useMemo(() => makeEmptyStyles(C), [C]);
  return (
    <View style={emptyStyles.container}>
      <MaterialIcons name={icon as any} size={28} color={Colors.textMuted} />
      <Text style={emptyStyles.text}>{message}</Text>
    </View>
  );
}
function makeEmptyStyles(C: typeof DarkColors) {
  return StyleSheet.create({
    container: { backgroundColor: C.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: C.border },
    text: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false },
  });
}





// ─── AIReportSection — full redesign with free upsell and pro display ───────

const INSIGHT_CATEGORIES = [
  {
    id: 'mood_intel',
    icon: 'mood' as const,
    emoji: '🧠',
    title: 'Mood Intelligence',
    color: '#F59E0B',
    items: [
      '7-day & 30-day trend with % change',
      'Best & worst day analysis',
      'Time of day score patterns',
      'Day of week patterns',
      'Mood volatility score',
      'Longest positive streak',
      'Score distribution breakdown',
    ],
  },
  {
    id: 'drivers',
    icon: 'bar-chart' as const,
    emoji: '📊',
    title: 'What Drives Your Score',
    color: '#4ADE80',
    items: [
      'Top 5 positive score drivers',
      'Top 5 negative score drags',
      'Tag correlation analysis',
      'Compound effect analysis',
      'Activity vs mood impact',
    ],
  },
  {
    id: 'health',
    icon: 'favorite' as const,
    emoji: '💪',
    title: 'Body & Health Correlations',
    color: '#FF6B6B',
    items: [
      'Sleep duration vs next-day mood',
      'Step count vs mood score',
      'Heart rate vs anxiety/energy',
      'Exercise type vs mood impact',
      'Nutrition tags vs focus scores',
    ],
  },
  {
    id: 'weather',
    icon: 'wb-sunny' as const,
    emoji: '🌤️',
    title: 'Weather & Environment',
    color: '#FFD166',
    items: [
      'Temperature vs mood correlation',
      'Sunlight/UV vs energy scores',
      'Barometric pressure patterns',
      'Seasonal trend analysis',
      'Indoor vs outdoor mood',
    ],
  },
  {
    id: 'time_intel',
    icon: 'schedule' as const,
    emoji: '⏰',
    title: 'Time Intelligence',
    color: '#4ECDC4',
    items: [
      'Your peak performance time',
      'Energy crash patterns',
      'Best time to exercise for you',
      'Optimal sleep window',
    ],
  },
  {
    id: 'predictions',
    icon: 'auto-awesome' as const,
    emoji: '🔮',
    title: 'Predictive Insights',
    color: '#A78BFA',
    items: [
      "Tomorrow's mood forecast",
      'Weekly forecast from patterns',
      'Risk alerts — low period warnings',
      'Personalised recommendations',
    ],
  },
  {
    id: 'therapist',
    icon: 'psychology' as const,
    emoji: '🏥',
    title: 'Therapist-Ready Summary',
    color: '#32D4C0',
    proOnly: true,
    items: [
      'Clinical-style narrative summary',
      'PHQ-9 & GAD-7 trend indicators',
      'Risk flag summary',
      'Progress toward wellness goals',
      'Exportable PDF report',
    ],
  },
];

type ReportTab = 'overview' | 'drivers' | 'health' | 'weather' | 'predictions';

function AIReportSection({
  isProOrTherapist, moodLogEntries, filteredEntries, tagCorrelations, timePatterns,
  fitnessSummary, weatherData, sex, cycleStatus, cycleMoodCorrelations,
  period, generated, insights, loading, error, intakeCompleted, intakeSummary,
  onGenerate, onRefresh, onGoToProfile, onGoToQuiz, C, isDark,
}: {
  isProOrTherapist: boolean;
  moodLogEntries: any[];
  filteredEntries: any[];
  tagCorrelations: any[];
  timePatterns: any[];
  fitnessSummary: any;
  weatherData: any;
  sex: string;
  cycleStatus: any;
  cycleMoodCorrelations: any[];
  period: InsightPeriod;
  generated: boolean;
  insights: WellnessInsights | null;
  loading: boolean;
  error: string | null;
  intakeCompleted: boolean;
  intakeSummary: IntakeSummaryContext | null;
  onGenerate: () => void;
  onRefresh: () => void;
  onGoToProfile: () => void;
  onGoToQuiz: () => void;
  C: typeof DarkColors;
  isDark: boolean;
}) {
  const G = getGlass(isDark);
  const [reportTab, setReportTab] = useState<ReportTab>('overview');
  const totalInsights = 47;

  // Compute real teasers from user data
  const weekCutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const weekEntries = moodLogEntries.filter((e: any) => e.date >= weekCutoff);
  const monthCutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const monthEntries = moodLogEntries.filter((e: any) => e.date >= monthCutoff);

  const weekAvg = weekEntries.length ? Math.round(weekEntries.reduce((s: number, e: any) => s + e.score, 0) / weekEntries.length) : null;
  const priorWeekCutoff = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
  const priorWeek = moodLogEntries.filter((e: any) => e.date >= priorWeekCutoff && e.date < weekCutoff);
  const priorWeekAvg = priorWeek.length ? Math.round(priorWeek.reduce((s: number, e: any) => s + e.score, 0) / priorWeek.length) : null;
  const weekTrend = weekAvg !== null && priorWeekAvg !== null ? weekAvg - priorWeekAvg : null;

  const topPositiveDriver = tagCorrelations.filter((c: any) => c.deltaVsBaseline > 0)[0];
  const topNegativeDriver = [...tagCorrelations].filter((c: any) => c.deltaVsBaseline < 0).pop();
  const topPositiveTag = topPositiveDriver ? CONTEXT_TAGS.find(t => t.id === topPositiveDriver.tagId) : null;
  const topNegativeTag = topNegativeDriver ? CONTEXT_TAGS.find(t => t.id === topNegativeDriver.tagId) : null;
  const bestTimeOfDay = timePatterns.length > 0 ? timePatterns[0] : null;
  const worstTimeOfDay = timePatterns.length > 1 ? timePatterns[timePatterns.length - 1] : null;

  // Streak
  let currentStreak = 0;
  const today = new Date().toISOString().split('T')[0];
  const allDates = [...new Set(moodLogEntries.map((e: any) => e.date))].sort().reverse();
  for (let i = 0; i < allDates.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    if (allDates[i] === expected) { currentStreak++; } else { break; }
  }

  const enoughData = moodLogEntries.length >= 5;

  // ── Not enough data — show teaser empty state
  if (!enoughData) {
    const needed = Math.max(0, 5 - moodLogEntries.length);
    return (
      <View style={{ gap: Spacing.lg }}>
        {/* Header card */}
        <View style={[arStyles.headerCard, { backgroundColor: G.cardBg, borderColor: G.cardBorder }]}>
          <View style={arStyles.headerIconWrap}>
            <MaterialIcons name="psychology" size={28} color={C.primary} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[arStyles.headerTitle, { color: C.textPrimary }]}>Your Personal Mood{' '}Intelligence Report</Text>
            <Text style={[arStyles.headerSub, { color: C.textSecondary }]}>
              Log {needed} more time{needed !== 1 ? 's' : ''} to unlock your first AI report
            </Text>
          </View>
        </View>

        {/* Progress toward unlock */}
        <View style={{ backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>Insight unlock progress</Text>
            <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.primary, includeFontPadding: false } as any}>{moodLogEntries.length}/5</Text>
          </View>
          <View style={{ height: 8, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${Math.min(100, (moodLogEntries.length / 5) * 100)}%` as any, backgroundColor: C.primary, borderRadius: Radius.full }} />
          </View>
          <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>
            The more you log, the more personalized and accurate your insights become
          </Text>
        </View>

        {/* Blurred preview of all categories */}
        <Text style={{ fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false } as any}>
          Preview — unlocks after 5 logs
        </Text>
        {INSIGHT_CATEGORIES.slice(0, 4).map(cat => (
          <View key={cat.id} style={[arStyles.lockedCategoryCard, { backgroundColor: G.cardBg, borderColor: cat.color + '30', borderLeftColor: cat.color }]}>
            <View style={[arStyles.catIconWrap, { backgroundColor: cat.color + '18' }]}>
              <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{cat.title}</Text>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>{cat.items.length} insights · locked</Text>
            </View>
            <MaterialIcons name="lock" size={16} color={C.textMuted} />
          </View>
        ))}
      </View>
    );
  }

  // ── Free tier — compelling upsell
  if (!isProOrTherapist) {
    return (
      <View style={{ gap: Spacing.lg }}>
        {/* Hero header */}
        <View style={[arStyles.heroCard, { backgroundColor: G.cardBg, borderColor: '#F59E0B40' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md }}>
            <View style={[arStyles.headerIconWrap, { backgroundColor: '#F59E0B15' }]}>
              <MaterialIcons name="auto-awesome" size={24} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '900', color: C.textPrimary, includeFontPadding: false } as any}>
                Your Personal Mood Intelligence Report
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false } as any}>
            <Text style={{ color: '#F59E0B', fontWeight: '700' } as any}>{totalInsights} insights</Text> generated from your unique data — from what drives your best days to predicting your next low period before it hits.
          </Text>
          {/* Count badge row */}
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, flexWrap: 'wrap' }}>
            {[
              { val: String(moodLogEntries.length), label: 'logs analyzed', color: C.primary },
              { val: String(tagCorrelations.length), label: 'patterns found', color: '#4ADE80' },
              { val: `${totalInsights}+`, label: 'AI insights', color: '#A78BFA' },
            ].map((stat, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', backgroundColor: C.surfaceElevated, borderRadius: Radius.lg, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ fontSize: Typography.fontSizes.lg, fontWeight: '900', color: stat.color, includeFontPadding: false } as any}>{stat.val}</Text>
                <Text style={{ fontSize: 9, color: C.textMuted, includeFontPadding: false } as any}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Real free teaser data — mood + top driver */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={{ fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false } as any}>
            Your free preview
          </Text>
          {/* Mood trend teaser */}
          {weekAvg !== null ? (
            <View style={[arStyles.teaserCard, { borderLeftColor: '#F59E0B', backgroundColor: G.cardBg, borderColor: G.cardBorder }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 }}>
                <Text style={{ fontSize: 16 }}>🧠</Text>
                <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>7-Day Mood Trend</Text>
                {weekTrend !== null ? (
                  <View style={{ marginLeft: 'auto' as any, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: weekTrend >= 0 ? '#4ADE8020' : '#FF6B6B20' }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: weekTrend >= 0 ? '#4ADE80' : '#FF6B6B', includeFontPadding: false } as any}>
                      {weekTrend >= 0 ? '+' : ''}{weekTrend} vs prior week
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ fontSize: 28, fontWeight: '900', color: getScoreColor(weekAvg), includeFontPadding: false } as any}>{weekAvg}</Text>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>7-day average · {weekEntries.length} entries</Text>
            </View>
          ) : null}
          {/* Top driver teaser */}
          {topPositiveTag ? (
            <View style={[arStyles.teaserCard, { borderLeftColor: '#4ADE80', backgroundColor: G.cardBg, borderColor: G.cardBorder }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 }}>
                <Text style={{ fontSize: 16 }}>📊</Text>
                <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>Top Score Driver</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <Text style={{ fontSize: 24 }}>{topPositiveTag.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: '#4ADE80', includeFontPadding: false } as any}>{topPositiveTag.label}</Text>
                  <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>+{topPositiveDriver.deltaVsBaseline} pts above your baseline</Text>
                </View>
              </View>
            </View>
          ) : null}
          {/* Time pattern teaser */}
          {bestTimeOfDay ? (
            <View style={[arStyles.teaserCard, { borderLeftColor: '#4ECDC4', backgroundColor: G.cardBg, borderColor: G.cardBorder }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 }}>
                <Text style={{ fontSize: 16 }}>⏰</Text>
                <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>Your Peak Performance Time</Text>
              </View>
              <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: '#4ECDC4', textTransform: 'capitalize', includeFontPadding: false } as any}>{bestTimeOfDay.timeOfDay}</Text>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>avg {bestTimeOfDay.avgScore} · {bestTimeOfDay.sampleSize} logs</Text>
            </View>
          ) : null}
        </View>

        {/* Locked categories — rich preview */}
        <View style={{ gap: Spacing.sm }}>
          <Text style={{ fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false } as any}>
            Locked — unlock with Pro
          </Text>
          {INSIGHT_CATEGORIES.map(cat => (
            <View key={cat.id} style={[arStyles.lockedCategoryCard, { backgroundColor: G.cardBg, borderColor: G.cardBorder, borderLeftColor: cat.color, opacity: 0.7 }]}>
              <View style={[arStyles.catIconWrap, { backgroundColor: cat.color + '18' }]}>
                <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{cat.title}</Text>
                  {cat.proOnly ? (
                    <View style={{ backgroundColor: '#32D4C020', borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#32D4C040' }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#32D4C0', includeFontPadding: false } as any}>THERAPIST PRO</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {cat.items.slice(0, 3).map((item, i) => (
                    <View key={i} style={{ backgroundColor: cat.color + '12', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: cat.color + '25' }}>
                      <Text style={{ fontSize: 10, color: cat.color, fontWeight: '600', includeFontPadding: false } as any}>{item}</Text>
                    </View>
                  ))}
                  {cat.items.length > 3 ? (
                    <View style={{ backgroundColor: C.border, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>+{cat.items.length - 3} more</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <MaterialIcons name="lock" size={18} color={C.textMuted} />
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={[arStyles.ctaCard, { backgroundColor: '#F59E0B08', borderColor: '#F59E0B40' }]}>
          <View style={{ alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
            <MaterialIcons name="auto-awesome" size={32} color="#F59E0B" />
            <Text style={{ fontSize: Typography.fontSizes.xl, fontWeight: '900', color: C.textPrimary, textAlign: 'center', includeFontPadding: false } as any}>
              Unlock Full AI Report
            </Text>
            <Text style={{ fontSize: Typography.fontSizes.sm, color: C.textSecondary, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false } as any}>
              Includes mood trends, top drivers, and time patterns. Pro unlocks health correlations, weather analysis, predictions, and your full therapist report.
            </Text>
          </View>
          <Pressable
            onPress={onGoToProfile}
            style={({ pressed }) => [arStyles.ctaBtn, { backgroundColor: '#F59E0B' }, pressed && { opacity: 0.85 }]}
          >
            <MaterialIcons name="star" size={18} color="#08091A" />
            <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: '#08091A', includeFontPadding: false } as any}>Unlock Full AI Report — $3.99/mo</Text>
          </Pressable>
          <Text style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 4, includeFontPadding: false } as any}>
            Cancel anytime · 7-day free trial
          </Text>
        </View>
      </View>
    );
  }

  // ── Pro/Therapist tier — full report experience
  // Show generate card if not yet generated
  if (!generated) {
    return (
      <View style={{ gap: Spacing.lg }}>
        {/* Context data banners */}
        <ContextBanners
          weatherData={weatherData}
          tagCorrelations={tagCorrelations}
          timePatterns={timePatterns}
          sex={sex}
          cycleStatus={cycleStatus}
          cycleMoodCorrelations={cycleMoodCorrelations}
          G={G}
          C={C}
        />

        <View style={[arStyles.generateCard, { backgroundColor: G.cardBg, borderColor: G.cardBorder }]}>
          <View style={[arStyles.generateIconWrap, { backgroundColor: C.primarySoft }]}>
            <MaterialIcons name="psychology" size={36} color={C.primary} />
          </View>
          <Text style={{ fontSize: Typography.fontSizes.xl, fontWeight: '800', color: C.textPrimary, textAlign: 'center', includeFontPadding: false } as any}>
            {period === 'daily' ? "Today's Full Read" : period === 'weekly' ? '7-Day Intelligence Report' : '30-Day Deep Dive'}
          </Text>
          <Text style={{ fontSize: Typography.fontSizes.sm, color: C.textSecondary, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false } as any}>
            {intakeCompleted
              ? `${totalInsights}+ personalized insights powered by your Wellbeing Profile. AI connects your mood, health, and environment data to reveal patterns you cannot see manually.`
              : 'Complete your Wellbeing Profile first to unlock personalized AI analysis — it takes about 5 minutes.'}
          </Text>

          {/* What\'s included chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' }}>
            {INSIGHT_CATEGORIES.slice(0, 6).map(cat => (
              <View key={cat.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: cat.color + '15', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: cat.color + '35' }}>
                <Text style={{ fontSize: 13 }}>{cat.emoji}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: cat.color, includeFontPadding: false } as any}>{cat.title}</Text>
              </View>
            ))}
          </View>

          {error ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.errorSoft, borderRadius: Radius.md, padding: Spacing.md, alignSelf: 'stretch' }}>
              <MaterialIcons name="error-outline" size={14} color={C.error} />
              <Text style={{ flex: 1, fontSize: Typography.fontSizes.xs, color: C.error, includeFontPadding: false } as any}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={{ alignItems: 'center', gap: Spacing.md }}>
              <ActivityIndicator color={C.primary} size="large" />
              <Text style={{ fontSize: Typography.fontSizes.sm, color: C.textSecondary, includeFontPadding: false } as any}>Analyzing your patterns...</Text>
            </View>
          ) : intakeCompleted ? (
            <Pressable
              onPress={onGenerate}
              style={({ pressed }) => [arStyles.ctaBtn, { backgroundColor: C.primary, alignSelf: 'stretch' }, pressed && { opacity: 0.85 }]}
            >
              <MaterialIcons name="auto-awesome" size={18} color="#08091A" />
              <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: '#08091A', includeFontPadding: false } as any}>Generate my report</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={onGoToQuiz}
              style={({ pressed }) => [arStyles.ctaBtn, { backgroundColor: C.primary, alignSelf: 'stretch' }, pressed && { opacity: 0.85 }]}
            >
              <MaterialIcons name="favorite" size={18} color="#08091A" />
              <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: '#08091A', includeFontPadding: false } as any}>Complete Wellbeing Profile first</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // ── Pro: full report with tab navigation
  if (!insights) return null;

  return (
    <View style={{ gap: Spacing.lg }}>
      {/* Quick Summary TTS — appears once at the top with Listen button */}
      {insights.quickSummary ? <QuickSummaryCard summary={insights.quickSummary} /> : null}

      {/* Report tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: 2, paddingVertical: 4 }}
      >
        {([['overview', '🗺️ Overview'], ['drivers', '📊 Drivers'], ['health', '💪 Health'], ['weather', '🌤️ Weather'], ['predictions', '🔮 Predict']] as [ReportTab, string][]).map(([tab, label]) => (
          <Pressable
            key={tab}
            onPress={() => setReportTab(tab)}
            style={[arStyles.reportTab, reportTab === tab && arStyles.reportTabActive, reportTab === tab && { borderColor: C.primary }, { backgroundColor: reportTab === tab ? C.primarySoft : G.cardBgLight }]}
          >
            <Text style={[arStyles.reportTabText, { color: reportTab === tab ? C.primary : C.textMuted }]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Narrative headline */}
      <View style={[arStyles.narrativeCard, { backgroundColor: G.cardBg, borderColor: '#F59E0B30' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
          <MaterialIcons name="auto-awesome" size={16} color="#F59E0B" />
          <Text style={{ fontSize: Typography.fontSizes.xs, fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false } as any}>AI Summary</Text>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={onRefresh}
            disabled={loading}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4, backgroundColor: C.primarySoft, borderRadius: Radius.full }, pressed && { opacity: 0.7 }]}
          >
            {loading
              ? <ActivityIndicator size="small" color={C.primary} />
              : <MaterialIcons name="refresh" size={12} color={C.primary} />}
            <Text style={{ fontSize: 11, color: C.primary, fontWeight: '700', includeFontPadding: false } as any}>{loading ? 'Updating' : 'Refresh'}</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '700', color: C.textPrimary, lineHeight: Typography.fontSizes.md * 1.4, includeFontPadding: false } as any}>{insights.headline}</Text>
        <Text style={{ fontSize: 11, color: C.textMuted, marginTop: Spacing.sm, includeFontPadding: false } as any}>
          Generated {new Date(insights.generatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {/* Tab content */}
      {reportTab === 'overview' ? <ReportTabOverview insights={insights} tagCorrelations={tagCorrelations} timePatterns={timePatterns} weekAvg={weekAvg} weekTrend={weekTrend} currentStreak={currentStreak} C={C} isDark={isDark} G={G} /> : null}
      {reportTab === 'drivers' ? <ReportTabDrivers insights={insights} tagCorrelations={tagCorrelations} C={C} isDark={isDark} G={G} /> : null}
      {reportTab === 'health' ? <ReportTabHealth insights={insights} fitnessSummary={fitnessSummary} C={C} isDark={isDark} G={G} /> : null}
      {reportTab === 'weather' ? <ReportTabWeather insights={insights} weatherData={weatherData} C={C} isDark={isDark} G={G} /> : null}
      {reportTab === 'predictions' ? <ReportTabPredictions insights={insights} C={C} isDark={isDark} G={G} /> : null}

      {/* Behavior recommendations */}
      {(insights as any).behaviorRecommendations?.length > 0 ? (
        <BehaviorRecommendations recs={(insights as any).behaviorRecommendations} />
      ) : null}
    </View>
  );
}

// ── Context banners shown before report generation ───────────────────────────
function ContextBanners({ weatherData, tagCorrelations, timePatterns, sex, cycleStatus, cycleMoodCorrelations, G, C }: any) {
  const items: { emoji: string; title: string; sub: string; color?: string }[] = [];
  if (weatherData) items.push({ emoji: weatherData.conditionEmoji, title: 'Weather included', sub: `${weatherData.condition} · ${weatherData.temperature}°C · ${weatherData.moodImpact} impact` });
  if (tagCorrelations?.length >= 2) items.push({ emoji: '📊', title: 'Score driver data included', sub: `${tagCorrelations.length} tags analysed` });
  if (timePatterns?.length >= 2) items.push({ emoji: '🕐', title: 'Time-of-day patterns included', sub: `Peak: ${timePatterns[0].timeOfDay} (avg ${timePatterns[0].avgScore})` });
  if (sex === 'female' && cycleStatus && cycleStatus.phase !== 'unknown') {
    const info = PHASE_INFO[cycleStatus.phase as keyof typeof PHASE_INFO];
    if (info) items.push({ emoji: info.emoji, title: 'Cycle context included', sub: `${info.label} phase`, color: info.color });
  }
  if (items.length === 0) return null;
  return (
    <View style={{ gap: Spacing.sm }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: G.cardBgLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: G.cardBorderLight }}>
          <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{item.title}</Text>
            <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>{item.sub}</Text>
          </View>
          <MaterialIcons name="check-circle" size={16} color="#4ADE80" />
        </View>
      ))}
    </View>
  );
}

// ── Insight Card — reusable color-coded card ─────────────────────────────────
function InsightCard({ title, icon, text, impact, stat, statLabel, recommendation, C, isDark }: {
  title: string; icon: string; text: string; impact: 'positive' | 'neutral' | 'negative';
  stat?: string; statLabel?: string; recommendation?: string;
  C: typeof DarkColors; isDark: boolean;
}) {
  const G = getGlass(isDark);
  const borderColor = impact === 'positive' ? '#1D9E75' : impact === 'negative' ? '#EF4444' : '#F59E0B';
  const bgColor = impact === 'positive' ? '#1D9E7508' : impact === 'negative' ? '#EF444408' : '#F59E0B08';
  return (
    <View style={{ backgroundColor: G.cardBg, borderRadius: Radius.xl, borderWidth: 1, borderColor: G.cardBorder, borderLeftWidth: 4, borderLeftColor: borderColor, overflow: 'hidden' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, paddingBottom: Spacing.sm }}>
        <MaterialIcons name={icon as any} size={16} color={borderColor} />
        <Text style={{ flex: 1, fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{title}</Text>
        {stat ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: Typography.fontSizes.lg, fontWeight: '900', color: borderColor, includeFontPadding: false } as any}>{stat}</Text>
            {statLabel ? <Text style={{ fontSize: 9, color: C.textMuted, includeFontPadding: false } as any}>{statLabel}</Text> : null}
          </View>
        ) : null}
      </View>
      {/* Body */}
      <View style={{ paddingHorizontal: Spacing.md, paddingBottom: recommendation ? 0 : Spacing.md }}>
        <Text style={{ fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false } as any}>{text}</Text>
      </View>
      {/* Recommendation */}
      {recommendation ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: borderColor + '10', padding: Spacing.md, borderTopWidth: 1, borderTopColor: borderColor + '25', margin: Spacing.sm, borderRadius: Radius.lg }}>
          <MaterialIcons name="lightbulb" size={13} color={borderColor} />
          <Text style={{ flex: 1, fontSize: Typography.fontSizes.xs, color: C.textPrimary, lineHeight: Typography.fontSizes.xs * 1.55, includeFontPadding: false } as any}>{recommendation}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Report tab: Overview ─────────────────────────────────────────────────────
function ReportTabOverview({ insights, tagCorrelations, timePatterns, weekAvg, weekTrend, currentStreak, C, isDark, G }: any) {
  const scoreColor = getScoreColor(insights.overallScore);
  const trendUp = insights.overallTrend === 'improving';
  const trendDown = insights.overallTrend === 'declining';
  return (
    <View style={{ gap: Spacing.md }}>
      {/* Score + trend hero */}
      <View style={{ flexDirection: 'row', gap: Spacing.md }}>
        <View style={{ flex: 1, backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 36, fontWeight: '900', color: scoreColor, includeFontPadding: false } as any}>{insights.overallScore}</Text>
          <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>Overall score</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name={trendUp ? 'trending-up' : trendDown ? 'trending-down' : 'trending-flat'} size={14} color={trendUp ? '#4ADE80' : trendDown ? '#EF4444' : C.textMuted} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: trendUp ? '#4ADE80' : trendDown ? '#EF4444' : C.textMuted, includeFontPadding: false } as any}>{insights.overallTrend}</Text>
          </View>
        </View>
        <View style={{ flex: 1, backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 36, fontWeight: '900', color: C.primary, includeFontPadding: false } as any}>{currentStreak}</Text>
          <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>Day streak</Text>
          <MaterialIcons name="local-fire-department" size={16} color={currentStreak >= 3 ? '#FF8C00' : C.textMuted} />
        </View>
      </View>

      {/* Celebration */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.primarySoft, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '30' }}>
        <MaterialIcons name="celebration" size={16} color={C.primary} />
        <Text style={{ flex: 1, fontSize: Typography.fontSizes.sm, color: C.primary, lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false } as any}>{insights.celebrationNote}</Text>
      </View>

      {/* One insight per category — overview */}
      <InsightCard title="Mood Intelligence" icon="mood" text={insights.moodInsight} impact={trendUp ? 'positive' : trendDown ? 'negative' : 'neutral'} stat={insights.overallScore ? String(insights.overallScore) : undefined} statLabel="score" C={C} isDark={isDark} />
      {(insights as any).scoreDriversInsight ? <InsightCard title="Score Drivers" icon="bar-chart" text={(insights as any).scoreDriversInsight} impact="positive" C={C} isDark={isDark} /> : null}
      {(insights as any).timePatternInsight ? <InsightCard title="Time Patterns" icon="schedule" text={(insights as any).timePatternInsight} impact="neutral" C={C} isDark={isDark} /> : null}
      {insights.fitnessInsight ? <InsightCard title="Body & Health" icon="fitness-center" text={insights.fitnessInsight} impact="neutral" C={C} isDark={isDark} /> : null}
      {insights.weatherInsight ? <InsightCard title="Weather & Environment" icon="wb-sunny" text={insights.weatherInsight} impact="neutral" C={C} isDark={isDark} /> : null}

      {/* Watch out */}
      {insights.watchOut ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.warning + '15', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.warning + '30' }}>
          <MaterialIcons name="warning-amber" size={15} color={C.warning} />
          <Text style={{ flex: 1, fontSize: Typography.fontSizes.sm, color: C.warning, lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false } as any}>{insights.watchOut}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Report tab: Drivers ──────────────────────────────────────────────────────
function ReportTabDrivers({ insights, tagCorrelations, C, isDark, G }: any) {
  const positiveDrivers = tagCorrelations.filter((c: any) => c.deltaVsBaseline > 0).slice(0, 5);
  const negativeDrivers = [...tagCorrelations].filter((c: any) => c.deltaVsBaseline < 0).reverse().slice(0, 5);
  return (
    <View style={{ gap: Spacing.md }}>
      {(insights as any).scoreDriversInsight ? (
        <InsightCard title="What Drives Your Score" icon="bar-chart" text={(insights as any).scoreDriversInsight} impact="positive" C={C} isDark={isDark} />
      ) : null}

      {/* Top positive drivers */}
      {positiveDrivers.length > 0 ? (
        <View style={{ backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <MaterialIcons name="arrow-upward" size={16} color="#4ADE80" />
            <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: '#4ADE80', includeFontPadding: false } as any}>Top Positive Drivers</Text>
          </View>
          {positiveDrivers.map((c: any, i: number) => {
            const tag = CONTEXT_TAGS.find(t => t.id === c.tagId);
            if (!tag) return null;
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <Text style={{ fontSize: 20 }}>{tag.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{tag.label}</Text>
                  <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>{c.sampleSize}x logged · avg {c.avgScore}</Text>
                </View>
                <View style={{ backgroundColor: '#4ADE8020', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full }}>
                  <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '900', color: '#4ADE80', includeFontPadding: false } as any}>+{c.deltaVsBaseline}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Top negative drivers */}
      {negativeDrivers.length > 0 ? (
        <View style={{ backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <MaterialIcons name="arrow-downward" size={16} color="#EF4444" />
            <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: '#EF4444', includeFontPadding: false } as any}>Top Score Drags</Text>
          </View>
          {negativeDrivers.map((c: any, i: number) => {
            const tag = CONTEXT_TAGS.find(t => t.id === c.tagId);
            if (!tag) return null;
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <Text style={{ fontSize: 20 }}>{tag.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{tag.label}</Text>
                  <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>{c.sampleSize}x logged · avg {c.avgScore}</Text>
                </View>
                <View style={{ backgroundColor: '#EF444420', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full }}>
                  <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '900', color: '#EF4444', includeFontPadding: false } as any}>{c.deltaVsBaseline}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Correlations */}
      {insights.correlations?.length > 0 ? (
        <View style={{ backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 }}>
            <MaterialIcons name="link" size={16} color={C.secondary} />
            <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>Key Correlations</Text>
          </View>
          {insights.correlations.map((c: any, i: number) => {
            const col = c.impact === 'positive' ? '#4ADE80' : c.impact === 'negative' ? '#EF4444' : C.textMuted;
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: col + '08', borderRadius: Radius.md, padding: Spacing.sm }}>
                <MaterialIcons name={c.impact === 'positive' ? 'arrow-upward' : c.impact === 'negative' ? 'arrow-downward' : 'remove'} size={13} color={col} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textPrimary, includeFontPadding: false } as any}>{c.finding}</Text>
                  <Text style={{ fontSize: 11, color: col, textTransform: 'capitalize', includeFontPadding: false } as any}>{c.confidence} confidence</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Action steps */}
      {insights.actionableAdvice?.length > 0 ? (
        <View style={{ backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 }}>
            <MaterialIcons name="lightbulb" size={16} color={C.primary} />
            <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>Action Steps</Text>
          </View>
          {insights.actionableAdvice.map((a: string, i: number) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.primary, includeFontPadding: false } as any}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false } as any}>{a}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── Report tab: Health ───────────────────────────────────────────────────────
function ReportTabHealth({ insights, fitnessSummary, C, isDark, G }: any) {
  return (
    <View style={{ gap: Spacing.md }}>
      {insights.fitnessInsight ? (
        <InsightCard title="Body & Health Overview" icon="fitness-center" text={insights.fitnessInsight} impact="neutral" C={C} isDark={isDark} />
      ) : null}
      {insights.sleepInsight ? (
        <InsightCard title="Sleep & Recovery" icon="bedtime" text={insights.sleepInsight} impact="neutral" stat={fitnessSummary.avgSleepHours ? `${fitnessSummary.avgSleepHours.toFixed(1)}h` : undefined} statLabel="avg sleep" C={C} isDark={isDark} />
      ) : null}

      {/* Fitness correlations detail */}
      {fitnessSummary.avgDailySteps > 0 ? (
        <View style={{ backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <MaterialIcons name="bar-chart" size={16} color="#4ADE80" />
            <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>Health Data This Period</Text>
          </View>
          {[
            { label: 'Avg Daily Steps', value: fitnessSummary.avgDailySteps?.toLocaleString(), icon: 'directions-walk', color: C.primary, note: fitnessSummary.avgDailySteps >= 8000 ? 'Above WHO target' : 'Below 8K goal' },
            { label: 'Avg Active Minutes', value: fitnessSummary.avgActiveMinutes ? `${fitnessSummary.avgActiveMinutes}min` : null, icon: 'fitness-center', color: '#4ADE80', note: fitnessSummary.avgActiveMinutes >= 30 ? 'Meeting daily target' : 'Below 30min goal' },
            { label: 'Avg Sleep', value: fitnessSummary.avgSleepHours ? `${fitnessSummary.avgSleepHours.toFixed(1)}h` : null, icon: 'bedtime', color: '#7C83FF', note: fitnessSummary.avgSleepHours >= 7 ? 'Good sleep duration' : 'Below 7h optimal' },
            { label: 'Resting Heart Rate', value: fitnessSummary.avgRestingHR ? `${fitnessSummary.avgRestingHR} bpm` : null, icon: 'favorite', color: '#EF4444', note: null },
          ].filter(s => s.value).map((stat, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <View style={{ width: 36, height: 36, borderRadius: Radius.md, backgroundColor: stat.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name={stat.icon as any} size={16} color={stat.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{stat.value}</Text>
                <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>{stat.label}</Text>
              </View>
              {stat.note ? (
                <Text style={{ fontSize: 10, color: stat.color, fontWeight: '600', includeFontPadding: false } as any}>{stat.note}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ backgroundColor: G.cardBgLight, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorderLight, alignItems: 'center', gap: Spacing.md }}>
          <MaterialIcons name="fitness-center" size={28} color={C.textMuted} />
          <Text style={{ fontSize: Typography.fontSizes.sm, color: C.textSecondary, textAlign: 'center', includeFontPadding: false } as any}>
            Sync health data from your phone to unlock sleep, steps, and heart rate correlations with your mood.
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Report tab: Weather ──────────────────────────────────────────────────────
function ReportTabWeather({ insights, weatherData, C, isDark, G }: any) {
  return (
    <View style={{ gap: Spacing.md }}>
      {insights.weatherInsight ? (
        <InsightCard title="Weather & Mood Correlation" icon="wb-sunny" text={insights.weatherInsight} impact="neutral" C={C} isDark={isDark} />
      ) : null}
      {(insights as any).schumannInsight ? (
        <InsightCard title="Earth Resonance" icon="wifi" text={(insights as any).schumannInsight} impact="neutral" C={C} isDark={isDark} />
      ) : null}
      {weatherData ? (
        <View style={{ backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md }}>
          <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>Current Conditions</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <Text style={{ fontSize: 40 }}>{weatherData.conditionEmoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: Typography.fontSizes.xl, fontWeight: '900', color: C.textPrimary, includeFontPadding: false } as any}>{weatherData.temperature}°C</Text>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>{weatherData.condition} · {weatherData.city}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {[{ label: 'UV Index', value: String(weatherData.uvIndex), color: '#FFD166' }, { label: 'Humidity', value: `${weatherData.humidity}%`, color: '#4ECDC4' }, { label: 'Wind', value: `${weatherData.windSpeed}km/h`, color: C.secondary }].map((s, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', backgroundColor: C.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.sm, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: s.color, includeFontPadding: false } as any}>{s.value}</Text>
                <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>{s.label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false } as any}>{weatherData.moodImpactReason}</Text>
        </View>
      ) : (
        <View style={{ backgroundColor: G.cardBgLight, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorderLight, alignItems: 'center', gap: Spacing.md }}>
          <MaterialIcons name="wb-sunny" size={28} color={C.textMuted} />
          <Text style={{ fontSize: Typography.fontSizes.sm, color: C.textSecondary, textAlign: 'center', includeFontPadding: false } as any}>Set your location on the Dashboard to unlock weather vs mood correlations.</Text>
        </View>
      )}
    </View>
  );
}

// ── Report tab: Predictions ──────────────────────────────────────────────────
function ReportTabPredictions({ insights, C, isDark, G }: any) {
  return (
    <View style={{ gap: Spacing.md }}>
      {/* Astrology */}
      {insights.astrologyInsight ? (
        <InsightCard title="Cosmic Alignment" icon="auto-awesome" text={insights.astrologyInsight} impact="neutral" C={C} isDark={isDark} />
      ) : null}
      {/* Cycle */}
      {(insights as any).cycleInsight ? (
        <InsightCard title="Cycle Phase Insight" icon="water-drop" text={(insights as any).cycleInsight} impact="neutral" C={C} isDark={isDark} />
      ) : null}

      {/* Predictive cards based on top patterns */}
      {insights.topPatterns?.length > 0 ? (
        <View style={{ backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <MaterialIcons name="auto-awesome" size={16} color="#A78BFA" />
            <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>Your Top Patterns</Text>
          </View>
          {insights.topPatterns.map((p: string, i: number) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#A78BFA20', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#A78BFA', includeFontPadding: false } as any}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false } as any}>{p}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Recommendations */}
      {insights.actionableAdvice?.length > 0 ? (
        <View style={{ backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <MaterialIcons name="lightbulb" size={16} color="#F59E0B" />
            <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>Personalized Recommendations</Text>
          </View>
          {insights.actionableAdvice.map((a: string, i: number) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }}>
              <MaterialIcons name="arrow-forward-ios" size={12} color="#F59E0B" style={{ marginTop: 3 }} />
              <Text style={{ flex: 1, fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false } as any}>{a}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Risk alert */}
      {insights.watchOut ? (
        <InsightCard title="Risk Alert" icon="warning-amber" text={insights.watchOut} impact="negative" recommendation="Monitor these patterns and log consistently to help the AI refine its predictions." C={C} isDark={isDark} />
      ) : null}
    </View>
  );
}

// Styles for AIReportSection
const arStyles = StyleSheet.create({
  headerCard: { borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerIconWrap: { width: 52, height: 52, borderRadius: Radius.xl, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.primary + '40', flexShrink: 0 },
  headerTitle: { fontSize: Typography.fontSizes.md, fontWeight: '800', flex: 1, includeFontPadding: false },
  headerSub: { fontSize: Typography.fontSizes.xs, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
  heroCard: { borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1 },
  lockedCategoryCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderLeftWidth: 4 },
  catIconWrap: { width: 44, height: 44, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  teaserCard: { borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderLeftWidth: 4, gap: 4 },
  ctaCard: { borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, gap: Spacing.md },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: Spacing.xl },
  generateCard: { borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, alignItems: 'center', gap: Spacing.lg },
  generateIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.primary + '40' },
  reportTab: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1 },
  reportTabActive: {},
  reportTabText: { fontSize: Typography.fontSizes.sm, fontWeight: '600', includeFontPadding: false },
  narrativeCard: { borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1 },
});

// ─── Quick Summary Card with Read-Aloud ─────────────────────────────────────
function QuickSummaryCard({ summary }: { summary: string }) {
  const { colors: C } = useTheme();
  const [ttsState, setTtsState] = useState<'idle' | 'playing' | 'paused'>('idle');

  // Web: use window.speechSynthesis directly for reliable pause/resume
  // Native: use expo-speech with Android fallback (no pause support)
  const handlePlay = useCallback(async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(summary);
        utt.rate = 0.82;
        utt.pitch = 0.95;
        utt.onend = () => setTtsState('idle');
        utt.onerror = () => setTtsState('idle');
        window.speechSynthesis.speak(utt);
        setTtsState('playing');
      } else {
        Speech.speak(summary, {
          rate: 0.82,
          pitch: 0.95,
          onStart: () => setTtsState('playing'),
          onDone: () => setTtsState('idle'),
          onError: () => setTtsState('idle'),
          onStopped: () => setTtsState('idle'),
        });
        setTtsState('playing');
      }
    } catch { setTtsState('idle'); }
  }, [summary]);

  const handlePause = useCallback(async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.pause();
        setTtsState('paused');
      } else {
        try {
          Speech.pause();
          setTtsState('paused');
        } catch {
          // Android doesn't support pause — stop instead
          Speech.stop();
          setTtsState('idle');
        }
      }
    } catch { setTtsState('idle'); }
  }, []);

  const handleResume = useCallback(async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.resume();
        setTtsState('playing');
      } else {
        try {
          Speech.resume();
          setTtsState('playing');
        } catch { handlePlay(); }
      }
    } catch { handlePlay(); }
  }, [handlePlay]);

  const handleStop = useCallback(async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    } else {
      try { Speech.stop(); } catch {}
    }
    setTtsState('idle');
  }, []);

  React.useEffect(() => {
    return () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      } else {
        try { Speech.stop(); } catch {}
      }
    };
  }, []);

  const isActive = ttsState !== 'idle';

  return (
    <View style={[qsStyles.card, { backgroundColor: C.surfaceElevated, borderColor: Colors.primary + '35' }]}>
      <View style={qsStyles.header}>
        <View style={[qsStyles.iconWrap, { backgroundColor: Colors.primary + '18' }]}>
          <MaterialIcons name="record-voice-over" size={16} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[qsStyles.title, { color: C.textPrimary }]}>Quick Summary</Text>
          <Text style={[qsStyles.sub, { color: C.textMuted }]}>At-a-glance overview · tap to listen</Text>
        </View>
        {/* Playback controls */}
        <View style={qsStyles.controls}>
          {ttsState === 'idle' ? (
            <Pressable
              onPress={handlePlay}
              hitSlop={8}
              style={({ pressed }) => [qsStyles.ctrlBtn, { borderColor: C.border }, pressed && { opacity: 0.7 }]}
              accessibilityLabel="Play summary"
            >
              <MaterialIcons name="play-arrow" size={18} color={C.textMuted} />
              <Text style={[qsStyles.ctrlText, { color: C.textMuted }]}>Listen</Text>
            </Pressable>
          ) : (
            <>
              {ttsState === 'playing' ? (
                <Pressable
                  onPress={handlePause}
                  hitSlop={8}
                  style={({ pressed }) => [qsStyles.ctrlBtn, qsStyles.ctrlBtnActive, { borderColor: Colors.primary }, pressed && { opacity: 0.7 }]}
                  accessibilityLabel="Pause"
                >
                  <MaterialIcons name="pause" size={18} color={Colors.primary} />
                  <Text style={[qsStyles.ctrlText, { color: Colors.primary }]}>Pause</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleResume}
                  hitSlop={8}
                  style={({ pressed }) => [qsStyles.ctrlBtn, qsStyles.ctrlBtnActive, { borderColor: Colors.primary }, pressed && { opacity: 0.7 }]}
                  accessibilityLabel="Resume"
                >
                  <MaterialIcons name="play-arrow" size={18} color={Colors.primary} />
                  <Text style={[qsStyles.ctrlText, { color: Colors.primary }]}>Resume</Text>
                </Pressable>
              )}
              <Pressable
                onPress={handleStop}
                hitSlop={8}
                style={({ pressed }) => [qsStyles.ctrlBtnStop, { borderColor: C.border }, pressed && { opacity: 0.7 }]}
                accessibilityLabel="Stop"
              >
                <MaterialIcons name="stop" size={18} color={C.textMuted} />
              </Pressable>
            </>
          )}
        </View>
      </View>
      <View style={[qsStyles.summaryBox, { backgroundColor: C.background, borderColor: C.border }]}>
        <Text style={[qsStyles.summaryText, { color: C.textPrimary }]}>{summary}</Text>
        {isActive ? (
          <View style={qsStyles.speakingIndicator}>
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={[qsStyles.speakDot, { backgroundColor: Colors.primary, opacity: 0.3 + i * 0.14 }]} />
            ))}
            <Text style={[qsStyles.speakingText, { color: Colors.primary }]}>
              {ttsState === 'paused' ? 'Paused' : 'Reading…'}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const qsStyles = StyleSheet.create({
  card: { borderRadius: Radius.xl, borderWidth: 1.5, padding: Spacing.lg, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', includeFontPadding: false },
  sub: { fontSize: 14, includeFontPadding: false },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctrlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1.5, minHeight: 36 },
  ctrlBtnActive: { backgroundColor: Colors.primary + '15' },
  ctrlBtnStop: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full, borderWidth: 1.5 },
  ctrlText: { fontSize: 14, fontWeight: '700', includeFontPadding: false },
  summaryBox: { borderRadius: Radius.lg, padding: 14, borderWidth: 1, gap: 8 },
  summaryText: { fontSize: 16, lineHeight: 25, fontWeight: '400', includeFontPadding: false },
  speakingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  speakDot: { width: 5, height: 5, borderRadius: 2.5 },
  speakingText: { fontSize: 13, fontWeight: '700', includeFontPadding: false },
});

// ─── Behavior Recommendations ────────────────────────────────────────────────
const CATEGORY_META: Record<string, { icon: string; color: string; label: string }> = {
  sleep:        { icon: 'bedtime',          color: '#7C83FF', label: 'Sleep'       },
  exercise:     { icon: 'fitness-center',   color: '#4ADE80', label: 'Movement'    },
  social:       { icon: 'people',           color: '#FB923C', label: 'Social'      },
  mindfulness:  { icon: 'self-improvement', color: '#A78BFA', label: 'Mind'        },
  schedule:     { icon: 'schedule',         color: '#4ECDC4', label: 'Timing'      },
  nutrition:    { icon: 'restaurant',       color: '#FFD166', label: 'Nutrition'   },
  recovery:     { icon: 'spa',              color: '#95E06C', label: 'Recovery'    },
  cognitive:    { icon: 'psychology',       color: Colors.primary, label: 'Mindset' },
};

const EFFORT_COLOR = { low: '#4ADE80', medium: '#FFD166', high: '#FF8C42' };
const TIMEFRAME_LABEL = { immediate: 'Do today', 'this-week': 'This week', 'this-month': 'This month' };
const PRIORITY_LABEL = ['', 'Critical', 'High', 'Medium', 'Standard', 'Optional'];
const PRIORITY_COLOR = ['', '#EF4444', '#FF8C42', '#FFD166', '#4ECDC4', '#A78BFA'];

function BehaviorRecommendations({ recs }: { recs: BehaviorRecommendation[] }) {
  const { colors: C } = useTheme();
  const [expanded, setExpanded] = useState<number | null>(0);

  if (!recs || recs.length === 0) return null;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <MaterialIcons name="psychology" size={18} color={Colors.primary} />
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>Behaviour Recommendations</Text>
        <View style={{ flex: 1 }} />
        <View style={{ backgroundColor: Colors.primary + '15', paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary + '35' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary, includeFontPadding: false } as any}>Science-backed · priority order</Text>
        </View>
      </View>
      <Text style={{ fontSize: 14, color: C.textMuted, lineHeight: 22, includeFontPadding: false } as any}>
        Based on your data patterns — ranked by predicted impact on your wellbeing score.
      </Text>
      {recs.map((rec, i) => {
        const isOpen = expanded === i;
        const meta = CATEGORY_META[rec.category] ?? CATEGORY_META.cognitive;
        const pColor = PRIORITY_COLOR[rec.priority] ?? Colors.primary;
        const pLabel = PRIORITY_LABEL[rec.priority] ?? `P${rec.priority}`;
        return (
          <Pressable
            key={i}
            onPress={() => setExpanded(isOpen ? null : i)}
            style={({ pressed }) => [
              brStyles.card,
              {
                backgroundColor: C.surfaceElevated,
                borderColor: isOpen ? pColor + '60' : C.border,
                borderLeftColor: pColor,
              },
              pressed && { opacity: 0.92 },
            ]}
          >
            {/* Header row */}
            <View style={brStyles.header}>
              <View style={[brStyles.priorityBadge, { backgroundColor: pColor + '18', borderColor: pColor + '50' }]}>
                <Text style={[brStyles.priorityNum, { color: pColor }]}>#{rec.priority}</Text>
                <Text style={[brStyles.priorityLabel, { color: pColor }]}>{pLabel}</Text>
              </View>
              <View style={[brStyles.catIcon, { backgroundColor: meta.color + '18' }]}>
                <MaterialIcons name={meta.icon as any} size={14} color={meta.color} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[brStyles.title, { color: C.textPrimary }]} numberOfLines={isOpen ? undefined : 1}>
                  {rec.title}
                </Text>
                {!isOpen ? (
                  <Text style={[brStyles.summaryLine, { color: C.textSecondary }]} numberOfLines={1}>
                    {rec.summary}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={[brStyles.effortPill, { backgroundColor: EFFORT_COLOR[rec.effort] + '20' }]}>
                  <Text style={[brStyles.effortText, { color: EFFORT_COLOR[rec.effort] }]}>
                    {rec.effort} effort
                  </Text>
                </View>
                <MaterialIcons name={isOpen ? 'expand-less' : 'expand-more'} size={16} color={C.textMuted} />
              </View>
            </View>

            {isOpen ? (
              <View style={[brStyles.body, { borderTopColor: C.border }]}>
                {/* Timeframe + category chips */}
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <View style={[brStyles.chip, { backgroundColor: meta.color + '15', borderColor: meta.color + '40' }]}>
                    <MaterialIcons name={meta.icon as any} size={10} color={meta.color} />
                    <Text style={[brStyles.chipText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <View style={[brStyles.chip, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <MaterialIcons name="schedule" size={10} color={C.textMuted} />
                    <Text style={[brStyles.chipText, { color: C.textMuted }]}>{TIMEFRAME_LABEL[rec.timeframe]}</Text>
                  </View>
                </View>

                {/* Summary */}
                <Text style={[brStyles.sectionText, { color: C.textPrimary, fontWeight: '600' }]}>
                  {rec.summary}
                </Text>

                {/* Detail */}
                <View style={[brStyles.detailBox, { backgroundColor: C.background, borderColor: C.border }]}>
                  <Text style={[brStyles.bodyText, { color: C.textSecondary }]}>{rec.detail}</Text>
                </View>

                {/* Non-obvious insight — highlighted */}
                <View style={[brStyles.insightBox, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '30' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <MaterialIcons name="lightbulb" size={13} color={Colors.primary} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.primary, includeFontPadding: false } as any}>
                      NON-OBVIOUS INSIGHT
                    </Text>
                  </View>
                  <Text style={[brStyles.bodyText, { color: C.textPrimary }]}>{rec.notObviousInsight}</Text>
                </View>

                {/* Why + prediction in 2-col */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={[brStyles.miniBox, { flex: 1, backgroundColor: C.surface, borderColor: C.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <MaterialIcons name="science" size={13} color={meta.color} />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: meta.color, includeFontPadding: false } as any}>WHY IT WORKS</Text>
                    </View>
                    <Text style={[brStyles.miniText, { color: C.textSecondary }]}>{rec.why}</Text>
                  </View>
                  <View style={[brStyles.miniBox, { flex: 1, backgroundColor: C.surface, borderColor: C.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <MaterialIcons name="trending-up" size={13} color='#4ADE80' />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#4ADE80', includeFontPadding: false } as any}>IF YOU ACT</Text>
                    </View>
                    <Text style={[brStyles.miniText, { color: C.textSecondary }]}>{rec.predictedOutcome}</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const brStyles = StyleSheet.create({
  card: { borderRadius: Radius.xl, borderWidth: 1, borderLeftWidth: 4, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  priorityBadge: { alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 5, minWidth: 48 },
  priorityNum: { fontSize: 15, fontWeight: '900', includeFontPadding: false },
  priorityLabel: { fontSize: 12, fontWeight: '700', includeFontPadding: false },
  catIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontSize: 15, fontWeight: '700', includeFontPadding: false },
  summaryLine: { fontSize: 15, includeFontPadding: false },
  effortPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  effortText: { fontSize: 13, fontWeight: '700', includeFontPadding: false },
  body: { borderTopWidth: 1, padding: 14, gap: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1 },
  chipText: { fontSize: 14, fontWeight: '600', includeFontPadding: false },
  sectionText: { fontSize: 16, lineHeight: 25, includeFontPadding: false },
  detailBox: { borderRadius: Radius.lg, padding: 13, borderWidth: 1 },
  insightBox: { borderRadius: Radius.lg, padding: 13, borderWidth: 1 },
  bodyText: { fontSize: 15, lineHeight: 24, includeFontPadding: false },
  miniBox: { borderRadius: Radius.md, padding: 10, borderWidth: 1 },
  miniText: { fontSize: 14, lineHeight: 22, includeFontPadding: false },
});

// ─── Main InsightReport ───────────────────────────────────────────────────────
function InsightReport({ insights, onRefresh, loading, intakeSummary }: {
  insights: WellnessInsights; onRefresh: () => void; loading: boolean; intakeSummary?: IntakeSummaryContext | null;
}) {
  const { colors: C } = useTheme();
  const { isDark: reportIsDark } = useTheme();
  const rpStyles = useMemo(() => makeRpStyles(C, reportIsDark), [C, reportIsDark]);
  const hasScoreDrivers = !!(insights as any).scoreDriversInsight;
  const hasTimePattern = !!(insights as any).timePatternInsight;
  const hasSchumann = !!(insights as any).schumannInsight;
  const scoreColor = getScoreColor(insights.overallScore);
  const trendIcon = insights.overallTrend === 'improving' ? 'trending-up' : insights.overallTrend === 'declining' ? 'trending-down' : 'trending-flat';
  const trendColor = insights.overallTrend === 'improving' ? Colors.success : insights.overallTrend === 'declining' ? Colors.error : Colors.textSecondary;
  const behaviorRecs = (insights as any).behaviorRecommendations as BehaviorRecommendation[] | undefined;
  return (
    <View style={rpStyles.container}>
      {/* Quick Summary Card */}
      {insights.quickSummary ? (
        <QuickSummaryCard summary={insights.quickSummary} />
      ) : null}

      <View style={rpStyles.scoreCard}>
        <View style={[rpStyles.scoreCircle, { borderColor: scoreColor }]}>
          <Text style={[rpStyles.scoreNum, { color: scoreColor }]}>{insights.overallScore}</Text>
          <Text style={rpStyles.scoreOf}>/100</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={rpStyles.trendRow}>
            <MaterialIcons name={trendIcon as any} size={15} color={trendColor} />
            <Text style={[rpStyles.trendText, { color: trendColor }]}>{insights.overallTrend}</Text>
          </View>
          <Text style={rpStyles.headline}>{insights.headline}</Text>
        </View>
      </View>
      {intakeSummary?.presenting_concern ? (
        <View style={rpStyles.intakeChip}>
          <MaterialIcons name="favorite" size={12} color={Colors.primary} />
          <Text style={rpStyles.intakeChipText} numberOfLines={2}>Personalised for: {intakeSummary.presenting_concern}</Text>
        </View>
      ) : null}
      <View style={rpStyles.celebCard}>
        <MaterialIcons name="celebration" size={16} color={Colors.primary} />
        <Text style={rpStyles.celebText}>{insights.celebrationNote}</Text>
      </View>

      {/* Behaviour Recommendations — priority-ordered, science-backed */}
      {behaviorRecs && behaviorRecs.length > 0 ? (
        <BehaviorRecommendations recs={behaviorRecs} />
      ) : null}

      <Section icon="mood" title="Mood patterns" text={insights.moodInsight} color={Colors.primary} />
      {(insights as any).journalInsight ? (
        <View style={rpStyles.journalCard}>
          <View style={rpStyles.secHead}>
            <MaterialIcons name="menu-book" size={15} color="#A78BFA" />
            <Text style={[rpStyles.secTitle, { color: '#A78BFA' }]}>Your journal reveals</Text>
          </View>
          <Text style={[rpStyles.secText, { fontStyle: 'italic', color: C.textPrimary }]}>{(insights as any).journalInsight}</Text>
        </View>
      ) : null}
      {hasScoreDrivers ? <Section icon="bar-chart" title="What moves your score" text={(insights as any).scoreDriversInsight} color={Colors.success} /> : null}
      {hasTimePattern ? <Section icon="schedule" title="Time of day patterns" text={(insights as any).timePatternInsight} color="#4ECDC4" /> : null}
      <Section icon="fitness-center" title="Body × mind" text={insights.fitnessInsight} color={Colors.success} />
      {insights.sleepInsight ? <Section icon="bedtime" title="Sleep & recovery" text={insights.sleepInsight} color="#7C83FF" /> : null}
      {insights.weatherInsight ? <Section icon="wb-sunny" title="Weather & mood" text={insights.weatherInsight} color="#FFD166" /> : null}
      {hasSchumann ? <Section icon="wifi" title="Earth resonance" text={(insights as any).schumannInsight} color="#95E06C" /> : null}
      {insights.astrologyInsight ? <Section icon="auto-awesome" title="Cosmic alignment" text={insights.astrologyInsight} color="#A78BFA" /> : null}
      {(insights as any).cycleInsight ? <Section icon="water-drop" title="Cycle phase insight" text={(insights as any).cycleInsight} color="#FF6B6B" /> : null}
      {insights.correlations?.length > 0 ? (
        <View style={rpStyles.section}>
          <View style={rpStyles.secHead}><MaterialIcons name="link" size={15} color={Colors.textSecondary} /><Text style={rpStyles.secTitle}>Key correlations</Text></View>
          {insights.correlations.map((c: CorrelationFinding, i: number) => {
            const ic = c.impact === 'positive' ? 'arrow-upward' : c.impact === 'negative' ? 'arrow-downward' : 'remove';
            const col = c.impact === 'positive' ? Colors.success : c.impact === 'negative' ? Colors.error : Colors.textSecondary;
            return (
              <View key={i} style={rpStyles.corrRow}>
                <MaterialIcons name={ic as any} size={13} color={col} />
                <View style={{ flex: 1 }}>
                  <Text style={rpStyles.corrText}>{c.finding}</Text>
                  <Text style={[rpStyles.corrMeta, { color: col }]}>{c.confidence} confidence</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      {insights.actionableAdvice?.length > 0 ? (
        <View style={rpStyles.section}>
          <View style={rpStyles.secHead}><MaterialIcons name="lightbulb" size={15} color={Colors.primary} /><Text style={rpStyles.secTitle}>Action steps</Text></View>
          {insights.actionableAdvice.map((a: string, i: number) => (
            <View key={i} style={rpStyles.advRow}>
              <View style={rpStyles.advNum}><Text style={rpStyles.advNumText}>{i + 1}</Text></View>
              <Text style={rpStyles.advText}>{a}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {insights.watchOut ? (
        <View style={rpStyles.watchCard}>
          <MaterialIcons name="warning-amber" size={15} color={Colors.warning} />
          <Text style={rpStyles.watchText}>{insights.watchOut}</Text>
        </View>
      ) : null}
      <View style={rpStyles.refreshRow}>
        <Text style={rpStyles.timestamp}>Generated {new Date(insights.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        <Pressable onPress={onRefresh} disabled={loading} style={({ pressed }) => [rpStyles.refreshBtn, pressed && { opacity: 0.7 }]}>
          {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : <><MaterialIcons name="refresh" size={13} color={Colors.primary} /><Text style={rpStyles.refreshText}>Refresh</Text></>}
        </Pressable>
      </View>
    </View>
  );
}

function Section({ icon, title, text, color }: { icon: string; title: string; text: string; color: string }) {
  const { colors: C } = useTheme();
  const { isDark: reportIsDark } = useTheme();
  const rpStyles = useMemo(() => makeRpStyles(C, reportIsDark), [C, reportIsDark]);
  return (
    <View style={rpStyles.section}>
      <View style={rpStyles.secHead}>
        <MaterialIcons name={icon as any} size={15} color={color} />
        <Text style={rpStyles.secTitle}>{title}</Text>
      </View>
      <Text style={rpStyles.secText}>{text}</Text>
    </View>
  );
}

function makeRpStyles(C: typeof DarkColors, isDark = true) {
  const G = getGlass(isDark);
  return StyleSheet.create({
    container: { gap: Spacing.md },
    scoreCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder },
    scoreCircle: { width: 68, height: 68, borderRadius: 34, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
    scoreNum: { fontSize: 24, fontWeight: '900', includeFontPadding: false },
    scoreOf: { fontSize: 13, color: C.textMuted, includeFontPadding: false },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    trendText: { fontSize: Typography.fontSizes.xs, fontWeight: '600', textTransform: 'capitalize', includeFontPadding: false },
    headline: { fontSize: Typography.fontSizes.sm, color: C.textPrimary, lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
    celebCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.primarySoft, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '30' },
    celebText: { flex: 1, fontSize: Typography.fontSizes.sm, color: C.primary, lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
    section: { backgroundColor: G.cardBg, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.sm },
    secHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    secTitle: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, flex: 1, includeFontPadding: false },
    secText: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: Typography.fontSizes.sm * 1.65, includeFontPadding: false },
    corrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.background, borderRadius: Radius.md, padding: Spacing.sm },
    corrText: { fontSize: 16, color: C.textPrimary, includeFontPadding: false },
    corrMeta: { fontSize: 14, textTransform: 'capitalize', includeFontPadding: false },
    advRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    advNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    advNumText: { fontSize: 13, fontWeight: '700', color: C.primary, includeFontPadding: false },
    advText: { flex: 1, fontSize: 16, color: C.textSecondary, lineHeight: 25, includeFontPadding: false },
    journalCard: { borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1.5, borderColor: '#A78BFA40', backgroundColor: '#A78BFA10', gap: Spacing.sm },
    watchCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.warning + '15', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.warning + '30' },
    watchText: { flex: 1, fontSize: 16, color: C.warning, lineHeight: 25, includeFontPadding: false },
    refreshRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    timestamp: { fontSize: 14, color: C.textMuted, includeFontPadding: false },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 5, backgroundColor: C.primarySoft, borderRadius: Radius.full },
    refreshText: { fontSize: 13, color: C.primary, fontWeight: '600', includeFontPadding: false },
    intakeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primarySoft, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: C.primary + '40' },
    intakeChipText: { fontSize: 14, color: C.primary, fontWeight: '600', includeFontPadding: false, flex: 1 },
  });
}

function makeInsightsStyles(C: typeof DarkColors, isDark = true) {
  const G = getGlass(isDark);
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl },
    pageTitle: { fontSize: Typography.fontSizes['2xl'], fontWeight: Typography.fontWeights.bold, color: C.textPrimary, includeFontPadding: false },
    aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primarySoft, paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.full },
    aiBadgeText: { fontSize: 13, fontWeight: '600', color: C.primary, includeFontPadding: false },
    periodRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
    periodTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: G.cardBgLight, borderWidth: 1, borderColor: G.cardBorderLight },
    periodTabActive: { backgroundColor: C.primarySoft, borderColor: C.primary },
    periodTabText: { fontSize: Typography.fontSizes.sm, color: C.textMuted, fontWeight: '500', includeFontPadding: false },
    periodTabTextActive: { color: C.primary, fontWeight: '700' },
    avgScoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, marginBottom: Spacing.xl, ...Shadows.sm },
    avgScoreCircle: { width: 80, height: 80, borderRadius: Radius.xl, borderWidth: 3, alignItems: 'center', justifyContent: 'center', gap: 1, flexShrink: 0 },
    avgScoreEmoji: { fontSize: 28 },
    avgScoreNum: { fontSize: 28, fontWeight: '900', includeFontPadding: false },
    avgScoreLabel: { fontSize: 13, color: C.textMuted, includeFontPadding: false },
    avgScoreRight: { flex: 1, gap: Spacing.xs },
    avgScorePeriodLabel: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    avgScoreStatus: { fontSize: Typography.fontSizes.lg, fontWeight: '800', includeFontPadding: false },
    avgScoreMeta: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    dimRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginTop: 2 },
    viewToggle: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
    viewTab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: Radius.lg, backgroundColor: G.cardBgLight, borderWidth: 1, borderColor: G.cardBorderLight },
    viewTabActive: { backgroundColor: C.primarySoft, borderColor: C.primary },
    viewTabText: { fontSize: 14, color: C.textMuted, fontWeight: '500', includeFontPadding: false },
    viewTabTextActive: { color: C.primary, fontWeight: '700' },
    section: { marginBottom: Spacing.xl, gap: Spacing.md },
    sectionTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
    sectionSub: { fontSize: 14, color: C.textSecondary, marginTop: -8, includeFontPadding: false },
    corrCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder },
    topTagsCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md },
    topTagRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    topTagEmoji: { fontSize: 20, width: 24 },
    topTagLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    topTagLabel: { fontSize: Typography.fontSizes.sm, color: C.textPrimary, fontWeight: '500', includeFontPadding: false },
    topTagCount: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    topTagBar: { height: 5, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' },
    topTagFill: { height: '100%', borderRadius: Radius.full },
    timeCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: G.cardBorder },
    timeDetailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: C.border },
    timeDetailEmoji: { fontSize: 22, width: 26 },
    timeDetailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    timeDetailLabel: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: C.textPrimary, includeFontPadding: false },
    timeDetailScore: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    timeDetailNoData: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    timeDetailBar: { height: 6, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' },
    timeDetailFill: { height: '100%', borderRadius: Radius.full },
    insightBox: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.primarySoft, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '30' },
    insightBoxText: { flex: 1, fontSize: 15, color: C.primary, lineHeight: 23, includeFontPadding: false },
    distCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md },
    distRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    distDot: { width: 8, height: 8, borderRadius: 4 },
    distLabel: { fontSize: 13, color: C.textPrimary, width: 118, includeFontPadding: false },
    distBarWrap: { flex: 1, height: 8, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' },
    distBarFill: { height: '100%', borderRadius: Radius.full },
    distPct: { fontSize: 13, fontWeight: '700', width: 34, textAlign: 'right', includeFontPadding: false },
    nudgeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: G.cardBgLight, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorderLight },
    nudgeText: { flex: 1, fontSize: Typography.fontSizes.sm, color: C.textSecondary, includeFontPadding: false },
    weatherContextBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: G.cardBgLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: G.cardBorderLight, marginBottom: Spacing.md },
    weatherContextEmoji: { fontSize: 22 },
    weatherContextTitle: { fontSize: 15, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    weatherContextSub: { fontSize: 13, color: C.textMuted, includeFontPadding: false },
    generateCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: G.cardBorder },
    generateIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.primary + '40' },
    generateTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '700', color: C.textPrimary, textAlign: 'center', includeFontPadding: false },
    generateSub: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false },
    generateBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.primary, borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: 13 },
    generateBtnText: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: '#08091A', includeFontPadding: false },
    loadingBox: { alignItems: 'center', gap: Spacing.md },
    loadingText: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, includeFontPadding: false },
    errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.errorSoft, borderRadius: Radius.md, padding: Spacing.md, alignSelf: 'stretch' },
    errorText: { flex: 1, fontSize: Typography.fontSizes.xs, color: C.error, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
    fitnessGrid: { flexDirection: 'row', gap: Spacing.sm },
    chartSection: { marginBottom: Spacing.xl, gap: Spacing.sm },
    chartHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    chartTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
    chartAvgBadge: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.surfaceElevated, borderRadius: Radius.full, borderWidth: 1, borderColor: C.border },
    chartAvgText: { fontSize: 13, fontWeight: '700', includeFontPadding: false },
    chartCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.sm, position: 'relative' },
    chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 80, paddingTop: 16 },
    chartBarsDense: { height: 64, gap: 2, paddingTop: 12 },
    chartBarCol: { flex: 1, alignItems: 'center', gap: 3 },
    chartBarColDense: { gap: 2 },
    chartBarScore: { fontSize: 11, color: C.textMuted, fontWeight: '600', includeFontPadding: false },
    chartBar: { width: '100%', borderRadius: 3, minHeight: 3 },
    chartBarDay: { fontSize: 11, color: C.textMuted, includeFontPadding: false },
    chartBarDaySmall: { fontSize: 9 },
    chartGuide: { position: 'absolute', right: Spacing.sm, top: Spacing.md, bottom: Spacing.lg, justifyContent: 'space-between', alignItems: 'flex-end', pointerEvents: 'none' },
    chartGuideLine: {},
    chartGuideLabel: { fontSize: 10, color: C.border, includeFontPadding: false },
    cycleCorrelationCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: G.cardBorder },
    cycleCorrelationRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
    cycleCorrelationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cyclePhaseName: { fontSize: Typography.fontSizes.sm, fontWeight: '700', includeFontPadding: false },
    cycleEntryCount: { fontSize: 13, color: C.textSecondary, includeFontPadding: false },
    cycleBarTrack: { height: 7, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' },
    cycleBarFill: { height: '100%', borderRadius: Radius.full },
    cycleDimRow: { flexDirection: 'row', gap: Spacing.md },
    cycleDimText: { fontSize: 13, color: C.textSecondary, includeFontPadding: false },
    cycleScoreBadge: { width: 40, height: 40, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
    cycleScoreText: { fontSize: Typography.fontSizes.md, fontWeight: '900', includeFontPadding: false },
    cycleCurrentPhaseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, padding: Spacing.md, borderTopWidth: 1, borderTopColor: C.border },
    cycleCurrentPhaseText: { flex: 1, fontSize: 13, color: C.textMuted, lineHeight: 20, includeFontPadding: false },
  });
}
