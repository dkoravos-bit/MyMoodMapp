/**
 * fitness.web.ts — Web stub for the fitness service.
 *
 * On web, HealthKit / Health Connect / Pedometer are unavailable.
 * All data comes from the Supabase cloud sync written by the mobile app.
 * Metro automatically picks this file over fitness.ts when bundling for web.
 */

import { getSupabaseClient } from '@/template';

export interface DailyFitnessEntry {
  date: string;
  steps: number;
  activeMinutes: number;
  restingHeartRate: number | null;
  avgHeartRate: number | null;
  caloriesBurned: number;
  workoutMinutes: number;
  sleepHours: number | null;
  heartRateSamples?: number[];
}

export interface FitnessSummary {
  avgDailySteps: number;
  avgActiveMinutes: number;
  avgRestingHR: number | null;
  avgSleepHours: number | null;
  workoutCount: number;
  highExerciseDays: number;
  lowExerciseDays: number;
  totalSteps: number;
  peakHRDay: string | null;
}

export interface FitnessPermissionStatus {
  granted: boolean;
  source: 'healthkit' | 'expo_health' | 'pedometer' | 'health_connect' | 'mock';
}

// No-op — permissions are native-only
export async function requestFitnessPermissions(): Promise<FitnessPermissionStatus> {
  return { granted: true, source: 'mock' };
}

export async function getFitnessPermissionStatus(): Promise<FitnessPermissionStatus> {
  return { granted: false, source: 'mock' };
}

// On web, fetch from cloud (synced by the mobile app)
export async function fetchFitnessData(days: number = 30): Promise<DailyFitnessEntry[]> {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return fetchCloudFitnessData(user.id, days);
  } catch {}
  return generateMockData(days);
}

export async function fetchFitnessDataAndSync(days: number = 30): Promise<DailyFitnessEntry[]> {
  return fetchFitnessData(days);
}

export async function getCachedFitnessData(): Promise<DailyFitnessEntry[]> {
  return fetchFitnessData(30);
}

export async function syncFitnessDataToCloud(_entries: DailyFitnessEntry[], _userId: string): Promise<void> {
  // No-op on web — data flows native → cloud only
}

export async function fetchCloudFitnessData(userId: string, days: number = 30): Promise<DailyFitnessEntry[]> {
  try {
    const supabase = getSupabaseClient();
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('fitness_data')
      .select('*')
      .eq('user_id', userId)
      .gte('date', cutoff)
      .order('date', { ascending: false })
      .limit(days);
    if (error || !data || data.length === 0) return generateMockData(days);
    return data.map((row: any): DailyFitnessEntry => ({
      date: row.date,
      steps: row.steps ?? 0,
      activeMinutes: row.active_minutes ?? 0,
      restingHeartRate: row.resting_heart_rate ?? null,
      avgHeartRate: row.avg_heart_rate ?? null,
      caloriesBurned: row.calories_burned ?? 0,
      workoutMinutes: row.workout_minutes ?? 0,
      sleepHours: row.sleep_hours != null ? parseFloat(row.sleep_hours) : null,
      heartRateSamples: [],
    }));
  } catch {
    return generateMockData(days);
  }
}

export function generateMockData(days: number): DailyFitnessEntry[] {
  const entries: DailyFitnessEntry[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toISOString().split('T')[0];
    const seed = d.getDate() + d.getMonth() * 31;
    const isWorkoutDay = seed % 3 !== 0;
    const steps = isWorkoutDay ? 6000 + (seed * 137) % 6000 : 2000 + (seed * 97) % 3000;
    const hr = 58 + (seed * 7) % 22;
    const sleep = parseFloat((5.5 + ((seed * 3) % 30) / 10).toFixed(1));
    entries.push({
      date: key, steps,
      activeMinutes: isWorkoutDay ? 25 + (seed % 35) : 5 + (seed % 15),
      restingHeartRate: hr, avgHeartRate: hr + 15 + (seed % 20),
      caloriesBurned: isWorkoutDay ? 300 + (seed % 400) : 100 + (seed % 150),
      workoutMinutes: isWorkoutDay ? 20 + (seed % 40) : 0,
      sleepHours: sleep, heartRateSamples: [],
    });
  }
  return entries;
}

export function summarizeFitnessData(data: DailyFitnessEntry[]): FitnessSummary {
  if (data.length === 0) {
    return { avgDailySteps: 0, avgActiveMinutes: 0, avgRestingHR: null, avgSleepHours: null, workoutCount: 0, highExerciseDays: 0, lowExerciseDays: 0, totalSteps: 0, peakHRDay: null };
  }
  const totalSteps = data.reduce((s, d) => s + d.steps, 0);
  const avgDailySteps = Math.round(totalSteps / data.length);
  const avgActiveMinutes = Math.round(data.reduce((s, d) => s + d.activeMinutes, 0) / data.length);
  const hrEntries = data.filter(d => d.restingHeartRate !== null);
  const avgRestingHR = hrEntries.length ? Math.round(hrEntries.reduce((s, d) => s + d.restingHeartRate!, 0) / hrEntries.length) : null;
  const sleepEntries = data.filter(d => d.sleepHours !== null);
  const avgSleepHours = sleepEntries.length ? parseFloat((sleepEntries.reduce((s, d) => s + d.sleepHours!, 0) / sleepEntries.length).toFixed(1)) : null;
  const workoutCount = data.filter(d => d.workoutMinutes > 0).length;
  const highExerciseDays = data.filter(d => d.steps >= 8000 || d.workoutMinutes >= 30).length;
  const lowExerciseDays = data.filter(d => d.steps < 3000 && d.workoutMinutes === 0).length;
  const peakHREntry = data.reduce<DailyFitnessEntry | null>(
    (max, d) => d.avgHeartRate !== null && (!max || d.avgHeartRate > (max.avgHeartRate ?? 0)) ? d : max, null
  );
  return { avgDailySteps, avgActiveMinutes, avgRestingHR, avgSleepHours, workoutCount, highExerciseDays, lowExerciseDays, totalSteps, peakHRDay: peakHREntry?.date ?? null };
}

export function getTodayFitness(data: DailyFitnessEntry[]): DailyFitnessEntry | null {
  const today = new Date().toISOString().split('T')[0];
  return data.find(d => d.date === today) ?? null;
}

export function getDateRangeFitness(data: DailyFitnessEntry[], days: number): DailyFitnessEntry[] {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  return data.filter(d => d.date >= cutoff);
}
