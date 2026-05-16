/**
 * Notification service
 * Manages daily check-in reminders using expo-notifications.
 * Supports one-time daily or multiple per-day schedules.
 * Apple Watch: notifications mirror automatically via iOS pairing.
 * Interactive quick-action buttons ("Log Now", "Snooze 1h") appear on
 * both iPhone and Apple Watch via Notification Categories.
 *
 * WEB SAFETY: expo-notifications is native-only. All calls are guarded
 * with Platform.OS !== 'web' checks. No top-level import of expo-notifications.
 */

import { Platform } from 'react-native';

// AsyncStorage is shimmed to a localStorage wrapper on web (metro.config.js)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calcWellnessScore, getTimeOfDay, MOODLOG_STORAGE_KEY } from '@/constants/moodlog';
import { getSupabaseClient } from '@/template';
import { syncMoodEntryToCloud } from '@/services/sync';

// Lazily require expo-notifications only on native platforms.
// This prevents the web bundler from trying to resolve the native module.
let Notifications: any = null;
if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch {}
}

export interface ReminderTime {
  id: string;
  hour: number;
  minute: number;
  label: string;
  enabled: boolean;
  notificationId?: string;
}

export interface NotificationSettings {
  enabled: boolean;
  reminders: ReminderTime[];
  weeklyRecapEnabled: boolean;
  weeklyRecapNotificationId?: string;
}

export interface WeeklyRecapSummary {
  topMood: string;
  topMoodEmoji: string;
  topEmotion: string;
  topEmotionEmoji: string;
  avgSteps: number;
  streak: number;
}

// ─── Apple Watch / Interactive Notification Category ────────────────────────

export const CHECKIN_CATEGORY_ID = 'MOOD_CHECKIN';

export const WATCH_ACTION_GREAT     = 'MOOD_GREAT';
export const WATCH_ACTION_GOOD      = 'MOOD_GOOD';
export const WATCH_ACTION_FINE      = 'MOOD_FINE';
export const WATCH_ACTION_NOT_GREAT = 'MOOD_NOT_GREAT';
export const WATCH_ACTION_LOW       = 'MOOD_LOW';
export const WATCH_ACTION_OKAY      = WATCH_ACTION_FINE;

export const WATCH_QUICK_PRESETS: Record<string, { body: number; mind: number; energy: number; focus: number; label: string; tag: string }> = {
  [WATCH_ACTION_GREAT]:     { body:  0.8,  mind:  0.8,  energy: 0.85, focus: 0.80, label: 'Feeling great',     tag: 'sleep_good'  },
  [WATCH_ACTION_GOOD]:      { body:  0.4,  mind:  0.4,  energy: 0.65, focus: 0.60, label: 'Feeling good',      tag: 'work_good'   },
  [WATCH_ACTION_FINE]:      { body:  0.0,  mind:  0.0,  energy: 0.45, focus: 0.45, label: 'Feeling fine',      tag: 'work_good'   },
  [WATCH_ACTION_NOT_GREAT]: { body: -0.35, mind: -0.35, energy: 0.30, focus: 0.30, label: 'Not feeling great', tag: 'screens'     },
  [WATCH_ACTION_LOW]:       { body: -0.75, mind: -0.75, energy: 0.15, focus: 0.15, label: 'Feeling bad',       tag: 'screens'     },
};

export async function registerCheckinCategory(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    try {
      await Notifications.deleteNotificationCategoryAsync(CHECKIN_CATEGORY_ID);
    } catch {}

    await Notifications.setNotificationCategoryAsync(
      CHECKIN_CATEGORY_ID,
      [
        {
          identifier: WATCH_ACTION_GREAT,
          buttonTitle: '🌟 Great',
          options: { opensAppToForeground: false, isAuthenticationRequired: false, isDestructive: false },
        },
        {
          identifier: WATCH_ACTION_GOOD,
          buttonTitle: '😊 Good',
          options: { opensAppToForeground: false, isAuthenticationRequired: false, isDestructive: false },
        },
        {
          identifier: WATCH_ACTION_FINE,
          buttonTitle: '😐 Fine',
          options: { opensAppToForeground: false, isAuthenticationRequired: false, isDestructive: false },
        },
        {
          identifier: WATCH_ACTION_NOT_GREAT,
          buttonTitle: '😕 Not Great',
          options: { opensAppToForeground: false, isAuthenticationRequired: false, isDestructive: false },
        },
        {
          identifier: WATCH_ACTION_LOW,
          buttonTitle: '😔 Bad',
          options: { opensAppToForeground: false, isAuthenticationRequired: false, isDestructive: false },
        },
        {
          identifier: 'LOG_NOW',
          buttonTitle: '📝 Full Log',
          options: { opensAppToForeground: true, isAuthenticationRequired: false, isDestructive: false },
        },
        {
          identifier: 'SNOOZE_1H',
          buttonTitle: '⏰ Snooze 1h',
          options: { opensAppToForeground: false, isAuthenticationRequired: false, isDestructive: false },
        },
      ],
      {
        showTitle: true,
        showSubtitle: true,
        allowInCarPlay: false,
        allowAnnouncement: false,
        customDismissAction: false,
        intentIdentifiers: [],
      },
    );
  } catch (e) {
    console.warn('[registerCheckinCategory]', e);
  }
}

