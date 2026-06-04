// Storage service — AsyncStorage wrappers for all local persistent data
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ARCHETYPE: 'mymoodmapp_archetype',
  TEMP_UNIT: 'moodlog_temp_unit',
  MOOD_LOG: 'mymoodmapp_mood_log',
  ONBOARDING_DONE: 'mymoodmapp_onboarding_done',
  STREAK: 'mymoodmapp_streak',
  LAST_CHECKIN: 'mymoodmapp_last_checkin',
  PREMIUM: 'mymoodmapp_premium',
  VIBE_CARD_URL: 'mymoodmapp_card_url',
  SELFIE_URI: 'mymoodmapp_selfie_uri',
  FITNESS_PERMISSION: 'mymoodmapp_fitness_permission',
  BIRTHDATE: 'mymoodmapp_birthdate',
  EMOTION_TRACKING: 'moodlog_emotion_tracking_enabled',
};

export interface MoodEntry {
  id: string;
  mood: string;
  note: string;
  timestamp: number;
  date: string; // YYYY-MM-DD
  selfieUri?: string;       // local path of the selfie taken during check-in
  emotionAnalysisId?: string; // date-keyed reference to emotion log
}

export interface StreakData {
  current: number;
  longest: number;
  lastDate: string;
}

// ── Archetype ────────────────────────────────────────────
export async function saveArchetype(id: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.ARCHETYPE, id);
}

export async function getArchetype(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.ARCHETYPE);
}

// ── Mood Log ─────────────────────────────────────────────
export async function saveMoodEntry(entry: MoodEntry): Promise<void> {
  const raw = await AsyncStorage.getItem(KEYS.MOOD_LOG);
  const log: MoodEntry[] = raw ? JSON.parse(raw) : [];
  // Replace same-day entry if exists
  const filtered = log.filter(e => e.date !== entry.date);
  filtered.unshift(entry);
  await AsyncStorage.setItem(KEYS.MOOD_LOG, JSON.stringify(filtered.slice(0, 90)));
}

export async function getMoodLog(): Promise<MoodEntry[]> {
  const raw = await AsyncStorage.getItem(KEYS.MOOD_LOG);
  return raw ? JSON.parse(raw) : [];
}

export async function getTodayMood(): Promise<MoodEntry | null> {
  const log = await getMoodLog();
  const today = new Date().toISOString().split('T')[0];
  return log.find(e => e.date === today) || null;
}

// ── Streak ────────────────────────────────────────────────
export async function getStreak(): Promise<StreakData> {
  const raw = await AsyncStorage.getItem(KEYS.STREAK);
  return raw ? JSON.parse(raw) : { current: 0, longest: 0, lastDate: '' };
}

export async function updateStreak(): Promise<StreakData> {
  const streak = await getStreak();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (streak.lastDate === today) return streak;

  const current = streak.lastDate === yesterday ? streak.current + 1 : 1;
  const longest = Math.max(current, streak.longest);
  const updated: StreakData = { current, longest, lastDate: today };
  await AsyncStorage.setItem(KEYS.STREAK, JSON.stringify(updated));
  return updated;
}

// ── Onboarding ────────────────────────────────────────────
export async function markOnboardingDone(): Promise<void> {
  await AsyncStorage.setItem(KEYS.ONBOARDING_DONE, '1');
}

export async function isOnboardingDone(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.ONBOARDING_DONE);
  return val === '1';
}

// ── Vibe Card ────────────────────────────────────────────
export async function saveVibeCardUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.VIBE_CARD_URL, url);
}

export async function getVibeCardUrl(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.VIBE_CARD_URL);
}

export async function saveSelfieUri(uri: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.SELFIE_URI, uri);
}

export async function getSelfieUri(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.SELFIE_URI);
}

// ── Birthdate ─────────────────────────────────────────────
export async function saveBirthdateStorage(birthdate: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.BIRTHDATE, birthdate);
}

export async function getBirthdateStorage(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.BIRTHDATE);
}

// ── Emotion Tracking Toggle ─────────────────────────────────
export async function getEmotionTrackingEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.EMOTION_TRACKING);
  return val !== '0'; // default ON
}

export async function setEmotionTrackingEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.EMOTION_TRACKING, enabled ? '1' : '0');
}

// ── Temperature Unit ────────────────────────────────────────
export async function getTempUnit(): Promise<'C' | 'F'> {
  const val = await AsyncStorage.getItem(KEYS.TEMP_UNIT);
  return val === 'C' ? 'C' : 'F';
}

export async function setTempUnit(unit: 'C' | 'F'): Promise<void> {
  await AsyncStorage.setItem(KEYS.TEMP_UNIT, unit);
}

// ── Premium (mocked) ──────────────────────────────────────
export async function getPremiumStatus(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.PREMIUM);
  return val === '1';
}

export async function setPremiumStatus(active: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.PREMIUM, active ? '1' : '0');
}
