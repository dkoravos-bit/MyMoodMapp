// @ts-nocheck
/**
 * MyMoodMap — Buddy & Client Activity Feed
 *
 * Shows a chronological feed of log activity from:
 *   - Accountability buddies (people who added me as their buddy to monitor)
 *   - Therapist clients (if current user is a therapist)
 *
 * Each row shows: name, when they last logged (or how long overdue),
 * their most recent score, and recent trend chips.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';
import { useApp } from '@/hooks/useApp';
import { getScoreColor, getScoreEmoji, getScoreLabel } from '@/constants/moodlog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityPerson {
  /** Unique key for the row */
  key: string;
  /** Display name */
  name: string;
  /** Relationship type */
  type: 'buddy' | 'client';
  /** User ID of the person being monitored */
  userId: string;
  /** Hours window after which they're considered overdue */
  notifyAfterHours: number;
  /** ISO string of their most recent log (null = never logged) */
  lastLoggedAt: string | null;
  /** Most recent mood_entries for this person (up to 7) */
  recentEntries: RecentEntry[];
  /** Whether they have logged within their window */
  isOnTrack: boolean;
  /** Hours since last log (null if never logged) */
  hoursSinceLog: number | null;
}

interface RecentEntry {
  id: string;
  date: string;
  time: string | null;
  timestamp: number;
  score: number;
  primaryTag: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLastSeen(hoursSince: number | null, lastLoggedAt: string | null): string {
  if (hoursSince === null || !lastLoggedAt) return 'Never logged';
  if (hoursSince < 1) return 'Just now';
  if (hoursSince < 24) return `${Math.floor(hoursSince)}h ago`;
  const days = Math.floor(hoursSince / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function formatLogTime(entry: RecentEntry): string {
  const d = new Date(entry.timestamp);
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (entry.date === today) return `Today${entry.time ? ` at ${entry.time}` : ''}`;
  if (entry.date === yesterday) return `Yesterday${entry.time ? ` at ${entry.time}` : ''}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getHoursSince(isoString: string | null): number | null {
  if (!isoString) return null;
  return (Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60);
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchActivityFeed(userId: string, userRole: string): Promise<ActivityPerson[]> {
  const supabase = getSupabaseClient();
  const people: ActivityPerson[] = [];
  const seenKeys = new Set<string>();

  // ── 1a. Rows where I am the buddy — I monitor these users ────────────────────
  const { data: monitorRows } = await supabase
    .from('accountability_buddies')
    .select(`
      id,
      user_id,
      buddy_name,
      notify_after_hours,
      user:user_profiles!accountability_buddies_user_id_fkey(
        id, display_name, email, last_logged_at
      )
    `)
    .eq('buddy_id', userId)
    .in('status', ['active', 'pending']);

  // ── 1b. My own buddy rows — the people monitoring ME (reverse direction) ─────
  // This gives us the buddy's profile so we can show their activity too
  const { data: myBuddyRows } = await supabase
    .from('accountability_buddies')
    .select(`
      id,
      buddy_id,
      buddy_email,
      buddy_name,
      notify_after_hours,
      buddy:user_profiles!accountability_buddies_buddy_id_fkey(
        id, display_name, email, last_logged_at
      )
    `)
    .eq('user_id', userId)
    .in('status', ['active', 'pending'])
    .not('buddy_id', 'is', null);

  // Collect all user IDs for batch mood-entry fetch
  const allUserIds: string[] = [];
  for (const row of monitorRows ?? []) {
    const uid = (row as any).user?.id;
    if (uid) allUserIds.push(uid);
  }
  for (const row of myBuddyRows ?? []) {
    const uid = (row as any).buddy?.id;
    if (uid) allUserIds.push(uid);
  }

  const uniqueIds = [...new Set(allUserIds)];

  const { data: allEntries } = uniqueIds.length > 0
    ? await supabase
        .from('mood_entries')
        .select('id, user_id, date, time, timestamp, score, primary_tag')
        .in('user_id', uniqueIds)
        .order('timestamp', { ascending: false })
        .limit(uniqueIds.length * 10)
    : { data: [] };

  // Helper to build RecentEntry[] for a given userId
  const getEntries = (uid: string): RecentEntry[] =>
    (allEntries ?? [])
      .filter((e: any) => e.user_id === uid)
      .slice(0, 7)
      .map((e: any) => ({
        id: e.id,
        date: e.date,
        time: e.time,
        timestamp: Number(e.timestamp),
        score: e.score,
        primaryTag: e.primary_tag ?? null,
      }));

  // Process monitor rows (where I am the buddy watching them)
  for (const row of monitorRows ?? []) {
    const userProfile = (row as any).user;
    if (!userProfile) continue;
    const key = `buddy_${row.id}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const name =
      row.buddy_name ||
      userProfile.display_name ||
      userProfile.email?.split('@')[0] ||
      'Buddy';

    const recentEntries = getEntries(userProfile.id);
    // Derive last logged at from entries if user_profiles.last_logged_at is null
    const lastLoggedAt =
      userProfile.last_logged_at ??
      (recentEntries.length > 0
        ? new Date(recentEntries[0].timestamp).toISOString()
        : null);
    const hoursSince = getHoursSince(lastLoggedAt);
    const isOnTrack = hoursSince !== null && hoursSince < (row.notify_after_hours ?? 24);

    people.push({
      key,
      name,
      type: 'buddy',
      userId: userProfile.id,
      notifyAfterHours: row.notify_after_hours ?? 24,
      lastLoggedAt,
      recentEntries,
      isOnTrack,
      hoursSinceLog: hoursSince,
    });
  }

  // Process my own buddy rows (people who are monitoring me — show their activity)
  for (const row of myBuddyRows ?? []) {
    const buddyProfile = (row as any).buddy;
    if (!buddyProfile) continue;
    // Deduplicate in case they appear from both directions
    const key = `mybuddy_${buddyProfile.id}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const name =
      row.buddy_name ||
      buddyProfile.display_name ||
      buddyProfile.email?.split('@')[0] ||
      'Buddy';

    const recentEntries = getEntries(buddyProfile.id);
    const lastLoggedAt =
      buddyProfile.last_logged_at ??
      (recentEntries.length > 0
        ? new Date(recentEntries[0].timestamp).toISOString()
        : null);
    const hoursSince = getHoursSince(lastLoggedAt);
    const isOnTrack = hoursSince !== null && hoursSince < (row.notify_after_hours ?? 24);

    people.push({
      key,
      name,
      type: 'buddy',
      userId: buddyProfile.id,
      notifyAfterHours: row.notify_after_hours ?? 24,
      lastLoggedAt,
      recentEntries,
      isOnTrack,
      hoursSinceLog: hoursSince,
    });
  }

  // ── 2. Therapist clients (if current user is a therapist) ────────────────────
  if (userRole === 'therapist') {
    const { data: clientRows } = await supabase
      .from('therapist_clients')
      .select(`
        id,
        client_name,
        notify_after_hours,
        client:user_profiles!therapist_clients_client_id_fkey(
          id, display_name, email, last_logged_at
        )
      `)
      .eq('therapist_id', userId)
      .eq('status', 'active')
      .not('client_id', 'is', null);

    if (clientRows && clientRows.length > 0) {
      const clientIds = clientRows.map(r => (r as any).client?.id).filter(Boolean);

      const { data: clientEntries } = clientIds.length > 0
        ? await supabase
            .from('mood_entries')
            .select('id, user_id, date, time, timestamp, score, primary_tag')
            .in('user_id', clientIds)
            .order('timestamp', { ascending: false })
            .limit(clientIds.length * 7)
        : { data: [] };

      for (const row of clientRows) {
        const clientProfile = (row as any).client;
        if (!clientProfile) continue;

        const name =
          row.client_name ||
          clientProfile.display_name ||
          clientProfile.email?.split('@')[0] ||
          'Client';

        const lastLoggedAt = clientProfile.last_logged_at ?? null;
        const hoursSince = getHoursSince(lastLoggedAt);
        const isOnTrack = hoursSince !== null && hoursSince < (row.notify_after_hours ?? 48);

        const recentEntries: RecentEntry[] = (clientEntries ?? [])
          .filter((e: any) => e.user_id === clientProfile.id)
          .slice(0, 7)
          .map((e: any) => ({
            id: e.id,
            date: e.date,
            time: e.time,
            timestamp: Number(e.timestamp),
            score: e.score,
            primaryTag: e.primary_tag ?? null,
          }));

        people.push({
          key: `client_${row.id}`,
          name,
          type: 'client',
          userId: clientProfile.id,
          notifyAfterHours: row.notify_after_hours ?? 48,
          lastLoggedAt,
          recentEntries,
          isOnTrack,
          hoursSinceLog: hoursSince,
        });
      }
    }
  }

  // Sort: overdue first (longest overdue at top), then on-track by most recent
  people.sort((a, b) => {
    if (!a.isOnTrack && b.isOnTrack) return -1;
    if (a.isOnTrack && !b.isOnTrack) return 1;
    // Both same status — sort by most recently logged (ascending hours)
    const aH = a.hoursSinceLog ?? Infinity;
    const bH = b.hoursSinceLog ?? Infinity;
    return aH - bH;
  });

  return people;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BuddyActivityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { userRole } = useApp();

  const [feed, setFeed] = useState<ActivityPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await fetchActivityFeed(user.id, userRole ?? 'user');
      setFeed(data);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load activity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, userRole]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const overdueCount = feed.filter(p => !p.isOnTrack && p.hoursSinceLog !== null).length;
  const neverLoggedCount = feed.filter(p => p.hoursSinceLog === null).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialIcons name="arrow-back" size={20} color={Colors.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Activity Feed</Text>
          {lastUpdated ? (
            <Text style={styles.headerSub}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onRefresh}
          disabled={refreshing || loading}
          hitSlop={8}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
        >
          {refreshing
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <MaterialIcons name="refresh" size={18} color={Colors.primary} />}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Summary banner */}
        {!loading && feed.length > 0 ? (
          <View style={styles.summaryBanner}>
            <SummaryChip
              icon="group"
              label={`${feed.length} monitored`}
              color={Colors.primary}
            />
            {overdueCount > 0 ? (
              <SummaryChip
                icon="warning-amber"
                label={`${overdueCount} overdue`}
                color={Colors.error}
              />
            ) : null}
            {neverLoggedCount > 0 ? (
              <SummaryChip
                icon="person-off"
                label={`${neverLoggedCount} never logged`}
                color={Colors.textMuted}
              />
            ) : null}
            {overdueCount === 0 && neverLoggedCount === 0 ? (
              <SummaryChip
                icon="check-circle"
                label="Everyone on track"
                color={Colors.success}
              />
            ) : null}
          </View>
        ) : null}

        {/* Loading state */}
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.centerStateText}>Loading activity...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <MaterialIcons name="error-outline" size={32} color={Colors.error} />
            <Text style={styles.centerStateText}>{error}</Text>
            <Pressable
              onPress={() => load()}
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.retryBtnText}>Try again</Text>
            </Pressable>
          </View>
        ) : feed.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="people-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No one to monitor yet</Text>
            <Text style={styles.emptyDesc}>
              {userRole === 'therapist'
                ? 'Add clients from the Therapist Dashboard, or add an accountability buddy from the settings page below.'
                : 'Add an accountability buddy below, or ask a friend to add you — both directions show activity here.'}
            </Text>
            <View style={styles.emptyActions}>
              <Pressable
                onPress={() => router.push('/accountability' as any)}
                style={({ pressed }) => [styles.emptyActionBtn, pressed && { opacity: 0.8 }]}
              >
                <MaterialIcons name="group-add" size={16} color={Colors.primary} />
                <Text style={styles.emptyActionText}>Set up buddy</Text>
              </Pressable>
              {userRole === 'therapist' ? (
                <Pressable
                  onPress={() => router.push('/therapist-dashboard' as any)}
                  style={({ pressed }) => [styles.emptyActionBtn, { borderColor: Colors.secondary + '60', backgroundColor: Colors.secondary + '12' }, pressed && { opacity: 0.8 }]}
                >
                  <MaterialIcons name="psychology" size={16} color={Colors.secondary} />
                  <Text style={[styles.emptyActionText, { color: Colors.secondary }]}>Therapist dashboard</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          <>
            {/* Section: Overdue */}
            {feed.filter(p => !p.isOnTrack).length > 0 ? (
              <>
                <SectionHeader icon="warning-amber" label="Needs check-in" color={Colors.error} />
                {feed
                  .filter(p => !p.isOnTrack)
                  .map(person => (
                    <PersonCard key={person.key} person={person} onPress={() => {}} />
                  ))}
              </>
            ) : null}

            {/* Section: On track */}
            {feed.filter(p => p.isOnTrack).length > 0 ? (
              <>
                <SectionHeader icon="check-circle" label="On track" color={Colors.success} />
                {feed
                  .filter(p => p.isOnTrack)
                  .map(person => (
                    <PersonCard key={person.key} person={person} onPress={() => {}} />
                  ))}
              </>
            ) : null}
          </>
        )}

        {/* Navigation shortcuts */}
        {!loading && feed.length > 0 ? (
          <View style={styles.shortcuts}>
            <Pressable
              onPress={() => router.push('/accountability' as any)}
              style={({ pressed }) => [styles.shortcutBtn, pressed && { opacity: 0.8 }]}
            >
              <MaterialIcons name="group" size={15} color={Colors.primary} />
              <Text style={styles.shortcutText}>Accountability settings</Text>
            </Pressable>
            {userRole === 'therapist' ? (
              <Pressable
                onPress={() => router.push('/therapist-dashboard' as any)}
                style={({ pressed }) => [styles.shortcutBtn, { borderColor: Colors.secondary + '50', backgroundColor: Colors.secondary + '12' }, pressed && { opacity: 0.8 }]}
              >
                <MaterialIcons name="psychology" size={15} color={Colors.secondary} />
                <Text style={[styles.shortcutText, { color: Colors.secondary }]}>Therapist dashboard</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryChip({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={[schipStyles.chip, { backgroundColor: color + '15', borderColor: color + '35' }]}>
      <MaterialIcons name={icon as any} size={12} color={color} />
      <Text style={[schipStyles.label, { color }]}>{label}</Text>
    </View>
  );
}
const schipStyles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1 },
  label: { fontSize: Typography.fontSizes.xs, fontWeight: '600', includeFontPadding: false },
});

function SectionHeader({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={shStyles.row}>
      <MaterialIcons name={icon as any} size={13} color={color} />
      <Text style={[shStyles.label, { color }]}>{label}</Text>
    </View>
  );
}
const shStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: Spacing.sm, marginTop: Spacing.md },
  label: { fontSize: Typography.fontSizes.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, includeFontPadding: false },
});

function PersonCard({ person, onPress }: { person: ActivityPerson; onPress: () => void }) {
  const isOverdue = !person.isOnTrack && person.hoursSinceLog !== null;
  const neverLogged = person.hoursSinceLog === null;
  const statusColor = neverLogged
    ? Colors.textMuted
    : isOverdue
    ? Colors.error
    : Colors.success;

  const latestEntry = person.recentEntries[0] ?? null;
  const recentScores = person.recentEntries.slice(0, 5).map(e => e.score);

  // Determine trend from last 3 vs prior 2 entries
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (person.recentEntries.length >= 4) {
    const recent = person.recentEntries.slice(0, 2).reduce((s, e) => s + e.score, 0) / 2;
    const prior = person.recentEntries.slice(2, 4).reduce((s, e) => s + e.score, 0) / 2;
    if (recent - prior > 5) trend = 'up';
    else if (prior - recent > 5) trend = 'down';
  }

  const overdueHours = isOverdue && person.hoursSinceLog !== null
    ? Math.round(person.hoursSinceLog)
    : null;

  return (
    <View style={[pcStyles.card, isOverdue && pcStyles.cardOverdue, neverLogged && pcStyles.cardMuted]}>
      {/* Avatar + status dot */}
      <View style={pcStyles.avatarCol}>
        <View style={[pcStyles.avatar, { backgroundColor: statusColor + '18', borderColor: statusColor + '50' }]}>
          <Text style={[pcStyles.avatarText, { color: statusColor }]}>
            {person.name[0].toUpperCase()}
          </Text>
        </View>
        <View style={[pcStyles.statusDot, { backgroundColor: statusColor }]} />
      </View>

      {/* Main content */}
      <View style={pcStyles.content}>
        {/* Name + type badge */}
        <View style={pcStyles.nameRow}>
          <Text style={pcStyles.name}>{person.name}</Text>
          <View style={[pcStyles.typeBadge, { backgroundColor: person.type === 'therapist' || person.type === 'client' ? Colors.secondary + '18' : Colors.primary + '18' }]}>
            <MaterialIcons
              name={person.type === 'client' ? 'psychology' : 'group'}
              size={10}
              color={person.type === 'client' ? Colors.secondary : Colors.primary}
            />
            <Text style={[pcStyles.typeText, { color: person.type === 'client' ? Colors.secondary : Colors.primary }]}>
              {person.type === 'client' ? 'Client' : 'Buddy'}
            </Text>
          </View>
        </View>

        {/* Status line */}
        {neverLogged ? (
          <Text style={[pcStyles.statusLine, { color: Colors.textMuted }]}>
            No check-ins logged yet
          </Text>
        ) : isOverdue ? (
          <Text style={[pcStyles.statusLine, { color: Colors.error }]}>
            Overdue — {overdueHours}h since last log (window: {person.notifyAfterHours}h)
          </Text>
        ) : latestEntry ? (
          <Text style={[pcStyles.statusLine, { color: Colors.success }]}>
            {person.name.split(' ')[0]} logged {formatLogTime(latestEntry)}
            {latestEntry.score ? ` · score ${latestEntry.score}` : ''}
          </Text>
        ) : null}

        {/* Recent score dots + trend */}
        {recentScores.length > 0 ? (
          <View style={pcStyles.scoreRow}>
            <View style={pcStyles.scoreDots}>
              {recentScores.map((s, i) => {
                const c = getScoreColor(s);
                const size = i === 0 ? 28 : 20 - i;
                return (
                  <View
                    key={i}
                    style={[
                      pcStyles.scoreDot,
                      {
                        width: Math.max(12, size),
                        height: Math.max(12, size),
                        borderRadius: Math.max(6, size / 2),
                        backgroundColor: c + (i === 0 ? '' : '60'),
                        borderWidth: i === 0 ? 2 : 1,
                        borderColor: c,
                      },
                    ]}
                  >
                    {i === 0 ? (
                      <Text style={[pcStyles.scoreDotText, { color: i === 0 ? '#fff' : c }]}>
                        {s}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
            {person.recentEntries.length >= 2 ? (
              <View style={[
                pcStyles.trendBadge,
                {
                  backgroundColor: trend === 'up' ? Colors.success + '18' : trend === 'down' ? Colors.error + '18' : Colors.border,
                },
              ]}>
                <MaterialIcons
                  name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'trending-flat'}
                  size={11}
                  color={trend === 'up' ? Colors.success : trend === 'down' ? Colors.error : Colors.textMuted}
                />
                <Text style={[
                  pcStyles.trendText,
                  { color: trend === 'up' ? Colors.success : trend === 'down' ? Colors.error : Colors.textMuted },
                ]}>
                  {trend === 'up' ? 'Rising' : trend === 'down' ? 'Dropping' : 'Stable'}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Log history mini-timeline */}
        {person.recentEntries.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={pcStyles.timelineScroll}
            contentContainerStyle={pcStyles.timelineContent}
          >
            {person.recentEntries.slice(0, 7).map((entry, i) => {
              const c = getScoreColor(entry.score);
              return (
                <View key={entry.id} style={pcStyles.timelineEntry}>
                  <View style={[pcStyles.timelineBar, { backgroundColor: c + '50', borderTopColor: c }]}>
                    <Text style={[pcStyles.timelineScore, { color: c }]}>{entry.score}</Text>
                  </View>
                  <Text style={pcStyles.timelineDate}>
                    {entry.date === new Date().toISOString().split('T')[0]
                      ? `Today${entry.time ? `\n${entry.time}` : ''}`
                      : new Date(entry.timestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {/* Right: last-seen label */}
      <View style={pcStyles.rightCol}>
        <Text style={[pcStyles.lastSeen, { color: statusColor }]}>
          {formatLastSeen(person.hoursSinceLog, person.lastLoggedAt)}
        </Text>
        <Text style={pcStyles.windowLabel}>{person.notifyAfterHours}h window</Text>
      </View>
    </View>
  );
}

const pcStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  cardOverdue: {
    borderColor: Colors.error + '40',
    backgroundColor: Colors.error + '05',
  },
  cardMuted: {
    borderColor: Colors.border,
    opacity: 0.75,
  },
  avatarCol: {
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: '900',
    includeFontPadding: false,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    gap: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    fontSize: Typography.fontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    includeFontPadding: false,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  typeText: {
    fontSize: 9,
    fontWeight: '700',
    includeFontPadding: false,
  },
  statusLine: {
    fontSize: Typography.fontSizes.xs,
    lineHeight: Typography.fontSizes.xs * 1.4,
    includeFontPadding: false,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  scoreDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreDot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreDotText: {
    fontSize: 8,
    fontWeight: '900',
    includeFontPadding: false,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  trendText: {
    fontSize: 9,
    fontWeight: '700',
    includeFontPadding: false,
  },
  timelineScroll: {
    marginTop: 2,
  },
  timelineContent: {
    gap: 5,
    paddingVertical: 2,
  },
  timelineEntry: {
    alignItems: 'center',
    gap: 3,
  },
  timelineBar: {
    width: 28,
    height: 24,
    borderRadius: Radius.sm,
    borderTopWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineScore: {
    fontSize: 9,
    fontWeight: '800',
    includeFontPadding: false,
  },
  timelineDate: {
    fontSize: 8,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 10,
    includeFontPadding: false,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 4,
    justifyContent: 'flex-start',
    minWidth: 60,
    flexShrink: 0,
    paddingTop: 3,
  },
  lastSeen: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'right',
    includeFontPadding: false,
  },
  windowLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'right',
    includeFontPadding: false,
  },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    includeFontPadding: false,
  },
  headerSub: {
    fontSize: 10,
    color: Colors.textMuted,
    includeFontPadding: false,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  summaryBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  centerState: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing['3xl'],
  },
  centerStateText: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  retryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  retryBtnText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: '700',
    color: Colors.primary,
    includeFontPadding: false,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    includeFontPadding: false,
  },
  emptyDesc: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: Typography.fontSizes.sm * 1.6,
    includeFontPadding: false,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  emptyActionText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: '700',
    color: Colors.primary,
    includeFontPadding: false,
  },
  shortcuts: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    flexWrap: 'wrap',
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  shortcutText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: '700',
    color: Colors.primary,
    includeFontPadding: false,
  },
});