export async function quickLogMoodFromWatch(actionId: string): Promise<string> {
  const preset = WATCH_QUICK_PRESETS[actionId];
  if (!preset) return 'logged';

  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const time = now.toTimeString().slice(0, 5);
  const timeOfDay = getTimeOfDay(now.getHours());
  const dimensions = { body: preset.body, mind: preset.mind, energy: preset.energy, focus: preset.focus };
  const score = calcWellnessScore(dimensions);

  const entry = {
    id: `${date}_${timeOfDay}_watch_${Date.now()}`,
    date,
    time,
    timestamp: now.getTime(),
    timeOfDay,
    dimensions,
    score,
    primaryTag: preset.tag,
    additionalTags: [],
    note: `Quick log via Apple Watch — ${preset.label}`,
    source: 'watch',
  };

  try {
    const raw = await AsyncStorage.getItem(MOODLOG_STORAGE_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.unshift(entry);
    await AsyncStorage.setItem(MOODLOG_STORAGE_KEY, JSON.stringify(log.slice(0, 1000)));
  } catch {}

  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      syncMoodEntryToCloud(entry as any, user.id);
      await supabase.from('user_profiles').update({ last_logged_at: now.toISOString() }).eq('id', user.id);
    }
  } catch {}

  return `${score} · ${preset.label}`;
}

export async function sendWatchConfirmationNotification(summary: string): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Score logged — MyMoodMapp',
        body: `Score ${summary} saved. Open the app to view your patterns and insights.`,
        sound: false,
        data: { screen: '/(tabs)', type: 'watch_confirm' },
      },
      trigger: null,
    });
  } catch {}
}

export async function snoozeCheckinOneHour(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    const msg = getRandomWatchMessage();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        subtitle: msg.subtitle,
        body: msg.body,
        sound: true,
        categoryIdentifier: CHECKIN_CATEGORY_ID,
        data: { screen: '/(tabs)/checkin', source: 'snooze' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3600,
      },
    });
  } catch (e) {
    console.warn('[snoozeCheckinOneHour]', e);
  }
}

const SETTINGS_KEY = 'mymoodmapp_notification_settings';

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  reminders: [],
  weeklyRecapEnabled: false,
  weeklyRecapNotificationId: undefined,
};

const WEEKLY_RECAP_ID_KEY = 'mymoodmapp_weekly_recap_notif_id';

interface ReminderMessage {
  title: string;
  subtitle: string;
  body: string;
}

const WATCH_REMINDER_MESSAGES: ReminderMessage[] = [
  {
    title: '✨ Log your mood',
    subtitle: 'How are you feeling right now?',
    body: 'Time to log your mood in MyMoodMapp. Long-press to instant-log without opening the app.',
  },
  {
    title: '🌊 MyMoodMapp reminder',
    subtitle: "Don't break your streak",
    body: 'Log your daily mood — keep your streak alive. Long-press for quick instant-log options.',
  },
  {
    title: '🔍 8 seconds to log',
    subtitle: 'Body · Mind · Energy · Focus',
    body: '8 seconds to log your mood in MyMoodMapp. Long-press to instant-log Great, Good, Fine, or Low.',
  },
  {
    title: '💫 Daily mood log',
    subtitle: 'MyMoodMapp · 30 seconds',
    body: 'Track how you feel across all four dimensions. Long-press to log instantly.',
  },
  {
    title: '⚡ MyMoodMapp check-in',
    subtitle: 'How are you showing up today?',
    body: 'Log your mood now and keep your streak going. Long-press this notification to log in one tap.',
  },
  {
    title: '🎯 Log your mood',
    subtitle: 'MyMoodMapp · keep your streak',
    body: 'Log your mood and build a clear picture of your wellbeing over time. Long-press to instant-log.',
  },
  {
    title: '🌿 Mood check-in',
    subtitle: "What's your energy like?",
    body: 'MyMoodMapp helps you spot patterns in your mood. Long-press to instantly log your score.',
  },
];

