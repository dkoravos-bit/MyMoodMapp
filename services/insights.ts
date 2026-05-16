import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoodEntry } from './storage';

import { DailyFitnessEntry, summarizeFitnessData, getDateRangeFitness } from './fitness';

export type InsightPeriod = 'daily' | 'weekly' | 'monthly';

export interface CorrelationFinding {
  finding: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
}

export type BehaviorCategory = 'sleep' | 'exercise' | 'social' | 'mindfulness' | 'schedule' | 'nutrition' | 'recovery' | 'cognitive';

export interface BehaviorRecommendation {
  priority: number;
  title: string;
  summary: string;
  detail: string;
  why: string;
  predictedOutcome: string;
  notObviousInsight: string;
  category: BehaviorCategory;
  effort: 'low' | 'medium' | 'high';
  timeframe: 'immediate' | 'this-week' | 'this-month';
}

export interface WellnessInsights {
  period: InsightPeriod;
  generatedAt: number;
  headline: string;
  overallScore: number;
  overallTrend: 'improving' | 'stable' | 'declining';
  moodInsight: string;
  emotionInsight: string;
  fitnessInsight: string;
  sleepInsight: string;
  scoreDriversInsight?: string;
  timePatternInsight?: string;
  journalInsight?: string;
  astrologyInsight?: string;
  weatherInsight?: string;
  schumannInsight?: string;
  cycleInsight?: string;
  correlations: CorrelationFinding[];
  topPatterns: string[];
  actionableAdvice: string[];
  celebrationNote: string;
  watchOut: string;
  quickSummary?: string;
  behaviorRecommendations?: BehaviorRecommendation[];
}

const INSIGHTS_KEY = (period: InsightPeriod) => `mymoodmapp_insights_${period}`;

// ── Cloud report persistence ─────────────────────────────────────────────────

export interface SavedReport {
  id: string;
  report_type: InsightPeriod;
  period_start: string;
  period_end: string;
  report_data: WellnessInsights;
  ai_summary: string;
  generated_at: string;
}

/** Save a generated report to the wellness_reports table */
export async function saveReportToCloud(insights: WellnessInsights): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const days = insights.period === 'daily' ? 1 : insights.period === 'weekly' ? 7 : 30;
    const now = new Date();
    const periodEnd = now.toISOString().split('T')[0];
    const periodStart = new Date(now.getTime() - (days - 1) * 86400000).toISOString().split('T')[0];

    await supabase.from('wellness_reports').insert({
      user_id: user.id,
      report_type: insights.period,
      period_start: periodStart,
      period_end: periodEnd,
      report_data: insights as any,
      ai_summary: insights.headline,
    });
  } catch {}
}

/** Load saved reports from the wellness_reports table, newest first */
export async function loadReportsFromCloud(limit = 20): Promise<SavedReport[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('wellness_reports')
      .select('id, report_type, period_start, period_end, report_data, ai_summary, generated_at')
      .order('generated_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as SavedReport[];
  } catch {
    return [];
  }
}

export async function getCachedInsights(period: InsightPeriod): Promise<WellnessInsights | null> {
  const raw = await AsyncStorage.getItem(INSIGHTS_KEY(period));
  if (!raw) return null;
  const cached: WellnessInsights = JSON.parse(raw);
  // Invalidate after 6 hours
  const staleCutoff = Date.now() - 6 * 60 * 60 * 1000;
  return cached.generatedAt > staleCutoff ? cached : null;
}

export async function saveInsights(insights: WellnessInsights): Promise<void> {
  await AsyncStorage.setItem(INSIGHTS_KEY(insights.period), JSON.stringify(insights));
}

export interface IntakeSummaryContext {
  presenting_concern?: string;
  phq9_total?: number;
  phq9_severity?: string;
  gad7_total?: number;
  gad7_severity?: string;
  duration?: string;
  support_level?: string;
  life_areas_affected?: string[];
  whats_working?: string;
  tried_helps?: string;
  self_knowledge?: string;
  goal_feel?: string;
  goal_better?: string;
  pref_style?: string;
  pref_pace?: string;
  pref_therapist?: string;
  hard_first?: string;
  trauma_flag?: boolean;
  safety_flag?: boolean;
}

