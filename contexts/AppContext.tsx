import React, { createContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  getArchetype,
  getMoodLog,
  getTodayMood,
  getStreak,
  getPremiumStatus,
  isOnboardingDone,
  getVibeCardUrl,
  getSelfieUri,
  getBirthdateStorage,
  MoodEntry,
  StreakData,
} from '@/services/storage';
import { getMoodLogEntries } from '@/services/moodlog';
import { MoodLogEntry } from '@/constants/moodlog';
import {
  getCachedFitnessData,
  getFitnessPermissionStatus,
  fetchCloudFitnessData,
  DailyFitnessEntry,
  FitnessPermissionStatus,
} from '@/services/fitness';
import { getCachedWeather, WeatherData } from '@/services/weather';
import { getUserProfile, fetchCloudMoodEntries, fetchIntakeSummaryFromCloud, syncAllMoodEntriesToCloud } from '@/services/sync';
import { getSupabaseClient } from '@/template';
import { checkSubscription, SubscriptionTier } from '@/services/subscription';
import { initRevenueCat, getRevenueCatSubscription, logoutRevenueCat } from '@/services/revenuecat';
import { isOwnerEmail } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppContextType {
  archetypeId: string | null;
  setArchetypeId: (id: string | null) => void;
  moodLog: MoodEntry[];
  setMoodLog: React.Dispatch<React.SetStateAction<MoodEntry[]>>;
  todayMood: MoodEntry | null;
  setTodayMood: (entry: MoodEntry | null) => void;
  streak: StreakData;
  setStreak: (s: StreakData) => void;
  isPremium: boolean;
  setIsPremium: (v: boolean) => void;
  onboardingDone: boolean;
  setOnboardingDone: (v: boolean) => void;
  isLoading: boolean;
  vibeCardUrl: string | null;
  setVibeCardUrl: (url: string | null) => void;
  selfieUri: string | null;
  setSelfieUri: (uri: string | null) => void;
  fitnessData: DailyFitnessEntry[];
  setFitnessData: React.Dispatch<React.SetStateAction<DailyFitnessEntry[]>>;
  fitnessPermission: FitnessPermissionStatus;
  setFitnessPermission: (s: FitnessPermissionStatus) => void;
  birthdate: string | null;
  setBirthdate: (d: string | null) => void;
  moodLogEntries: MoodLogEntry[];
  setMoodLogEntries: React.Dispatch<React.SetStateAction<MoodLogEntry[]>>;
  todayMoodLogEntries: MoodLogEntry[];
  weatherData: WeatherData | null;
  setWeatherData: (w: WeatherData | null) => void;
  sex: string;
  setSex: (s: string) => void;
  displayName: string | null;
  setDisplayName: (n: string | null) => void;
  userRole: 'user' | 'therapist';
  setUserRole: (r: 'user' | 'therapist') => void;
  subscriptionTier: SubscriptionTier;
  setSubscriptionTier: (t: SubscriptionTier) => void;
  subscriptionEnd: string | null;
  refreshSubscription: () => Promise<void>;
  refreshAll: (resolvedUserId?: string) => Promise<void>;
  tempUnit: 'C' | 'F';
  setTempUnit: (u: 'C' | 'F') => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [archetypeId, setArchetypeId] = useState<string | null>(null);
  const [moodLog, setMoodLog] = useState<MoodEntry[]>([]);
  const [todayMood, setTodayMood] = useState<MoodEntry | null>(null);
  const [streak, setStreak] = useState<StreakData>({ current: 0, longest: 0, lastDate: '' });
  const [isPremium, setIsPremium] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [vibeCardUrl, setVibeCardUrl] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [fitnessData, setFitnessData] = useState<DailyFitnessEntry[]>([]);
  const [fitnessPermission, setFitnessPermission] = useState<FitnessPermissionStatus>({ granted: false, source: 'mock' });
  const [birthdate, setBirthdate] = useState<string | null>(null);
  const [moodLogEntries, setMoodLogEntries] = useState<MoodLogEntry[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [sex, setSex] = useState<string>('prefer_not_to_say');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'user' | 'therapist'>('user');
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');
  const [_todayKey] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  });
  const todayMoodLogEntriesMemo = useMemo(
    () => moodLogEntries.filter(e => e.date === _todayKey),
    [moodLogEntries, _todayKey]
  );

  // Persist temperature unit preference
  useEffect(() => {
    AsyncStorage.getItem('pref_temp_unit').then(v => {
      if (v === 'F' || v === 'C') setTempUnit(v);
    }).catch(() => {});
  }, []);

  const setTempUnitPersist = (u: 'C' | 'F') => {
    setTempUnit(u);
    AsyncStorage.setItem('pref_temp_unit', u).catch(() => {});
  };

  const refreshSubscription = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user && isOwnerEmail(user.email)) {
        setSubscriptionTier('therapist_pro');
        setUserRole('therapist');
        setSubscriptionEnd(null);
        return;
      }
      if (Platform.OS !== 'web') {
        const rcSub = await getRevenueCatSubscription();
        if (rcSub.isActive) {
          setSubscriptionTier(rcSub.tier);
          setSubscriptionEnd(rcSub.expirationDate);
          return;
        }
      }
      const sub = await checkSubscription();
      setSubscriptionTier(sub.tier);
      setSubscriptionEnd(sub.subscriptionEnd);
    } catch (e: any) {
      console.warn('[AppContext] refreshSubscription error:', e?.message);
    }
  };

  const refreshAll = async (resolvedUserId?: string) => {
    // ── Step 1: load all local storage in parallel ──────────────────────────
    let localData: any[] = [];
    try {
      localData = await Promise.all([
        getArchetype(), getMoodLog(), getTodayMood(), getStreak(),
        getPremiumStatus(), isOnboardingDone(), getVibeCardUrl(), getSelfieUri(),
        getCachedFitnessData(), getFitnessPermissionStatus(), getBirthdateStorage(),
        getMoodLogEntries(), getCachedWeather(),
      ]);
    } catch (e: any) {
      console.warn('[AppContext] local storage load error:', e?.message);
      // Provide safe defaults so the rest of the function can continue
      localData = [null, [], null, { current: 0, longest: 0, lastDate: '' }, false, false, null, null, [], { granted: false, source: 'mock' }, null, [], null];
    }

    const [
      archetype, log, today, streakData, premium, onboarding,
      cardUrl, selfie, fitness, fitnessStatus,
      bd, localMoodEntries, weather,
    ] = localData;

    try { setArchetypeId(archetype); } catch {}
    try { setMoodLog(log ?? []); } catch {}
    try { setTodayMood(today); } catch {}
    try { setStreak(streakData ?? { current: 0, longest: 0, lastDate: '' }); } catch {}
    try { setIsPremium(premium ?? false); } catch {}
    try { setOnboardingDone(onboarding ?? false); } catch {}
    try { setVibeCardUrl(cardUrl); } catch {}
    try { setSelfieUri(selfie); } catch {}
    try { setFitnessData(fitness ?? []); } catch {}
    try { setFitnessPermission(fitnessStatus ?? { granted: false, source: 'mock' }); } catch {}
    try { setBirthdate(bd); } catch {}
    try { setMoodLogEntries(localMoodEntries ?? []); } catch {}
    try { if (weather) setWeatherData(weather); } catch {}

    // ── Step 2: load cloud data ──────────────────────────────────────────────
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        console.warn('[AppContext] Supabase client unavailable — skipping cloud sync');
        return;
      }

      let userId = resolvedUserId;
      let userEmail: string | undefined;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!userId) userId = authUser?.id;
        userEmail = authUser?.email;
      } catch (e: any) {
        console.warn('[AppContext] getUser error:', e?.message);
      }

      const user = userId ? { id: userId, email: userEmail } : null;
      if (!user) return;

      const [profile, sub, cloudEntries] = await Promise.all([
        getUserProfile(user.id).catch(() => null),
        checkSubscription().catch(() => ({ tier: 'free' as SubscriptionTier, subscriptionEnd: null })),
        fetchCloudMoodEntries(user.id).catch(() => [] as MoodLogEntry[]),
      ]);

      // On web, pull real fitness data synced from the mobile app
      if (Platform.OS === 'web') {
        fetchCloudFitnessData(user.id, 30).then(cloudFitness => {
          if (cloudFitness.length > 0) {
            setFitnessData(cloudFitness);
            setFitnessPermission({ granted: true, source: 'expo_health' });
          }
        }).catch(() => {});
      }

      if (profile) {
        try { setUserRole(profile.role as 'user' | 'therapist'); } catch {}
        try { setSubscriptionTier(profile.subscription_tier as SubscriptionTier); } catch {}
        try { if (profile.sex) setSex(profile.sex as string); } catch {}
        try { if (profile.birthdate) setBirthdate(profile.birthdate); } catch {}
        try { if (profile.onboarding_done) setOnboardingDone(true); } catch {}
        try {
          const name = profile.display_name ?? profile.username ?? null;
          if (name) setDisplayName(name);
        } catch {}
      }

      // Sync intake questionnaire from cloud when local AsyncStorage is empty
      try {
        const localIntake = await AsyncStorage.getItem('intake_summary');
        if (!localIntake) {
          const cloudIntake = await fetchIntakeSummaryFromCloud(user.id);
          if (cloudIntake) {
            await AsyncStorage.setItem('intake_summary', JSON.stringify(cloudIntake));
          }
        }
      } catch {}

      // Owner override — full access regardless of Stripe status
      if (isOwnerEmail(userEmail)) {
        setSubscriptionTier('therapist_pro');
        setUserRole('therapist');
        setSubscriptionEnd(null);
      } else if (Platform.OS !== 'web') {
        try {
          await initRevenueCat(userId!);
          const rcSub = await getRevenueCatSubscription();
          if (rcSub.isActive) {
            setSubscriptionTier(rcSub.tier);
            setSubscriptionEnd(rcSub.expirationDate);
          } else {
            setSubscriptionTier(sub.tier);
            setSubscriptionEnd(sub.subscriptionEnd);
          }
        } catch (e: any) {
          console.warn('[AppContext] RevenueCat error:', e?.message);
          setSubscriptionTier(sub.tier);
          setSubscriptionEnd(sub.subscriptionEnd);
        }
      } else {
        setSubscriptionTier(sub.tier);
        setSubscriptionEnd(sub.subscriptionEnd);
      }

      // Merge cloud entries with local entries (cloud is authoritative)
      if (cloudEntries.length > 0) {
        try {
          const localIds = new Set(cloudEntries.map((e: MoodLogEntry) => e.id));
          const localOnly = (localMoodEntries ?? []).filter((e: MoodLogEntry) => !localIds.has(e.id));
          const merged = [...cloudEntries, ...localOnly].sort((a: MoodLogEntry, b: MoodLogEntry) => b.timestamp - a.timestamp);
          setMoodLogEntries(merged);

          const sortedDates = [...new Set(merged.map((e: MoodLogEntry) => e.date))].sort() as string[];
          if (sortedDates.length > 0) {
            const todayStr = new Date().toISOString().split('T')[0];
            let current = 0;
            let checkDate = todayStr;
            for (let i = sortedDates.length - 1; i >= 0; i--) {
              if (sortedDates[i] === checkDate) {
                current++;
                const d = new Date(checkDate);
                d.setDate(d.getDate() - 1);
                checkDate = d.toISOString().split('T')[0];
              } else if (sortedDates[i] < checkDate) {
                break;
              }
            }
            const longest = Math.max(current, (streakData?.longest ?? 0));
            setStreak({ current, longest, lastDate: sortedDates[sortedDates.length - 1] });
          }
        } catch (e: any) {
          console.warn('[AppContext] merge entries error:', e?.message);
        }
      }

      // Push any local-only entries up to cloud
      if ((localMoodEntries ?? []).length > 0) {
        syncAllMoodEntriesToCloud(localMoodEntries, user.id).catch(() => {});
      }
    } catch (e: any) {
      console.warn('[AppContext] cloud sync error:', e?.message);
    }
  };

  useEffect(() => {
    // ── Guard: ensure Supabase client initialises without throwing ───────────
    let supabase: ReturnType<typeof getSupabaseClient> | null = null;
    try {
      supabase = getSupabaseClient();
    } catch (e: any) {
      console.error('[AppContext] Supabase client init failed:', e?.message);
      setIsLoading(false);
      return;
    }
    if (!supabase) {
      console.error('[AppContext] Supabase client is null — check EXPO_PUBLIC_SUPABASE_URL / ANON_KEY env vars');
      setIsLoading(false);
      return;
    }

    let initialDone = false;

    let authSub: { unsubscribe: () => void } | null = null;
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!initialDone) {
            initialDone = true;
            refreshAll(session?.user?.id).finally(() => setIsLoading(false));
            return;
          }
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            refreshAll(session?.user?.id).catch(() => {});
          } else if (event === 'SIGNED_OUT') {
            logoutRevenueCat().catch(() => {});
            setMoodLogEntries([]);
            setMoodLog([]);
            setOnboardingDone(false);
            setIsLoading(false);
          }
        }
      );
      authSub = subscription;
    } catch (e: any) {
      console.error('[AppContext] onAuthStateChange setup failed:', e?.message);
      setIsLoading(false);
      return;
    }

    // Absolute fallback: if onAuthStateChange never fires within 4 s
    const fallback = setTimeout(() => {
      if (!initialDone) {
        initialDone = true;
        refreshAll().finally(() => setIsLoading(false));
      }
    }, 4000);

    return () => {
      try { authSub?.unsubscribe(); } catch {}
      clearTimeout(fallback);
    };
  }, []);

  try { return (
    <AppContext.Provider
      value={{
        archetypeId, setArchetypeId,
        moodLog, setMoodLog,
        todayMood, setTodayMood,
        streak, setStreak,
        isPremium, setIsPremium,
        onboardingDone, setOnboardingDone,
        isLoading,
        refreshAll,
        vibeCardUrl, setVibeCardUrl,
        selfieUri, setSelfieUri,
        fitnessData, setFitnessData,
        fitnessPermission, setFitnessPermission,
        birthdate, setBirthdate,
        moodLogEntries, setMoodLogEntries,
        weatherData, setWeatherData,
        sex, setSex,
        displayName, setDisplayName,
        userRole, setUserRole,
        subscriptionTier, setSubscriptionTier,
        subscriptionEnd,
        refreshSubscription,
        tempUnit,
        setTempUnit: setTempUnitPersist,
        todayMoodLogEntries: todayMoodLogEntriesMemo,
      }}
    >
      {children}
    </AppContext.Provider>
  ); } catch (e: any) {
    console.error('[AppProvider] render error:', String(e?.message));
    return <>{children}</>;
  }
}
