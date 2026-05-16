/**
 * Fitness data service
 *
 * Data source priority:
 *  1. expo-health — real HR, steps, sleep via HealthKit (iOS) and Health Connect (Android)
 *     Works in managed Expo builds (Expo Go does NOT grant HealthKit; use dev-client / EAS).
 *  2. expo-sensors Pedometer — real step counts, works in Expo Go on iOS/Android
 *  3. react-native-health (HealthKit) — legacy EAS builds only
 *  4. Mock data — simulator / web fallback
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── expo-health (managed builds — HealthKit iOS + Health Connect Android) ────
let ExpoHealth: any = null;
if (Platform.OS !== 'web') {
  try { ExpoHealth = require('expo-health'); } catch {}
}

// ─── Pedometer (expo-sensors) ─────────────────────────────────────────────────
// Available in Expo Go on iOS and Android
let Pedometer: any = null;
if (Platform.OS !== 'web') {
  try {
    const mod = require('expo-sensors');
    Pedometer = mod.Pedometer ?? null;
  } catch {}
}

// ─── HealthKit (react-native-health) — legacy EAS builds only ────────────────
let AppleHealthKit: any = null;
let _hkInitialized = false;

if (Platform.OS === 'ios') {
  try {
    const mod = require('react-native-health');
    AppleHealthKit = mod.default ?? mod.AppleHealthKit ?? mod;
  } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyFitnessEntry {
  date: string; // YYYY-MM-DD
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

const FITNESS_KEY = 'vibe_fitness_log';
const FITNESS_PERMISSION_KEY = 'vibe_fitness_permission';

// ─── expo-health helpers (HealthKit iOS + Health Connect Android) ────────────

async function isExpoHealthAvailable(): Promise<boolean> {
  if (!ExpoHealth) return false;
  try {
    // expo-health exposes isAvailableAsync or isHealthDataAvailable
    if (typeof ExpoHealth.isAvailableAsync === 'function') {
      return !!(await ExpoHealth.isAvailableAsync());
    }
    if (typeof ExpoHealth.isHealthDataAvailable === 'function') {
      return !!(await ExpoHealth.isHealthDataAvailable());
    }
    return false;
  } catch {
    return false;
  }
}

async function requestExpoHealthPermissions(): Promise<boolean> {
  if (!ExpoHealth) return false;
  try {
    // Permissions needed: Steps, HeartRate, SleepAnalysis, ActiveEnergyBurned
    const perms = [
      ExpoHealth.HealthDataType?.Steps ?? 'Steps',
      ExpoHealth.HealthDataType?.HeartRate ?? 'HeartRate',
      ExpoHealth.HealthDataType?.SleepAnalysis ?? 'SleepAnalysis',
      ExpoHealth.HealthDataType?.ActiveEnergyBurned ?? 'ActiveEnergyBurned',
      ExpoHealth.HealthDataType?.RestingHeartRate ?? 'RestingHeartRate',
    ].filter(Boolean);
    const result = await ExpoHealth.requestPermissionsAsync?.(perms);
    // Accept granted or authorized
    return result?.granted === true || result?.status === 'authorized';
  } catch {
    return false;
  }
}

async function fetchFromExpoHealth(days: number): Promise<DailyFitnessEntry[]> {
  if (!ExpoHealth) return [];
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 86400000);

  const byDate: Record<string, DailyFitnessEntry> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toISOString().split('T')[0];
    byDate[key] = { date: key, steps: 0, activeMinutes: 0, restingHeartRate: null, avgHeartRate: null, caloriesBurned: 0, workoutMinutes: 0, sleepHours: null, heartRateSamples: [] };
  }

  const safe = async <T>(fn: () => Promise<T[]>): Promise<T[]> => {
    try { return await fn(); } catch { return []; }
  };

  // ── Steps ──
  const stepsData: any[] = await safe(() =>
    ExpoHealth.getStepsAsync?.({ startDate: startDate.toISOString(), endDate: now.toISOString() }) ??
    ExpoHealth.queryAsync?.({ type: ExpoHealth.HealthDataType?.Steps ?? 'Steps', startDate: startDate.toISOString(), endDate: now.toISOString() }) ?? Promise.resolve([])
  );
  stepsData.forEach((s: any) => {
    const k = new Date(s.startDate ?? s.date).toISOString().split('T')[0];
    if (byDate[k]) byDate[k].steps += Math.round(s.value ?? s.quantity ?? 0);
  });

  // ── Heart Rate ──
  const hrData: any[] = await safe(() =>
    ExpoHealth.queryAsync?.({ type: ExpoHealth.HealthDataType?.HeartRate ?? 'HeartRate', startDate: startDate.toISOString(), endDate: now.toISOString(), ascending: true }) ?? Promise.resolve([])
  );
  hrData.forEach((h: any) => {
    const k = new Date(h.startDate ?? h.date).toISOString().split('T')[0];
    const bpm = Math.round(h.value ?? h.quantity ?? 0);
    if (byDate[k] && bpm > 20 && bpm < 250) {
      byDate[k].heartRateSamples!.push(bpm);
    }
  });

  // ── Resting Heart Rate (iOS only) ──
  const restingHRData: any[] = await safe(() =>
    ExpoHealth.queryAsync?.({ type: ExpoHealth.HealthDataType?.RestingHeartRate ?? 'RestingHeartRate', startDate: startDate.toISOString(), endDate: now.toISOString() }) ?? Promise.resolve([])
  );
  restingHRData.forEach((h: any) => {
    const k = new Date(h.startDate ?? h.date).toISOString().split('T')[0];
    const bpm = Math.round(h.value ?? h.quantity ?? 0);
    if (byDate[k] && bpm > 20) byDate[k].restingHeartRate = bpm;
  });

  // ── Compute avgHeartRate from samples where restingHR not available ──
  Object.values(byDate).forEach(e => {
    const s = e.heartRateSamples ?? [];
    if (s.length > 0) {
      e.avgHeartRate = Math.round(s.reduce((a, b) => a + b, 0) / s.length);
      if (!e.restingHeartRate) {
        // Use the 10th percentile as a resting estimate when no explicit resting HR
        const sorted = [...s].sort((a, b) => a - b);
        const idx = Math.max(0, Math.floor(sorted.length * 0.1));
        e.restingHeartRate = sorted[idx];
      }
    }
    // Derive active minutes from steps if not available
    if (!e.activeMinutes && e.steps > 0) {
      e.activeMinutes = Math.round(e.steps / 100);
    }
  });

  // ── Calories ──
  const calData: any[] = await safe(() =>
    ExpoHealth.queryAsync?.({ type: ExpoHealth.HealthDataType?.ActiveEnergyBurned ?? 'ActiveEnergyBurned', startDate: startDate.toISOString(), endDate: now.toISOString() }) ?? Promise.resolve([])
  );
  calData.forEach((c: any) => {
    const k = new Date(c.startDate ?? c.date).toISOString().split('T')[0];
    if (byDate[k]) {
      byDate[k].caloriesBurned += Math.round(c.value ?? c.quantity ?? 0);
      byDate[k].workoutMinutes += 30;
    }
  });

  // ── Sleep ──
  const sleepData: any[] = await safe(() =>
    ExpoHealth.queryAsync?.({ type: ExpoHealth.HealthDataType?.SleepAnalysis ?? 'SleepAnalysis', startDate: startDate.toISOString(), endDate: now.toISOString() }) ?? Promise.resolve([])
  );
  sleepData.forEach((sl: any) => {
    const k = new Date(sl.startDate ?? sl.date).toISOString().split('T')[0];
    if (byDate[k]) {
      const hrs = (new Date(sl.endDate).getTime() - new Date(sl.startDate ?? sl.date).getTime()) / 3600000;
      byDate[k].sleepHours = parseFloat(((byDate[k].sleepHours ?? 0) + hrs).toFixed(1));
    }
  });

  const result = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
  // Only return if we got any real data
  const hasRealData = result.some(d => d.steps > 0 || (d.heartRateSamples?.length ?? 0) > 0 || d.sleepHours !== null);
  return hasRealData ? result : [];
}

// ─── Pedometer helpers ────────────────────────────────────────────────────────

async function isPedometerAvailable(): Promise<boolean> {
  if (!Pedometer) return false;
  try {
    const available = await Pedometer.isAvailableAsync();
    return !!available;
  } catch {
    return false;
  }
}

async function requestPedometerPermission(): Promise<boolean> {
  if (!Pedometer) return false;
  try {
    // requestPermissionsAsync may not exist on all versions — check first
    if (typeof Pedometer.requestPermissionsAsync === 'function') {
      const { status } = await Pedometer.requestPermissionsAsync();
      return status === 'granted';
    }
    // Older SDK — just check availability; permission is implicit
    return await isPedometerAvailable();
  } catch {
    return false;
  }
}

async function fetchStepsForDay(date: Date): Promise<number> {
  if (!Pedometer) return 0;
  try {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    // Don't query future dates
    if (start > new Date()) return 0;
    const result = await Pedometer.getStepCountAsync(start, end);
    return result?.steps ?? 0;
  } catch {
    return 0;
  }
}

async function fetchFromPedometer(days: number): Promise<DailyFitnessEntry[]> {
  const entries: DailyFitnessEntry[] = [];
  const now = new Date();

  // Fetch all days in parallel for speed
  const dayDates = Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getTime() - i * 86400000);
    return d;
  });

  const stepCounts = await Promise.all(dayDates.map(d => fetchStepsForDay(d)));

  for (let i = 0; i < days; i++) {
    const d = dayDates[i];
    const key = d.toISOString().split('T')[0];
    const steps = stepCounts[i];

    // Derive active minutes from steps (rough: 100 steps ≈ 1 min of light walking)
    const activeMinutes = Math.round(steps / 100);
    // Derive calories from steps (rough: 0.04 cal/step)
    const caloriesBurned = Math.round(steps * 0.04);

    // For HR and sleep we use plausible seed-based estimates when not on HealthKit
    // These are marked null so the UI can show "—" rather than fake numbers
    entries.push({
      date: key,
      steps,
      activeMinutes,
      restingHeartRate: null,
      avgHeartRate: null,
      caloriesBurned,
      workoutMinutes: steps >= 8000 ? 30 : steps >= 5000 ? 15 : 0,
      sleepHours: null,
      heartRateSamples: [],
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── HealthKit (full data — EAS build only) ───────────────────────────────────

function initHealthKit(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!AppleHealthKit || typeof AppleHealthKit.initHealthKit !== 'function') {
      resolve(false);
      return;
    }

    const readPerms = AppleHealthKit.Constants?.Permissions
      ? [
          AppleHealthKit.Constants.Permissions.Steps,
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          AppleHealthKit.Constants.Permissions.HeartRate,
          AppleHealthKit.Constants.Permissions.RestingHeartRate,
          AppleHealthKit.Constants.Permissions.SleepAnalysis,
          AppleHealthKit.Constants.Permissions.AppleExerciseTime,
        ].filter(Boolean)
      : ['Steps', 'ActiveEnergyBurned', 'HeartRate', 'RestingHeartRate', 'SleepAnalysis', 'AppleExerciseTime'];

    AppleHealthKit.initHealthKit(
      { permissions: { read: readPerms, write: [] } },
      (err: any) => {
        if (err) { console.warn('[Fitness] HealthKit init:', err); resolve(false); }
        else { _hkInitialized = true; resolve(true); }
      },
    );
  });
}

async function fetchFromHealthKit(days: number): Promise<DailyFitnessEntry[]> {
  if (!AppleHealthKit || !_hkInitialized) return [];

  const now = new Date();
  const start = new Date(now.getTime() - days * 86400000);
  const options = { startDate: start.toISOString(), endDate: now.toISOString(), includeManuallyAdded: true };

  const safe = <T>(fn: () => Promise<T[]>): Promise<T[]> => fn().catch(() => []);

  const [stepsData, hrData, sleepData, exerciseData] = await Promise.all([
    safe(() => new Promise<any[]>(res => AppleHealthKit.getDailyStepCountSamples(options, (_: any, r: any) => res(r || [])))),
    safe(() => new Promise<any[]>(res => AppleHealthKit.getHeartRateSamples(options, (_: any, r: any) => res(r || [])))),
    safe(() => new Promise<any[]>(res => AppleHealthKit.getSleepSamples(options, (_: any, r: any) => res(r || [])))),
    safe(() => new Promise<any[]>(res => AppleHealthKit.getActiveEnergyBurned(options, (_: any, r: any) => res(r || [])))),
  ]);

  const byDate: Record<string, DailyFitnessEntry> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toISOString().split('T')[0];
    byDate[key] = { date: key, steps: 0, activeMinutes: 0, restingHeartRate: null, avgHeartRate: null, caloriesBurned: 0, workoutMinutes: 0, sleepHours: null, heartRateSamples: [] };
  }

  stepsData.forEach((s: any) => {
    const k = new Date(s.startDate).toISOString().split('T')[0];
    if (byDate[k]) byDate[k].steps += Math.round(s.value || 0);
  });
  hrData.forEach((h: any) => {
    const k = new Date(h.startDate).toISOString().split('T')[0];
    if (byDate[k]) byDate[k].heartRateSamples!.push(Math.round(h.value || 0));
  });
  Object.values(byDate).forEach(e => {
    const s = e.heartRateSamples || [];
    if (s.length > 0) { e.avgHeartRate = Math.round(s.reduce((a, b) => a + b, 0) / s.length); e.restingHeartRate = Math.min(...s); }
    e.activeMinutes = Math.round(e.steps / 100);
  });
  exerciseData.forEach((ex: any) => {
    const k = new Date(ex.startDate).toISOString().split('T')[0];
    if (byDate[k]) { byDate[k].caloriesBurned += Math.round(ex.value || 0); byDate[k].workoutMinutes += 30; }
  });
  sleepData.forEach((sl: any) => {
    const k = new Date(sl.startDate).toISOString().split('T')[0];
    if (byDate[k]) {
      const hrs = (new Date(sl.endDate).getTime() - new Date(sl.startDate).getTime()) / 3600000;
      byDate[k].sleepHours = parseFloat(((byDate[k].sleepHours || 0) + hrs).toFixed(1));
    }
  });

  return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Cloud sync ─────────────────────────────────────────────────────────────

import { getSupabaseClient } from '@/template';

/**
 * Upload the most recent `days` fitness entries to Supabase.
 * Called after a successful HealthKit/Pedometer fetch on mobile.
 * Silent — never throws.
 */
