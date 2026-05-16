/**
 * NotificationScheduler component
 * Full UI for managing check-in reminders and weekly recap notification.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DarkColors, Typography, Spacing, Radius } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import * as Notifications from 'expo-notifications';
import {
  NotificationSettings,
  ReminderTime,
  loadNotificationSettings,
  saveNotificationSettings,
  syncReminders,
  syncWeeklyRecap,
  requestNotificationPermissions,
  getNotificationPermissionStatus,
  formatTime,
  generateReminderId,
  PRESET_REMINDERS,
  buildWeeklyRecapSummary,
  registerCheckinCategory,
  CHECKIN_CATEGORY_ID,
} from '@/services/notifications';
import { useApp } from '@/hooks/useApp';
import { summarizeFitnessData, getDateRangeFitness } from '@/services/fitness';

interface Props {
  onSettingsChange?: (settings: NotificationSettings) => void;
}

function makeStyles(C: typeof DarkColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: C.surfaceElevated,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.lg,
    },
    loadingText: {
      fontSize: Typography.fontSizes.sm,
      color: C.textMuted,
      includeFontPadding: false,
    },
    masterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.lg,
    },
    weeklyRecapRow: {
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    masterLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      flex: 1,
    },
    masterIcon: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    masterLabel: {
      fontSize: Typography.fontSizes.md,
      fontWeight: Typography.fontWeights.semibold,
      color: C.textPrimary,
      includeFontPadding: false,
    },
    masterSubtitle: {
      fontSize: Typography.fontSizes.xs,
      color: C.textMuted,
      marginTop: 2,
      includeFontPadding: false,
    },
    masterRight: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
    },
    weeklyPreviewCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      backgroundColor: C.secondarySoft,
      borderRadius: Radius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: C.secondary + '30',
    },
    weeklyPreviewText: {
      flex: 1,
      fontSize: Typography.fontSizes.xs,
      color: C.secondary,
      lineHeight: Typography.fontSizes.xs * 1.6,
      includeFontPadding: false,
    },
    permWarning: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      backgroundColor: C.warning + '15',
      borderRadius: Radius.md,
      padding: Spacing.md,
    },
    permWarningText: {
      flex: 1,
      fontSize: Typography.fontSizes.xs,
      color: C.warning,
      lineHeight: Typography.fontSizes.xs * 1.6,
      includeFontPadding: false,
    },
    reminderList: {
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    emptyReminders: {
      padding: Spacing.lg,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: Typography.fontSizes.sm,
      color: C.textMuted,
      includeFontPadding: false,
    },
    reminderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    reminderRowFirst: {
      borderTopWidth: 0,
    },
    reminderRowDisabled: {
      opacity: 0.5,
    },
    reminderTimeBlock: {
      flex: 1,
      gap: 2,
      minHeight: 44,
      justifyContent: 'center',
    },
    reminderTime: {
      fontSize: Typography.fontSizes.xl,
      fontWeight: Typography.fontWeights.semibold,
      color: C.textPrimary,
      includeFontPadding: false,
    },
    reminderLabel: {
      fontSize: Typography.fontSizes.xs,
      color: C.textMuted,
      includeFontPadding: false,
    },
    reminderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    deleteBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      padding: Spacing.lg,
      paddingBottom: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    addBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: 10,
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      borderColor: C.primary + '60',
      borderStyle: 'dashed',
      minHeight: 44,
    },
    addBtnSecondary: {
      borderColor: C.secondary + '60',
    },
    addBtnText: {
      fontSize: Typography.fontSizes.sm,
      fontWeight: Typography.fontWeights.semibold,
      color: C.primary,
      includeFontPadding: false,
    },
    repeatNote: {
      fontSize: Typography.fontSizes.xs,
      color: C.textMuted,
      textAlign: 'center',
      paddingBottom: Spacing.md,
      includeFontPadding: false,
    },
    watchCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
      margin: Spacing.lg,
      marginBottom: 0,
      backgroundColor: C.secondary + '12',
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: C.secondary + '40',
    },
    watchIconWrap: {
      width: 36,
      height: 36,
      borderRadius: Radius.md,
      backgroundColor: C.secondary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginTop: 1,
    },
    watchTitle: {
      fontSize: Typography.fontSizes.sm,
      fontWeight: Typography.fontWeights.semibold,
      color: C.textPrimary,
      includeFontPadding: false,
    },
    watchBody: {
      fontSize: Typography.fontSizes.xs,
      color: C.textSecondary,
      lineHeight: Typography.fontSizes.xs * 1.6,
      includeFontPadding: false,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      padding: Spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
      borderTopWidth: 1,
      borderColor: C.border,
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: C.border,
      borderRadius: Radius.full,
      alignSelf: 'center',
      marginBottom: Spacing.lg,
    },
    modalTitle: {
      fontSize: Typography.fontSizes.xl,
      fontWeight: Typography.fontWeights.bold,
      color: C.textPrimary,
      textAlign: 'center',
      marginBottom: Spacing.xl,
      includeFontPadding: false,
    },
    timePickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    timeColumn: {
      width: 120,
      alignItems: 'center',
      gap: Spacing.xs,
    },
    timeColumnLabel: {
      fontSize: Typography.fontSizes.xs,
      color: C.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      includeFontPadding: false,
    },
    timeScroll: {
      height: 176,
      width: '100%',
    },
    timeItem: {
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      marginVertical: 1,
    },
    timeItemSelected: {
      backgroundColor: C.primarySoft,
      borderWidth: 1,
      borderColor: C.primary + '50',
    },
    timeItemText: {
      fontSize: Typography.fontSizes.md,
      color: C.textSecondary,
      includeFontPadding: false,
    },
    timeItemTextSelected: {
      color: C.primary,
      fontWeight: Typography.fontWeights.bold,
    },
    timeSep: {
      fontSize: Typography.fontSizes['2xl'],
      fontWeight: Typography.fontWeights.bold,
      color: C.textMuted,
      marginTop: 20,
      includeFontPadding: false,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: C.primarySoft,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
    },
    previewText: {
      fontSize: Typography.fontSizes.xl,
      fontWeight: Typography.fontWeights.bold,
      color: C.primary,
      includeFontPadding: false,
    },
    previewSub: {
      fontSize: Typography.fontSizes.sm,
      color: C.textSecondary,
      includeFontPadding: false,
    },
    labelRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.xl,
      justifyContent: 'center',
    },
    labelChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceElevated,
      minHeight: 36,
      justifyContent: 'center',
    },
    labelChipSelected: {
      backgroundColor: C.primarySoft,
      borderColor: C.primary,
    },
    labelChipText: {
      fontSize: Typography.fontSizes.sm,
      color: C.textSecondary,
      includeFontPadding: false,
    },
    labelChipTextSelected: {
      color: C.primary,
      fontWeight: Typography.fontWeights.semibold,
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    modalCancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: Radius.lg,
      backgroundColor: C.surfaceElevated,
      borderWidth: 1,
      borderColor: C.border,
      minHeight: 52,
    },
    modalCancelText: {
      fontSize: Typography.fontSizes.md,
      color: C.textSecondary,
      fontWeight: Typography.fontWeights.medium,
      includeFontPadding: false,
    },
    modalSaveBtn: {
      flex: 2,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: Radius.lg,
      backgroundColor: C.primary,
      minHeight: 52,
    },
    modalSaveText: {
      fontSize: Typography.fontSizes.md,
      color: '#08091A',
      fontWeight: Typography.fontWeights.bold,
      includeFontPadding: false,
    },
  });
}

export function NotificationScheduler({ onSettingsChange }: Props) {
  const { moodLog, fitnessData, streak } = useApp();
  const { colors: C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: false,
    reminders: [],
    weeklyRecapEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [weeklyRecapSyncing, setWeeklyRecapSyncing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [firingTest, setFiringTest] = useState(false);
  const [testCountdown, setTestCountdown] = useState(0);
  const [editingReminder, setEditingReminder] = useState<ReminderTime | null>(null);
  const [pickerHour, setPickerHour] = useState(8);
  const [pickerMinute, setPickerMinute] = useState(0);
  const [pickerLabel, setPickerLabel] = useState('');

  useEffect(() => {
    const init = async () => {
      const [s, perm] = await Promise.all([
        loadNotificationSettings(),
        getNotificationPermissionStatus(),
        registerCheckinCategory(),
      ]);
      setSettings(s);
      setPermissionStatus(perm);
      setLoading(false);
    };
    init();
  }, []);

  const handleFireTest = async () => {
    if (Platform.OS === 'web') return;
    setFiringTest(true);
    const DELAY = 10;
    setTestCountdown(DELAY);
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✨ Vibe check',
          subtitle: 'How are you feeling?',
          body: "Tap 😊 Great, 😐 Okay, or 😔 Low to log instantly — or 📝 Full Log to open the app.",
          sound: true,
          categoryIdentifier: CHECKIN_CATEGORY_ID,
          ...(Platform.OS === 'ios' ? { relevanceScore: 0.85 } : {}),
          data: { screen: '/(tabs)/checkin', source: 'test' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: DELAY },
      });
      // Tick countdown so user knows how long they have to lock their phone
      let remaining = DELAY;
      const interval = setInterval(() => {
        remaining -= 1;
        setTestCountdown(remaining);
        if (remaining <= 0) clearInterval(interval);
      }, 1000);
    } catch (e) {
      console.warn('[testNotification]', e);
    } finally {
      setTimeout(() => { setFiringTest(false); setTestCountdown(0); }, (DELAY + 2) * 1000);
    }
  };

  const buildSummary = () => {
    try {
      const weekFitness = getDateRangeFitness(fitnessData, 7);
      const fitSummary = summarizeFitnessData(weekFitness);
      return buildWeeklyRecapSummary(moodLog, [], fitSummary.avgDailySteps, streak.current);
    } catch {
      return { topMood: 'calm', topMoodEmoji: '✨', topEmotion: 'neutral', topEmotionEmoji: '🔍', avgSteps: 0, streak: 0 };
    }
  };

  const applySettings = async (next: NotificationSettings) => {
    setSyncing(true);
    const synced = await syncReminders(next);
    setSettings(synced);
    onSettingsChange?.(synced);
    setSyncing(false);
  };

  const handleWeeklyRecapToggle = async (value: boolean) => {
    if (value && Platform.OS !== 'web' && permissionStatus !== 'granted') {
      const granted = await requestNotificationPermissions();
      setPermissionStatus(granted ? 'granted' : 'denied');
      if (!granted) return;
    }
    const next = { ...settings, weeklyRecapEnabled: value };
    setSettings(next);
    setWeeklyRecapSyncing(true);
    try {
      const summary = value ? buildSummary() : undefined;
      const synced = await syncWeeklyRecap(next, summary);
      setSettings(synced);
      onSettingsChange?.(synced);
    } catch {
      await saveNotificationSettings(next);
      onSettingsChange?.(next);
    } finally {
      setWeeklyRecapSyncing(false);
    }
  };

  const handleMasterToggle = async (value: boolean) => {
    if (value && permissionStatus !== 'granted') {
      const granted = await requestNotificationPermissions();
      setPermissionStatus(granted ? 'granted' : 'denied');
      if (!granted) return;
    }

    let reminders = settings.reminders;
    if (value && reminders.length === 0) {
      reminders = [{
        id: generateReminderId(),
        hour: 9,
        minute: 0,
        label: 'Morning check-in',
        enabled: true,
      }];
    }

    await applySettings({ ...settings, enabled: value, reminders });
  };

  const handleReminderToggle = async (id: string, enabled: boolean) => {
    const updated = {
      ...settings,
      reminders: settings.reminders.map(r => r.id === id ? { ...r, enabled } : r),
    };
    await applySettings(updated);
  };

  const handleDeleteReminder = async (id: string) => {
    const updated = {
      ...settings,
      reminders: settings.reminders.filter(r => r.id !== id),
    };
    await applySettings(updated);
  };

  const openAddReminder = () => {
    setEditingReminder(null);
    setPickerHour(9);
    setPickerMinute(0);
    setPickerLabel('');
    setShowTimePicker(true);
  };

  const openEditReminder = (reminder: ReminderTime) => {
    setEditingReminder(reminder);
    setPickerHour(reminder.hour);
    setPickerMinute(reminder.minute);
    setPickerLabel(reminder.label);
    setShowTimePicker(true);
  };

  const handleSaveReminder = async () => {
    const label = pickerLabel.trim() || formatTime(pickerHour, pickerMinute);

    let updatedReminders: ReminderTime[];
    if (editingReminder) {
      updatedReminders = settings.reminders.map(r =>
        r.id === editingReminder.id
          ? { ...r, hour: pickerHour, minute: pickerMinute, label }
          : r
      );
    } else {
      const newReminder: ReminderTime = {
        id: generateReminderId(),
        hour: pickerHour,
        minute: pickerMinute,
        label,
        enabled: true,
      };
      updatedReminders = [...settings.reminders, newReminder];
    }

    updatedReminders.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
    setShowTimePicker(false);
    await applySettings({ ...settings, reminders: updatedReminders });
  };

  const handleAddPresets = async () => {
    const existing = new Set(settings.reminders.map(r => `${r.hour}:${r.minute}`));
    const toAdd: ReminderTime[] = PRESET_REMINDERS
      .filter(p => !existing.has(`${p.hour}:${p.minute}`))
      .map(p => ({ ...p, id: generateReminderId() }));

    if (toAdd.length === 0) return;

    const merged = [...settings.reminders, ...toAdd]
      .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

    await applySettings({ ...settings, enabled: true, reminders: merged });
  };

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={C.primary} />
        <Text style={styles.loadingText}>Loading reminders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Apple Watch info card ── */}
      {Platform.OS === 'ios' ? (
        <View style={styles.watchCard}>
          <View style={styles.watchIconWrap}>
            <MaterialIcons name="watch" size={20} color={C.secondary} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.watchTitle}>Log directly from Apple Watch</Text>
            <Text style={styles.watchBody}>
              Every reminder shows action buttons on your Watch long-look and iPhone lock screen.
              {' '}<Text style={{ fontWeight: '700', color: C.warning }}>Tip:</Text>{' '}the Watch shows the notification when your iPhone screen is off — lock your phone first, then wait for the reminder.{' '}On Watch Series 9/Ultra 2, <Text style={{ fontWeight: '700' }}>Double Tap</Text> logs 😊 Great instantly.
            </Text>
            <View style={{ gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13 }}>😊</Text>
                <Text style={[styles.watchBody, { flex: 1 }]}>
                  <Text style={{ fontWeight: '700', color: C.success }}>Great</Text>
                  {' — '}
                  saves a high-energy entry instantly, no phone needed
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13 }}>😐</Text>
                <Text style={[styles.watchBody, { flex: 1 }]}>
                  <Text style={{ fontWeight: '700', color: C.warning }}>Okay</Text>
                  {' — '}
                  saves a neutral entry
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13 }}>😔</Text>
                <Text style={[styles.watchBody, { flex: 1 }]}>
                  <Text style={{ fontWeight: '700', color: C.error }}>Low</Text>
                  {' — '}
                  saves a low-energy entry
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13 }}>📝</Text>
                <Text style={[styles.watchBody, { flex: 1 }]}>
                  <Text style={{ fontWeight: '700', color: C.primary }}>Full Log</Text>
                  {' — '}
                  opens the detailed check-in screen on your phone
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13 }}>⏰</Text>
                <Text style={[styles.watchBody, { flex: 1 }]}>
                  <Text style={{ fontWeight: '700', color: C.secondary }}>Snooze 1h</Text>
                  {' — '}
                  re-fires the reminder 60 minutes later
                </Text>
              </View>
            </View>
            <Text style={[styles.watchBody, { marginTop: 2, opacity: 0.7 }]}>
              A confirmation notification is sent after every quick log so you know it saved.
            </Text>
            <View style={{ marginTop: 4, backgroundColor: C.warning + '18', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: C.warning + '40' }}>
              <Text style={[styles.watchBody, { color: C.warning, fontWeight: '700' }]}>⚠️ Watch setup checklist:</Text>
              <Text style={[styles.watchBody, { marginTop: 3 }]}>1. Open Watch app on iPhone → Notifications → find this app → enable "Mirror my iPhone"</Text>
              <Text style={[styles.watchBody, { marginTop: 2 }]}>2. When testing: tap the button below, then <Text style={{ fontWeight: '700', color: C.warning }}>immediately lock your iPhone</Text> — the Watch only receives it when the iPhone screen is OFF</Text>
              <Text style={[styles.watchBody, { marginTop: 2 }]}>3. On Watch, long-press (force-press) the notification to reveal action buttons</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* ── Test notification button ── */}
      {Platform.OS !== 'web' ? (
        <Pressable
          onPress={handleFireTest}
          disabled={firingTest}
          style={({ pressed }) => [{
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            gap: Spacing.sm,
            margin: Spacing.lg,
            marginBottom: 0,
            paddingVertical: 12,
            borderRadius: Radius.lg,
            backgroundColor: firingTest ? C.primarySoft : C.primary,
            borderWidth: 1,
            borderColor: C.primary,
            opacity: firingTest ? 0.7 : pressed ? 0.85 : 1,
            minHeight: 48,
          }]}
        >
          {firingTest
            ? <><ActivityIndicator size="small" color={testCountdown > 0 ? C.primary : C.background} /><Text style={{ fontSize: 14, fontWeight: '700', color: testCountdown > 0 ? C.primary : '#08091A', includeFontPadding: false }}>{testCountdown > 0 ? `🔒 Lock your phone now! (${testCountdown}s)` : 'Sending…'}</Text></>
            : <><MaterialIcons name="notifications-active" size={18} color="#08091A" /><Text style={{ fontSize: 14, fontWeight: '700', color: '#08091A', includeFontPadding: false }}>Send test notification</Text></>}
        </Pressable>
      ) : null}

      {/* ── Daily check-in toggle ── */}
      <View style={styles.masterRow}>
        <View style={styles.masterLeft}>
          <View style={[styles.masterIcon, { backgroundColor: settings.enabled ? C.primarySoft : C.surfaceElevated }]}>
            <MaterialIcons
              name="notifications"
              size={20}
              color={settings.enabled ? C.primary : C.textMuted}
            />
          </View>
          <View>
            <Text style={styles.masterLabel}>Check-in reminders</Text>
            <Text style={styles.masterSubtitle}>
              {settings.enabled
                ? `${settings.reminders.filter(r => r.enabled).length} active reminder${settings.reminders.filter(r => r.enabled).length !== 1 ? 's' : ''}`
                : 'Tap to enable notifications'}
            </Text>
          </View>
        </View>
        <View style={styles.masterRight}>
          {syncing ? <ActivityIndicator size="small" color={C.primary} style={{ marginRight: 8 }} /> : null}
          <Switch
            value={settings.enabled}
            onValueChange={handleMasterToggle}
            trackColor={{ true: C.primary, false: C.border }}
            thumbColor={C.textPrimary}
            disabled={syncing}
          />
        </View>
      </View>

      {/* ── Weekly recap toggle ── */}
      <View style={[styles.masterRow, styles.weeklyRecapRow]}>
        <View style={styles.masterLeft}>
          <View style={[styles.masterIcon, { backgroundColor: settings.weeklyRecapEnabled ? C.secondarySoft : C.surfaceElevated }]}>
            <MaterialIcons
              name="calendar-today"
              size={20}
              color={settings.weeklyRecapEnabled ? C.secondary : C.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.masterLabel}>Weekly recap</Text>
            <Text style={styles.masterSubtitle} numberOfLines={2}>
              {settings.weeklyRecapEnabled
                ? 'Sundays at 7:00 PM · mood, emotion, steps & streak'
                : 'Sunday evening summary of your week'}
            </Text>
          </View>
        </View>
        <View style={styles.masterRight}>
          {weeklyRecapSyncing ? <ActivityIndicator size="small" color={C.secondary} style={{ marginRight: 8 }} /> : null}
          <Switch
            value={settings.weeklyRecapEnabled}
            onValueChange={handleWeeklyRecapToggle}
            trackColor={{ true: C.secondary, false: C.border }}
            thumbColor={C.textPrimary}
            disabled={weeklyRecapSyncing}
          />
        </View>
      </View>

      {/* Weekly recap preview card */}
      {settings.weeklyRecapEnabled ? (
        <View style={styles.weeklyPreviewCard}>
          <MaterialIcons name="auto-awesome" size={13} color={C.secondary} />
          <Text style={styles.weeklyPreviewText}>
            {Platform.OS === 'web'
              ? 'Weekly recap is saved. On mobile devices this sends a push notification every Sunday at 7:00 PM with your mood summary, avg steps and streak.'
              : 'Every Sunday at 7:00 PM you will receive a push notification summarising your top mood, average step count and current streak — tapping it opens the weekly Insights report.'}
          </Text>
        </View>
      ) : null}

      {/* Permission denied warning */}
      {permissionStatus === 'denied' ? (
        <View style={styles.permWarning}>
          <MaterialIcons name="warning-amber" size={15} color={C.warning} />
          <Text style={styles.permWarningText}>
            Notification permission is blocked. Enable it in your device Settings to use reminders.
          </Text>
        </View>
      ) : null}

      {/* ── Reminder list ── */}
      {settings.enabled ? (
        <View style={styles.reminderList}>
          {settings.reminders.length === 0 ? (
            <View style={styles.emptyReminders}>
              <Text style={styles.emptyText}>No reminders yet. Add one below.</Text>
            </View>
          ) : (
            settings.reminders.map((reminder, index) => (
              <View
                key={reminder.id}
                style={[
                  styles.reminderRow,
                  index === 0 && styles.reminderRowFirst,
                  !reminder.enabled && styles.reminderRowDisabled,
                ]}
              >
                <Pressable
                  onPress={() => openEditReminder(reminder)}
                  style={styles.reminderTimeBlock}
                  hitSlop={8}
                >
                  <Text style={[styles.reminderTime, !reminder.enabled && { color: C.textMuted }]}>
                    {formatTime(reminder.hour, reminder.minute)}
                  </Text>
                  <Text style={styles.reminderLabel}>{reminder.label}</Text>
                </Pressable>

                <View style={styles.reminderActions}>
                  <Switch
                    value={reminder.enabled}
                    onValueChange={(v) => handleReminderToggle(reminder.id, v)}
                    trackColor={{ true: C.primary, false: C.border }}
                    thumbColor={C.textPrimary}
                    disabled={syncing}
                  />
                  <Pressable
                    onPress={() => handleDeleteReminder(reminder.id)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
                  >
                    <MaterialIcons name="close" size={16} color={C.textMuted} />
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <View style={styles.addRow}>
            <Pressable
              onPress={openAddReminder}
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.75 }]}
            >
              <MaterialIcons name="add" size={16} color={C.primary} />
              <Text style={styles.addBtnText}>Add reminder</Text>
            </Pressable>

            {settings.reminders.length === 0 ? (
              <Pressable
                onPress={handleAddPresets}
                style={({ pressed }) => [styles.addBtn, styles.addBtnSecondary, pressed && { opacity: 0.75 }]}
              >
                <MaterialIcons name="auto-awesome" size={15} color={C.secondary} />
                <Text style={[styles.addBtnText, { color: C.secondary }]}>Use presets</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.repeatNote}>
            <MaterialIcons name="loop" size={11} color={C.textMuted} /> Repeats daily
          </Text>
        </View>
      ) : null}

      {/* ── Time picker modal ── */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTimePicker(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editingReminder ? 'Edit reminder' : 'Add reminder'}
            </Text>

            <View style={styles.timePickerRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>Hour</Text>
                <ScrollView
                  style={styles.timeScroll}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={44}
                  decelerationRate="fast"
                >
                  {Array.from({ length: 24 }, (_, i) => i).map(h => (
                    <Pressable
                      key={h}
                      onPress={() => setPickerHour(h)}
                      style={[styles.timeItem, pickerHour === h && styles.timeItemSelected]}
                    >
                      <Text style={[styles.timeItemText, pickerHour === h && styles.timeItemTextSelected]}>
                        {h === 0 ? '12' : h <= 12 ? String(h) : String(h - 12)} {h < 12 ? 'AM' : 'PM'}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.timeSep}>:</Text>

              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>Minute</Text>
                <ScrollView
                  style={styles.timeScroll}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={44}
                  decelerationRate="fast"
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                    <Pressable
                      key={m}
                      onPress={() => setPickerMinute(m)}
                      style={[styles.timeItem, pickerMinute === m && styles.timeItemSelected]}
                    >
                      <Text style={[styles.timeItemText, pickerMinute === m && styles.timeItemTextSelected]}>
                        :{m.toString().padStart(2, '0')}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.previewRow}>
              <MaterialIcons name="notifications" size={18} color={C.primary} />
              <Text style={styles.previewText}>{formatTime(pickerHour, pickerMinute)}</Text>
              <Text style={styles.previewSub}>every day</Text>
            </View>

            <View style={styles.labelRow}>
              {['Morning', 'Midday', 'Afternoon', 'Evening', 'Night'].map(preset => (
                <Pressable
                  key={preset}
                  onPress={() => setPickerLabel(preset)}
                  style={[styles.labelChip, pickerLabel === preset && styles.labelChipSelected]}
                >
                  <Text style={[styles.labelChipText, pickerLabel === preset && styles.labelChipTextSelected]}>
                    {preset}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowTimePicker(false)}
                style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveReminder}
                style={({ pressed }) => [styles.modalSaveBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.modalSaveText}>Save reminder</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
