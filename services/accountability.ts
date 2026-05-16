/**
 * Accountability buddy service
 * - Add / remove buddies
 * - Accept / decline buddy requests
 * - Fetch incoming buddy requests (where current user is the buddy)
 * - Notify buddy via push when user hasn't logged within notify_after_hours
 */

import { getSupabaseClient } from '@/template';

export interface AccountabilityBuddy {
  id: string;
  user_id: string;
  buddy_id: string | null;
  buddy_email: string;
  buddy_name: string | null;
  status: 'pending' | 'active' | 'declined' | 'removed';
  notify_after_hours: number;
  notifications_enabled: boolean;
  last_notified_at: string | null;
  created_at: string;
}

// ─── User's own buddies ────────────────────────────────────────────────────────

export async function getMyBuddies(userId: string): Promise<AccountabilityBuddy[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('accountability_buddies')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addBuddy(userId: string, buddyEmail: string, buddyName: string, notifyAfterHours: number = 24): Promise<AccountabilityBuddy> {
  const supabase = getSupabaseClient();
  const normalizedEmail = buddyEmail.toLowerCase().trim();

  // Case-insensitive lookup so mixed-case emails still link correctly
  const { data: buddyProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  // Prevent duplicate: check if this user already has a non-removed row for this email
  const { data: existing } = await supabase
    .from('accountability_buddies')
    .select('id, status')
    .eq('user_id', userId)
    .ilike('buddy_email', normalizedEmail)
    .neq('status', 'removed')
    .maybeSingle();

  if (existing) {
    throw new Error(
      existing.status === 'pending'
        ? 'You already have a pending request to this person.'
        : 'This person is already your accountability buddy.',
    );
  }

  const { data, error } = await supabase
    .from('accountability_buddies')
    .insert({
      user_id: userId,
      buddy_id: buddyProfile?.id ?? null,
      buddy_email: normalizedEmail,
      buddy_name: buddyName.trim() || null,
      notify_after_hours: notifyAfterHours,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function toggleBuddyNotifications(buddyRowId: string, enabled: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('accountability_buddies')
    .update({ notifications_enabled: enabled })
    .eq('id', buddyRowId);
  if (error) throw new Error(error.message);
}

export async function removeBuddy(buddyRowId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('accountability_buddies')
    .update({ status: 'removed' })
    .eq('id', buddyRowId);
  if (error) throw new Error(error.message);
}

// ─── Incoming buddy requests (I am the buddy) ─────────────────────────────────

export async function getIncomingBuddyRequests(userId: string, userEmail?: string): Promise<AccountabilityBuddy[]> {
  const supabase = getSupabaseClient();

  // Primary: rows already linked by buddy_id
  const { data: byId, error } = await supabase
    .from('accountability_buddies')
    .select('*')
    .eq('buddy_id', userId)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  // Fallback: rows where buddy_email matches but buddy_id was never set
  // (happens when the sender couldn't find the recipient's profile at invite time)
  let byEmail: AccountabilityBuddy[] = [];
  if (userEmail) {
    const { data: emailRows } = await supabase
      .from('accountability_buddies')
      .select('*')
      .ilike('buddy_email', userEmail)
      .is('buddy_id', null)
      .in('status', ['pending', 'active']);
    if (emailRows?.length) {
      byEmail = emailRows;
      // Auto-link: stamp buddy_id now that we know who they are
      const ids = emailRows.map((r: any) => r.id);
      await supabase
        .from('accountability_buddies')
        .update({ buddy_id: userId })
        .in('id', ids);
    }
  }

  // Merge, deduplicate by id
  const merged = [...(byId ?? []), ...byEmail];
  const seen = new Set<string>();
  return merged.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
}

export async function respondToBuddyRequest(buddyRowId: string, accept: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('accountability_buddies')
    .update({ status: accept ? 'active' : 'declined' })
    .eq('id', buddyRowId);
  if (error) throw new Error(error.message);
}

// ─── People who have added me as buddy (I monitor their logging) ───────────────

export async function getPeopleIMonitor(userId: string): Promise<AccountabilityBuddy[]> {
  const supabase = getSupabaseClient();
  // Return both active AND pending so the watcher sees who they are monitoring
  // (pending = they added you but haven't been accepted yet — you still see them listed)
  const { data, error } = await supabase
    .from('accountability_buddies')
    .select('*')
    .eq('buddy_id', userId)
    .in('status', ['pending', 'active']);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Therapist-pro buddies ────────────────────────────────────────────────────
// Returns active buddy rows where the person who added the current user as their
// buddy holds a therapist_pro subscription. Used to gate the therapist section
// of the Wellbeing Profile questionnaire.

export interface TherapistBuddyRow extends AccountabilityBuddy {
  therapist_name: string | null;
  therapist_email: string | null;
}

export async function getTherapistBuddiesForUser(userId: string): Promise<TherapistBuddyRow[]> {
  const supabase = getSupabaseClient();
  // Join accountability_buddies with user_profiles of the requester (user_id column)
  const { data, error } = await supabase
    .from('accountability_buddies')
    .select('*, user_profiles!accountability_buddies_user_id_fkey(subscription_tier, email, username, display_name)')
    .eq('buddy_id', userId)
    .eq('status', 'active');

  if (error) throw new Error(error.message);
  if (!data) return [];

  // Filter to only therapist_pro accounts
  return data
    .filter((row: any) => row.user_profiles?.subscription_tier === 'therapist_pro')
    .map((row: any) => ({
      ...row,
      therapist_name: row.user_profiles?.display_name ?? row.user_profiles?.username ?? null,
      therapist_email: row.user_profiles?.email ?? null,
      user_profiles: undefined,
    }));
}