export interface TagCorrelationContext {
  tagId: string;
  tagLabel: string;
  sampleSize: number;
  avgScore: number;
  deltaVsBaseline: number;
  avgBody: number;
  avgMind: number;
}

export interface TimePatternContext {
  timeOfDay: string;
  avgScore: number;
  sampleSize: number;
}

export async function generateInsights(
  period: InsightPeriod,
  moodLog: MoodEntry[],
  emotionLog: any[],  // retained for API compatibility, currently unused
  fitnessData: DailyFitnessEntry[],
  intakeSummary: IntakeSummaryContext | null,
  tagCorrelations?: TagCorrelationContext[] | null,
  timePatterns?: TimePatternContext[] | null,
  astrologyContext?: {
    sunSign: string; element: string; rulingPlanet: string;
    physicalAreas: string[]; moonPhase: string; moonEnergyLevel: string;
    retrogrades: string[]; energyScore: number; overallEnergy: string;
    dailyForecast: string;
  } | null,
  schumannContext?: {
    frequency: number; status: string; kIndex: number;
    trend: string; physicalEffects: string[];
  } | null,
  weatherContext?: {
    condition: string; temperature: number; humidity: number;
    uvIndex: number; moodImpact: string; moodImpactReason: string;
    pressureHPA: number;
  } | null,
  cycleContext?: {
    currentPhase: string;
    dayOfCycle: number | null;
    daysUntilNextPeriod: number | null;
    avgCycleLength: number;
    phaseMoodCorrelations: { phase: string; avgScore: number; entryCount: number; avgBody: number | null; avgMind: number | null }[];
  } | null,
): Promise<WellnessInsights | null> {
  const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;

  const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  // Include journalText and transcript in filtered mood entries so the edge
  // function can analyze the user's own written/spoken words for richer insights.
  const filteredMood = moodLog.filter(e => e.date >= cutoff).map(e => ({
    id: e.id,
    date: e.date,
    timestamp: e.timestamp,
    timeOfDay: (e as any).timeOfDay,
    score: (e as any).score,
    dimensions: (e as any).dimensions,
    primaryTag: (e as any).primaryTag,
    additionalTags: (e as any).additionalTags,
    note: e.note,
    journalText: (e as any).journalText,
    transcript: (e as any).transcript,
  }));
  const filteredEmotion = emotionLog.filter(e => e.date >= cutoff);
  const filteredFitness = getDateRangeFitness(fitnessData, days);
  const fitnessSummary = summarizeFitnessData(filteredFitness);

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.functions.invoke('generate-insights', {
      body: {
        period,
        moodLog: filteredMood,
        emotionLog: filteredEmotion,
        fitnessData: fitnessSummary,
        dailyFitnessRaw: filteredFitness,
        intakeSummary: intakeSummary ?? null,
        tagCorrelations: tagCorrelations ?? null,
        timePatterns: timePatterns ?? null,
        astrologyContext: astrologyContext ?? null,
        schumannContext: schumannContext ?? null,
        weatherContext: weatherContext ?? null,
        cycleContext: cycleContext ?? null,
      },
    });

    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          const text = await error.context?.text();
          msg = `[${error.context?.status}] ${text || error.message}`;
        } catch {}
      }
      console.warn('Insights generation error:', msg);
      return null;
    }

    if (!data?.insights) return null;

    const result: WellnessInsights = {
      period,
      generatedAt: Date.now(),
      ...data.insights,
    };

    await saveInsights(result);
    // Persist to cloud (fire-and-forget, no await to avoid blocking UI)
    saveReportToCloud(result).catch(() => {});
    return result;
  } catch (e) {
    console.warn('generateInsights error:', e);
    return null;
  }
}
