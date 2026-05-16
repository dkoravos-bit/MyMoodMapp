/**
 * MoodLog service — persistence and data operations for MoodLogEntry.
 * Also syncs each saved entry to Supabase when user is authenticated.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MoodLogEntry,
  MOODLOG_STORAGE_KEY,
  calcWellnessScore,
  getTimeOfDay,
} from '@/constants/moodlog';
import { getSupabaseClient } from '@/template';
import { syncMoodEntryToCloud } from './sync';

export async function saveMoodLogEntry(entry: MoodLogEntry): Promise<MoodLogEntry[]> {
  const raw = await AsyncStorage.getItem(MOODLOG_STORAGE_KEY);
  const log: MoodLogEntry[] = raw ? JSON.parse(raw) : [];
  log.unshift(entry);
  const trimmed = log.slice(0, 1000);
  await AsyncStorage.setItem(MOODLOG_STORAGE_KEY, JSON.stringify(trimmed));

  // Background sync to cloud
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      syncMoodEntryToCloud(entry, user.id);
      // Update last_logged_at on user profile
      await supabase.from('user_profiles').update({ last_logged_at: new Date().toISOString() }).eq('id', user.id);
    }
  } catch {}

  return trimmed;
}

export async function updateMoodLogEntry(id: string, patch: Partial<MoodLogEntry>): Promise<MoodLogEntry[]> {
  const raw = await AsyncStorage.getItem(MOODLOG_STORAGE_KEY);
  const log: MoodLogEntry[] = raw ? JSON.parse(raw) : [];
  const updated = log.map(e => e.id === id ? { ...e, ...patch } : e);
  await AsyncStorage.setItem(MOODLOG_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function getMoodLogEntries(): Promise<MoodLogEntry[]> {
  const raw = await AsyncStorage.getItem(MOODLOG_STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getTodayMoodLogEntries(): Promise<MoodLogEntry[]> {
  const log = await getMoodLogEntries();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return log.filter(e => e.date === today);
}

export function buildMoodLogEntry(
  dimensions: { body: number; mind: number; energy: number; focus: number },
  primaryTag: string,
  additionalTags: string[],
  note: string,
  selfieUri?: string,
  emotionAnalysisId?: string,
): MoodLogEntry {
  const now = new Date();
  // Use local date (not UTC) so entries logged near midnight land on the correct calendar day
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const time = now.toTimeString().slice(0, 5);
  const timeOfDay = getTimeOfDay(now.getHours());
  const score = calcWellnessScore(dimensions, [primaryTag, ...additionalTags]);

  return {
    id: `${date}_${timeOfDay}_${Date.now()}`,
    date,
    time,
    timestamp: now.getTime(),
    timeOfDay,
    dimensions,
    score,
    primaryTag,
    additionalTags: additionalTags.slice(0, 5),
    note: note.trim(),
    selfieUri,
    emotionAnalysisId,
  };
}

export function getWeeklyAvgScore(entries: MoodLogEntry[]): number | null {
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const week = entries.filter(e => e.date >= cutoff);
  if (week.length === 0) return null;
  return Math.round(week.reduce((s, e) => s + e.score, 0) / week.length);
}

export function getScoreTrend(entries: MoodLogEntry[]): 'up' | 'down' | 'stable' {
  if (entries.length < 4) return 'stable';
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  const recent = sorted.slice(0, 3);
  const prior = sorted.slice(3, 7);
  if (prior.length === 0) return 'stable';
  const recentAvg = recent.reduce((s, e) => s + e.score, 0) / recent.length;
  const priorAvg = prior.reduce((s, e) => s + e.score, 0) / prior.length;
  const delta = recentAvg - priorAvg;
  if (delta > 5) return 'up';
  if (delta < -5) return 'down';
  return 'stable';
}
