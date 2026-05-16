/**
 * Accountability Buddy screen
 * - View your buddies list
 * - Add new buddies
 * - Accept/decline incoming requests
 * - See which tracked people you monitor
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  AccountabilityBuddy,
  getMyBuddies,
  addBuddy,
  removeBuddy,
  toggleBuddyNotifications,
  getIncomingBuddyRequests,
  respondToBuddyRequest,
  getPeopleIMonitor,
} from '@/services/accountability';
import {
  TherapistClient,
  getMyTherapistLinks,
  respondToTherapistInvite,
} from '@/services/therapist';
import { useApp } from '@/hooks/useApp';
import { isOwnerEmail } from '@/constants/config';

type Tab = 'my_buddies' | 'incoming' | 'i_monitor';

const FREE_BUDDY_LIMIT = 1;

export default function AccountabilityScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const { subscriptionTier } = useApp();
  const isOwner = isOwnerEmail(user?.email);
  const isProOrTherapist = subscriptionTier === 'pro' || subscriptionTier === 'therapist_pro' || isOwner;

  const [tab, setTab] = useState<Tab>('my_buddies');
  const [myBuddies, setMyBuddies] = useState<AccountabilityBuddy[]>([]);
  const [incoming, setIncoming] = useState<AccountabilityBuddy[]>([]);
  const [iMonitor, setIMonitor] = useState<AccountabilityBuddy[]>([]);
  const [therapistInvites, setTherapistInvites] = useState<TherapistClient[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addHours, setAddHours] = useState('24');
  const [adding, setAdding] = useState(false);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [buddies, inc, mon, therapistLinks] = await Promise.all([
        getMyBuddies(user.id),
        getIncomingBuddyRequests(user.id, user.email),
        getPeopleIMonitor(user.id),
        getMyTherapistLinks(user.id, user.email),
      ]);
      setMyBuddies(buddies);
      setIncoming(inc);
      setIMonitor(mon);
      setTherapistInvites(therapistLinks);
    } catch (e: any) {
      showAlert('Load error', e.message ?? 'Could not load buddy data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [user]);

  const handleAdd = async () => {
    if (!user) return;
    const email = addEmail.trim();
    if (!email || !email.includes('@')) {
      showAlert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    const hours = parseInt(addHours, 10);
    if (isNaN(hours) || hours < 1 || hours > 168) {
      showAlert('Invalid hours', 'Notify after must be between 1 and 168 hours.');
      return;
    }
    // Free tier: max 1 buddy
    const activeBuddies = myBuddies.filter(b => b.status !== 'removed');
    if (!isProOrTherapist && activeBuddies.length >= FREE_BUDDY_LIMIT) {
      showAlert('Pro feature', 'Free accounts can have 1 accountability buddy. Upgrade to Pro for unlimited buddies.');
      return;
    }
    setAdding(true);
    try {
      await addBuddy(user.id, email, addName, hours);
      setAddEmail(''); setAddName(''); setAddHours('24');
      setShowAdd(false);
      await loadAll();
      showAlert('Buddy added', 'Your buddy will be notified when you have the app — push notifications are sent if they have MyMoodMap installed.');
    } catch (e: any) {
      showAlert('Error', e.message ?? 'Could not add buddy.');
    } finally {
      setAdding(false);
    }
  };

  // Toggle notifications for rows where I am the watcher (i_monitor tab)
  const handleToggleMonitorNotifications = async (row: AccountabilityBuddy) => {
    const current = row.notifications_enabled ?? true;
    const next = !current;
    // Optimistic UI update
    setIMonitor(prev => prev.map(r => r.id === row.id ? { ...r, notifications_enabled: next } : r));
    try {
      await toggleBuddyNotifications(row.id, next);
    } catch (e: any) {
      // Revert on failure
      setIMonitor(prev => prev.map(r => r.id === row.id ? { ...r, notifications_enabled: !next } : r));
      showAlert('Error', e.message ?? 'Could not update notification setting.');
    }
  };

  const handleRemove = (buddy: AccountabilityBuddy) => {
    showAlert(
      'Remove buddy?',
      `${buddy.buddy_name ?? buddy.buddy_email} will no longer receive notifications about your logging.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            await removeBuddy(buddy.id);
            await loadAll();
          },
        },
      ],
    );
  };

  const handleRespond = async (req: AccountabilityBuddy, accept: boolean) => {
    await respondToBuddyRequest(req.id, accept);
    await loadAll();
  };

  const handleRespondTherapist = async (invite: TherapistClient, accept: boolean) => {
    await respondToTherapistInvite(invite.id, accept);
    await loadAll();
    if (accept) {
      showAlert('Connected!', 'You are now connected with your therapist. They can view your mood data to support your care.');
    }
  };

  const statusColor = (s: string) => {
    if (s === 'active') return Colors.success;
    if (s === 'declined' || s === 'removed') return Colors.error;
    return Colors.warning;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Accountability Buddy</Text>
          <Text style={styles.headerSub}>Get notified when someone misses their log</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {([
          { key: 'my_buddies', label: 'Add Buddies', count: myBuddies.filter(b => b.status !== 'removed').length },
          { key: 'incoming', label: 'Requests', count: incoming.filter(b => b.status === 'pending').length + therapistInvites.filter(t => t.status === 'pending').length },
          { key: 'i_monitor', label: 'My Buddies', count: iMonitor.length },
        ] as { key: Tab; label: string; count: number }[]).map(t => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            {t.count > 0 ? (
              <View style={[styles.tabBadge, tab === t.key && { backgroundColor: Colors.primary }]}>
                <Text style={[styles.tabBadgeText, tab === t.key && { color: '#08091A' }]}>{t.count}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── MY BUDDIES ── */}
          {tab === 'my_buddies' ? (
            <>
              <View style={styles.infoCard}>
                <MaterialIcons name="info-outline" size={14} color={Colors.primary} />
                <Text style={styles.infoText}>
                  Your buddy gets a push notification if you have not logged in the specified window. They must also have MyMoodMap installed. Free accounts include 1 buddy slot.
                </Text>
              </View>

              {/* Free tier limit banner */}
              {!isProOrTherapist ? (
                <View style={styles.freeBanner}>
                  <MaterialIcons name="group" size={14} color={Colors.primary} />
                  <Text style={styles.freeBannerText}>
                    Free: 1 buddy included · <Text style={styles.freeBannerLink} onPress={() => router.push('/(tabs)/profile' as any)}>Upgrade to Pro</Text> for unlimited
                  </Text>
                </View>
              ) : null}

              {/* Add buddy */}
              {!showAdd ? (
                <Pressable
                  onPress={() => {
                    const activeBuddies = myBuddies.filter(b => b.status !== 'removed');
                    if (!isProOrTherapist && activeBuddies.length >= FREE_BUDDY_LIMIT) {
                      showAlert('Upgrade to Pro', 'Free accounts can have 1 accountability buddy. Upgrade to Pro from the Me tab for unlimited buddies.');
                      return;
                    }
                    setShowAdd(true);
                  }}
                  style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
                >
                  <MaterialIcons name="person-add" size={20} color="#08091A" />
                  <Text style={styles.addBtnText}>Add accountability buddy</Text>
                </Pressable>
              ) : (
                <View style={styles.addCard}>
                  <Text style={styles.addCardTitle}>Add a buddy</Text>
                  <Text style={styles.addCardSub}>They need MyMoodMap installed to receive push alerts.</Text>

                  <AddField label="Buddy's email *" value={addEmail} onChangeText={setAddEmail}
                    keyboardType="email-address" autoCapitalize="none" placeholder="friend@example.com" />
                  <AddField label="Buddy's name (optional)" value={addName} onChangeText={setAddName}
                    placeholder="Jane Doe" />
                  <AddField label="Notify after (hours)" value={addHours} onChangeText={setAddHours}
                    keyboardType="numeric" placeholder="24" />

                  <View style={styles.addCardBtns}>
                    <Pressable
                      onPress={() => { setShowAdd(false); setAddEmail(''); setAddName(''); }}
                      style={styles.cancelBtn}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleAdd}
                      disabled={adding}
                      style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }, adding && { opacity: 0.6 }]}
                    >
                      {adding ? <ActivityIndicator color="#08091A" size="small" /> : <Text style={styles.saveBtnText}>Add buddy</Text>}
                    </Pressable>
                  </View>
                </View>
              )}

              {myBuddies.filter(b => b.status !== 'removed').length === 0 ? (
                <EmptyState icon="group" message="No buddies yet. Add someone who will hold you accountable for daily mood logging." />
              ) : (
                <View style={styles.list}>
                  {myBuddies.filter(b => b.status !== 'removed').map(buddy => (
                    <View key={buddy.id} style={styles.buddyCard}>
                      <View style={styles.buddyAvatar}>
                        <Text style={styles.buddyAvatarText}>
                          {(buddy.buddy_name ?? buddy.buddy_email)[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.buddyName}>{buddy.buddy_name ?? buddy.buddy_email}</Text>
                        {buddy.buddy_name ? <Text style={styles.buddyEmail}>{buddy.buddy_email}</Text> : null}
                        <Text style={styles.buddyMeta}>Notify after {buddy.notify_after_hours}h of no logging</Text>
                      </View>
                      <View style={styles.buddyRight}>
                        <View style={[styles.statusPill, { backgroundColor: statusColor(buddy.status) + '20' }]}>
                          <Text style={[styles.statusText, { color: statusColor(buddy.status) }]}>
                            {buddy.status}
                          </Text>
                        </View>
                        <Pressable onPress={() => handleRemove(buddy)} hitSlop={8}>
                          <MaterialIcons name="close" size={18} color={Colors.textMuted} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : null}

          {/* ── INCOMING REQUESTS ── */}
          {tab === 'incoming' ? (
            <>
              {/* Therapist invites — shown first, prominently */}
              {therapistInvites.filter(t => t.status === 'pending').length > 0 ? (
                <View style={{ marginBottom: Spacing.xl }}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="psychology" size={14} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>Therapist Connection Request</Text>
                  </View>
                  <View style={styles.therapistInfoCard}>
                    <MaterialIcons name="info-outline" size={13} color={Colors.primary} />
                    <Text style={styles.therapistInfoText}>
                      Your therapist has sent you an invite to connect on MyMoodMapp. Accepting allows them to view your mood logs and wellness data to support your care.
                    </Text>
                  </View>
                  {therapistInvites.filter(t => t.status === 'pending').map(invite => (
                    <View key={invite.id} style={[styles.buddyCard, { borderColor: Colors.primary + '50', borderWidth: 1.5 }]}>
                      <View style={[styles.buddyAvatar, { backgroundColor: Colors.primary + '20' }]}>
                        <MaterialIcons name="psychology" size={22} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.buddyName}>{invite.client_name ? `Therapist invite for ${invite.client_name}` : 'Therapist invite'}</Text>
                        <Text style={styles.buddyMeta}>From: {invite.client_email}</Text>
                        <Text style={[styles.buddyMeta, { color: Colors.primary }]}>Therapist wants to connect with you</Text>
                      </View>
                      <View style={styles.respondBtns}>
                        <Pressable onPress={() => handleRespondTherapist(invite, false)} style={styles.declineBtn}>
                          <Text style={styles.declineBtnText}>Decline</Text>
                        </Pressable>
                        <Pressable onPress={() => handleRespondTherapist(invite, true)} style={[styles.acceptBtn, { backgroundColor: Colors.primary }]}>
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Accountability buddy requests */}
              {incoming.length === 0 && therapistInvites.filter(t => t.status === 'pending').length === 0 ? (
                <EmptyState icon="notifications-none" message="No pending requests. When someone adds you as their accountability buddy or a therapist sends you an invite, it will appear here." />
              ) : incoming.length > 0 ? (
                <View style={styles.list}>
                  {incoming.map(req => (
                    <View key={req.id} style={styles.buddyCard}>
                      <View style={[styles.buddyAvatar, { backgroundColor: Colors.secondary + '30' }]}>
                        <Text style={[styles.buddyAvatarText, { color: Colors.secondary }]}>
                          {req.buddy_email[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.buddyName}>{req.buddy_email}</Text>
                        <Text style={styles.buddyMeta}>Wants you as their accountability buddy</Text>
                        <Text style={styles.buddyMeta}>Notify after {req.notify_after_hours}h window</Text>
                      </View>
                      {req.status === 'pending' ? (
                        <View style={styles.respondBtns}>
                          <Pressable onPress={() => handleRespond(req, false)} style={styles.declineBtn}>
                            <Text style={styles.declineBtnText}>Decline</Text>
                          </Pressable>
                          <Pressable onPress={() => handleRespond(req, true)} style={styles.acceptBtn}>
                            <Text style={styles.acceptBtnText}>Accept</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={[styles.statusPill, { backgroundColor: statusColor(req.status) + '20' }]}>
                          <Text style={[styles.statusText, { color: statusColor(req.status) }]}>{req.status}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {/* ── I MONITOR ── */}
          {tab === 'i_monitor' ? (
            <>
              <View style={styles.infoCard}>
                <MaterialIcons name="info-outline" size={14} color={Colors.primary} />
                <Text style={styles.infoText}>
                  These are people who have added you as their accountability buddy. You receive a push notification if they miss a log within their alert window. Tap the bell icon to mute or unmute alerts for each person.
                </Text>
              </View>
              {iMonitor.length === 0 ? (
                <EmptyState icon="visibility" message="Nobody has added you as their buddy yet. Share your email with friends who want to stay accountable." />
              ) : (
                <View style={styles.list}>
                  {iMonitor.map(person => {
                    const isPending = person.status === 'pending';
                    const rowColor = isPending ? Colors.warning : Colors.success;
                    return (
                      <View key={person.id} style={[styles.buddyCard, { borderColor: rowColor + '30' }]}>
                        <View style={[styles.buddyAvatar, { backgroundColor: rowColor + '20' }]}>
                          <Text style={[styles.buddyAvatarText, { color: rowColor }]}>
                            {person.buddy_email[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.buddyName}>{person.buddy_email}</Text>
                          <Text style={styles.buddyMeta}>
                            {isPending ? 'Waiting for your acceptance' : 'You are their accountability buddy'}
                          </Text>
                          <Text style={styles.buddyMeta}>Alert window: {person.notify_after_hours}h</Text>
                          {person.last_notified_at ? (
                            <Text style={styles.buddyMeta}>
                              Last alert: {new Date(person.last_notified_at).toLocaleDateString()}
                            </Text>
                          ) : null}
                        </View>
                        {isPending ? (
                          <View style={styles.respondBtns}>
                            <Pressable onPress={() => handleRespond(person, false)} style={styles.declineBtn}>
                              <Text style={styles.declineBtnText}>Decline</Text>
                            </Pressable>
                            <Pressable onPress={() => handleRespond(person, true)} style={styles.acceptBtn}>
                              <Text style={styles.acceptBtnText}>Accept</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => handleToggleMonitorNotifications(person)}
                            hitSlop={8}
                            accessibilityLabel={(person.notifications_enabled ?? true) ? 'Mute alerts for this person' : 'Enable alerts for this person'}
                          >
                            <MaterialIcons
                              name={(person.notifications_enabled ?? true) ? 'notifications-active' : 'notifications-off'}
                              size={20}
                              color={(person.notifications_enabled ?? true) ? Colors.success : Colors.textMuted}
                            />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function AddField({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize }: any) {
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

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={styles.emptyCard}>
      <MaterialIcons name={icon as any} size={36} color={Colors.textMuted} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  headerTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  headerSub: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: Typography.fontSizes.xs, fontWeight: '600', color: Colors.textMuted, includeFontPadding: false },
  tabTextActive: { color: Colors.primary },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, includeFontPadding: false },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, includeFontPadding: false },
  freeBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primarySoft, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '30', marginBottom: Spacing.md },
  freeBannerText: { flex: 1, fontSize: Typography.fontSizes.xs, color: Colors.primary, includeFontPadding: false },
  freeBannerLink: { fontWeight: '700', textDecorationLine: 'underline' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.primarySoft, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '30', marginBottom: Spacing.lg },
  infoText: { flex: 1, fontSize: Typography.fontSizes.xs, color: Colors.primary, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.xl, paddingVertical: 14, marginBottom: Spacing.lg },
  addBtnText: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: '#08091A', includeFontPadding: false },
  addCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md, marginBottom: Spacing.lg, ...Shadows.sm },
  addCardTitle: { fontSize: Typography.fontSizes.lg, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  addCardSub: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  addCardBtns: { flexDirection: 'row', gap: Spacing.md },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, fontWeight: '600', includeFontPadding: false },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: Radius.lg, backgroundColor: Colors.primary },
  saveBtnText: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: '#08091A', includeFontPadding: false },
  list: { gap: Spacing.md },
  buddyCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  buddyAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '25', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  buddyAvatarText: { fontSize: Typography.fontSizes.lg, fontWeight: '700', color: Colors.primary, includeFontPadding: false },
  buddyName: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  buddyEmail: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  buddyMeta: { fontSize: Typography.fontSizes.xs, color: Colors.textSecondary, includeFontPadding: false },
  buddyRight: { alignItems: 'flex-end', gap: Spacing.sm },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize', includeFontPadding: false },
  respondBtns: { flexDirection: 'column', gap: Spacing.xs },
  declineBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  declineBtnText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', includeFontPadding: false },
  acceptBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.success, alignItems: 'center' },
  acceptBtnText: { fontSize: 11, color: '#08091A', fontWeight: '700', includeFontPadding: false },
  emptyCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  emptyText: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
  therapistInfoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.primarySoft, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '30', marginBottom: Spacing.md },
  therapistInfoText: { flex: 1, fontSize: Typography.fontSizes.xs, color: Colors.primary, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
});
