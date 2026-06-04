// @ts-nocheck
// ── CrashShield: MUST be the very first import ──────────────────────────────
// Patches ExceptionsManager.handleException using require() (non-hoisted) so
// fatal JS errors NEVER reach RCTExceptionManager's objc_exception_rethrow path.
// Must come before every other import so it installs before any module can throw.
import '@/services/crashShield';
import React from 'react';
import { ErrorUtils, Platform } from 'react-native';
// sentryService.ts wraps @sentry/react-native on native;
// sentryService.web.ts provides no-ops on web — zero native imports in web bundle.
import Sentry from '@/services/sentryService';

// ── Sentry — initialised as early as possible for maximum crash coverage ──
try {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      release: 'com.dkoravos.mymoodmapp@1.0.0+19',
      dist: '19',
      tracesSampleRate: 0.2,
      enableNativeCrashHandling: true,
      maxBreadcrumbs: 50,
      ignoreErrors: ['Network request failed', 'Load failed', 'AbortError'],
    });
  }
} catch {}

// ── Global JS error handler — belt-and-suspenders after Sentry is ready ──────
// crashShield.native.ts patches ExceptionsManager first; this handler adds Sentry
// reporting on top. NEVER call the previous handler — that leads to RCTFatal.
try {
  if (typeof ErrorUtils !== 'undefined') {
    ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
      try { Sentry.captureException(error, { tags: { fatal: String(isFatal) } }); } catch {}
      try { console.log('[GlobalErrorHandler] caught (swallowed):', error?.message); } catch {}
    });
  }
} catch {}

import { AlertProvider, AuthProvider } from '@/template';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { NotificationPrePrompt, shouldShowNotificationPrePrompt } from '@/components/feature/NotificationPrePrompt';
import { AppProvider } from '@/contexts/AppContext';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { StatusBar } from 'expo-status-bar';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { summarizeFitnessData, getDateRangeFitness } from '@/services/fitness';
import { updateUserProfile } from '@/services/sync';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  configureNotificationHandler,
  loadNotificationSettings,
  syncWeeklyRecap,
  buildWeeklyRecapSummary,
  registerCheckinCategory,
  snoozeCheckinOneHour,
  quickLogMoodFromWatch,
  sendWatchConfirmationNotification,
  addNotificationResponseReceivedListener,
  getExpoPushToken,
  getPermissionsAsync,
  requestPermissionsAsync,
  WATCH_ACTION_GREAT,
  WATCH_ACTION_GOOD,
  WATCH_ACTION_FINE,
  WATCH_ACTION_NOT_GREAT,
  WATCH_ACTION_LOW,
} from '@/services/notifications';

