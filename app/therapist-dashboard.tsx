/**
 * Therapist Dashboard — Therapist Pro role only
 * - Unlimited client roster
 * - Per-client mood trend, streak, overdue status
 * - Tap into client detail (entries + wellness report)
 * - Invite new clients
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  TherapistClient,
  ClientSummary,
  TherapistNote,
  getMyClients,
  inviteClient,
  removeClient,
  getClientSummary,
  updateClientNotificationsEnabled,
  getClientNotes,
  saveClientNote,
  deleteClientNote,
} from '@/services/therapist';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getScoreColor, getScoreLabel, getScoreEmoji, CONTEXT_TAGS } from '@/constants/moodlog';

export default function TherapistDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invHours, setInvHours] = useState('48');
  const [inviting, setInviting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null);
  // Per-client reminder sending state: key = therapist_clients row id
  const [remindingIds, setRemindingIds] = useState<Set<string>>(new Set());
  // Per-client notification toggle loading state
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rawClients = await getMyClients(user.id);
      const active = rawClients.filter(c => c.status !== 'removed');
      const summaries = await Promise.all(active.map(c => getClientSummary(c)));
      setClients(summaries);
    } catch (e: any) {
      showAlert('Load error', e.message ?? 'Could not load clients.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleNotify = useCallback(async (summary: ClientSummary) => {
    const rowId = summary.client.id;
    const newVal = !summary.client.notifications_enabled;
    setTogglingIds(prev => new Set(prev).add(rowId));
    try {
      await updateClientNotificationsEnabled(rowId, newVal);
      // Optimistically update local state
      setClients(prev => prev.map(c =>
        c.client.id === rowId
          ? { ...c, client: { ...c.client, notifications_enabled: newVal } }
          : c
      ));
    } catch (e: any) {
      showAlert('Error', e.message ?? 'Could not update notification setting.');
    } finally {
      setTogglingIds(prev => { const s = new Set(prev); s.delete(rowId); return s; });
    }
  }, []);

  const handleSendReminder = useCallback(async (summary: ClientSummary) => {
    if (!user) return;
    const rowId = summary.client.id;
    setRemindingIds(prev => new Set(prev).add(rowId));
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.functions.invoke('send-invite-reminder', {
        body: {
          therapistClientId: rowId,
          therapistName: user.username ?? user.email?.split('@')[0] ?? 'Your therapist',
        },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const statusCode = error.context?.status ?? 500;
            const txt = await error.context?.text();
            if (statusCode === 429) {
              showAlert('Too soon', 'A reminder was already sent within the last hour. Please wait before sending another.');
              return;
            }
            msg = `[${statusCode}] ${txt || error.message}`;
          } catch {}
        }
        showAlert('Error', msg);
        return;
      }
      showAlert(
        'Reminder sent ✓',
        `An email has been sent to ${summary.client.client_email} with a link to download MyMoodMapp and accept your invite. If they already have the app, they also received a push notification.`
      );
      // Refresh to update last_notified_at
      await load();
    } catch (e: any) {
      showAlert('Error', e.message ?? 'Could not send reminder.');
    } finally {
      setRemindingIds(prev => { const s = new Set(prev); s.delete(rowId); return s; });
    }
  }, [user, load]);

  const handleInvite = async () => {
    if (!user) return;
    const email = invEmail.trim();
    if (!email || !email.includes('@')) {
      showAlert('Invalid email', 'Enter a valid client email address.');
      return;
    }
    const hours = parseInt(invHours, 10);
    if (isNaN(hours) || hours < 1) {
      showAlert('Invalid', 'Alert window must be at least 1 hour.');
      return;
    }
    setInviting(true);
    try {
      await inviteClient(user.id, email, invName, hours);
      setInvEmail(''); setInvName(''); setInvHours('48');
      setShowInvite(false);
      await load();
      showAlert('Invite sent', 'Client will be linked when they sign in with this email on MyMoodMap.');
    } catch (e: any) {
      showAlert('Error', e.message ?? 'Could not invite client.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = (summary: ClientSummary) => {
    showAlert(
      'Remove client?',
      `${summary.client.client_name ?? summary.client.client_email} will no longer appear in your dashboard.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            await removeClient(summary.client.id);
            await load();
          },
        },
      ],
    );
  };

  if (selectedClient) {
    return <ClientDetailView summary={selectedClient} onBack={() => setSelectedClient(null)} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Client Dashboard</Text>
            <View style={styles.proBadge}>
              <MaterialIcons name="psychology" size={10} color={Colors.primary} />
              <Text style={styles.proBadgeText}>Therapist Pro</Text>
            </View>
          </View>
          <Text style={styles.headerSub}>{clients.length} active client{clients.length !== 1 ? 's' : ''}</Text>
        </View>
        <Pressable
          onPress={() => setShowInvite(!showInvite)}
          style={({ pressed }) => [styles.addIconBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialIcons name={showInvite ? 'close' : 'person-add'} size={20} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Summary row */}
        <View style={styles.statsRow}>
          <MiniStat label="Total" value={String(clients.length)} color={Colors.primary} icon="group" />
          <MiniStat label="Active today" value={String(clients.filter(c => c.lastLoggedAt && new Date(c.lastLoggedAt).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]).length)} color={Colors.success} icon="check-circle" />
          <MiniStat label="Overdue" value={String(clients.filter(c => c.isOverdue && c.client.status === 'active').length)} color={Colors.error} icon="warning" />
          <MiniStat label="Pending" value={String(clients.filter(c => c.client.status === 'pending').length)} color={Colors.warning} icon="hourglass-top" />
        </View>

        {/* Invite panel */}
        {showInvite ? (
          <View style={styles.inviteCard}>
            <Text style={styles.inviteTitle}>Invite a client</Text>
            <Text style={styles.inviteSub}>
              Client links their MyMoodMap account automatically when they sign in with this email.
            </Text>
            <InvField label="Client email *" value={invEmail} onChangeText={setInvEmail}
              keyboardType="email-address" autoCapitalize="none" placeholder="client@example.com" />
            <InvField label="Client name (optional)" value={invName} onChangeText={setInvName}
              placeholder="Full name" />
            <InvField label="Alert if no log after (hours)" value={invHours} onChangeText={setInvHours}
              keyboardType="numeric" placeholder="48" />
            <Pressable
              onPress={handleInvite}
              disabled={inviting}
              style={({ pressed }) => [styles.inviteBtn, pressed && { opacity: 0.8 }, inviting && { opacity: 0.6 }]}
            >
              {inviting ? <ActivityIndicator color="#08091A" size="small" /> : <Text style={styles.inviteBtnText}>Add client</Text>}
            </Pressable>
          </View>
        ) : null}

        {/* Overdue alerts */}
        {clients.some(c => c.isOverdue && c.client.status === 'active') ? (
          <View style={styles.overdueSection}>
            <View style={styles.sectionRow}>
              <MaterialIcons name="warning-amber" size={14} color={Colors.error} />
              <Text style={[styles.sectionTitle, { color: Colors.error }]}>Overdue — missed logging window</Text>
            </View>
            {clients.filter(c => c.isOverdue && c.client.status === 'active').map(s => (
              <ClientCard key={s.client.id} summary={s} onTap={() => setSelectedClient(s)} onRemove={() => handleRemove(s)} onRemind={null} isReminding={false} onToggleNotify={() => handleToggleNotify(s)} isTogglingNotify={togglingIds.has(s.client.id)} />
            ))}
          </View>
        ) : null}

        {/* Active clients */}
        {clients.filter(c => c.client.status === 'active' && !c.isOverdue).length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Logging on track</Text>
            {clients.filter(c => c.client.status === 'active' && !c.isOverdue).map(s => (
              <ClientCard key={s.client.id} summary={s} onTap={() => setSelectedClient(s)} onRemove={() => handleRemove(s)} onRemind={null} isReminding={false} onToggleNotify={() => handleToggleNotify(s)} isTogglingNotify={togglingIds.has(s.client.id)} />
            ))}
          </View>
        ) : null}

        {/* Pending */}
        {clients.filter(c => c.client.status === 'pending').length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <MaterialIcons name="hourglass-top" size={14} color={Colors.warning} />
              <Text style={[styles.sectionTitle, { color: Colors.warning }]}>Pending — awaiting client acceptance</Text>
            </View>
            <View style={[styles.pendingInfoCard]}>
              <MaterialIcons name="info-outline" size={13} color={Colors.warning} />
              <Text style={styles.pendingInfoText}>
                These clients have not yet accepted your invitation. Tap "Send Reminder" to email them a sign-in link and push notification directing them to the Accountability Buddy screen where they can accept.
              </Text>
            </View>
            {clients.filter(c => c.client.status === 'pending').map(s => (
              <ClientCard
                key={s.client.id}
                summary={s}
                onTap={() => setSelectedClient(s)}
                onRemove={() => handleRemove(s)}
                onRemind={() => handleSendReminder(s)}
                isReminding={remindingIds.has(s.client.id)}
                onToggleNotify={() => handleToggleNotify(s)}
                isTogglingNotify={togglingIds.has(s.client.id)}
              />
            ))}
          </View>
        ) : null}

        {!loading && clients.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="people-outline" size={44} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No clients yet</Text>
            <Text style={styles.emptyText}>Tap the add button above to invite your first client. They will be linked automatically when they sign in with the same email.</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>Loading clients...</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Client Card ───────────────────────────────────────────────────────────────
function ClientCard({ summary, onTap, onRemove, onRemind, isReminding, onToggleNotify, isTogglingNotify }: {
  summary: ClientSummary;
  onTap: () => void;
  onRemove: () => void;
  onRemind: (() => void) | null;
  isReminding: boolean;
  onToggleNotify: () => void;
  isTogglingNotify: boolean;
}) {
  const { client, recentEntries, lastLoggedAt, avgScore7d, streak, isOverdue } = summary;
  const scoreColor = avgScore7d !== null ? getScoreColor(avgScore7d) : Colors.textMuted;
  const isPending = client.status === 'pending';
  const hasData = recentEntries.length > 0;

  const lastLogLabel = lastLoggedAt
    ? (() => {
        const diff = Date.now() - new Date(lastLoggedAt).getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return 'just now';
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
      })()
    : 'never logged';

  return (
    <Pressable
      onPress={onTap}
      style={({ pressed }) => [
        styles.clientCard,
        isOverdue && !isPending && { borderColor: Colors.error + '50' },
        isPending && { borderColor: Colors.warning + '40', borderStyle: 'dashed' },
        pressed && { opacity: 0.85 },
      ]}
    >
      {/* Main info row */}
      <View style={styles.clientCardRow}>
        <View style={[
          styles.clientAvatar,
          { backgroundColor: isPending ? Colors.warning + '20' : (isOverdue ? Colors.error + '20' : Colors.primary + '20') },
        ]}>
          <Text style={[styles.clientAvatarText, {
            color: isPending ? Colors.warning : (isOverdue ? Colors.error : Colors.primary),
          }]}>
            {(client.client_name ?? client.client_email)[0].toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.clientNameRow}>
            <Text style={styles.clientName} numberOfLines={1}>
              {client.client_name ?? client.client_email}
            </Text>
            {isOverdue && !isPending ? (
              <View style={styles.overdueChip}>
                <Text style={styles.overdueChipText}>Overdue</Text>
              </View>
            ) : null}
            {isPending ? (
              <View style={[styles.overdueChip, { backgroundColor: Colors.warning + '20' }]}>
                <Text style={[styles.overdueChipText, { color: Colors.warning }]}>Pending</Text>
              </View>
            ) : null}
          </View>
          {client.client_name ? <Text style={styles.clientEmail} numberOfLines={1}>{client.client_email}</Text> : null}
          <View style={styles.clientMetaRow}>
            <View style={styles.clientMetaItem}>
              <MaterialIcons name="access-time" size={10} color={Colors.textMuted} />
              <Text style={styles.clientMetaText}>{lastLogLabel}</Text>
            </View>
            {streak > 0 ? (
              <View style={styles.clientMetaItem}>
                <MaterialIcons name="local-fire-department" size={10} color={Colors.primary} />
                <Text style={[styles.clientMetaText, { color: Colors.primary }]}>{streak}d streak</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.clientRight}>
          {avgScore7d !== null ? (
            <View style={styles.clientScoreWrap}>
              <Text style={[styles.clientScore, { color: scoreColor }]}>{avgScore7d}</Text>
              <Text style={styles.clientScoreSub}>7d avg</Text>
            </View>
          ) : null}
          <View style={styles.clientRightActions}>
            {isTogglingNotify ? (
              <ActivityIndicator size="small" color={Colors.textMuted} style={{ width: 28, height: 28 }} />
            ) : (
              <Pressable
                onPress={(e) => { e.stopPropagation?.(); onToggleNotify(); }}
                hitSlop={8}
                style={[styles.notifyToggleBtn, { backgroundColor: client.notifications_enabled ? Colors.primary + '18' : Colors.border + '60' }]}
              >
                <MaterialIcons
                  name={client.notifications_enabled ? 'notifications-active' : 'notifications-off'}
                  size={14}
                  color={client.notifications_enabled ? Colors.primary : Colors.textMuted}
                />
              </Pressable>
            )}
            <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
          </View>
        </View>
      </View>

      {/* Reminder row — full width below the main content, pending only */}
      {onRemind ? (
        <View style={styles.reminderRow}>
          <View style={styles.pendingExplain}>
            <MaterialIcons name="hourglass-top" size={11} color={Colors.warning} />
            <Text style={styles.pendingExplainText}>
              {isPending && summary.client.last_notified_at
                ? `Last reminded: ${(() => { const h = Math.round((Date.now() - new Date(summary.client.last_notified_at).getTime()) / 3_600_000); return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`; })()}`
                : 'Client has not accepted yet'}
            </Text>
          </View>
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onRemind(); }}
            disabled={isReminding}
            style={({ pressed }) => [styles.remindBtn, pressed && { opacity: 0.75 }, isReminding && { opacity: 0.55 }]}
          >
            {isReminding
              ? <ActivityIndicator size="small" color="#08091A" />
              : <>
                  <MaterialIcons name="send" size={12} color="#08091A" />
                  <Text style={styles.remindBtnText}>Send Reminder</Text>
                </>
            }
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

// ─── Intake severity helpers ──────────────────────────────────────────────────
function phq9Color(s: number) { return s <= 4 ? Colors.success : s <= 9 ? '#FFD166' : s <= 14 ? '#FF8C42' : Colors.error; }
function phq9Label(s: number) { return s <= 4 ? 'Minimal' : s <= 9 ? 'Mild' : s <= 14 ? 'Moderate' : s <= 19 ? 'Mod-severe' : 'Severe'; }
function gad7Color(s: number) { return s <= 4 ? Colors.success : s <= 9 ? '#FFD166' : s <= 14 ? '#FF8C42' : Colors.error; }
function gad7Label(s: number) { return s <= 4 ? 'Minimal' : s <= 9 ? 'Mild' : s <= 14 ? 'Moderate' : 'Severe'; }

interface IntakeData {
  phq9_total: number | null;
  gad7_total: number | null;
  presenting_concern: string | null;
  contextual: Record<string, any> | null;
  clinical_summary: Record<string, any> | null;
  trauma_flag: boolean;
  safety_flag: boolean;
  completed_at: string | null;
}

// ─── Client Detail View ────────────────────────────────────────────────────────
function ClientDetailView({ summary, onBack }: { summary: ClientSummary; onBack: () => void }) {
  const { client, recentEntries, lastLoggedAt, avgScore7d, streak, isOverdue } = summary;
  const scoreColor = avgScore7d !== null ? getScoreColor(avgScore7d) : Colors.textMuted;
  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [intakeLoading, setIntakeLoading] = useState(true);

  useEffect(() => {
    if (!client.client_id) { setIntakeLoading(false); return; }
    const fetchIntake = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('intake_questionnaires')
          .select('phq9_total, gad7_total, presenting_concern, contextual, clinical_summary, trauma_flag, safety_flag, completed_at')
          .eq('user_id', client.client_id)
          .order('completed_at', { ascending: false })
          .limit(1)
          .single();
        if (data) setIntake(data as IntakeData);
      } catch {}
      setIntakeLoading(false);
    };
    fetchIntake();
  }, [client.client_id]);

  // 30-day mini chart
  const last14 = (() => {
    const byDate: Record<string, number[]> = {};
    recentEntries.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e.score);
    });
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().split('T')[0];
      const scores = byDate[d] ?? [];
      return {
        date: d,
        avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        dayLabel: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][new Date(d + 'T12:00:00').getDay()],
      };
    });
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {client.client_name ?? client.client_email}
          </Text>
          <Text style={styles.headerSub}>{client.client_email}</Text>
        </View>
        {isOverdue ? (
          <View style={[styles.overdueChip, { marginRight: 0 }]}>
            <Text style={styles.overdueChipText}>Overdue</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Stats row */}
        <View style={styles.statsRow}>
          <MiniStat label="7-day avg" value={avgScore7d !== null ? String(avgScore7d) : '—'} color={scoreColor} icon="mood" />
          <MiniStat label="Entries" value={String(recentEntries.length)} color={Colors.secondary} icon="event-note" />
          <MiniStat label="Streak" value={`${streak}d`} color={Colors.primary} icon="local-fire-department" />
          <MiniStat label="Last log" value={lastLoggedAt ? (() => {
            const h = Math.floor((Date.now() - new Date(lastLoggedAt).getTime()) / 3600000);
            return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
          })() : '—'} color={isOverdue ? Colors.error : Colors.success} icon="access-time" />
        </View>

        {/* 14-day chart */}
        {recentEntries.length >= 2 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>14-day score trend</Text>
            <View style={styles.miniChart}>
              {last14.map((d, i) => {
                const h = d.avg != null ? Math.max(5, Math.round((d.avg / 100) * 52)) : 3;
                const col = d.avg != null ? getScoreColor(d.avg) : Colors.border;
                const isToday = i === 13;
                return (
                  <View key={i} style={styles.miniChartCol}>
                    {d.avg != null ? <Text style={[styles.miniChartScore, { color: col }]}>{d.avg}</Text> : <Text style={styles.miniChartScore}> </Text>}
                    <View style={[styles.miniChartBar, { height: h, backgroundColor: isToday ? col : col + '80' }]} />
                    <Text style={[styles.miniChartDay, isToday && { color: Colors.textPrimary, fontWeight: '700' }]}>
                      {isToday ? 'Now' : d.dayLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Wellbeing Profile (intake questionnaire) */}
        {intakeLoading ? (
          <View style={[styles.section, { alignItems: 'center', paddingVertical: Spacing.lg }]}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={[styles.sectionTitle, { marginTop: 4 }]}>Loading intake profile...</Text>
          </View>
        ) : intake ? (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <MaterialIcons name="favorite" size={14} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Wellbeing profile</Text>
              {intake.completed_at ? (
                <Text style={intakeStyles.completedAt}>Completed {new Date(intake.completed_at).toLocaleDateString()}</Text>
              ) : null}
            </View>

            {/* Safety flags — priority display */}
            {(intake.safety_flag || intake.trauma_flag || (intake.phq9_total ?? 0) >= 15 || (intake.gad7_total ?? 0) >= 15) ? (
              <View style={intakeStyles.flagCard}>
                <View style={intakeStyles.flagHeader}>
                  <MaterialIcons name="warning-amber" size={13} color={Colors.warning} />
                  <Text style={intakeStyles.flagTitle}>Clinical flags</Text>
                </View>
                {intake.safety_flag ? (
                  <View style={intakeStyles.flagRow}>
                    <MaterialIcons name="flag" size={12} color={Colors.error} />
                    <Text style={[intakeStyles.flagText, { color: Colors.error }]}>Safety: self-harm thoughts reported (PHQ-9 item 9)</Text>
                  </View>
                ) : null}
                {intake.trauma_flag ? (
                  <View style={intakeStyles.flagRow}>
                    <MaterialIcons name="flag" size={12} color={Colors.warning} />
                    <Text style={[intakeStyles.flagText, { color: Colors.warning }]}>Trauma history indicated</Text>
                  </View>
                ) : null}
                {(intake.phq9_total ?? 0) >= 15 ? (
                  <View style={intakeStyles.flagRow}>
                    <MaterialIcons name="flag" size={12} color={Colors.error} />
                    <Text style={[intakeStyles.flagText, { color: Colors.error }]}>PHQ-9 {intake.phq9_total}/27 — {phq9Label(intake.phq9_total!)}</Text>
                  </View>
                ) : null}
                {(intake.gad7_total ?? 0) >= 15 ? (
                  <View style={intakeStyles.flagRow}>
                    <MaterialIcons name="flag" size={12} color={Colors.error} />
                    <Text style={[intakeStyles.flagText, { color: Colors.error }]}>GAD-7 {intake.gad7_total}/21 — {gad7Label(intake.gad7_total!)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Severity meters */}
            <View style={intakeStyles.metersCard}>
              {intake.phq9_total != null ? (
                <IntakeMeter label="PHQ-9" score={intake.phq9_total} max={27}
                  color={phq9Color(intake.phq9_total)} sublabel={phq9Label(intake.phq9_total)} />
              ) : null}
              {intake.gad7_total != null ? (
                <IntakeMeter label="GAD-7" score={intake.gad7_total} max={21}
                  color={gad7Color(intake.gad7_total)} sublabel={gad7Label(intake.gad7_total)} />
              ) : null}
            </View>

            {/* Presenting concern */}
            {intake.presenting_concern ? (
              <View style={intakeStyles.blockCard}>
                <Text style={intakeStyles.blockLabel}>Presenting concern</Text>
                <Text style={intakeStyles.blockValue}>{intake.presenting_concern}</Text>
              </View>
            ) : null}

            {/* Goals */}
            {(intake.clinical_summary?.goal_feel || intake.clinical_summary?.goal_better) ? (
              <View style={intakeStyles.blockCard}>
                <Text style={intakeStyles.blockLabel}>Goals — in their words</Text>
                {intake.clinical_summary?.goal_feel ? (
                  <Text style={intakeStyles.blockValue}>{intake.clinical_summary.goal_feel}</Text>
                ) : null}
                {intake.clinical_summary?.goal_better ? (
                  <Text style={[intakeStyles.blockValue, { marginTop: 4 }]}>{intake.clinical_summary.goal_better}</Text>
                ) : null}
              </View>
            ) : null}

            {/* Key context chips */}
            <View style={intakeStyles.chipRow}>
              {intake.clinical_summary?.duration ? (
                <IntakeChip icon="schedule" label={intake.clinical_summary.duration} />
              ) : null}
              {intake.clinical_summary?.support_level ? (
                <IntakeChip icon="group" label={intake.clinical_summary.support_level} />
              ) : null}
              {intake.clinical_summary?.pref_style ? (
                <IntakeChip icon="tune" label={intake.clinical_summary.pref_style} />
              ) : null}
            </View>

            {/* Strengths snapshot */}
            {intake.clinical_summary?.whats_working || intake.clinical_summary?.self_knowledge ? (
              <View style={intakeStyles.blockCard}>
                <Text style={intakeStyles.blockLabel}>Strengths</Text>
                {intake.clinical_summary?.whats_working ? (
                  <Text style={intakeStyles.blockValue}>{intake.clinical_summary.whats_working}</Text>
                ) : null}
                {intake.clinical_summary?.self_knowledge ? (
                  <Text style={[intakeStyles.blockValue, { marginTop: 4 }]}>{intake.clinical_summary.self_knowledge}</Text>
                ) : null}
              </View>
            ) : null}

            {/* Life areas */}
            {intake.clinical_summary?.life_areas_affected?.length > 0 ? (
              <View style={intakeStyles.blockCard}>
                <Text style={intakeStyles.blockLabel}>Life areas affected</Text>
                <View style={intakeStyles.areaChipRow}>
                  {intake.clinical_summary.life_areas_affected.map((a: string, i: number) => (
                    <View key={i} style={intakeStyles.areaChip}>
                      <Text style={intakeStyles.areaChipText}>{a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : client.client_id ? (
          <View style={[styles.section]}>
            <View style={[styles.emptyCard, { paddingVertical: Spacing.lg }]}>
              <MaterialIcons name="assignment" size={24} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Client has not completed their Wellbeing Profile yet.</Text>
            </View>
          </View>
        ) : null}

        {/* Therapist session notes */}
        {client.client_id ? (
          <TherapistNotesSection
            summary={summary}
          />
        ) : null}

        {/* Recent entries */}
        {recentEntries.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent log entries</Text>
            <View style={styles.entriesList}>
              {recentEntries.slice(0, 15).map(entry => {
                const tag = CONTEXT_TAGS.find(t => t.id === entry.primaryTag);
                const eColor = getScoreColor(entry.score);
                return (
                  <View key={entry.id} style={styles.entryRow}>
                    <View style={[styles.entryScoreBadge, { backgroundColor: eColor + '18', borderColor: eColor + '40' }]}>
                      <Text style={styles.entryScoreEmoji}>{getScoreEmoji(entry.score)}</Text>
                      <Text style={[styles.entryScore, { color: eColor }]}>{entry.score}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.entryMeta}>
                        <Text style={styles.entryDate}>{entry.date}</Text>
                        <Text style={styles.entryTime}>{entry.time}</Text>
                        {tag ? (
                          <View style={[styles.entryTagPill, { backgroundColor: tag.color + '15' }]}>
                            <Text style={styles.entryTagEmoji}>{tag.emoji}</Text>
                            <Text style={[styles.entryTagLabel, { color: tag.color }]}>{tag.label}</Text>
                          </View>
                        ) : null}
                      </View>
                      {(entry as any).journalText ? (
                        <Text style={styles.entryJournal} numberOfLines={2}>
                          "{(entry as any).journalText}"
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <MaterialIcons name="event-busy" size={32} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {client.status === 'pending'
                ? 'Client has not linked their account yet. They need to sign in with MyMoodMap using this email.'
                : 'No logged entries yet.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Therapist Notes Section ────────────────────────────────────────────────────
function TherapistNotesSection({ summary }: { summary: ClientSummary }) {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [notes, setNotes] = useState<TherapistNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  // Collapsed months: key = "YYYY-MM"
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  // Collapsed individual notes
  const [collapsedNotes, setCollapsedNotes] = useState<Set<string>>(new Set());
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  // Compose state
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  // Voice recording
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const loadNotes = useCallback(async () => {
    if (!user?.id || !summary.client.client_id) { setLoading(false); return; }
    try {
      const data = await getClientNotes(user.id, summary.client.client_id);
      setNotes(data);
    } catch {}
    setLoading(false);
  }, [user?.id, summary.client.client_id]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // Group notes by YYYY-MM, then by date
  const grouped = React.useMemo(() => {
    const byMonth: Record<string, Record<string, TherapistNote[]>> = {};
    notes.forEach(n => {
      const month = n.note_date.substring(0, 7);
      const day = n.note_date;
      if (!byMonth[month]) byMonth[month] = {};
      if (!byMonth[month][day]) byMonth[month][day] = [];
      byMonth[month][day].push(n);
    });
    return byMonth;
  }, [notes]);

  const monthKeys = Object.keys(grouped).sort().reverse();

  const toggleMonth = (m: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  };

  const toggleNote = (id: string) => {
    setCollapsedNotes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startRecording = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Permission required', 'Microphone access is needed to record notes.');
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      }
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = rec;
      setRecording(rec);
      setIsRecording(true);
    } catch (e: any) {
      showAlert('Recording failed', e.message ?? 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    setTranscribing(true);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setRecording(null);

      if (!uri) { setTranscribing(false); return; }

      // Transcribe via edge function
      const supabase = getSupabaseClient();
      let base64: string | null = null;
      if (Platform.OS !== 'web') {
        try {
          const FileSystem = require('expo-file-system');
          base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        } catch {}
      }

      if (base64) {
        const { data, error } = await supabase.functions.invoke('transcribe-voice', {
          body: { audioBase64: base64, mimeType: 'audio/m4a' },
        });
        if (!error && data?.transcript) {
          const t = data.transcript as string;
          setNoteText(prev => (prev ? prev + ' ' + t : t));
        }
      }
    } catch {}
    setTranscribing(false);
  };

  const handleSave = async () => {
    if (!user?.id || !summary.client.client_id || !noteText.trim()) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      if (editingId) {
        await saveClientNote(
          user.id, summary.client.client_id, summary.client.id,
          noteText.trim(), today, null, null, editingId
        );
        setEditingId(null);
      } else {
        await saveClientNote(
          user.id, summary.client.client_id, summary.client.id,
          noteText.trim(), today
        );
      }
      setNoteText('');
      setShowCompose(false);
      await loadNotes();
    } catch (e: any) {
      showAlert('Error', e.message ?? 'Could not save note.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (noteId: string) => {
    showAlert('Delete note?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (!user?.id) return;
        await deleteClientNote(user.id, noteId);
        await loadNotes();
      }},
    ]);
  };

  const handleEdit = (note: TherapistNote) => {
    setEditingId(note.id);
    setNoteText(note.note_text);
    setShowCompose(true);
  };

  const formatMonthLabel = (m: string) => {
    const [y, mo] = m.split('-');
    return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  const formatDayLabel = (d: string) => {
    return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.section, { gap: Spacing.md }]}>
      {/* Section header */}
      <View style={[styles.sectionRow, { justifyContent: 'space-between' }]}>
        <View style={styles.sectionRow}>
          <MaterialIcons name="notes" size={14} color={Colors.secondary} />
          <Text style={[styles.sectionTitle, { color: Colors.secondary }]}>Session Notes</Text>
          {notes.length > 0 ? (
            <View style={[styles.overdueChip, { backgroundColor: Colors.secondary + '20' }]}>
              <Text style={[styles.overdueChipText, { color: Colors.secondary }]}>{notes.length}</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={() => { setEditingId(null); setNoteText(''); setShowCompose(!showCompose); }}
          style={({ pressed }) => [tnStyles.addBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialIcons name={showCompose ? 'close' : 'add'} size={16} color={Colors.secondary} />
          <Text style={tnStyles.addBtnText}>{showCompose ? 'Cancel' : 'Add Note'}</Text>
        </Pressable>
      </View>

      {/* Compose panel */}
      {showCompose ? (
        <View style={tnStyles.composeCard}>
          <View style={tnStyles.composeHeader}>
            <MaterialIcons name="edit" size={14} color={Colors.secondary} />
            <Text style={tnStyles.composeTitle}>
              {editingId ? 'Edit note' : `Note — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </Text>
          </View>
          <TextInput
            style={tnStyles.textarea}
            multiline
            numberOfLines={5}
            placeholder="Session observations, treatment notes, progress..."
            placeholderTextColor={Colors.textMuted}
            value={noteText}
            onChangeText={setNoteText}
            textAlignVertical="top"
            autoCapitalize="sentences"
          />
          {/* Voice controls */}
          <View style={tnStyles.voiceRow}>
            {Platform.OS !== 'web' ? (
              isRecording ? (
                <Pressable
                  onPress={stopRecording}
                  style={({ pressed }) => [tnStyles.voiceBtn, { backgroundColor: Colors.error + '20', borderColor: Colors.error }, pressed && { opacity: 0.7 }]}
                >
                  <View style={tnStyles.recordingDot} />
                  <Text style={[tnStyles.voiceBtnText, { color: Colors.error }]}>Stop Recording</Text>
                </Pressable>
              ) : transcribing ? (
                <View style={[tnStyles.voiceBtn, { borderColor: Colors.primary + '40' }]}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={[tnStyles.voiceBtnText, { color: Colors.primary }]}>Transcribing...</Text>
                </View>
              ) : (
                <Pressable
                  onPress={startRecording}
                  style={({ pressed }) => [tnStyles.voiceBtn, { backgroundColor: Colors.primary + '12', borderColor: Colors.primary + '40' }, pressed && { opacity: 0.7 }]}
                >
                  <MaterialIcons name="mic" size={14} color={Colors.primary} />
                  <Text style={[tnStyles.voiceBtnText, { color: Colors.primary }]}>Record & Transcribe</Text>
                </Pressable>
              )
            ) : (
              <Text style={{ fontSize: 10, color: Colors.textMuted, includeFontPadding: false } as any}>Voice recording available on mobile app</Text>
            )}
            <Pressable
              onPress={handleSave}
              disabled={saving || !noteText.trim()}
              style={({ pressed }) => [tnStyles.saveBtn, (!noteText.trim() || saving) && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#08091A" />
              ) : (
                <>
                  <MaterialIcons name="save" size={14} color="#08091A" />
                  <Text style={tnStyles.saveBtnText}>Save Note</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Notes grouped by month > day */}
      {loading ? (
        <ActivityIndicator size="small" color={Colors.secondary} />
      ) : monthKeys.length === 0 ? (
        <View style={tnStyles.emptyNotes}>
          <MaterialIcons name="sticky-note-2" size={24} color={Colors.textMuted} />
          <Text style={tnStyles.emptyNotesText}>No session notes yet. Tap "Add Note" to create the first one.</Text>
        </View>
      ) : (
        monthKeys.map(month => {
          const isMonthCollapsed = collapsedMonths.has(month);
          const dayKeys = Object.keys(grouped[month]).sort().reverse();
          const noteCount = dayKeys.reduce((acc, d) => acc + grouped[month][d].length, 0);
          return (
            <View key={month} style={tnStyles.monthBlock}>
              {/* Month header */}
              <Pressable
                onPress={() => toggleMonth(month)}
                style={({ pressed }) => [tnStyles.monthHeader, pressed && { opacity: 0.75 }]}
              >
                <MaterialIcons
                  name={isMonthCollapsed ? 'keyboard-arrow-right' : 'keyboard-arrow-down'}
                  size={18}
                  color={Colors.secondary}
                />
                <Text style={tnStyles.monthLabel}>{formatMonthLabel(month)}</Text>
                <View style={tnStyles.monthCount}>
                  <Text style={tnStyles.monthCountText}>{noteCount} note{noteCount !== 1 ? 's' : ''}</Text>
                </View>
              </Pressable>

              {/* Days */}
              {!isMonthCollapsed ? dayKeys.map(day => (
                <View key={day} style={tnStyles.dayBlock}>
                  <View style={tnStyles.dayHeader}>
                    <View style={tnStyles.dayDot} />
                    <Text style={tnStyles.dayLabel}>{formatDayLabel(day)}</Text>
                  </View>
                  {grouped[month][day].map(note => {
                    const isNoteCollapsed = collapsedNotes.has(note.id);
                    return (
                      <View key={note.id} style={tnStyles.noteCard}>
                        {/* Note header row */}
                        <Pressable
                          onPress={() => toggleNote(note.id)}
                          style={({ pressed }) => [tnStyles.noteHeader, pressed && { opacity: 0.75 }]}
                        >
                          <MaterialIcons
                            name={isNoteCollapsed ? 'keyboard-arrow-right' : 'keyboard-arrow-down'}
                            size={14}
                            color={Colors.textMuted}
                          />
                          <Text style={tnStyles.noteTime}>{formatTime(note.created_at)}</Text>
                          <Text
                            style={tnStyles.notePreview}
                            numberOfLines={1}
                          >
                            {note.note_text}
                          </Text>
                          {/* Actions */}
                          <Pressable
                            onPress={() => handleEdit(note)}
                            hitSlop={8}
                            style={({ pressed }) => [tnStyles.noteActionBtn, pressed && { opacity: 0.6 }]}
                          >
                            <MaterialIcons name="edit" size={13} color={Colors.textMuted} />
                          </Pressable>
                          <Pressable
                            onPress={() => handleDelete(note.id)}
                            hitSlop={8}
                            style={({ pressed }) => [tnStyles.noteActionBtn, pressed && { opacity: 0.6 }]}
                          >
                            <MaterialIcons name="delete-outline" size={13} color={Colors.error + 'CC'} />
                          </Pressable>
                        </Pressable>
                        {/* Expanded content */}
                        {!isNoteCollapsed ? (
                          <View style={tnStyles.noteBody}>
                            <Text style={tnStyles.noteText}>{note.note_text}</Text>
                            {note.transcript ? (
                              <View style={tnStyles.transcriptBadge}>
                                <MaterialIcons name="mic" size={11} color={Colors.primary} />
                                <Text style={tnStyles.transcriptText}>Voice transcribed</Text>
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const tnStyles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.secondary + '15', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.secondary + '40',
  },
  addBtnText: { fontSize: 11, fontWeight: '700', color: Colors.secondary, includeFontPadding: false },
  composeCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, borderWidth: 1.5,
    borderColor: Colors.secondary + '40', overflow: 'hidden',
  },
  composeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.secondary + '08',
  },
  composeTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.secondary, includeFontPadding: false },
  textarea: {
    minHeight: 100, backgroundColor: 'transparent', color: Colors.textPrimary,
    fontSize: Typography.fontSizes.sm, lineHeight: Typography.fontSizes.sm * 1.6,
    padding: Spacing.md, textAlignVertical: 'top',
  },
  voiceRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  voiceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.lg,
    paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1,
  },
  voiceBtnText: { fontSize: 11, fontWeight: '700', includeFontPadding: false },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error },
  saveBtn: {
    marginLeft: 'auto' as any, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.secondary, borderRadius: Radius.lg,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  saveBtnText: { fontSize: 12, fontWeight: '800', color: '#08091A', includeFontPadding: false },
  emptyNotes: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg,
    alignItems: 'center', gap: Spacing.sm,
  },
  emptyNotesText: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 18, includeFontPadding: false },
  monthBlock: { gap: 2 },
  monthHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  monthLabel: { fontSize: Typography.fontSizes.sm, fontWeight: '800', color: Colors.textPrimary, flex: 1, includeFontPadding: false },
  monthCount: { backgroundColor: Colors.secondary + '20', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  monthCountText: { fontSize: 10, fontWeight: '700', color: Colors.secondary, includeFontPadding: false },
  dayBlock: { paddingLeft: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 3 },
  dayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.secondary + '80', flexShrink: 0 },
  dayLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.textSecondary, includeFontPadding: false },
  noteCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, overflow: 'hidden',
  },
  noteHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  noteTime: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', width: 48, includeFontPadding: false },
  notePreview: { flex: 1, fontSize: 12, color: Colors.textSecondary, includeFontPadding: false },
  noteActionBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  noteBody: { paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2, borderTopWidth: 1, borderTopColor: Colors.border },
  noteText: { fontSize: Typography.fontSizes.sm, color: Colors.textPrimary, lineHeight: Typography.fontSizes.sm * 1.65, includeFontPadding: false },
  transcriptBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
    backgroundColor: Colors.primarySoft, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start',
  },
  transcriptText: { fontSize: 10, color: Colors.primary, fontWeight: '600', includeFontPadding: false },
});

// ─── Intake sub-components ────────────────────────────────────────────────────────
function IntakeMeter({ label, score, max, color, sublabel }: { label: string; score: number; max: number; color: string; sublabel: string }) {
  const pct = Math.min((score / max) * 100, 100);
  return (
    <View style={intakeStyles.meterRow}>
      <View style={intakeStyles.meterLeft}>
        <Text style={intakeStyles.meterLabel}>{label}</Text>
        <Text style={[intakeStyles.meterSublabel, { color }]}>{sublabel}</Text>
      </View>
      <View style={intakeStyles.meterRight}>
        <View style={intakeStyles.meterTrack}>
          <View style={[intakeStyles.meterFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
        <Text style={[intakeStyles.meterScore, { color }]}>{score}/{max}</Text>
      </View>
    </View>
  );
}

function IntakeChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={intakeStyles.chip}>
      <MaterialIcons name={icon as any} size={10} color={Colors.textMuted} />
      <Text style={intakeStyles.chipText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const intakeStyles = StyleSheet.create({
  completedAt: { fontSize: 9, color: Colors.textMuted, marginLeft: 'auto', includeFontPadding: false } as any,
  flagCard: { backgroundColor: Colors.warning + '10', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.warning + '30', gap: 6 },
  flagHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  flagTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.warning, includeFontPadding: false },
  flagRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  flagText: { flex: 1, fontSize: 11, lineHeight: 16, includeFontPadding: false },
  metersCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  meterLeft: { width: 72 },
  meterRight: { flex: 1, gap: 3 },
  meterLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  meterSublabel: { fontSize: 9, fontWeight: '600', includeFontPadding: false },
  meterTrack: { height: 7, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: Radius.full },
  meterScore: { fontSize: 9, fontWeight: '700', includeFontPadding: false },
  blockCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  blockLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, includeFontPadding: false },
  blockValue: { fontSize: Typography.fontSizes.sm, color: Colors.textPrimary, lineHeight: Typography.fontSizes.sm * 1.55, includeFontPadding: false },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border },
  chipText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600', includeFontPadding: false, maxWidth: 140 },
  areaChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: 4 },
  areaChip: { paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.full, backgroundColor: Colors.primarySoft, borderWidth: 1, borderColor: Colors.primary + '40' },
  areaChipText: { fontSize: 10, color: Colors.primary, fontWeight: '600', includeFontPadding: false },
});

function MiniStat({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={msStyles.wrap}>
      <MaterialIcons name={icon as any} size={14} color={color} />
      <Text style={[msStyles.value, { color }]}>{value}</Text>
      <Text style={msStyles.label}>{label}</Text>
    </View>
  );
}
const msStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 2, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  value: { fontSize: Typography.fontSizes.md, fontWeight: '900', includeFontPadding: false },
  label: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', includeFontPadding: false },
});

function InvField({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize }: any) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textSecondary, includeFontPadding: false }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 10, color: Colors.textPrimary, fontSize: Typography.fontSizes.sm, minHeight: 44 }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  headerSub: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  addIconBtn: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary + '40' },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.primarySoft, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  proBadgeText: { fontSize: 9, color: Colors.primary, fontWeight: '700', includeFontPadding: false },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingTop: Spacing['3xl'] },
  loadingText: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, includeFontPadding: false },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  inviteCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primary + '40', gap: Spacing.md, marginBottom: Spacing.xl, ...Shadows.sm },
  inviteTitle: { fontSize: Typography.fontSizes.lg, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  inviteSub: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  inviteBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 13, alignItems: 'center' },
  inviteBtnText: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: '#08091A', includeFontPadding: false },
  section: { marginBottom: Spacing.xl, gap: Spacing.md },
  overdueSection: { marginBottom: Spacing.xl, gap: Spacing.md },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
  clientCard: { flexDirection: 'column', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm, gap: 0 },
  clientCardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  clientAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  clientAvatarText: { fontSize: Typography.fontSizes.xl, fontWeight: '700', includeFontPadding: false },
  clientNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  clientName: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: Colors.textPrimary, flex: 1, includeFontPadding: false },
  clientEmail: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  clientMetaRow: { flexDirection: 'row', gap: Spacing.md, marginTop: 3 },
  clientMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  clientMetaText: { fontSize: 10, color: Colors.textMuted, includeFontPadding: false },
  clientRight: { alignItems: 'flex-end', gap: 4 },
  clientRightActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  notifyToggleBtn: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  clientScoreWrap: { alignItems: 'center' },
  clientScore: { fontSize: Typography.fontSizes.lg, fontWeight: '900', includeFontPadding: false },
  clientScoreSub: { fontSize: 9, color: Colors.textMuted, includeFontPadding: false },
  overdueChip: { backgroundColor: Colors.error + '20', paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full, marginRight: 4 },
  overdueChipText: { fontSize: 10, color: Colors.error, fontWeight: '700', includeFontPadding: false },
  pendingInfoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.warning + '10', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.warning + '30', marginBottom: Spacing.sm },
  pendingInfoText: { flex: 1, fontSize: Typography.fontSizes.xs, color: Colors.warning, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.md },
  pendingExplain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  pendingExplainText: { flex: 1, fontSize: 10, color: Colors.textMuted, includeFontPadding: false },
  remindBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.warning, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 8, minWidth: 120, justifyContent: 'center' },
  remindBtnText: { fontSize: 11, fontWeight: '700', color: '#08091A', includeFontPadding: false },
  emptyCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: Typography.fontSizes.lg, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  emptyText: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false },
  // Detail styles
  miniChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 72, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, paddingTop: 20 },
  miniChartCol: { flex: 1, alignItems: 'center', gap: 3 },
  miniChartScore: { fontSize: 8, color: Colors.textMuted, fontWeight: '600', includeFontPadding: false },
  miniChartBar: { width: '80%', borderRadius: 3, minHeight: 3 },
  miniChartDay: { fontSize: 8, color: Colors.textMuted, includeFontPadding: false },
  notesCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.secondary + '30' },
  notesText: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.7, includeFontPadding: false },
  entriesList: { gap: Spacing.sm },
  entryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  entryScoreBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, flexShrink: 0 },
  entryScoreEmoji: { fontSize: 12 },
  entryScore: { fontSize: Typography.fontSizes.sm, fontWeight: '900', includeFontPadding: false },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  entryDate: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  entryTime: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  entryTagPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full },
  entryTagEmoji: { fontSize: 11 },
  entryTagLabel: { fontSize: 10, fontWeight: '600', includeFontPadding: false },
  entryJournal: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', lineHeight: 16, marginTop: 3, includeFontPadding: false },
});
