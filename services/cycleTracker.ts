/**
 * Menstrual Cycle Tracker Service
 * Handles CRUD for cycles, phase calculation, and symptom tracking.
 */

import { getSupabaseClient } from '@/template';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FlowIntensity = 'light' | 'medium' | 'heavy' | 'spotting';

export type CyclePhase =
  | 'menstrual'
  | 'follicular'
  | 'ovulation'
  | 'luteal'
  | 'unknown';

export const CYCLE_SYMPTOMS = [
  { id: 'cramps', label: 'Cramps', emoji: '🌀' },
  { id: 'bloating', label: 'Bloating', emoji: '🫧' },
  { id: 'headache', label: 'Headache', emoji: '🤕' },
  { id: 'fatigue', label: 'Fatigue', emoji: '😴' },
  { id: 'mood_swings', label: 'Mood swings', emoji: '🎢' },
  { id: 'breast_tenderness', label: 'Tenderness', emoji: '💗' },
  { id: 'acne', label: 'Acne', emoji: '🔴' },
  { id: 'back_pain', label: 'Back pain', emoji: '🔙' },
  { id: 'nausea', label: 'Nausea', emoji: '🤢' },
  { id: 'cravings', label: 'Cravings', emoji: '🍫' },
];

export const FLOW_LABELS: Record<FlowIntensity, string> = {
  spotting: 'Spotting',
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
};

export const PHASE_INFO: Record<CyclePhase, { label: string; emoji: string; color: string; description: string; energyNote: string }> = {
  menstrual: {
    label: 'Menstrual',
    emoji: '🌑',
    color: '#FF6B6B',
    description: 'Your period is here. Rest and restore.',
    energyNote: 'Energy tends to be lower — be gentle with yourself.',
  },
  follicular: {
    label: 'Follicular',
    emoji: '🌒',
    color: '#FFD166',
    description: 'Energy rising as your body prepares.',
    energyNote: 'Great time for new projects and social energy.',
  },
  ovulation: {
    label: 'Ovulation',
    emoji: '🌕',
    color: '#95E06C',
    description: 'Peak energy and confidence.',
    energyNote: 'You may feel your most social, focused, and energised.',
  },
  luteal: {
    label: 'Luteal',
    emoji: '🌖',
    color: '#7C83FF',
    description: 'Winding down toward your next cycle.',
    energyNote: 'Energy may dip — good time for reflection and self-care.',
  },
  unknown: {
    label: 'Unknown',
    emoji: '❓',
    color: '#888',
    description: 'Log your period to track your cycle.',
    energyNote: 'Start logging to unlock phase insights.',
  },
};

export interface CycleEntry {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string | null;
  cycle_length: number | null;
  flow_intensity: FlowIntensity;
  symptoms: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const CACHE_KEY = 'cycle_entries_cache';

// ── Local cache helpers ────────────────────────────────────────────────────────

async function loadCached(): Promise<CycleEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveCache(entries: CycleEntry[]) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entries));
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function fetchCycleEntries(): Promise<CycleEntry[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('menstrual_cycles')
      .select('*')
      .order('period_start', { ascending: false });
    if (error) throw error;
    const entries = (data ?? []) as CycleEntry[];
    await saveCache(entries);
    return entries;
  } catch {
    return loadCached();
  }
}

export async function logPeriodStart(date: string, flowIntensity: FlowIntensity = 'medium', symptoms: string[] = []): Promise<CycleEntry | null> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('menstrual_cycles')
      .insert({ user_id: user.id, period_start: date, flow_intensity: flowIntensity, symptoms })
      .select()
      .single();

    if (error) throw error;
    return data as CycleEntry;
  } catch (e) {
    console.warn('logPeriodStart error:', e);
    return null;
  }
}

