/**
 * Therapist service
 * - Manage client roster
 * - Fetch client mood entries and wellness reports
 * - Accept / decline client link requests
 */

import { getSupabaseClient } from '@/template';
import { MoodLogEntry } from '@/constants/moodlog';
import { getClientMoodEntries } from './sync';

export interface TherapistClient {
  id: string;
  therapist_id: string;
  client_id: string | null;
  client_email: string;
  client_name: string | null;
  invite_token: string;
  status: 'pending' | 'active' | 'declined' | 'removed';
  notify_after_hours: number;
  notifications_enabled: boolean;
  last_notified_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ClientSummary {
  client: TherapistClient;
  recentEntries: MoodLogEntry[];
  lastLoggedAt: string | null;
  avgScore7d: number | null;
  streak: number;
  isOverdue: boolean;
}

// ─── Therapist's client roster ─────────────────────────────────────────────────

export async function getMyClients(therapistId: string): Promise<TherapistClient[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('therapist_clients')
    .select('*')
    .eq('therapist_id', therapistId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function inviteClient(therapistId: string, clientEmail: string, clientName: string, notifyAfterHours: number = 48): Promise<TherapistClient> {
  const supabase = getSupabaseClient();
  const normalizedEmail = clientEmail.toLowerCase().trim();

  // Check if email is already a registered user (case-insensitive)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  const { data, error } = await supabase
    .from('therapist_clients')
    .insert({
      therapist_id: therapistId,
      client_id: profile?.id ?? null,
      client_email: normalizedEmail,
      client_name: clientName.trim() || null,
      notify_after_hours: notifyAfterHours,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function removeClient(clientRowId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('therapist_clients')
    .update({ status: 'removed' })
    .eq('id', clientRowId);
}

// ─── Therapist session notes (therapist_client_notes table) ─────────────────

export interface TherapistNote {
  id: string;
  therapist_id: string;
  client_id: string;
  therapist_client_row_id: string | null;
  note_text: string;
  audio_uri: string | null;
  transcript: string | null;
  note_date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export async function getClientNotes(therapistId: string, clientId: string): Promise<TherapistNote[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('therapist_client_notes')
    .select('*')
    .eq('therapist_id', therapistId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveClientNote(
  therapistId: string,
  clientId: string,
  therapistClientRowId: string | null,
  noteText: string,
  noteDate: string,
  audioUri?: string | null,
  transcript?: string | null,
  existingId?: string | null,
): Promise<TherapistNote> {
  const supabase = getSupabaseClient();
  if (existingId) {
    const { data, error } = await supabase
      .from('therapist_client_notes')
      .update({ note_text: noteText, audio_uri: audioUri ?? null, transcript: transcript ?? null, updated_at: new Date().toISOString() })
      .eq('id', existingId)
      .eq('therapist_id', therapistId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await supabase
    .from('therapist_client_notes')
    .insert({
      therapist_id: therapistId,
      client_id: clientId,
      therapist_client_row_id: therapistClientRowId,
      note_text: noteText,
      audio_uri: audioUri ?? null,
      transcript: transcript ?? null,
      note_date: noteDate,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteClientNote(therapistId: string, noteId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('therapist_client_notes')
    .delete()
    .eq('id', noteId)
    .eq('therapist_id', therapistId);
}

export async function updateClientNotes(clientRowId: string, notes: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('therapist_clients')
    .update({ notes })
    .eq('id', clientRowId);
}

export async function updateClientNotificationsEnabled(clientRowId: string, enabled: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('therapist_clients')
    .update({ notifications_enabled: enabled })
    .eq('id', clientRowId);
  if (error) throw new Error(error.message);
}

// ─── Client data access ────────────────────────────────────────────────────────

export async function getClientSummary(client: TherapistClient): Promise<ClientSummary> {
  if (!client.client_id) {
    return { client, recentEntries: [], lastLoggedAt: null, avgScore7d: null, streak: 0, isOverdue: false };
  }

  const entries = await getClientMoodEntries(client.client_id);
  const now = Date.now();

  // Last logged
  const sortedByTime = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  const lastEntry = sortedByTime[0];
  const lastLoggedAt = lastEntry ? new Date(lastEntry.timestamp).toISOString() : null;

  // 7-day avg score
  const cutoff7d = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const week = entries.filter(e => e.date >= cutoff7d);
  const avgScore7d = week.length
    ? Math.round(week.reduce((s, e) => s + e.score, 0) / week.length)
    : null;

  // Simple streak (consecutive days with at least one entry)
  let streak = 0;
  const loggedDates = new Set(entries.map(e => e.date));
  for (let i = 0; i < 30; i++) {
    const d = new Date(now - i * 86400000).toISOString().split('T')[0];
    if (loggedDates.has(d)) streak++;
    else if (i > 0) break;
  }

  // Overdue check
  const hoursThreshold = client.notify_after_hours ?? 48;
  const isOverdue = lastLoggedAt
    ? (now - new Date(lastLoggedAt).getTime()) > hoursThreshold * 3600000
    : true;

  return {
    client,
    recentEntries: sortedByTime.slice(0, 20),
    lastLoggedAt,
    avgScore7d,
    streak,
    isOverdue,
  };
}

// ─── Incoming invites (client side) ───────────────────────────────────────────

export async function getMyTherapistLinks(userId: string, userEmail?: string): Promise<TherapistClient[]> {
  const supabase = getSupabaseClient();

  // Primary: match by client_id (already linked)
  const { data: byId } = await supabase
    .from('therapist_clients')
    .select('*')
    .eq('client_id', userId)
    .in('status', ['pending', 'active']);

  // Fallback: match by email for rows where client_id was never set
  // (can happen if therapist invited before client had an account)
  let byEmail: TherapistClient[] = [];
  if (userEmail) {
    const { data: emailRows } = await supabase
      .from('therapist_clients')
      .select('*')
      .ilike('client_email', userEmail)
      .is('client_id', null)
      .in('status', ['pending', 'active']);
    if (emailRows?.length) {
      byEmail = emailRows;
      // Auto-link: set client_id now that we know who they are
      const ids = emailRows.map(r => r.id);
      await supabase
        .from('therapist_clients')
        .update({ client_id: userId })
        .in('id', ids);
    }
  }

  // Merge, deduplicate by id
  const merged = [...(byId ?? []), ...byEmail];
  const seen = new Set<string>();
  return merged.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
}

export async function respondToTherapistInvite(inviteId: string, accept: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('therapist_clients')
    .update({ status: accept ? 'active' : 'declined' })
    .eq('id', inviteId);
}