export async function syncFitnessDataToCloud(entries: DailyFitnessEntry[], userId: string): Promise<void> {
  if (entries.length === 0) return;
  try {
    const supabase = getSupabaseClient();
    const rows = entries.map(e => ({
      user_id: userId,
      date: e.date,
      steps: e.steps,
      active_minutes: e.activeMinutes,
      resting_heart_rate: e.restingHeartRate ?? null,
      avg_heart_rate: e.avgHeartRate ?? null,
      calories_burned: e.caloriesBurned,
      workout_minutes: e.workoutMinutes,
      sleep_hours: e.sleepHours ?? null,
      synced_at: new Date().toISOString(),
    }));
    // Batch upsert in chunks of 50
    const CHUNK = 50;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await supabase
        .from('fitness_data')
        .upsert(rows.slice(i, i + CHUNK), { onConflict: 'user_id,date' });
    }
  } catch {}
}

/**
 * Fetch fitness data from Supabase (used on web where HealthKit is unavailable).
 * Returns entries sorted newest-first.
 */
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
    if (error || !data || data.length === 0) return [];
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
    return [];
  }
}

// ─── Mock data generator ──────────────────────────────────────────────────────

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

// ─── Permissions ─────────────────────────────────────────────────────────────

export async function requestFitnessPermissions(): Promise<FitnessPermissionStatus> {
  // 1. Try expo-health (managed builds — HealthKit iOS + Health Connect Android)
  if (Platform.OS !== 'web' && ExpoHealth) {
    const available = await isExpoHealthAvailable();
    if (available) {
      const granted = await requestExpoHealthPermissions();
      if (granted) {
        const status: FitnessPermissionStatus = { granted: true, source: 'expo_health' };
        await AsyncStorage.setItem(FITNESS_PERMISSION_KEY, JSON.stringify(status));
        return status;
      }
    }
  }

  // 2. Try full HealthKit via react-native-health (legacy EAS build)
  if (Platform.OS === 'ios' && AppleHealthKit) {
    const ok = _hkInitialized ? true : await initHealthKit();
    if (ok) {
      const status: FitnessPermissionStatus = { granted: true, source: 'healthkit' };
      await AsyncStorage.setItem(FITNESS_PERMISSION_KEY, JSON.stringify(status));
      return status;
    }
  }

  // 3. Try Pedometer (Expo Go + managed builds on iOS/Android)
  const pedometerOk = await requestPedometerPermission();
  if (pedometerOk) {
    const status: FitnessPermissionStatus = { granted: true, source: 'pedometer' };
    await AsyncStorage.setItem(FITNESS_PERMISSION_KEY, JSON.stringify(status));
    return status;
  }

  // 4. Mock fallback
  const status: FitnessPermissionStatus = { granted: true, source: 'mock' };
  await AsyncStorage.setItem(FITNESS_PERMISSION_KEY, JSON.stringify(status));
  return status;
}