export async function updateCycleEntry(id: string, updates: Partial<Pick<CycleEntry, 'period_end' | 'flow_intensity' | 'symptoms' | 'notes' | 'cycle_length'>>): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('menstrual_cycles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

export async function deleteCycleEntry(id: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('menstrual_cycles').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

// ── Phase Calculation ─────────────────────────────────────────────────────────

/**
 * Calculates the current cycle phase based on the most recent period start date.
 * Uses an assumed 28-day cycle with typical phase windows.
 */
export function getCurrentCyclePhase(entries: CycleEntry[]): {
  phase: CyclePhase;
  dayOfCycle: number | null;
  daysUntilNextPeriod: number | null;
  nextPeriodDate: string | null;
  avgCycleLength: number;
} {
  if (entries.length === 0) {
    return { phase: 'unknown', dayOfCycle: null, daysUntilNextPeriod: null, nextPeriodDate: null, avgCycleLength: 28 };
  }

  // Calculate average cycle length from historical data
  const cyclesWithLength = entries.filter(e => e.cycle_length != null && e.cycle_length > 0);
  const avgCycleLength = cyclesWithLength.length >= 2
    ? Math.round(cyclesWithLength.reduce((s, e) => s + (e.cycle_length ?? 28), 0) / cyclesWithLength.length)
    : 28;

  // Calculate from entries gap if no explicit cycle_length
  let effectiveAvgLength = avgCycleLength;
  if (entries.length >= 2) {
    const gaps: number[] = [];
    for (let i = 0; i < Math.min(entries.length - 1, 6); i++) {
      const start1 = new Date(entries[i].period_start).getTime();
      const start2 = new Date(entries[i + 1].period_start).getTime();
      const gap = Math.round((start1 - start2) / 86400000);
      if (gap > 15 && gap < 50) gaps.push(gap);
    }
    if (gaps.length > 0) {
      effectiveAvgLength = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
    }
  }

  const mostRecent = entries[0];
  const periodStart = new Date(mostRecent.period_start);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  periodStart.setHours(0, 0, 0, 0);

  const dayOfCycle = Math.floor((today.getTime() - periodStart.getTime()) / 86400000) + 1;

  // If we're way past expected next period, phase is unknown
  if (dayOfCycle > effectiveAvgLength + 10) {
    return { phase: 'unknown', dayOfCycle, daysUntilNextPeriod: null, nextPeriodDate: null, avgCycleLength: effectiveAvgLength };
  }

  // Typical phase windows based on avg cycle length
  const menstrualEnd = 5;
  const follicularEnd = Math.round(effectiveAvgLength * 0.46); // ~13 in 28-day
  const ovulationEnd = Math.round(effectiveAvgLength * 0.57); // ~16 in 28-day

  let phase: CyclePhase;
  if (dayOfCycle >= 1 && dayOfCycle <= menstrualEnd) {
    phase = 'menstrual';
  } else if (dayOfCycle <= follicularEnd) {
    phase = 'follicular';
  } else if (dayOfCycle <= ovulationEnd) {
    phase = 'ovulation';
  } else if (dayOfCycle <= effectiveAvgLength) {
    phase = 'luteal';
  } else {
    phase = 'menstrual'; // Period is late/just starting
  }

  const nextPeriodMs = periodStart.getTime() + effectiveAvgLength * 86400000;
  const daysUntilNextPeriod = Math.round((nextPeriodMs - today.getTime()) / 86400000);
  const nextPeriodDate = new Date(nextPeriodMs).toISOString().split('T')[0];

  return { phase, dayOfCycle, daysUntilNextPeriod, nextPeriodDate, avgCycleLength: effectiveAvgLength };
}

/**
 * Correlates cycle phases with mood log entries to reveal phase-mood patterns.
 */
export interface CycleMoodCorrelation {
  phase: CyclePhase;
  avgScore: number;
  entryCount: number;
  avgBody: number | null;
  avgMind: number | null;
}

export function computeCycleMoodCorrelation(
  cycleEntries: CycleEntry[],
  moodEntries: { date: string; score: number; dimensions: { body: number; mind: number; energy: number } }[],
): CycleMoodCorrelation[] {
  if (cycleEntries.length === 0 || moodEntries.length === 0) return [];

  const calendarMap = buildCycleCalendar(cycleEntries);
  const phaseData: Record<CyclePhase, { scores: number[]; body: number[]; mind: number[] }> = {
    menstrual: { scores: [], body: [], mind: [] },
    follicular: { scores: [], body: [], mind: [] },
    ovulation: { scores: [], body: [], mind: [] },
    luteal: { scores: [], body: [], mind: [] },
    unknown: { scores: [], body: [], mind: [] },
  };

  for (const entry of moodEntries) {
    const phase = calendarMap.get(entry.date);
    if (!phase) continue;
    phaseData[phase].scores.push(entry.score);
    if (entry.dimensions?.body != null) phaseData[phase].body.push(entry.dimensions.body);
    if (entry.dimensions?.mind != null) phaseData[phase].mind.push(entry.dimensions.mind);
  }

  const results: CycleMoodCorrelation[] = [];
  const phases: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];
  for (const phase of phases) {
    const d = phaseData[phase];
    if (d.scores.length === 0) continue;
    results.push({
      phase,
      avgScore: Math.round(d.scores.reduce((s, v) => s + v, 0) / d.scores.length),
      entryCount: d.scores.length,
      avgBody: d.body.length > 0 ? parseFloat((d.body.reduce((s, v) => s + v, 0) / d.body.length).toFixed(2)) : null,
      avgMind: d.mind.length > 0 ? parseFloat((d.mind.reduce((s, v) => s + v, 0) / d.mind.length).toFixed(2)) : null,
    });
  }

  return results.sort((a, b) => b.avgScore - a.avgScore);
}

/**
 * Returns a 3-month calendar of dates with their cycle status.
 */
export function buildCycleCalendar(entries: CycleEntry[], monthsBack = 3): Map<string, CyclePhase> {
  const map = new Map<string, CyclePhase>();
  if (entries.length === 0) return map;

  const avgCycleLength = 28;
  const today = new Date();

  for (const entry of entries) {
    const start = new Date(entry.period_start);
    const end = entry.period_end ? new Date(entry.period_end) : new Date(start.getTime() + 5 * 86400000);

    // Mark period days (menstrual)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      map.set(d.toISOString().split('T')[0], 'menstrual');
    }

    // Mark subsequent phases based on avg cycle
    const follicularStart = new Date(end.getTime() + 86400000);
    const follicularEnd = new Date(start.getTime() + 13 * 86400000);
    for (let d = new Date(follicularStart); d <= follicularEnd; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, 'follicular');
    }

    const ovulationStart = new Date(start.getTime() + 14 * 86400000);
    const ovulationEnd = new Date(start.getTime() + 16 * 86400000);
    for (let d = new Date(ovulationStart); d <= ovulationEnd; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, 'ovulation');
    }

    const lutealStart = new Date(start.getTime() + 17 * 86400000);
    const lutealEnd = new Date(start.getTime() + (avgCycleLength - 1) * 86400000);
    for (let d = new Date(lutealStart); d <= lutealEnd; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, 'luteal');
    }
  }

  return map;
}