// Inject global web styles for proper desktop layout
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    html, body, #root { height: 100%; margin: 0; padding: 0; }
    * { box-sizing: border-box; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
  `;
  document.head.appendChild(style);
}

// ── Global error boundary ────────────────────────────────────────────────────
class ErrorBoundaryInner extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: String(error?.message ?? error ?? 'Unknown error') };
  }
  componentDidCatch(error: any, info: any) {
    try { Sentry.captureException(error, { extra: { componentStack: info?.componentStack } }); } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0A0A14', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', paddingHorizontal: 32 }}>
            MyMoodMapp encountered an error.{`\n`}Please restart the app.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}
const ErrorBoundary = Sentry.wrap(ErrorBoundaryInner as any) as typeof ErrorBoundaryInner;

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { user, loading: authLoading } = useAuth();
  const { onboardingDone, isLoading, moodLog, fitnessData, streak } = useApp();
  const responseListenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const setupNotifications = async () => {
      try { configureNotificationHandler(); } catch (e: any) { console.warn('[Notifications] configureHandler failed:', e?.message); }
      try { await registerCheckinCategory(); } catch (e: any) { console.warn('[Notifications] registerCategory failed:', e?.message); }
    };
    const t = setTimeout(() => { setupNotifications().catch((e: any) => console.warn('[Notifications] setup error:', e?.message)); }, 500);
    return () => clearTimeout(t);
  }, []);

  const hadSessionRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const notifPromptShownRef = useRef(false);

  useEffect(() => {
    if (user) hadSessionRef.current = true;
  }, [user]);

  useEffect(() => {
    if (isLoading || authLoading) {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
      return;
    }

    const inOnboarding = segments[0] === 'onboarding';
    const inLogin = segments[0] === 'login';
    const inLanding = segments[0] === 'landing';

    if (!user) {
      if (hadSessionRef.current) {
        if (redirectTimerRef.current) return;
        redirectTimerRef.current = setTimeout(() => {
          redirectTimerRef.current = null;
          if (Platform.OS === 'web') {
            if (!inLogin && !inLanding) router.replace('/landing');
          } else {
            if (!inLogin) router.replace('/login');
          }
        }, 800);
        return;
      }
      if (Platform.OS === 'web') {
        if (!inLogin && !inLanding) router.replace('/landing');
      } else {
        if (!inLogin) router.replace('/login');
      }
      return;
    }

    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }

    if (!onboardingDone && !inOnboarding) {
      router.replace('/onboarding');
      return;
    }

    if (onboardingDone && (inOnboarding || inLogin || inLanding)) {
      router.replace('/(tabs)');
    }

    if (onboardingDone && user && Platform.OS !== 'web' && !notifPromptShownRef.current) {
      notifPromptShownRef.current = true;
      shouldShowNotificationPrePrompt().then(should => {
        if (should) setShowNotifPrompt(true);
      });
    }
  }, [user, onboardingDone, isLoading, authLoading, segments]);

  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    const registerToken = async () => {
      try {
        if (!Device.isDevice) return;
        const { status: existing } = await getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;
        const token = await getExpoPushToken();
        if (token && user.id) {
          await updateUserProfile(user.id, { notification_token: token });
        }
      } catch {}
    };
    registerToken();
  }, [user?.id]);

  useEffect(() => {
    if (!user || isLoading) return;
    const DEMO_EMAIL = 'testaccount@mymoodmapp.com';
    if (user.email?.toLowerCase() !== DEMO_EMAIL) return;
    const triggerDemoPopulate = async () => {
      try {
        const DEMO_KEY = 'demo_populate_last_date';
        const today = new Date().toISOString().split('T')[0];
        let lastDate: string | null = null;
        if (Platform.OS === 'web') {
          lastDate = typeof localStorage !== 'undefined' ? localStorage.getItem(DEMO_KEY) : null;
        } else {
          lastDate = await AsyncStorage.getItem(DEMO_KEY);
        }
        if (lastDate === today) return;
        const supabase = getSupabaseClient();
        const { error } = await supabase.functions.invoke('populate-demo-data', { body: {} });
        if (!error) {
          if (Platform.OS === 'web') {
            if (typeof localStorage !== 'undefined') localStorage.setItem(DEMO_KEY, today);
          } else {
            await AsyncStorage.setItem(DEMO_KEY, today);
          }
        }
      } catch {}
    };
    const t = setTimeout(triggerDemoPopulate, 3500);
    return () => clearTimeout(t);
  }, [user?.id, isLoading]);

  useEffect(() => {
    if (!user || isLoading) return;
    const triggerOverdueCheck = async () => {
      try {
        const THROTTLE_KEY = 'overdue_check_last_run';
        let lastRun: string | null = null;
        if (Platform.OS === 'web') {
          lastRun = typeof localStorage !== 'undefined' ? localStorage.getItem(THROTTLE_KEY) : null;
        } else {
          lastRun = await AsyncStorage.getItem(THROTTLE_KEY);
        }
        const hourAgo = Date.now() - 60 * 60 * 1000;
        if (lastRun && Number(lastRun) > hourAgo) return;
        const now = String(Date.now());
        if (Platform.OS === 'web') {
          if (typeof localStorage !== 'undefined') localStorage.setItem(THROTTLE_KEY, now);
        } else {
          await AsyncStorage.setItem(THROTTLE_KEY, now);
        }
        const supabase = getSupabaseClient();
        const { error } = await supabase.functions.invoke('notify-overdue-logs', { body: {} });
        if (error instanceof FunctionsHttpError) {
          const txt = await error.context?.text?.();
          console.warn('[overdue-check]', txt);
        }
      } catch {}
    };
    const t = setTimeout(triggerOverdueCheck, 5000);
    return () => clearTimeout(t);
  }, [user?.id, isLoading]);

  useEffect(() => {
    if (isLoading || Platform.OS === 'web') return;
    const refreshWeeklyRecap = async () => {
      try {
        const settings = await loadNotificationSettings();
        if (!settings.weeklyRecapEnabled) return;
        const weekFitness = getDateRangeFitness(fitnessData, 7);
        const fitSummary = summarizeFitnessData(weekFitness);
        const summary = buildWeeklyRecapSummary(moodLog, [], fitSummary.avgDailySteps, streak.current);
        await syncWeeklyRecap(settings, summary);
      } catch {}
    };
    refreshWeeklyRecap();
  }, [isLoading]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const setupListener = async () => {
      try {
        responseListenerRef.current = addNotificationResponseReceivedListener(response => {
          const actionId = response.actionIdentifier;
          const data = response.notification.request.content.data;

          if (actionId === 'SNOOZE_1H') {
            snoozeCheckinOneHour().catch(() => {});
            return;
          }
          if (actionId === WATCH_ACTION_GREAT || actionId === WATCH_ACTION_GOOD || actionId === WATCH_ACTION_FINE || actionId === WATCH_ACTION_NOT_GREAT || actionId === WATCH_ACTION_LOW) {
            quickLogMoodFromWatch(actionId)
              .then(summary => sendWatchConfirmationNotification(summary))
              .catch(() => {});
            return;
          }
          const screen = data?.screen as string | undefined;
          if (screen) {
            try { router.push(screen as any); } catch {}
          } else {
            router.push('/(tabs)/checkin');
          }
        });
      } catch {}
    };
    setupListener();
    return () => { responseListenerRef.current?.remove(); };
  }, []);

  return (
    <>
    <NotificationPrePrompt
      visible={showNotifPrompt}
      onAllow={() => setShowNotifPrompt(false)}
      onSkip={() => setShowNotifPrompt(false)}
    />
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="landing" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="quiz" />
      <Stack.Screen name="result" />
      <Stack.Screen name="vibe-card-viewer" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="schumann-detail" options={{ headerShown: false }} />
      <Stack.Screen name="astrology-detail" options={{ headerShown: false }} />
      <Stack.Screen name="fitness-detail" options={{ headerShown: false }} />
      <Stack.Screen name="weather-detail" options={{ headerShown: false }} />
      <Stack.Screen name="accountability" options={{ headerShown: false }} />
      <Stack.Screen name="buddy-activity" options={{ headerShown: false }} />
      <Stack.Screen name="therapist-dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="cycle-tracker" options={{ headerShown: false }} />
      <Stack.Screen name="account" options={{ headerShown: false }} />
      <Stack.Screen name="support" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ headerShown: false }} />
      <Stack.Screen name="terms" options={{ headerShown: false }} />
    </Stack>
    </>
  );
}

export default function RootLayout() {
  try {
    return (
      <ErrorBoundary>
        <ThemeProvider>
          <AlertProvider>
            <AuthProvider>
              <SafeAreaProvider>
                <AppProvider>
                  <ThemedStatusBar />
                  <RootNavigator />
                </AppProvider>
              </SafeAreaProvider>
            </AuthProvider>
          </AlertProvider>
        </ThemeProvider>
      </ErrorBoundary>
    );
  } catch (e: any) {
    console.error('[RootLayout] render error:', e?.message);
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A14', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', paddingHorizontal: 32 }}>
          MyMoodMapp encountered a startup error.{'\n'}Please restart the app.
        </Text>
      </View>
    );
  }
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