export async function getFitnessPermissionStatus(): Promise<FitnessPermissionStatus> {
  const cached = await AsyncStorage.getItem(FITNESS_PERMISSION_KEY);
  if (cached) return JSON.parse(cached);
  return { granted: false, source: 'mock' };
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchFitnessData(days: number = 30): Promise<DailyFitnessEntry[]> {
  const status = await requestFitnessPermissions();

  // expo-health path (managed builds — real HR, steps, sleep on iOS + Android)
  if (status.source === 'expo_health') {
    try {
      const data = await fetchFromExpoHealth(days);
      if (data.length > 0) {
        await AsyncStorage.setItem(FITNESS_KEY, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn('[Fitness] expo-health fetch failed:', e);
    }
  }

  // Full HealthKit path (legacy EAS build)
  if (status.source === 'healthkit' && _hkInitialized) {
    try {
      const data = await fetchFromHealthKit(days);
      if (data.length > 0) {
        await AsyncStorage.setItem(FITNESS_KEY, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn('[Fitness] HealthKit fetch failed:', e);
    }
  }

  // Pedometer path (Expo Go / managed — real step counts)
  if (status.source === 'pedometer') {
    try {
      const data = await fetchFromPedometer(days);
      // Verify we actually got non-zero steps for at least one day
      const hasRealSteps = data.some(d => d.steps > 0);
      if (hasRealSteps) {
        await AsyncStorage.setItem(FITNESS_KEY, JSON.stringify(data));
        return data;
      }
      // Zero steps on all days likely means pedometer isn't tracking yet
      // (e.g., fresh install, simulator). Fall through to mock but save what we have.
      if (data.length > 0) {
        await AsyncStorage.setItem(FITNESS_KEY, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn('[Fitness] Pedometer fetch failed:', e);
    }
  }

  // Mock fallback
  const mock = generateMockData(days);
  await AsyncStorage.setItem(FITNESS_KEY, JSON.stringify(mock));
  return mock;
}

/**
 * fetchFitnessDataAndSync — calls fetchFitnessData then silently pushes
 * real (non-mock) results to the cloud so the website can display them.
 *
 * Quality gate: only syncs when the data is genuinely real:
 *  - Source must be healthkit, expo_health, or pedometer
 *  - At least one entry must have steps > 0 OR non-null sleep/HR
 *    (guards against Expo Go on simulator where pedometer returns 0 for everything)
 */
export async function fetchFitnessDataAndSync(days: number = 30): Promise<DailyFitnessEntry[]> {
  const data = await fetchFitnessData(days);
  const status = await getFitnessPermissionStatus();

  const isRealSource = status.source === 'healthkit' || status.source === 'expo_health' || status.source === 'pedometer';
  const hasRealValues = data.some(
    d => d.steps > 0 || d.sleepHours !== null || d.restingHeartRate !== null || d.avgHeartRate !== null
  );

  if (isRealSource && hasRealValues) {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        // Only upload entries that have at least one real metric — skip empty days
        const realEntries = data.filter(
          d => d.steps > 0 || d.sleepHours !== null || d.restingHeartRate !== null || d.avgHeartRate !== null
        );
        if (realEntries.length > 0) {
          syncFitnessDataToCloud(realEntries, user.id).catch(() => {});
        }
      }
    } catch {}
  }
  return data;
}

export async function getCachedFitnessData(): Promise<DailyFitnessEntry[]> {
  const raw = await AsyncStorage.getItem(FITNESS_KEY);
  return raw ? JSON.parse(raw) : [];
}

// ─── Summaries ────────────────────────────────────────────────────────────────

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