function getRandomWatchMessage(): ReminderMessage {
  return WATCH_REMINDER_MESSAGES[Math.floor(Math.random() * WATCH_REMINDER_MESSAGES.length)];
}

// ─── Permissions ──────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web' || !Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web' || !Notifications) return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status as 'granted' | 'denied' | 'undetermined';
}

// ─── Settings persistence ─────────────────────────────────

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Weekly Recap ────────────────────────────────────────

export async function scheduleWeeklyRecap(summary: WeeklyRecapSummary): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications) return 'web-simulated';

  const existing = await AsyncStorage.getItem(WEEKLY_RECAP_ID_KEY).catch(() => null);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
  }

  const stepLine = summary.avgSteps > 0 ? ` · ${summary.avgSteps.toLocaleString()} avg steps` : '';
  const streakLine = summary.streak > 0 ? ` · ${summary.streak}-day streak` : '';

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Your weekly mood pattern report is ready ${summary.topMoodEmoji}`,
        body: `Top mood: ${summary.topMood}${stepLine}${streakLine}. Tap to see your full week.`,
        sound: true,
        data: { screen: '/(tabs)/insights', tab: 'weekly' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        weekday: 1,
        hour: 19,
        minute: 0,
        repeats: true,
      },
    });
    await AsyncStorage.setItem(WEEKLY_RECAP_ID_KEY, id);
    return id;
  } catch (e) {
    console.warn('scheduleWeeklyRecap error:', e);
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Your weekly mood pattern report is ready ${summary.topMoodEmoji}`,
          body: `Top mood: ${summary.topMood}${stepLine}${streakLine}. Tap to see your full week.`,
          sound: true,
          data: { screen: '/(tabs)/insights', tab: 'weekly' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 19,
          minute: 0,
        },
      });
      await AsyncStorage.setItem(WEEKLY_RECAP_ID_KEY, id);
      return id;
    } catch (e2) {
      console.warn('scheduleWeeklyRecap fallback error:', e2);
      return null;
    }
  }
}

export async function cancelWeeklyRecap(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  const existing = await AsyncStorage.getItem(WEEKLY_RECAP_ID_KEY).catch(() => null);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});
    await AsyncStorage.removeItem(WEEKLY_RECAP_ID_KEY).catch(() => {});
  }
}

export function buildWeeklyRecapSummary(
  moodLog: Array<{ mood: string; date: string }>,
  emotionLog: Array<{ primaryEmotion: string; date: string }>,
  avgSteps: number,
  streak: number,
): WeeklyRecapSummary {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentMoods = moodLog.filter(m => m.date >= cutoff);
  const recentEmotions = emotionLog.filter(e => e.date >= cutoff);

  const moodCounts: Record<string, number> = {};
  recentMoods.forEach(m => { moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1; });
  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'calm';

  const emotionCounts: Record<string, number> = {};
  recentEmotions.forEach(e => { emotionCounts[e.primaryEmotion] = (emotionCounts[e.primaryEmotion] || 0) + 1; });
  const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';

  const moodEmojiMap: Record<string, string> = {
    joyful: '😄', calm: '😌', energized: '⚡', focused: '🎯',
    reflective: '🌙', anxious: '😰', drained: '😔', grateful: '🙏',
  };
  const emotionEmojiMap: Record<string, string> = {
    happy: '😊', excited: '🤩', calm: '😌', content: '🙂', neutral: '😐',
    sad: '😔', anxious: '😰', stressed: '😤', frustrated: '😠', tired: '😴',
  };

  return {
    topMood,
    topMoodEmoji: moodEmojiMap[topMood] ?? '✨',
    topEmotion,
    topEmotionEmoji: emotionEmojiMap[topEmotion] ?? '🔍',
    avgSteps: Math.round(avgSteps),
    streak,
  };
}

