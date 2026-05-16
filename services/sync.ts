/**
 * Sync service — pushes local MoodLogEntries to Supabase and keeps
 * user_profiles up to date. Runs silently in the background; failures
 * never block the local-first experience.
 */

import { getSupabaseClient } from '@/template';
import { MoodLogEntry } from '@/constants/moodlog';

// ─── Mood entries ──────────────────────────────────────────────────────────────

export async function syncMoodEntryToCloud(entry: MoodLogEntry, userId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const row = {
      user_id: userId,
      local_id: entry.id,
      date: entry.date,
      timestamp: entry.timestamp,
      score: entry.score,
      dimensions: entry.dimensions,
      primary_tag: entry.primaryTag,
      additional_tags: entry.additionalTags ?? [],
      journal_text: (entry as any).journalText ?? entry.note ?? null,
      transcript: (entry as any).transcript ?? null,
      time_of_day: entry.timeOfDay,
      time: entry.time,
      note: entry.note ?? null,
    };

    await supabase
      .from('mood_entries')
      .upsert(row, { onConflict: 'user_id,local_id' });
  } catch {}
}

export async function syncAllMoodEntriesToCloud(entries: MoodLogEntry[], userId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const rows = entries.map(entry => ({
      user_id: userId,
      local_id: entry.id,
      date: entry.date,
      timestamp: entry.timestamp,
      score: entry.score,
      dimensions: entry.dimensions,
      primary_tag: entry.primaryTag,
      additional_tags: entry.additionalTags ?? [],
      journal_text: (entry as any).journalText ?? entry.note ?? null,
      transcript: (entry as any).transcript ?? null,
      time_of_day: entry.timeOfDay,
      time: entry.time,
      note: entry.note ?? null,
    }));

    // Batch in chunks of 100
    const CHUNK = 100;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await supabase
        .from('mood_entries')
        .upsert(rows.slice(i, i + CHUNK), { onConflict: 'user_id,local_id' });
    }
  } catch {}
}

export async function fetchCloudMoodEntries(userId: string): Promise<MoodLogEntry[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (error || !data) return [];

    return data.map((row: any): MoodLogEntry => ({
      id: row.local_id,
      date: row.date,
      timestamp: row.timestamp,
      score: row.score,
      dimensions: row.dimensions,
      primaryTag: row.primary_tag,
      additionalTags: row.additional_tags ?? [],
      note: row.note ?? '',
      journalText: row.journal_text ?? '',
      transcript: row.transcript ?? '',
      timeOfDay: row.time_of_day ?? 'morning',
      time: row.time ?? '00:00',
    } as any));
  } catch {
    return [];
  }
}

// ─── User profile ──────────────────────────────────────────────────────────────

export async function updateUserProfile(userId: string, patch: {
  display_name?: string;
  last_logged_at?: string;
  notification_token?: string;
  birthdate?: string;
  onboarding_done?: boolean;
  role?: string;
  sex?: string;
  subscription_tier?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase
      .from('user_profiles')
      .update(patch)
      .eq('id', userId);
  } catch {}
}

export async function getUserProfile(userId: string): Promise<{
  role: string;
  subscription_tier: string;
  subscription_status: string | null;
  display_name: string | null;
  birthdate: string | null;
  onboarding_done: boolean;
  sex: string | null;
  username: string | null;
} | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role, subscription_tier, subscription_status, display_name, birthdate, onboarding_done, sex, username')
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

// ── Intake questionnaire ───────────────────────────────────────────────────────

export async function fetchIntakeSummaryFromCloud(userId: string): Promise<object | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('intake_questionnaires')
      .select('clinical_summary, contextual, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return null;
    return data.clinical_summary ?? null;
  } catch {
    return null;
  }
}

// ─── Wellness reports ──────────────────────────────────────────────────────────

export async function saveWellnessReport(userId: string, reportData: {
  report_type: string;
  period_start: string;
  period_end: string;
  report_data: object;
  ai_summary?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('wellness_reports').insert({
      user_id: userId,
      ...reportData,
    });
  } catch {}
}

export async function getClientMoodEntries(clientId: string): Promise<MoodLogEntry[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', clientId)
      .order('timestamp', { ascending: false })
      .limit(500);

    if (error || !data) return [];

    return data.map((row: any): MoodLogEntry => ({
      id: row.local_id,
      date: row.date,
      timestamp: row.timestamp,
      score: row.score,
      dimensions: row.dimensions,
      primaryTag: row.primary_tag,
      additionalTags: row.additional_tags ?? [],
      note: row.note ?? '',
      journalText: row.journal_text ?? '',
      timeOfDay: row.time_of_day ?? 'morning',
      time: row.time ?? '00:00',
    } as any));
  } catch {
    return [];
  }
}