// ─── Scheduling ───────────────────────────────────────────

export async function scheduleReminder(reminder: ReminderTime): Promise<string> {
  if (Platform.OS === 'web' || !Notifications) return 'web-noop';
  const msg = getRandomWatchMessage();

  if (reminder.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => {});
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: msg.title,
      subtitle: msg.subtitle,
      body: msg.body,
      sound: true,
      categoryIdentifier: CHECKIN_CATEGORY_ID,
      ...(Platform.OS === 'ios' ? { relevanceScore: 0.85 } : {}),
      data: { screen: '/(tabs)/checkin', reminderId: reminder.id, label: reminder.label },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: reminder.hour,
      minute: reminder.minute,
    },
  });

  return notificationId;
}

export async function cancelReminder(notificationId: string): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  const settings = await loadNotificationSettings();
  const cancelPromises = settings.reminders
    .filter(r => r.notificationId)
    .map(r => Notifications.cancelScheduledNotificationAsync(r.notificationId!).catch(() => {}));
  await Promise.all(cancelPromises);
}

export async function syncWeeklyRecap(
  settings: NotificationSettings,
  summary?: WeeklyRecapSummary,
): Promise<NotificationSettings> {
  if (!settings.weeklyRecapEnabled) {
    await cancelWeeklyRecap();
    const updated = { ...settings, weeklyRecapNotificationId: undefined };
    await saveNotificationSettings(updated);
    return updated;
  }
  const recapSummary: WeeklyRecapSummary = summary ?? {
    topMood: 'calm',
    topMoodEmoji: '✨',
    topEmotion: 'neutral',
    topEmotionEmoji: '🔍',
    avgSteps: 0,
    streak: 0,
  };
  const id = await scheduleWeeklyRecap(recapSummary);
  const updated = { ...settings, weeklyRecapNotificationId: id ?? undefined };
  await saveNotificationSettings(updated);
  return updated;
}

export async function syncReminders(settings: NotificationSettings): Promise<NotificationSettings> {
  if (Platform.OS === 'web' || !Notifications) return settings;

  if (!settings.enabled) {
    await cancelAllReminders();
    const cleared = {
      ...settings,
      reminders: settings.reminders.map(r => ({ ...r, notificationId: undefined })),
    };
    await saveNotificationSettings(cleared);
    return cleared;
  }

  const updatedReminders = await Promise.all(
    settings.reminders.map(async (reminder) => {
      if (!reminder.enabled) {
        if (reminder.notificationId) {
          await cancelReminder(reminder.notificationId).catch(() => {});
        }
        return { ...reminder, notificationId: undefined };
      }
      try {
        const notificationId = await scheduleReminder(reminder);
        return { ...reminder, notificationId };
      } catch {
        return reminder;
      }
    })
  );

  const updated: NotificationSettings = { ...settings, reminders: updatedReminders };
  await saveNotificationSettings(updated);
  return updated;
}

// ─── Notification handler setup ──────────────────────────

export function configureNotificationHandler(): void {
  if (Platform.OS === 'web' || !Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Add a notification response listener (native only).
 * Returns a subscription object with a remove() method.
 */
export function addNotificationResponseReceivedListener(
  callback: (response: any) => void,
): { remove: () => void } {
  if (Platform.OS === 'web' || !Notifications) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get Expo push token (native only).
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications) return null;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Get current permission status (native only).
 */
export async function getPermissionsAsync(): Promise<{ status: string }> {
  if (Platform.OS === 'web' || !Notifications) return { status: 'denied' };
  return Notifications.getPermissionsAsync();
}

/**
 * Request permissions (native only).
 */
export async function requestPermissionsAsync(): Promise<{ status: string }> {
  if (Platform.OS === 'web' || !Notifications) return { status: 'denied' };
  return Notifications.requestPermissionsAsync();
}

// ─── Helpers ─────────────────────────────────────────────

export function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

export function parseTimeString(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number);
  return { hour: h || 0, minute: m || 0 };
}

export function generateReminderId(): string {
  return `reminder_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const PRESET_REMINDERS: Omit<ReminderTime, 'id' | 'notificationId'>[] = [
  { hour: 8, minute: 0, label: 'Morning', enabled: true },
  { hour: 13, minute: 0, label: 'Midday', enabled: true },
  { hour: 20, minute: 0, label: 'Evening', enabled: true },
];
