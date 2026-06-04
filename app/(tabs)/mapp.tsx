// @ts-nocheck
/**
 * MyMoodMapp — Mapp Visualization Dashboard
 *
 * Each layer answers a different question about your emotional state.
 * AI art is the primary canvas; data lives as overlays directly on it.
 *
 * Layer 1 — Right Now:    Radial compass gauge — your live emotional shape
 * Layer 2 — This Week:    Small-multiples: 7 mini-gauges across 7 days
 * Layer 3 — This Month:   30-day terrain map with tappable day cells
 * Layer 4 — Drivers:      Ranked correlation bars with % impact
 * Layer 5 — Forecast:     Weather-style narrative + 48-hour slots
 * Layer 6 — Mood Print:   Your unique generative emotional fingerprint
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius, Shadows, Glass, getGlass } from '@/constants/theme';
import { SUPABASE_URL } from '@/constants/supabase';
import { getSupabaseClient } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '@/hooks/useApp';
import {
  CONTEXT_TAGS,
  computeTagCorrelations,
  computeTimePatterns,
  getScoreColor,
  getScoreLabel,
  getScoreEmoji,
  MoodLogEntry,
} from '@/constants/moodlog';

// ─── Layout ───────────────────────────────────────────────────────────────────
// NOTE: Dimensions.get at module level returns 0 on web SSR.
// CONTENT_W is a safe fallback; layout-sensitive code computes reactively inside components.
const CONTENT_W = 608; // safe fallback — overridden reactively where needed

// Canvas-overlay glass tokens — always dark (sit on top of dark AI art imagery)
const G_BG   = 'rgba(6,7,20,0.75)';
const G_BORD = 'rgba(255,255,255,0.10)';
const G_TEXT = 'rgba(255,255,255,0.90)';
const G_MUTED= 'rgba(255,255,255,0.45)';

// Dimension axes — positions on the compass
const DIMS = [
  { key: 'mind',   label: 'Mind',   emoji: '🧠', color: '#7C83FF', angle: -90 },
  { key: 'energy', label: 'Energy', emoji: '⚡', color: '#4ADE80', angle:   0 },
  { key: 'body',   label: 'Body',   emoji: '💪', color: '#A78BFA', angle:  90 },
  { key: 'focus',  label: 'Focus',  emoji: '🎯', color: '#FB923C', angle: 180 },
] as const;

// ─── Radial Compass ───────────────────────────────────────────────────────────
function RadialCompass({
  dims, size, score, scoreColor, mini = false,
}: {
  dims: { mind: number; energy: number; body: number; focus: number };
  size: number; score: number | null; scoreColor: string; mini?: boolean;
}) {
  const c   = size / 2;
  const r   = c - (mini ? 8 : 20);
  const rop = mini ? 0.07 : 0.10;

  const pts = DIMS.map(d => {
    const v   = Math.max(0, Math.min(1, dims[d.key as keyof typeof dims] ?? 0));
    const rad = (d.angle * Math.PI) / 180;
    return { x: c + v * r * Math.cos(rad), y: c + v * r * Math.sin(rad),
             ax: c + r * Math.cos(rad), ay: c + r * Math.sin(rad), color: d.color };
  });

  const edges = pts.map((p, i) => {
    const n = pts[(i + 1) % pts.length];
    const dx = n.x - p.x; const dy = n.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return { x: p.x, y: p.y, len, angle: (Math.atan2(dy, dx) * 180) / Math.PI, color: p.color };
  });

  return (
    <View style={{ width: size, height: size }}>
      {[0.33, 0.66, 1].map(f => (
        <View key={f} pointerEvents="none" style={{
          position: 'absolute',
          width: r * 2 * f, height: r * 2 * f, borderRadius: r * f,
          borderWidth: f === 1 ? 1 : 0.5,
          borderColor: `rgba(255,255,255,${rop})`,
          top: c - r * f, left: c - r * f,
        }} />
      ))}
      {DIMS.map((d, i) => {
        const isV = d.angle === -90 || d.angle === 90;
        const len = r;
        return (
          <View key={d.key} pointerEvents="none" style={{
            position: 'absolute',
            width: isV ? 1 : len, height: isV ? len : 1,
            backgroundColor: `rgba(255,255,255,${rop * 1.6})`,
            left: isV ? c : (d.angle === 180 ? c - len : c),
            top:  isV ? (d.angle === -90 ? c - len : c) : c,
          }} />
        );
      })}
      {edges.map((e, i) => e.len > 1 ? (
        <View key={i} pointerEvents="none" style={{
          position: 'absolute',
          width: e.len, height: mini ? 1.5 : 2,
          backgroundColor: e.color,
          left: e.x, top: e.y - (mini ? 0.75 : 1),
          transform: [{ rotate: `${e.angle}deg` }],
          transformOrigin: '0 50%',
          opacity: 0.95,
        } as any} />
      ) : null)}
      {pts.map((p, i) => {
        const dx = p.x - c; const dy = p.y - c;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return null;
        return (
          <View key={'s' + i} pointerEvents="none" style={{
            position: 'absolute',
            width: len, height: mini ? 1 : 1.5,
            backgroundColor: p.color, opacity: 0.22,
            left: c, top: c - (mini ? 0.5 : 0.75),
            transform: [{ rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` }],
            transformOrigin: '0 50%',
          } as any} />
        );
      })}
      {pts.map((p, i) => (
        <View key={'v' + i} pointerEvents="none" style={{
          position: 'absolute',
          width: mini ? 5 : 9, height: mini ? 5 : 9,
          borderRadius: mini ? 2.5 : 4.5,
          backgroundColor: p.color,
          left: p.x - (mini ? 2.5 : 4.5),
          top:  p.y - (mini ? 2.5 : 4.5),
          shadowColor: p.color, shadowRadius: mini ? 2 : 5, shadowOpacity: 0.8, elevation: 3,
        }} />
      ))}
      {score !== null ? (
        <View pointerEvents="none" style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {mini ? (
            <Text style={{ fontSize: 10, fontWeight: '900', color: scoreColor, includeFontPadding: false } as any}>{score}</Text>
          ) : (
            <>
              <Text style={{ fontSize: 28, fontWeight: '900', color: scoreColor, includeFontPadding: false } as any}>{score}</Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 0.5, includeFontPadding: false } as any}>{getScoreLabel(score).toUpperCase()}</Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

// ─── Art cache ────────────────────────────────────────────────────────────────
// IMPORTANT: Art generation MUST go through the generate-mood-art Edge Function.
// Direct Pollinations calls are unreliable (CORS, CDN instability, no storage).
// The Edge Function: calls Pollinations → uploads to Supabase Storage → returns a
// stable public CDN URL. Always use invokeArtFunction() — never call Pollinations directly.
const ART_VER = 'v27'; // bump this when you need to force-clear all cached art
const TTL_MS  = 26 * 60 * 60 * 1000; // 26h

// TODAY_DATE is intentionally a function so web SSR never freezes it at module-load time.
// Called inside invokeArtFunction so the key always reflects the real current day.
function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Keep a module-level reference only for the stale-key pruning below (runs once on load).
const _now = new Date();
const TODAY_DATE = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

// Prune stale entries from prior days on first load (web only)
if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('ma_')) continue;
      if (!k.includes(TODAY_DATE)) toDelete.push(k);
    }
    toDelete.forEach(k => localStorage.removeItem(k));
  } catch {}
}

function wGet(k: string): string | null {
  if (Platform.OS !== 'web') return null;
  try {
    const r = localStorage.getItem('ma_' + ART_VER + '_' + k);
    if (!r) return null;
    const { u, t } = JSON.parse(r);
    if (Date.now() - t > TTL_MS) { localStorage.removeItem('ma_' + ART_VER + '_' + k); return null; }
    return u;
  } catch { return null; }
}
function wSet(k: string, u: string) {
  if (Platform.OS !== 'web') return;
  try { localStorage.setItem('ma_' + ART_VER + '_' + k, JSON.stringify({ u, t: Date.now() })); } catch {}
  // Pre-warm the browser image cache so the Canvas <img> renders instantly on mount
  if (typeof window !== 'undefined') {
    try { const _img = new window.Image(); _img.src = u; } catch {}
  }
}

// Native cache: in-memory hot layer + AsyncStorage persistence layer.
// Art URLs survive app restarts within the 26h TTL — no redundant regeneration.
const nativeMemCache: Record<string, { uri: string; t: number }> = {};
const NATIVE_CACHE_PREFIX = 'ma_native_' + ART_VER + '_';

function nGet(k: string): string | null {
  // Hot layer check (sync)
  const c = nativeMemCache[k];
  return (c && Date.now() - c.t < TTL_MS) ? c.uri : null;
}

async function nGetAsync(k: string): Promise<string | null> {
  // Hot layer
  const hot = nGet(k);
  if (hot) return hot;
  // Persistence layer
  try {
    const raw = await AsyncStorage.getItem(NATIVE_CACHE_PREFIX + k);
    if (!raw) return null;
    const { u, t } = JSON.parse(raw);
    if (Date.now() - t > TTL_MS) {
      AsyncStorage.removeItem(NATIVE_CACHE_PREFIX + k).catch(() => {});
      return null;
    }
    // Warm the hot layer so subsequent same-session calls are instant
    nativeMemCache[k] = { uri: u, t };
    return u;
  } catch { return null; }
}

function nSet(k: string, uri: string) {
  nativeMemCache[k] = { uri, t: Date.now() };
  // Persist to AsyncStorage (fire-and-forget)
  AsyncStorage.setItem(NATIVE_CACHE_PREFIX + k, JSON.stringify({ u: uri, t: Date.now() })).catch(() => {});
}

// Prune stale native cache entries once on startup
if (Platform.OS !== 'web') {
  (async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const staleKeys = (keys as string[]).filter(k =>
        k.startsWith('ma_native_') && !k.startsWith(NATIVE_CACHE_PREFIX)
      );
      if (staleKeys.length > 0) await AsyncStorage.multiRemove(staleKeys);
    } catch {}
  })();
}

/**
 * Invoke the generate-mood-art Edge Function.
 * This is the ONLY correct way to generate art in this app.
 * The function handles: Pollinations call → Storage upload → stable public URL.
 *
 * IMPORTANT: Uses raw fetch() with a 120s timeout — NOT supabase.functions.invoke().
 * The Supabase JS client has a short default timeout that causes 499 aborts
 * before Pollinations finishes generating (which takes 15-60s).
 * Raw fetch bypasses that limit and keeps the connection alive for the full duration.
 */
async function invokeArtFunction(params: Record<string, unknown>, cacheKey: string): Promise<string | null> {
  // Use live date so cache keys are always correct — avoids SSR-frozen date on web
  const dkey = `${getTodayDate()}_${cacheKey}`;

  // Check cache first — async on native to include AsyncStorage persistence layer
  const cached = Platform.OS === 'web' ? wGet(dkey) : await nGetAsync(dkey);
  if (cached) {
    // On web cache-hit, re-warm the browser image cache so display is instant
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { const _img = new window.Image(); _img.src = cached; } catch {}
    }
    return cached;
  }

  try {
    const supabase = getSupabaseClient();

    // Resolve Supabase URL — multi-source fallback ensures web builds always have it.
    // Priority: env var → client internal property → hardcoded backend URL.
    // The env var may be undefined in Vercel deployments that don't forward EXPO_PUBLIC_* vars,
    // but the already-initialized client always carries the correct URL internally.
    const supabaseUrl =
      SUPABASE_URL ||
      (supabase as any)?.supabaseUrl ||
      (supabase as any)?.storageUrl?.replace('/storage/v1', '') ||
      '';

    if (!supabaseUrl) {
      console.warn('[art] supabaseUrl is empty — cannot invoke Edge Function');
      return null;
    }
    const fnUrl = `${supabaseUrl}/functions/v1/generate-mood-art`;

    // Get the current auth session to attach the Bearer token.
    // On web, the Supabase client persists the session in localStorage.
    // On native, the template client stores the session in AsyncStorage/SecureStore.
    // Multi-source fallback: getSession() → internal client state → AsyncStorage.
    let token = '';
    try {
      // Primary: standard getSession()
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token ?? '';
    } catch (authErr) {
      console.warn('[art] getSession() failed:', authErr);
    }
    // Fallback 1: read from internal client state
    if (!token) {
      try {
        const internalSession = (supabase as any)?.auth?.currentSession
          ?? (supabase as any)?.auth?._session
          ?? (supabase as any)?.realtime?.accessToken
          ?? null;
        if (internalSession) token = typeof internalSession === 'string' ? internalSession : (internalSession?.access_token ?? '');
      } catch {}
    }
    // Fallback 2: read from AsyncStorage on native
    if (!token && Platform.OS !== 'web') {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const keys = await AsyncStorage.getAllKeys();
        const sessionKey = keys.find((k: string) => k.includes('supabase') && k.includes('auth-token'));
        if (sessionKey) {
          const raw = await AsyncStorage.getItem(sessionKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            const session = parsed?.currentSession ?? parsed?.session ?? parsed;
            token = session?.access_token ?? '';
          }
        }
      } catch {}
    }

    // Last resort: try refreshing the session
    if (!token) {
      try {
        const { data } = await supabase.auth.refreshSession();
        token = data?.session?.access_token ?? '';
      } catch {}
    }

    if (!token) {
      console.warn('[art] No auth token — cannot generate art (user not logged in or session expired)');
      return null;
    }

    // Raw fetch with 180s timeout — avoids Supabase JS client's short default timeout
    // that was causing 499 aborts before Pollinations generation completed (15-60s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    let response: Response;
    try {
      response = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn(`[art] Edge Function HTTP ${response.status}:`, text);
      // On web, browsers sometimes abort long-running fetches before the Edge Function
      // finishes (OS-level connection reuse timeouts). Give one automatic retry.
      if (Platform.OS === 'web' && response.status >= 500) {
        console.log('[art] Web retry after server error...');
        await new Promise(r => setTimeout(r, 3000));
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 180000);
        try {
          const resp2 = await fetch(fnUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(params),
            signal: controller2.signal,
          });
          if (resp2.ok) {
            const d2 = await resp2.json();
            const u2 = d2?.artUrl as string | undefined;
            if (u2) { wSet(dkey, u2); return u2; }
          }
        } finally { clearTimeout(timeout2); }
      }
      return null;
    }

    const data = await response.json();
    const url = data?.artUrl as string | undefined;
    if (!url) return null;

    // Cache the stable Storage URL
    if (Platform.OS === 'web') {
      wSet(dkey, url);
    } else {
      nSet(dkey, url);
    }
    return url;
  } catch (e) {
    console.warn('[art] invokeArtFunction failed:', e);
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ArtState = { url: string | null; loading: boolean; error?: boolean };
type AllArt   = { now: ArtState; week: ArtState; month: ArtState; forecast: ArtState; print: ArtState };
type DayData  = {
  ds: string; dayLabel?: string; dayNum?: number; isToday: boolean;
  count: number; avg: number | null;
  dims: { body: number; mind: number; energy: number; focus: number };
  entries?: MoodLogEntry[];
};
type LayerKey = 'now' | 'week' | 'month' | 'correlations' | 'forecast' | 'print';

const LAYERS: { id: LayerKey; label: string; emoji: string }[] = [
  { id: 'correlations', label: 'Drivers',    emoji: '📊' },
  { id: 'now',          label: 'Now',        emoji: '🔴' },
  { id: 'week',         label: 'Week',       emoji: '📅' },
  { id: 'month',        label: 'Month',      emoji: '🗺️' },
  { id: 'forecast',     label: 'Forecast',   emoji: '🔮' },
  { id: 'print',        label: 'Mood Print', emoji: '✨' },
];

// ─── Canvas (art bg + gradient + data overlay) ────────────────────────────────
function Canvas({
  artUrl, loading, height, onRegen, onFail, showRetryOnFail = false, gradient = 'soft', children,
}: {
  artUrl: string | null; loading: boolean; height: number;
  onRegen: () => void; onFail?: () => void;
  showRetryOnFail?: boolean;
  error?: boolean;
  gradient?: 'soft' | 'full' | 'vignette';
  children: React.ReactNode;
}) {
  const gc: [string, string, string] =
    gradient === 'full'    ? ['rgba(6,7,20,0.55)', 'rgba(6,7,20,0.25)', 'rgba(6,7,20,0.80)']
    : gradient === 'vignette' ? ['rgba(6,7,20,0.60)', 'rgba(6,7,20,0.10)', 'rgba(6,7,20,0.65)']
    :                         ['rgba(6,7,20,0.02)', 'rgba(6,7,20,0.02)', 'rgba(6,7,20,0.82)'];

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgErr,    setImgErr]    = useState(false);
  useEffect(() => { setImgLoaded(false); setImgErr(false); }, [artUrl]);

  return (
    <View style={[cs.wrap, { height }]}>
      {artUrl ? (
        Platform.OS === 'web' ? (
          <>
            {!imgLoaded && !imgErr && (
              <View style={[StyleSheet.absoluteFill, cs.shimmer]}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={cs.shimText}>Rendering your AI art…</Text>
              </View>
            )}
            <img src={artUrl} alt="" loading="eager" decoding="async" style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', display: 'block',
              opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease',
            } as any}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgErr(true)}
            />
          </>
        ) : (
          <Image source={{ uri: artUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={700} />
        )
      ) : loading ? (
        <View style={[StyleSheet.absoluteFill, cs.shimmer]}>
          <ActivityIndicator size="small" color={Colors.primary} />
          {/* Same message on web and native — generation takes 15–60s */}
          <Text style={cs.shimText}>Rendering your AI art — up to 60 s…</Text>
        </View>
      ) : (
        <View style={[StyleSheet.absoluteFill, cs.placeholder]}>
          <MaterialIcons name="auto-awesome" size={22} color="rgba(255,255,255,0.2)" />
          <Text style={cs.plhText}>Art generates automatically when you log a mood</Text>
          {(showRetryOnFail) ? (
            <Pressable
              onPress={onRegen}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: 'rgba(124,131,255,0.20)',
                borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8,
                borderWidth: 1, borderColor: 'rgba(124,131,255,0.50)',
                marginTop: 12, opacity: pressed ? 0.7 : 1,
              }]}
            >
              <MaterialIcons name="refresh" size={16} color="#7C83FF" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#7C83FF', includeFontPadding: false } as any}>Try Again</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <LinearGradient colors={gc} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">{children}</View>
      {artUrl && !loading ? (
        <View style={cs.badge} pointerEvents="none">
          <MaterialIcons name="auto-awesome" size={9} color={Colors.primary} />
          <Text style={cs.badgeText}>AI · unique to your data</Text>
        </View>
      ) : null}
    </View>
  );
}
const cs = StyleSheet.create({
  wrap:        { width: '100%', borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: '#0A0B1E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', ...Shadows.md },
  shimmer:     { alignItems: 'center', justifyContent: 'center', gap: 10 },
  shimText:    { fontSize: 15, color: 'rgba(255,255,255,0.55)', textAlign: 'center', paddingHorizontal: 32, includeFontPadding: false },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  plhText:     { fontSize: 15, color: 'rgba(255,255,255,0.40)', includeFontPadding: false },
  badge:       { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: G_BG, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, borderColor: G_BORD },
  badgeText:   { fontSize: 11, color: Colors.primary, fontWeight: '700', includeFontPadding: false },
});

// ─── Stat Row (theme-aware) ───────────────────────────────────────────────────
function StatRow({ items }: { items: { val: string; label: string; color?: string }[] }) {
  const { colors: C, isDark } = useTheme();
  const G = getGlass(isDark);
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map((s, i) => (
        <View key={i} style={{
          flex: 1, alignItems: 'center', justifyContent: 'center',
          backgroundColor: G.cardBg,
          borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 4, gap: 3,
          borderWidth: 1, borderColor: G.cardBorder,
        }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: s.color ?? C.textPrimary, includeFontPadding: false } as any}>{s.val}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 11, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, includeFontPadding: false, textAlign: 'center' } as any}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Glass Card (theme-aware) ─────────────────────────────────────────────────
function GCard({ children, style }: { children: React.ReactNode; style?: any }) {
  const { colors: C, isDark } = useTheme();
  const G = getGlass(isDark);
  return (
    <View style={[
      {
        backgroundColor: G.cardBg,
        borderRadius: Radius.xl,
        padding: Spacing.lg,
        gap: 12,
        borderWidth: 1,
        borderColor: G.cardBorder,
        ...Shadows.sm,
      },
      style,
    ]}>
      {/* Specular top-edge highlight */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          backgroundColor: G.specularTop, borderTopLeftRadius: Radius.xl,
          borderTopRightRadius: Radius.xl, opacity: 0.5,
        }}
      />
      {children}
    </View>
  );
}

// ─── Empty State (theme-aware) ────────────────────────────────────────────────
function Empty({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  const { colors: C } = useTheme();
  return (
    <View style={{ minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 }}>
      <MaterialIcons name={icon as any} size={44} color={C.textMuted} />
      <Text style={{ fontSize: 17, fontWeight: '700', color: C.textPrimary, textAlign: 'center', includeFontPadding: false } as any}>{title}</Text>
      <Text style={{ fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 22, includeFontPadding: false } as any}>{sub}</Text>
    </View>
  );
}

// =============================================================================
// MAIN SCREEN
// =============================================================================
export default function MappScreen() {
  const { moodLogEntries, todayMoodLogEntries, weatherData, sex, tempUnit, fitnessData } = useApp();
  const { colors: C } = useTheme();

  const [activeLayer, setActiveLayer] = useState<LayerKey>('correlations');
  const [art, setArt] = useState<AllArt>({
    now:      { url: null, loading: false, error: false },
    week:     { url: null, loading: false, error: false },
    month:    { url: null, loading: false, error: false },
    forecast: { url: null, loading: false, error: false },
    print:    { url: null, loading: false, error: false },
  });

  const patchArt = useCallback((k: keyof AllArt, p: Partial<ArtState>) =>
    setArt(prev => ({ ...prev, [k]: { ...prev[k], ...p } })), []);

  const fetchRef = useRef<Set<string>>(new Set());

  // In-flight promise dedup map — prevents duplicate concurrent fetches for the same layer.
  // If doFetch('now', ...) is already running and called again, the second call is a no-op.
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map());

  const doFetch = useCallback((k: keyof AllArt, params: Record<string, unknown>, ckey: string): Promise<void> => {
    // Dedup: if already running for this key, return the existing promise
    const existing = inflightRef.current.get(k);
    if (existing) return existing;

    const promise = (async () => {
      if (fetchRef.current.has(k)) return;
      fetchRef.current.add(k);
      try {
        patchArt(k, { loading: true, error: false });
        // Route through Edge Function — do NOT call Pollinations directly.
        // Edge Function handles: 2 retries × 60s per attempt + 10s backoff on 429.
        // CLIENT RULE (PROJECT_NOTES): raw fetch with 130s timeout — never use supabase.functions.invoke().
        // Do NOT add client-side retries here — the Edge Function already retries internally.
        const uri = await invokeArtFunction(params, ckey);
        patchArt(k, { url: uri ?? null, loading: false, error: !uri });
      } catch {
        patchArt(k, { loading: false, error: true });
      } finally {
        fetchRef.current.delete(k);
        inflightRef.current.delete(k);
      }
    })();

    inflightRef.current.set(k, promise);
    return promise;
  }, [patchArt]);

  // ── Computed data ──────────────────────────────────────────────────────────
  // Build an averaged "today" entry so the Now layer matches the dashboard score.
  // If there are multiple logs today we average all dimensions and scores, just
  // like the dashboard widget does — preventing a stale single-entry mismatch.
  const todayAvgEntry = useMemo<MoodLogEntry | null>(() => {
    const entries = todayMoodLogEntries;
    if (!entries.length) return null;
    if (entries.length === 1) return entries[0];
    const n = entries.length;
    const avgScore  = Math.round(entries.reduce((s, e) => s + e.score, 0) / n);
    const avgBody   = entries.reduce((s, e) => s + e.dimensions.body,   0) / n;
    const avgMind   = entries.reduce((s, e) => s + e.dimensions.mind,   0) / n;
    const avgEnergy = entries.reduce((s, e) => s + e.dimensions.energy, 0) / n;
    const avgFocus  = entries.reduce((s, e) => s + e.dimensions.focus,  0) / n;
    // Use the most recent entry as the base; override score + dimensions with averages
    const base = entries[entries.length - 1];
    return {
      ...base,
      // Synthetic id encodes the count so art regenerates when a new log is added
      id: `avg_${base.date}_n${n}`,
      score: avgScore,
      dimensions: { body: avgBody, mind: avgMind, energy: avgEnergy, focus: avgFocus },
    };
  }, [todayMoodLogEntries]);

  const lastAll   = moodLogEntries[moodLogEntries.length - 1] ?? null;
  const latest    = useMemo(() => todayAvgEntry ?? lastAll, [todayAvgEntry, lastAll]);

  const tagCorr    = useMemo(() => computeTagCorrelations(moodLogEntries), [moodLogEntries]);
  const timePat    = useMemo(() => computeTimePatterns(moodLogEntries), [moodLogEntries]);
  const volatility = useMemo(() => {
    if (moodLogEntries.length < 5) return 'stable';
    const sc = moodLogEntries.slice(-14).map(e => e.score);
    const av = sc.reduce((a, b) => a + b, 0) / sc.length;
    const sd = Math.sqrt(sc.reduce((s, n) => s + (n - av) ** 2, 0) / sc.length) / 100;
    return sd < 0.15 ? 'stable' : sd < 0.3 ? 'variable' : 'fluid';
  }, [moodLogEntries]);

  const weekDays = useMemo<DayData[]>(() => {
    const today = new Date().toISOString().split('T')[0];
    return Array.from({ length: 7 }, (_, i) => {
      const d  = new Date(Date.now() - (6 - i) * 86400000);
      const ds = d.toISOString().split('T')[0];
      const de = moodLogEntries.filter(e => e.date === ds);
      const avg  = de.length ? de.reduce((s, e) => s + e.score, 0) / de.length : null;
      const avgB = de.length ? de.reduce((s, e) => s + (e.dimensions.body + 1) / 2, 0) / de.length : 0;
      const avgM = de.length ? de.reduce((s, e) => s + (e.dimensions.mind + 1) / 2, 0) / de.length : 0;
      const avgE = de.length ? de.reduce((s, e) => s + e.dimensions.energy, 0) / de.length : 0;
      const avgF = de.length ? de.reduce((s, e) => s + e.dimensions.focus, 0) / de.length : 0;
      return { ds, dayLabel: ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()], isToday: ds === today, count: de.length, avg, dims: { body: avgB, mind: avgM, energy: avgE, focus: avgF }, entries: de };
    });
  }, [moodLogEntries]);

  const weekAvg  = useMemo(() => { const v = weekDays.filter(d => d.avg !== null); return v.length ? Math.round(v.reduce((s, d) => s + d.avg!, 0) / v.length) : null; }, [weekDays]);
  const monthDays = useMemo<DayData[]>(() => {
    const today = new Date().toISOString().split('T')[0];
    return Array.from({ length: 30 }, (_, i) => {
      const d  = new Date(Date.now() - (29 - i) * 86400000);
      const ds = d.toISOString().split('T')[0];
      const de = moodLogEntries.filter(e => e.date === ds);
      const avg = de.length ? Math.round(de.reduce((s, e) => s + e.score, 0) / de.length) : null;
      const avgB = de.length ? de.reduce((s, e) => s + (e.dimensions.body + 1) / 2, 0) / de.length : 0;
      const avgM = de.length ? de.reduce((s, e) => s + (e.dimensions.mind + 1) / 2, 0) / de.length : 0;
      const avgE = de.length ? de.reduce((s, e) => s + e.dimensions.energy, 0) / de.length : 0;
      const avgF = de.length ? de.reduce((s, e) => s + e.dimensions.focus, 0) / de.length : 0;
      return { ds, dayNum: d.getDate(), isToday: ds === today, count: de.length, avg, entries: de, dims: { body: avgB, mind: avgM, energy: avgE, focus: avgF } };
    });
  }, [moodLogEntries]);

  const monthAvg    = useMemo(() => { const v = monthDays.filter(d => d.avg !== null); return v.length ? Math.round(v.reduce((s, d) => s + d.avg!, 0) / v.length) : null; }, [monthDays]);
  const baseline    = useMemo(() => moodLogEntries.length ? Math.round(moodLogEntries.reduce((s, e) => s + e.score, 0) / moodLogEntries.length) : null, [moodLogEntries]);
  const forecastAvg = useMemo(() => {
    if (!baseline) return 50;
    const h = new Date().getHours();
    const slots = Array.from({ length: 8 }, (_, i) => {
      const sh  = (h + (i + 1) * 6) % 24;
      const tod = sh < 12 ? 'morning' : sh < 17 ? 'afternoon' : sh < 21 ? 'evening' : 'night';
      const tp  = timePat.find(t => t.timeOfDay === tod);
      return tp ? tp.avgScore : baseline;
    });
    return Math.round(slots.reduce((s, n) => s + n, 0) / slots.length);
  }, [baseline, timePat]);

  const printStats = useMemo(() => {
    if (moodLogEntries.length < 3) return null;
    const sc = moodLogEntries.map(e => e.score);
    const av = sc.reduce((a, b) => a + b, 0) / sc.length;
    const vl = Math.sqrt(sc.reduce((s, n) => s + (n - av) ** 2, 0) / sc.length) / 100;
    const aB = moodLogEntries.reduce((s, e) => s + (e.dimensions.body + 1) / 2, 0) / moodLogEntries.length;
    const aM = moodLogEntries.reduce((s, e) => s + (e.dimensions.mind + 1) / 2, 0) / moodLogEntries.length;
    const aE = moodLogEntries.reduce((s, e) => s + e.dimensions.energy, 0) / moodLogEntries.length;
    const top = tagCorr[0];
    const vStr = vl < 0.15 ? 'stable' : vl < 0.3 ? 'variable' : 'fluid';
    const tr = moodLogEntries.length > 7
      ? (moodLogEntries.slice(-7).reduce((s, e) => s + e.score, 0) / 7 > moodLogEntries.slice(-14, -7).reduce((s, e) => s + e.score, 0) / 7 ? 'improving' : 'declining')
      : 'stable';
    return { avg: av, volatility: vStr, avgBody: aB, avgMind: aM, avgEnergy: aE, topTag: top, count: moodLogEntries.length, trend: tr };
  }, [moodLogEntries, tagCorr]);

  const artRef         = useRef(art);          useEffect(() => { artRef.current = art; }, [art]);
  const weekAvgRef     = useRef(weekAvg);      useEffect(() => { weekAvgRef.current = weekAvg; }, [weekAvg]);
  const weekDaysRef    = useRef(weekDays);     useEffect(() => { weekDaysRef.current = weekDays; }, [weekDays]);
  const monthAvgRef    = useRef(monthAvg);     useEffect(() => { monthAvgRef.current = monthAvg; }, [monthAvg]);
  const baselineRef    = useRef(baseline);     useEffect(() => { baselineRef.current = baseline; }, [baseline]);
  const forecastAvgRef = useRef(forecastAvg);  useEffect(() => { forecastAvgRef.current = forecastAvg; }, [forecastAvg]);
  const printRef       = useRef(printStats);   useEffect(() => { printRef.current = printStats; }, [printStats]);
  const weatherRef     = useRef(weatherData);  useEffect(() => { weatherRef.current = weatherData; }, [weatherData]);
  const latestRef      = useRef(latest);       useEffect(() => { latestRef.current = latest; }, [latest]);
  const volatilityRef  = useRef(volatility);   useEffect(() => { volatilityRef.current = volatility; }, [volatility]);

  const regenNow = useCallback(() => {
    const entry = latest;
    if (!entry) return;
    fetchRef.current.delete('now');
    inflightRef.current.delete('now');
    patchArt('now', { url: null, loading: false, error: false });
    const bustStr = String(entry.id ?? entry.timestamp ?? Date.now());
    let bustSeed = 0;
    for (let i = 0; i < bustStr.length; i++) bustSeed = ((bustSeed * 31 + bustStr.charCodeAt(i)) >>> 0);
    bustSeed = ((bustSeed ^ Date.now()) % 999999) || 1; // mix with timestamp for forced regen
    doFetch('now', { artType: 'now', score: entry.score, dimensions: entry.dimensions, timeOfDay: entry.timeOfDay, volatility, seedOverride: bustSeed }, `now_${entry.id ?? entry.timestamp}_regen_${Date.now()}`);
  }, [doFetch, patchArt, latest, volatility]);

  const regenWeek = useCallback(() => {
    const wA = weekAvgRef.current; if (!wA) return;
    fetchRef.current.delete('week'); inflightRef.current.delete('week'); patchArt('week', { url: null, loading: false, error: false });
    const vd = weekDaysRef.current.filter((d: DayData) => d.avg !== null);
    const wb = vd.reduce((s: number, d: DayData) => s + d.dims.body, 0) / Math.max(vd.length, 1);
    const wm = vd.reduce((s: number, d: DayData) => s + d.dims.mind, 0) / Math.max(vd.length, 1);
    const we = vd.reduce((s: number, d: DayData) => s + d.dims.energy, 0) / Math.max(vd.length, 1);
    const bustSeed = (Math.floor(Math.random() * 999999) + 1);
    doFetch('week', { artType: 'landscape', score: wA, dimensions: { body: wb * 2 - 1, mind: wm * 2 - 1, energy: we, focus: 0.5 }, trend: 'stable', weatherCondition: weatherRef.current?.condition, seedOverride: bustSeed }, `week_${wA}_regen_${Date.now()}`);
  }, [doFetch, patchArt]);

  const regenMonth = useCallback(() => {
    const mA = monthAvgRef.current; if (!mA) return;
    fetchRef.current.delete('month'); inflightRef.current.delete('month'); patchArt('month', { url: null, loading: false, error: false });
    const bustSeed = (Math.floor(Math.random() * 999999) + 1);
    doFetch('month', { artType: 'landscape', score: mA, dimensions: { body: 0, mind: 0, energy: 0.5, focus: 0.5 }, trend: mA > 60 ? 'improving' : mA < 40 ? 'declining' : 'stable', seedOverride: bustSeed }, `month_${mA}_regen_${Date.now()}`);
  }, [doFetch, patchArt]);

  const regenForecast = useCallback(() => {
    const bl = baselineRef.current; if (!bl) return;
    fetchRef.current.delete('forecast'); inflightRef.current.delete('forecast'); patchArt('forecast', { url: null, loading: false, error: false });
    const fA = forecastAvgRef.current;
    const tod = new Date().getHours(); const tl = tod < 12 ? 'morning' : tod < 17 ? 'afternoon' : tod < 21 ? 'evening' : 'night';
    // Include a random seed override so each manual regen / auto-retry produces a distinct URL
    const bustSeed = (Math.floor(Math.random() * 999999) + 1);
    doFetch('forecast', { artType: 'forecast', score: fA, forecastMood: fA >= 65 ? 'high' : fA < 45 ? 'low' : 'moderate', timeOfDay: tl, weatherCondition: weatherRef.current?.condition, trend: 'stable', seedOverride: bustSeed }, `fcast_${fA}_${tl}_regen_${Date.now()}`);
  }, [doFetch, patchArt]);

  const regenPrint = useCallback(() => {
    const ps = printRef.current; if (!ps) return;
    fetchRef.current.delete('print'); inflightRef.current.delete('print'); patchArt('print', { url: null, loading: false, error: false });
    const tl = ps.topTag ? CONTEXT_TAGS.find(t => t.id === ps.topTag!.tagId)?.label ?? null : null;
    const bustSeed = (Math.floor(Math.random() * 999999) + 1);
    doFetch('print', { artType: 'print', score: Math.round(ps.avg), dimensions: { body: ps.avgBody * 2 - 1, mind: ps.avgMind * 2 - 1, energy: ps.avgEnergy, focus: 0.5 }, volatility: ps.volatility, trend: ps.trend, dominantTag: tl, entryCount: ps.count, seedOverride: bustSeed }, `print_${Math.round(ps.avg)}_${ps.count}_regen_${Date.now()}`);
  }, [doFetch, patchArt]);

  useEffect(() => {
    if (!moodLogEntries.length) return;
    const a = artRef.current;
    switch (activeLayer) {
      case 'now':
        if (!a.now.url && !a.now.loading && latest) {
          const bustStr = String(latest.id ?? latest.timestamp ?? Date.now());
          let bustSeed = 0;
          for (let i = 0; i < bustStr.length; i++) bustSeed = ((bustSeed * 31 + bustStr.charCodeAt(i)) >>> 0);
          bustSeed = (bustSeed % 999999) || 1;
          doFetch('now', { artType: 'now', score: latest.score, dimensions: latest.dimensions, timeOfDay: latest.timeOfDay, volatility, seedOverride: bustSeed }, `now_${latest.id ?? latest.timestamp}`);
        } break;
      case 'week':
        if (!a.week.url && !a.week.loading && weekAvg) {
          const vd = weekDays.filter((d: DayData) => d.avg !== null);
          const wb = vd.reduce((s: number, d: DayData) => s + d.dims.body, 0) / Math.max(vd.length, 1);
          const wm = vd.reduce((s: number, d: DayData) => s + d.dims.mind, 0) / Math.max(vd.length, 1);
          const we = vd.reduce((s: number, d: DayData) => s + d.dims.energy, 0) / Math.max(vd.length, 1);
          // Cache key: date + log count — new art on every new mood entry
          doFetch('week', { artType: 'landscape', score: weekAvg, dimensions: { body: wb * 2 - 1, mind: wm * 2 - 1, energy: we, focus: 0.5 }, trend: 'stable', weatherCondition: weatherData?.condition }, `week_${weekAvg}_L${moodLogEntries.length}`);
        } break;
      case 'month':
        if (!a.month.url && !a.month.loading && monthAvg)
          doFetch('month', { artType: 'landscape', score: monthAvg, dimensions: { body: 0, mind: 0, energy: 0.5, focus: 0.5 }, trend: monthAvg > 60 ? 'improving' : monthAvg < 40 ? 'declining' : 'stable' }, `month_${monthAvg}_L${moodLogEntries.length}`);
        break;
      case 'forecast':
        if (!a.forecast.url && !a.forecast.loading && baseline && moodLogEntries.length >= 5) {
          const tod = new Date().getHours(); const tl = tod < 12 ? 'morning' : tod < 17 ? 'afternoon' : tod < 21 ? 'evening' : 'night';
          doFetch('forecast', { artType: 'forecast', score: forecastAvg, forecastMood: forecastAvg >= 65 ? 'high' : forecastAvg < 45 ? 'low' : 'moderate', timeOfDay: tl, weatherCondition: weatherData?.condition, trend: 'stable' }, `fcast_${forecastAvg}_${tl}_L${moodLogEntries.length}`);
        } break;
      case 'print':
        if (!a.print.url && !a.print.loading && printStats) {
          const tl = printStats.topTag ? CONTEXT_TAGS.find(t => t.id === printStats.topTag!.tagId)?.label ?? null : null;
          doFetch('print', { artType: 'print', score: Math.round(printStats.avg), dimensions: { body: printStats.avgBody * 2 - 1, mind: printStats.avgMind * 2 - 1, energy: printStats.avgEnergy, focus: 0.5 }, volatility: printStats.volatility, trend: printStats.trend, dominantTag: tl, entryCount: printStats.count }, `print_${Math.round(printStats.avg)}_${printStats.count}`);
        } break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayer, doFetch, latest, volatility, weekAvg, weekDays, monthAvg, baseline, forecastAvg, printStats, weatherData, moodLogEntries.length]);

  // Background pre-fetch: fires ALL 5 art pieces in PARALLEL with individual guards.
  // Previously sequential (await each before starting next), which meant a slow/failed
  // layer blocked all subsequent layers. Now each layer races independently —
  // a 60s Now generation no longer delays Week from starting.
  // Guards prevent duplicate fetches: fetchRef dedup + inflightRef promise dedup.
  const lastFetchedLogCount = useRef(-1);

  useEffect(() => {
    if (!moodLogEntries.length) return;
    // Only re-run when a new mood is logged (log count changed) and not all art is cached
    if (lastFetchedLogCount.current === moodLogEntries.length && Object.values(artRef.current).every(a => a.url)) return;
    lastFetchedLogCount.current = moodLogEntries.length;

    const logCount = moodLogEntries.length;

    // ── Now ───────────────────────────────────────────────────────────────
    const tryNow = () => {
      const entry = latestRef.current;
      if (!entry || fetchRef.current.has('now') || artRef.current.now.url) return;
      const bustStr = String(entry.id ?? entry.timestamp ?? Date.now());
      let bustSeed = 0;
      for (let i = 0; i < bustStr.length; i++) bustSeed = ((bustSeed * 31 + bustStr.charCodeAt(i)) >>> 0);
      bustSeed = (bustSeed % 999999) || 1;
      doFetch('now', { artType: 'now', score: entry.score, dimensions: entry.dimensions, timeOfDay: entry.timeOfDay, volatility: volatilityRef.current, seedOverride: bustSeed }, `now_${entry.id ?? entry.timestamp}`).catch(() => {});
    };
    // ── Week ─────────────────────────────────────────────────────────────
    const tryW = () => {
      const _wA = weekAvgRef.current;
      if (!_wA || fetchRef.current.has('week') || artRef.current.week.url) return;
      const vd = weekDaysRef.current.filter((d: DayData) => d.avg !== null);
      const wb = vd.reduce((s: number, d: DayData) => s + d.dims.body, 0) / Math.max(vd.length, 1);
      const wm = vd.reduce((s: number, d: DayData) => s + d.dims.mind, 0) / Math.max(vd.length, 1);
      const we = vd.reduce((s: number, d: DayData) => s + d.dims.energy, 0) / Math.max(vd.length, 1);
      doFetch('week', { artType: 'landscape', score: _wA, dimensions: { body: wb * 2 - 1, mind: wm * 2 - 1, energy: we, focus: 0.5 }, trend: 'stable', weatherCondition: weatherRef.current?.condition }, `week_${_wA}_L${logCount}`).catch(() => {});
    };
    // ── Month ────────────────────────────────────────────────────────────
    const tryM = () => {
      const _mA = monthAvgRef.current;
      if (!_mA || fetchRef.current.has('month') || artRef.current.month.url) return;
      doFetch('month', { artType: 'landscape', score: _mA, dimensions: { body: 0, mind: 0, energy: 0.5, focus: 0.5 }, trend: _mA > 60 ? 'improving' : _mA < 40 ? 'declining' : 'stable' }, `month_${_mA}_L${logCount}`).catch(() => {});
    };
    // ── Forecast ─────────────────────────────────────────────────────────
    const tryF = () => {
      const _bl = baselineRef.current;
      if (!_bl || fetchRef.current.has('forecast') || artRef.current.forecast.url) return;
      const _fA = forecastAvgRef.current;
      const tod = new Date().getHours();
      const tl = tod < 12 ? 'morning' : tod < 17 ? 'afternoon' : tod < 21 ? 'evening' : 'night';
      doFetch('forecast', { artType: 'forecast', score: _fA, forecastMood: _fA >= 65 ? 'high' : _fA < 45 ? 'low' : 'moderate', timeOfDay: tl, weatherCondition: weatherRef.current?.condition, trend: 'stable' }, `fcast_${_fA}_${tl}_L${logCount}`).catch(() => {});
    };
    // ── Print ────────────────────────────────────────────────────────────
    const tryP = () => {
      const _ps = printRef.current;
      if (!_ps || fetchRef.current.has('print') || artRef.current.print.url) return;
      const tl = _ps.topTag ? CONTEXT_TAGS.find(t => t.id === _ps.topTag!.tagId)?.label ?? null : null;
      doFetch('print', { artType: 'print', score: Math.round(_ps.avg), dimensions: { body: _ps.avgBody * 2 - 1, mind: _ps.avgMind * 2 - 1, energy: _ps.avgEnergy, focus: 0.5 }, volatility: _ps.volatility, trend: _ps.trend, dominantTag: tl, entryCount: _ps.count }, `print_${Math.round(_ps.avg)}_${_ps.count}`).catch(() => {});
    };

    // Fire all layers in parallel — each has its own guard, failures are isolated
    tryNow();
    tryW();
    tryM();
    tryF();
    tryP();
  }, [moodLogEntries.length, doFetch]); // eslint-disable-line

  const TILE_W = 88;
  const TILE_H = 64;

  const tabBar = (
    <View style={[st.tabScrollWrap, { borderBottomColor: C.border }]}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={st.tabContent}
    >
      {LAYERS.map(l => {
        const ak = l.id !== 'correlations' ? l.id as keyof AllArt : null;
        const la = ak ? art[ak] : null;
        const active = activeLayer === l.id;
        const hasArt = !!(la?.url);
        const isLoading = !!(la?.loading);
        const tileUrl = la?.url ?? null;

        return (
          <Pressable
            key={l.id}
            onPress={() => setActiveLayer(l.id)}
            style={({ pressed }) => [st.tile, active && st.tileActive, pressed && { opacity: 0.8 }]}
          >
            <View style={[st.tileArt, { width: TILE_W, height: TILE_H }]}>
              {tileUrl ? (
                Platform.OS === 'web' ? (
                  <img src={tileUrl} alt="" loading="eager" fetchPriority="high" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: Radius.md } as any} />
                ) : (
                  <Image source={{ uri: tileUrl }} style={{ width: TILE_W, height: TILE_H, borderRadius: Radius.md }} contentFit="cover" />
                )
              ) : (
                <View style={[st.tileArtPlaceholder, { width: TILE_W, height: TILE_H }]}>
                  <Text style={{ fontSize: 20 }}>{l.emoji}</Text>
                </View>
              )}
              <LinearGradient
                colors={['rgba(6,7,20,0.1)', 'rgba(6,7,20,0.7)']}
                style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]}
                pointerEvents="none"
              />
              {isLoading && !tileUrl ? (
                <View style={st.tileSpinner}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : null}
              <View style={st.tileBottom} pointerEvents="none">
                <Text style={[st.tileLabel, active && st.tileLabelActive]} numberOfLines={1}>{l.label}</Text>
              </View>
              {active ? (
                <View style={[StyleSheet.absoluteFill, st.tileActiveBorder, { borderRadius: Radius.md }]} pointerEvents="none" />
              ) : null}
              {hasArt && !active ? (
                <View style={st.tileDotReady} />
              ) : isLoading ? (
                <View style={st.tileDotLoad} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: C.background }]} edges={['top']}>
      <View style={[st.header, { borderBottomColor: C.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[st.title, { color: C.textPrimary }]}>Mapp</Text>
          <Text style={[st.sub, { color: C.textMuted }]}>Your emotional landscape</Text>
        </View>
        <View style={st.aiBadge}>
          <MaterialIcons name="auto-awesome" size={11} color={Colors.primary} />
          <Text style={st.aiBadgeText}>AI-powered</Text>
        </View>
      </View>

      {tabBar}

      <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false} key={activeLayer}>
        {activeLayer === 'now'          && <LayerNow entry={latest} allEntries={moodLogEntries} volatility={volatility} artState={art.now} onRegen={regenNow} />}
        {activeLayer === 'week'         && <LayerWeek days={weekDays} weekAvg={weekAvg} weatherData={weatherData} artState={art.week} onRegen={regenWeek} tempUnit={tempUnit} />}
        {activeLayer === 'month'        && <LayerMonth days={monthDays} monthAvg={monthAvg} entries={moodLogEntries} artState={art.month} onRegen={regenMonth} />}
        {activeLayer === 'correlations' && <LayerDrivers entries={moodLogEntries} timePat={timePat} tagCorr={tagCorr} />}
        {activeLayer === 'forecast'     && <LayerForecast entries={moodLogEntries} weatherData={weatherData} timePat={timePat} tagCorr={tagCorr} baseline={baseline} forecastAvg={forecastAvg} artState={art.forecast} onRegen={regenForecast} tempUnit={tempUnit} fitnessData={fitnessData} />}
        {activeLayer === 'print'        && <LayerPrint entries={moodLogEntries} stats={printStats} artState={art.print} onRegen={regenPrint} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  title:        { fontSize: 24, fontWeight: '900', letterSpacing: 0.5, includeFontPadding: false },
  sub:          { fontSize: 15, includeFontPadding: false, marginTop: 1 },
  aiBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '18', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary + '35' },
  aiBadgeText:  { fontSize: 13, fontWeight: '700', color: Colors.primary, includeFontPadding: false },
  tabScrollWrap: { borderBottomWidth: 1 },
  tabContent:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, flexGrow: 0 },
  tile:         { borderRadius: Radius.md, overflow: 'hidden' },
  tileActive:   {},
  tileArt:      { borderRadius: Radius.md, overflow: 'hidden', backgroundColor: '#0A0B1E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', justifyContent: 'center', alignItems: 'center' },
  tileArtPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  tileBottom:   { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 6, paddingBottom: 5 },
  tileLabel:    { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.65)', textAlign: 'center', includeFontPadding: false },
  tileLabelActive: { color: Colors.primary, fontWeight: '800' },
  tileActiveBorder: { borderWidth: 2, borderColor: Colors.primary },
  tileSpinner:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 16, justifyContent: 'center', alignItems: 'center' },
  tileDotReady: { position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  tileDotLoad:  { position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.warning },
  content:      { padding: 20, paddingBottom: 80, gap: 20 },
});

// ─── Shared card text styles (color applied inline via theme) ─────────────────
const lz = StyleSheet.create({
  sTitle:  { fontSize: 17, fontWeight: '700', includeFontPadding: false },
  sBody:   { fontSize: 15, lineHeight: 22, includeFontPadding: false },
  detCard: { borderRadius: Radius.lg, padding: 14, gap: 10, borderWidth: 1 },
  wChip:   { alignItems: 'center', gap: 2, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  wVal:    { fontSize: 17, fontWeight: '700', includeFontPadding: false },
  wLbl:    { fontSize: 15, includeFontPadding: false },
});

// Dimension labels on the canvas use the dark glass overlay tokens (G_BG/G_BORD)
// because they always sit on top of dark AI art imagery regardless of app theme.
// The main GCard/StatRow components use getGlass(isDark) from useTheme().
function LayerNow({ entry, allEntries, volatility, artState, onRegen }: { // eslint-disable-line
  entry: MoodLogEntry | null; allEntries: MoodLogEntry[]; volatility: string;
  artState: ArtState; onRegen: () => void;
}) {
  const { colors: C } = useTheme();
  const router = useRouter();
  const CANVAS_H = Math.max(320, Math.min(CONTENT_W * 1.1, 420));
  const GAUGE_W  = Math.max(220, Math.min(CANVAS_H - 60, 280));

  if (!entry) {
    return <Empty icon="add-circle-outline" title="No mood logged yet" sub="Log your first mood to see your live emotional compass" />;
  }

  const dims = {
    mind:   (entry.dimensions.mind + 1) / 2,
    energy: entry.dimensions.energy,
    body:   (entry.dimensions.body + 1) / 2,
    focus:  entry.dimensions.focus,
  };
  const sc    = getScoreColor(entry.score);
  const avg7  = allEntries.length ? Math.round(allEntries.slice(-7).reduce((s, e) => s + e.score, 0) / Math.min(allEntries.length, 7)) : null;

  return (
    <View style={{ gap: 16 }}>
      <Canvas artUrl={artState.url} loading={artState.loading} height={CANVAS_H}
        onRegen={onRegen}
        onFail={onRegen}
        showRetryOnFail={!!(artState.error)}
        gradient="vignette">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <RadialCompass dims={dims} size={GAUGE_W} score={entry.score} scoreColor={sc} />
        </View>
        {/* Dimension labels — larger, easier to read */}
        {DIMS.map(d => {
          const pct = Math.round(dims[d.key as keyof typeof dims] * 100);
          const isTop    = d.angle === -90;
          const isRight  = d.angle === 0;
          const isBottom = d.angle === 90;
          const isLeft   = d.angle === 180;
          return (
            <View key={d.key} pointerEvents="none" style={{
              position: 'absolute',
              top:    isTop    ? 10 : isBottom ? undefined : '50%',
              bottom: isBottom ? 44 : undefined,
              left:   isLeft   ? 10 : isTop || isBottom ? '50%' : undefined,
              right:  isRight  ? 10 : undefined,
              alignItems: isLeft ? 'flex-start' : isRight ? 'flex-end' : 'center',
              transform: isTop || isBottom ? [{ translateX: -36 }] : isLeft || isRight ? [{ translateY: -28 }] : [],
              // Liquid Glass dimension label
              backgroundColor: Glass.cardBg,
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 5,
              borderWidth: 1,
              borderColor: d.color + '50',
              // Specular highlight hint
              shadowColor: d.color,
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 4,
            }}>
              <Text style={{ fontSize: 22, textAlign: 'center' }}>{d.emoji}</Text>
              <Text style={{ fontSize: 15, fontWeight: '900', color: d.color, includeFontPadding: false, textAlign: 'center' } as any}>{pct}%</Text>
              <Text style={{ fontSize: 10, color: G_MUTED, fontWeight: '700', textAlign: 'center', includeFontPadding: false } as any}>{d.label}</Text>
            </View>
          );
        })}
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 14, left: 14, right: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
          {entry.primaryTag ? (() => { const t = CONTEXT_TAGS.find(x => x.id === entry.primaryTag); return t ? (
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: t.color + '30', borderWidth: 1, borderColor: t.color + '60' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: t.color, includeFontPadding: false } as any}>{t.emoji} {t.label}</Text>
            </View>
          ) : null; })() : null}
          {(entry.additionalTags ?? []).slice(0, 3).map(tid => {
            const t = CONTEXT_TAGS.find(x => x.id === tid);
            return t ? (
              <View key={tid} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: G_BG, borderWidth: 1, borderColor: G_BORD }}>
                <Text style={{ fontSize: 10, color: G_TEXT, includeFontPadding: false } as any}>{t.emoji} {t.label}</Text>
              </View>
            ) : null;
          })}
        </View>
      </Canvas>

      <StatRow items={[
        { val: getScoreEmoji(entry.score), label: 'Feeling' },
        { val: String(entry.score), label: 'Score', color: sc },
        ...(avg7 ? [{ val: String(avg7), label: '7-day avg', color: getScoreColor(avg7) }] : []),
        { val: entry.timeOfDay === 'morning' ? '🌅' : entry.timeOfDay === 'afternoon' ? '☀️' : entry.timeOfDay === 'evening' ? '🌆' : '🌙', label: entry.timeOfDay === 'afternoon' ? 'Afternoon' : entry.timeOfDay === 'morning' ? 'Morning' : entry.timeOfDay === 'evening' ? 'Evening' : 'Night' },
      ]} />

      <GCard>
        <Text style={[lz.sTitle, { color: C.textPrimary }]}>Reading your compass</Text>
        <Text style={[lz.sBody, { color: C.textSecondary }]}>A balanced day = near-perfect circle. Spikes show dominant dimensions. Hollow areas = low scores there. The art scene shifts with your overall state.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {DIMS.map(d => (
            <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: d.color + '15', paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.full }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: d.color }} />
              <Text style={{ fontSize: 10, color: d.color, fontWeight: '700', includeFontPadding: false } as any}>{d.emoji} {d.label} · {Math.round(dims[d.key as keyof typeof dims] * 100)}%</Text>
            </View>
          ))}
        </View>
      </GCard>

      <GCard style={{ borderLeftWidth: 3, borderLeftColor: Colors.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="auto-awesome" size={15} color={Colors.primary} />
          <Text style={[lz.sTitle, { color: Colors.primary }]}>Art updates with every log</Text>
        </View>
        <Text style={[lz.sBody, { color: C.textSecondary, lineHeight: 18 }]}>All six Mapp layers — Now, Week, Month, Forecast, and Mood Print — regenerate automatically each time you log a new mood entry.</Text>
        <View style={{ gap: 8, marginTop: 2 }}>
          {[
            { e: '🔴', l: 'Now', d: 'Uses today\'s averaged score across all your logs. Each new entry shifts the art.' },
            { e: '📅', l: 'Week & Month', d: 'Landscape art rebuilds from updated daily averages as new entries come in.' },
            { e: '🔮', l: 'Forecast', d: 'Recalibrates your time-of-day patterns with every new data point.' },
            { e: '✨', l: 'Mood Print', d: 'Your emotional fingerprint evolves as your patterns and trends change.' },
          ].map((x, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Text style={{ fontSize: 15, width: 22 }}>{x.e}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{x.l}</Text>
                <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 19, includeFontPadding: false } as any}>{x.d}</Text>
              </View>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/checkin')}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: Colors.primary, borderRadius: Radius.lg,
            paddingVertical: 12, paddingHorizontal: 20, marginTop: 4,
            opacity: pressed ? 0.8 : 1,
          }]}
        >
          <MaterialIcons name="add-circle" size={16} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', includeFontPadding: false } as any}>Log Your Mood Now</Text>
          <MaterialIcons name="arrow-forward" size={14} color="#fff" />
        </Pressable>
      </GCard>

      <GCard>
        <Text style={[lz.sTitle, { color: C.textPrimary }]}>About this artwork</Text>
        <Text style={[lz.sBody, { color: C.textSecondary }]}>Outer space sacred geometry art — generated uniquely from your current emotional state. Your score selects a cosmic geometric form (merkaba, torus, tesseract…) floating in a deep space nebula colored by your mood dimensions.</Text>
        <View style={{ gap: 8, marginTop: 4 }}>
          {[
            { e: '🔷', l: entry.score >= 90 ? 'Merkaba star tetrahedron — exploding outward' : entry.score >= 80 ? 'Golden ratio galaxy spiral + icosahedron' : entry.score >= 70 ? 'Luminous torus ring + glowing tesseract' : entry.score >= 55 ? 'Nested hexagonal cosmic honeycomb' : entry.score >= 45 ? 'Compressed fractal dodecahedron' : entry.score >= 35 ? 'Fragmenting geodesic sphere drifting apart' : 'Collapsing octahedron — void singularity', d: 'Core geometry chosen from score — higher scores produce expansive outward forms' },
            { e: '🌌', l: dims.mind > 0.65 ? 'Electric cyan · UV plasma · star birth nebula' : dims.mind > 0.4 ? 'Warm amber gold · emission nebula' : 'Deep cobalt · dark molecular cloud', d: 'Nebula color and cosmic atmosphere from Mind clarity' },
            { e: '✨', l: dims.energy > 0.65 ? 'Dense brilliant star field · neon lens flares' : dims.energy > 0.4 ? 'Moderate stars · soft bokeh balance' : 'Sparse dim stars · dark space', d: 'Star density and saturation driven by Energy level' },
            { e: '💎', l: dims.body > 0.65 ? 'Razor sharp edges · perfect mathematical precision' : dims.body > 0.4 ? 'Smooth semi-transparent overlapping layers' : 'Soft dissolving geometry · ghostly fragile forms', d: 'Geometric edge precision and opacity from Body feel' },
          ].map((x, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Text style={{ fontSize: 16, width: 24 }}>{x.e}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{x.l}</Text>
                <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 19, includeFontPadding: false } as any}>{x.d}</Text>
              </View>
            </View>
          ))}
        </View>
      </GCard>
    </View>
  );
}

// =============================================================================
// LAYER 2 — THIS WEEK
// =============================================================================
function LayerWeek({ days, weekAvg, weatherData, artState, onRegen, tempUnit }: {
  days: DayData[]; weekAvg: number | null; weatherData: any; artState: ArtState; onRegen: () => void; tempUnit?: 'C' | 'F';
}) {
  const { colors: C } = useTheme();
  const [selDay, setSelDay] = useState<DayData | null>(null);
  const CANVAS_H = 200;
  // Reactive screen width so compasses scale correctly on every device
  const [screenW, setScreenW] = useState(() => Math.max(320, Dimensions.get('window').width));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenW(Math.max(320, window.width)));
    return () => sub?.remove();
  }, []);
  // 20px padding each side + 7 compasses + 6 gaps of 8px
  const MINI = Math.max(36, Math.floor((Math.min(screenW, 640) - 40 - 6 * 8) / 7));

  const router = useRouter();
  if (!weekAvg) return <Empty icon="bar-chart" title="No data this week" sub="Log your mood each day to see your weekly shape pattern" />;

  const sc = getScoreColor(weekAvg);
  const best = days.reduce((mx, d) => d.avg && d.avg > (mx ?? 0) ? d.avg : mx, null as number | null);
  const toDisplay = (c?: number) => {
    if (c == null) return null;
    return tempUnit === 'F' ? Math.round(c * 9/5 + 32) : Math.round(c);
  };

  return (
    <View style={{ gap: 16 }}>
      <Canvas artUrl={artState.url} loading={artState.loading} height={CANVAS_H} onRegen={onRegen} onFail={onRegen} showRetryOnFail={!!(artState.error)} gradient="soft">
        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 52, fontWeight: '900', color: sc, includeFontPadding: false } as any}>{weekAvg}</Text>
          <Text style={{ fontSize: 15, color: G_MUTED, fontWeight: '600', includeFontPadding: false } as any}>week average</Text>
        </View>
      </Canvas>

      <GCard>
        <Text style={[lz.sTitle, { color: C.textPrimary }]}>7-Day Shape View</Text>
        <Text style={[lz.sBody, { color: C.textSecondary }]}>Tap any day for detail. Each mini compass shows your 4 dimensions. Circle = balanced. Spikes = dominant dimension. Dashed = no log.</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          {days.map(d => {
            const col = d.avg !== null ? getScoreColor(Math.round(d.avg)) : C.border;
            const isSel = selDay?.ds === d.ds;
            return (
              <Pressable key={d.ds} onPress={() => setSelDay(isSel ? null : d)}
                style={({ pressed }) => [{ alignItems: 'center', gap: 5 }, pressed && { opacity: 0.7 }]}>
                <View style={{ borderRadius: 6, overflow: 'hidden', backgroundColor: d.count > 0 ? C.surface : 'transparent', borderWidth: isSel ? 2 : d.isToday ? 1.5 : 0, borderColor: isSel ? Colors.primary : col + '90' }}>
                  {d.count > 0 ? (
                    <RadialCompass dims={d.dims} size={MINI} score={Math.round(d.avg!)} scoreColor={col} mini />
                  ) : (
                    <View style={{ width: MINI, height: MINI, alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: MINI * 0.55, height: MINI * 0.55, borderRadius: MINI * 0.275, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' }} />
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 9, color: isSel ? Colors.primary : d.isToday ? col : C.textMuted, fontWeight: isSel || d.isToday ? '800' : '500', includeFontPadding: false } as any}>{d.dayLabel}</Text>
              </Pressable>
            );
          })}
        </View>

        {selDay ? (
          <View style={[lz.detCard, { backgroundColor: C.surface, borderColor: selDay.avg !== null ? getScoreColor(Math.round(selDay.avg)) + '40' : C.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>{selDay.ds}</Text>
              {selDay.avg !== null ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: getScoreColor(Math.round(selDay.avg)) + '20', borderWidth: 1, borderColor: getScoreColor(Math.round(selDay.avg)) + '50' }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: getScoreColor(Math.round(selDay.avg)), includeFontPadding: false } as any}>{Math.round(selDay.avg)} · {getScoreLabel(Math.round(selDay.avg))}</Text>
                </View>
              ) : <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>No log</Text>}
              <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>{selDay.count} log{selDay.count !== 1 ? 's' : ''}</Text>
              <Pressable onPress={() => setSelDay(null)} hitSlop={8} style={{ marginLeft: 'auto' } as any}><MaterialIcons name="close" size={14} color={C.textMuted} /></Pressable>
            </View>
            {selDay.avg !== null ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <RadialCompass dims={selDay.dims} size={80} score={Math.round(selDay.avg)} scoreColor={getScoreColor(Math.round(selDay.avg))} />
                  <View style={{ flex: 1, gap: 6 }}>
                    {DIMS.map(d => {
                      const pct = Math.round(selDay.dims[d.key as keyof typeof selDay.dims] * 100);
                      return (
                        <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 12, width: 16 }}>{d.emoji}</Text>
                          <View style={{ flex: 1, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' }}>
                            <View style={{ height: 4, width: `${pct}%` as any, backgroundColor: d.color, borderRadius: 2 }} />
                          </View>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: d.color, width: 26, textAlign: 'right', includeFontPadding: false } as any}>{pct}%</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                {(selDay.entries ?? []).length > 0 ? (
                  <View style={{ gap: 4 }}>
                    {(selDay.entries ?? []).map((e: MoodLogEntry) => {
                      const t = CONTEXT_TAGS.find(x => x.id === e.primaryTag);
                      return (
                        <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 10, color: C.textMuted, width: 40, includeFontPadding: false } as any}>{e.time ?? e.timeOfDay}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: getScoreColor(e.score), includeFontPadding: false } as any}>{e.score}</Text>
                          {t ? <Text style={{ fontSize: 10, color: C.textPrimary, includeFontPadding: false } as any}>{t.emoji} {t.label}</Text> : null}
                          {e.note ? <Text style={{ fontSize: 9, color: C.textMuted, flex: 1, includeFontPadding: false } as any} numberOfLines={1}>{e.note}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : <Text style={[lz.sBody, { color: C.textSecondary }]}>No mood logged this day.</Text>}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {DIMS.map(d => (
            <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: d.color }} />
              <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: '600', includeFontPadding: false } as any}>{d.emoji}</Text>
            </View>
          ))}
        </View>
      </GCard>

      <GCard>
        <Text style={[lz.sTitle, { color: C.textPrimary }]}>About this artwork</Text>
        <Text style={[lz.sBody, { color: C.textSecondary }]}>An aerial cinematic landscape generated from your week's mood data. Atmospheric clarity reflects your average mind score. Light warmth and saturation reflect energy. The terrain's lushness mirrors your body dimension. Rising or descending terrain follows your weekly trend.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {[{ e: '☁️', l: 'Atmosphere', d: 'Mind clarity — crisp sky vs heavy fog' },
            { e: '🌤️', l: 'Light', d: 'Energy level — golden rays vs overcast' },
            { e: '🌿', l: 'Terrain', d: 'Body score — lush meadow vs barren ground' },
            { e: '🏔️', l: 'Elevation', d: 'Trend — ascending vs descending landscape' }]
            .map((x, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, width: '48%' }}>
                <Text style={{ fontSize: 15, width: 22 }}>{x.e}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{x.l}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 17, includeFontPadding: false } as any}>{x.d}</Text>
                </View>
              </View>
            ))}
        </View>
      </GCard>

      <StatRow items={[
        { val: String(weekAvg), label: 'Week avg', color: sc },
        { val: `${days.filter(d => d.count > 0).length}/7`, label: 'Days logged' },
        { val: best ? String(Math.round(best)) : '—', label: 'Best day' },
        ...(weatherData?.temperature !== undefined ? [{ val: `${toDisplay(weatherData.temperature)}°${tempUnit ?? 'C'}`, label: 'Temp' }] : []),
      ]} />

      <GCard style={{ borderLeftWidth: 3, borderLeftColor: Colors.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="auto-awesome" size={15} color={Colors.primary} />
          <Text style={[lz.sTitle, { color: Colors.primary }]}>Art updates with every log</Text>
        </View>
        <Text style={[lz.sBody, { color: C.textSecondary, lineHeight: 18 }]}>This week's landscape art regenerates automatically each time you log a new mood entry. The terrain, atmosphere, and light all shift with your evolving week data.</Text>
        <Pressable
          onPress={() => router.push('/(tabs)/checkin')}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: Colors.primary, borderRadius: Radius.lg,
            paddingVertical: 12, paddingHorizontal: 20, marginTop: 4,
            opacity: pressed ? 0.8 : 1,
          }]}
        >
          <MaterialIcons name="add-circle" size={16} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', includeFontPadding: false } as any}>Log Your Mood Now</Text>
          <MaterialIcons name="arrow-forward" size={14} color="#fff" />
        </Pressable>
      </GCard>
    </View>
  );
}

// =============================================================================
// LAYER 3 — THIS MONTH (Calendar view)
// =============================================================================
function LayerMonth({ days, monthAvg, entries, artState, onRegen }: {
  days: DayData[]; monthAvg: number | null; entries: MoodLogEntry[]; artState: ArtState; onRegen: () => void;
}) {
  const { colors: C } = useTheme();
  const router = useRouter();
  const CANVAS_H = 200;
  const [sel, setSel] = useState<DayData | null>(null);
  // Reactive screen width — module-level CONTENT_W returns 0 on web SSR
  const [screenW, setScreenW] = useState(() => Math.max(320, Dimensions.get('window').width));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenW(Math.max(320, window.width)));
    return () => sub?.remove();
  }, []);

  if (!monthAvg) return <Empty icon="calendar-today" title="No data this month" sub="Log your mood regularly to see your monthly calendar" />;

  const sc = getScoreColor(monthAvg);
  const best = days.reduce((mx: number | null, d: any) => d.avg && d.avg > (mx ?? 0) ? d.avg : mx, null as number | null);

  // Build a proper calendar grid for the current month
  const todayDate = new Date();
  const year = todayDate.getFullYear();
  const month = todayDate.getMonth();
  // firstDayOfMonth: 0=Sun … 6=Sat — used to offset the first row
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build lookup: dateString -> DayData
  const dayMap: Record<string, DayData> = {};
  days.forEach(d => { dayMap[d.ds] = d; });

  // Build calendar cells: null = padding, number = day-of-month
  const calCells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (calCells.length % 7 !== 0) calCells.push(null);

  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAME = todayDate.toLocaleDateString([], { month: 'long', year: 'numeric' });

  // 20px card padding each side (GCard has Spacing.lg = 16) + 16 screen padding each side + 6 gaps of 6px
  const cardInnerW = Math.min(screenW - 32, 600) - 32; // subtract card padding
  const cellSize = Math.max(28, Math.floor((cardInnerW - 6 * 6) / 7));

  return (
    <View style={{ gap: 16 }}>
      <Canvas artUrl={artState.url} loading={artState.loading} height={CANVAS_H} onRegen={onRegen} onFail={onRegen} showRetryOnFail={!!(artState.error)} gradient="soft">
        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 52, fontWeight: '900', color: sc, includeFontPadding: false } as any}>{monthAvg}</Text>
          <Text style={{ fontSize: 15, color: G_MUTED, fontWeight: '600', includeFontPadding: false } as any}>30-day average</Text>
        </View>
      </Canvas>

      <GCard>
        {/* Calendar header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={[lz.sTitle, { color: C.textPrimary }]}>{MONTH_NAME}</Text>
          <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>tap a day</Text>
        </View>

        {/* Legend */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          {[{ v: 80, l: '80+' }, { v: 65, l: '65' }, { v: 50, l: '50' }, { v: 35, l: '35' }, { v: 20, l: '<35' }].map(x => (
            <View key={x.v} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: getScoreColor(x.v) }} />
              <Text style={{ fontSize: 8, color: C.textMuted, includeFontPadding: false } as any}>{x.l}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }} />
            <Text style={{ fontSize: 8, color: C.textMuted, includeFontPadding: false } as any}>no log</Text>
          </View>
        </View>

        {/* How-to hint banner */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary + '12', borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4, borderWidth: 1, borderColor: Colors.primary + '25' }}>
          <MaterialIcons name="touch-app" size={15} color={Colors.primary} />
          <Text style={{ flex: 1, fontSize: 11, color: Colors.primary, fontWeight: '600', lineHeight: 15, includeFontPadding: false } as any}>
            Tap any date to see your full mood breakdown for that day — scores, dimensions, and individual log entries appear below the calendar.
          </Text>
        </View>

        {/* Day-of-week header row */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
          {DOW_LABELS.map(lbl => (
            <View key={lbl} style={{ width: cellSize, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: C.textMuted, includeFontPadding: false } as any}>{lbl}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={{ gap: 6 }}>
          {Array.from({ length: calCells.length / 7 }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row', gap: 6 }}>
              {calCells.slice(row * 7, row * 7 + 7).map((dayNum, col) => {
                if (dayNum === null) {
                  return <View key={col} style={{ width: cellSize, height: cellSize }} />;
                }
                const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const d = dayMap[ds];
                const col_ = d?.avg ? getScoreColor(Math.round(d.avg)) : null;
                const isSel = sel?.ds === ds;
                const isToday = ds === todayDate.toISOString().split('T')[0];
                const isFuture = ds > todayDate.toISOString().split('T')[0];

                return (
                  <Pressable
                    key={col}
                    onPress={() => {
                      if (isFuture || !d) return;
                      setSel(isSel ? null : (d ?? { ds, dayNum, isToday, count: 0, avg: null, dims: { body: 0, mind: 0, energy: 0, focus: 0 }, entries: [] }));
                    }}
                    style={({ pressed }) => [{
                      width: cellSize,
                      height: cellSize,
                      borderRadius: Radius.md,
                      backgroundColor: col_ ? col_ + '30' : isFuture ? 'transparent' : C.surface,
                      borderWidth: isToday ? 2 : isSel ? 2 : 1,
                      borderColor: isToday ? Colors.primary : isSel ? col_ ?? Colors.primary : col_ ? col_ + '50' : C.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isFuture ? 0.2 : 1,
                    }, pressed && !isFuture && { opacity: 0.6 }]}
                  >
                    <Text style={{
                      fontSize: 11,
                      fontWeight: isToday || isSel ? '900' : d?.count ? '700' : '400',
                      color: col_ ?? (isToday ? Colors.primary : C.textMuted),
                      includeFontPadding: false,
                    } as any}>{dayNum}</Text>
                    {d?.avg ? (
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: col_ ?? C.border, marginTop: 1 }} />
                    ) : null}
                    {(d?.count ?? 0) > 1 ? (
                      <Text style={{ fontSize: 7, color: col_ ?? C.textMuted, fontWeight: '700', includeFontPadding: false } as any}>{d?.count}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Selected day detail panel */}
        {sel ? (
          <View style={[lz.detCard, { marginTop: 8, backgroundColor: C.surface, borderColor: sel.avg !== null ? getScoreColor(Math.round(sel.avg)) + '40' : C.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="event" size={14} color={sel.avg !== null ? getScoreColor(Math.round(sel.avg)) : C.textMuted} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.textPrimary, flex: 1, includeFontPadding: false } as any}>
                {new Date(sel.ds + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              {sel.avg !== null ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: getScoreColor(Math.round(sel.avg)) + '20', borderWidth: 1, borderColor: getScoreColor(Math.round(sel.avg)) + '50' }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: getScoreColor(Math.round(sel.avg)), includeFontPadding: false } as any}>{Math.round(sel.avg)} · {getScoreLabel(Math.round(sel.avg))}</Text>
                </View>
              ) : <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>No log</Text>}
              <Pressable onPress={() => setSel(null)} hitSlop={8}><MaterialIcons name="close" size={14} color={C.textMuted} /></Pressable>
            </View>

            {sel.avg !== null && (sel.dims.body !== 0 || sel.dims.mind !== 0) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <RadialCompass dims={sel.dims} size={72} score={Math.round(sel.avg)} scoreColor={getScoreColor(Math.round(sel.avg))} />
                <View style={{ flex: 1, gap: 5 }}>
                  {DIMS.map(d => {
                    const pct = Math.round(sel.dims[d.key as keyof typeof sel.dims] * 100);
                    return (
                      <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={{ fontSize: 11, width: 16 }}>{d.emoji}</Text>
                        <View style={{ flex: 1, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' }}>
                          <View style={{ height: 4, width: `${pct}%` as any, backgroundColor: d.color, borderRadius: 2 }} />
                        </View>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: d.color, width: 26, textAlign: 'right', includeFontPadding: false } as any}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {(sel.entries ?? []).length > 0 ? (
              <View style={{ gap: 5, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 }}>
                {(sel.entries ?? []).map((e: MoodLogEntry) => {
                  const t = CONTEXT_TAGS.find(x => x.id === e.primaryTag);
                  const eCol = getScoreColor(e.score);
                  return (
                    <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceElevated, borderRadius: Radius.md, padding: 8, borderWidth: 1, borderColor: eCol + '30' }}>
                      <View style={{ alignItems: 'center', gap: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: eCol, includeFontPadding: false } as any}>{e.score}</Text>
                        <Text style={{ fontSize: 8, color: C.textMuted, includeFontPadding: false } as any}>{e.time ?? e.timeOfDay}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        {t ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontSize: 12 }}>{t.emoji}</Text>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{t.label}</Text>
                          </View>
                        ) : null}
                        {e.note ? <Text style={{ fontSize: 9, color: C.textMuted, includeFontPadding: false } as any} numberOfLines={2}>{e.note}</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : sel.avg === null ? (
              <Text style={{ fontSize: 11, color: C.textMuted, includeFontPadding: false } as any}>No mood logged on this day.</Text>
            ) : null}
          </View>
        ) : null}
      </GCard>

      <GCard>
        <Text style={[lz.sTitle, { color: C.textPrimary }]}>About this artwork</Text>
        <Text style={[lz.sBody, { color: C.textSecondary }]}>A sweeping cinematic landscape generated from your 30-day emotional terrain. Mood peaks become highland plateaus; low periods deepen into misty valleys.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {[{ e: '🌈', l: 'Color palette', d: 'Monthly avg — warm amber for thriving, cool teal for good, deep indigo for low' },
            { e: '🏞️', l: 'Terrain height', d: 'Your trend — ascending highlands for improving, valley for declining' },
            { e: '🌿', l: 'Lushness', d: 'Body score — rich greenery vs sparse rocky landscape' },
            { e: '💡', l: 'Sky light', d: 'Energy — golden rays vs overcast diffused light' }]
            .map((x, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, width: '48%' }}>
                <Text style={{ fontSize: 15, width: 22 }}>{x.e}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{x.l}</Text>
                  <Text style={{ fontSize: 12, color: C.textMuted, lineHeight: 17, includeFontPadding: false } as any}>{x.d}</Text>
                </View>
              </View>
            ))}
        </View>
      </GCard>

      <StatRow items={[
        { val: String(monthAvg), label: 'Month avg', color: sc },
        { val: `${days.filter((d: any) => d.count > 0).length}/30`, label: 'Days logged' },
        { val: String(best ? Math.round(best) : '—'), label: 'Best day' },
        { val: String(entries.length), label: 'Total logs' },
      ]} />

      <GCard style={{ borderLeftWidth: 3, borderLeftColor: Colors.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="auto-awesome" size={15} color={Colors.primary} />
          <Text style={[lz.sTitle, { color: Colors.primary }]}>Art updates with every log</Text>
        </View>
        <Text style={[lz.sBody, { color: C.textSecondary, lineHeight: 18 }]}>This month's terrain art regenerates automatically each time you log a new mood. The landscape evolves as your 30-day emotional data shifts.</Text>
        <Pressable
          onPress={() => router.push('/(tabs)/checkin')}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: Colors.primary, borderRadius: Radius.lg,
            paddingVertical: 12, paddingHorizontal: 20, marginTop: 4,
            opacity: pressed ? 0.8 : 1,
          }]}
        >
          <MaterialIcons name="add-circle" size={16} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', includeFontPadding: false } as any}>Log Your Mood Now</Text>
          <MaterialIcons name="arrow-forward" size={14} color="#fff" />
        </Pressable>
      </GCard>
    </View>
  );
}

// =============================================================================
// LAYER 4 — DRIVERS / CORRELATIONS
// =============================================================================

type SoundSession = {
  id: string;
  sound_id: string;
  sound_name: string;
  sound_category: string;
  duration_seconds: number;
  mood_before: number | null;
  mood_after: number | null;
  mood_delta: number | null;
  created_at: string;
};

function LayerDrivers({ entries, timePat, tagCorr }: { entries: MoodLogEntry[]; timePat: any[]; tagCorr: any[] }) {
  const { colors: C } = useTheme();
  const baseline = useMemo(() => entries.length ? entries.reduce((s, e) => s + e.score, 0) / entries.length : 50, [entries]);
  const [soundSessions, setSoundSessions] = useState<SoundSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('sound_sessions')
          .select('id,sound_id,sound_name,sound_category,duration_seconds,mood_before,mood_after,mood_delta,created_at')
          .order('created_at', { ascending: false })
          .limit(200);
        if (data) setSoundSessions(data as SoundSession[]);
      } catch {}
      finally { setSessionsLoading(false); }
    };
    fetch();
  }, []);

  // Mood Lab analytics
  const moodLabStats = useMemo(() => {
    if (!soundSessions.length) return null;
    const totalSessions = soundSessions.length;
    const totalMinutes = Math.round(soundSessions.reduce((s, ss) => s + (ss.duration_seconds ?? 0), 0) / 60);
    const withDelta = soundSessions.filter(ss => ss.mood_delta !== null);
    const avgDelta = withDelta.length
      ? Math.round(withDelta.reduce((s, ss) => s + (ss.mood_delta ?? 0), 0) / withDelta.length * 10) / 10
      : null;
    // Top sounds by session count
    const soundMap: Record<string, { name: string; category: string; count: number; totalDelta: number; deltaCount: number }> = {};
    soundSessions.forEach(ss => {
      if (!soundMap[ss.sound_id]) soundMap[ss.sound_id] = { name: ss.sound_name, category: ss.sound_category, count: 0, totalDelta: 0, deltaCount: 0 };
      soundMap[ss.sound_id].count++;
      if (ss.mood_delta !== null) { soundMap[ss.sound_id].totalDelta += ss.mood_delta; soundMap[ss.sound_id].deltaCount++; }
    });
    const topSounds = Object.entries(soundMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id, v]) => ({ id, ...v, avgDelta: v.deltaCount > 0 ? Math.round(v.totalDelta / v.deltaCount * 10) / 10 : null }));
    // Category breakdown
    const catMap: Record<string, { count: number; totalDelta: number; deltaCount: number }> = {};
    soundSessions.forEach(ss => {
      const cat = ss.sound_category || 'Other';
      if (!catMap[cat]) catMap[cat] = { count: 0, totalDelta: 0, deltaCount: 0 };
      catMap[cat].count++;
      if (ss.mood_delta !== null) { catMap[cat].totalDelta += ss.mood_delta; catMap[cat].deltaCount++; }
    });
    const categories = Object.entries(catMap)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([cat, v]) => ({ cat, count: v.count, avgDelta: v.deltaCount > 0 ? Math.round(v.totalDelta / v.deltaCount * 10) / 10 : null }));
    // Recent 30 days sessions
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const recentCount = soundSessions.filter(ss => ss.created_at >= thirtyDaysAgo).length;
    return { totalSessions, totalMinutes, avgDelta, topSounds, categories, recentCount };
  }, [soundSessions]);

  const CAT_EMOJI: Record<string, string> = {
    nature: '🌿', rain: '🌧️', ocean: '🌊', forest: '🌲', fire: '🔥',
    meditation: '🧘', focus: '🎯', sleep: '😴', healing: '✨', frequency: '〰️',
    binaural: '🎵', ambient: '🎶', other: '🎧',
  };
  const getCatEmoji = (cat: string) => CAT_EMOJI[cat.toLowerCase()] ?? '🎵';

  const ranked = useMemo(() => tagCorr
    .map(c => { const tag = CONTEXT_TAGS.find(t => t.id === c.tagId); const cnt = c.sampleSize ?? c.count ?? 0; if (!tag || cnt < 2) return null; const impact = Math.round(((c.avgScore - baseline) / Math.max(baseline, 1)) * 100); return { tag, avgScore: c.avgScore, count: cnt, impact }; })
    .filter(Boolean).sort((a, b) => Math.abs(b!.impact) - Math.abs(a!.impact)).slice(0, 10) as { tag: typeof CONTEXT_TAGS[number]; avgScore: number; count: number; impact: number }[],
  [tagCorr, baseline]);

  if (!entries.length) return <Empty icon="insights" title="Not enough data" sub="Log mood with context tags to discover what drives your wellbeing" />;

  return (
    <View style={{ gap: 16 }}>
      <GCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="insights" size={16} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[lz.sTitle, { color: C.textPrimary }]}>What Drives Your Mood</Text>
            <Text style={[lz.sBody, { color: C.textSecondary }]}>Ranked by % impact vs your {Math.round(baseline)} baseline</Text>
          </View>
        </View>

        {ranked.length > 0 ? ranked.map((c, i) => {
          const isPos = c.impact >= 0;
          const col   = c.avgScore >= 65 ? '#4ADE80' : c.avgScore >= 50 ? '#FFD060' : '#FF6B6B';
          const fill  = Math.min(Math.abs(c.impact), 100);
          return (
            <View key={c.tag.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Text style={{ fontSize: 10, color: C.textSecondary, fontWeight: '700', width: 16, includeFontPadding: false } as any}>{i + 1}</Text>
              <Text style={{ fontSize: 17, width: 24, textAlign: 'center' }}>{c.tag.emoji}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: C.textPrimary, includeFontPadding: false } as any}>{c.tag.label}</Text>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: col + '20', borderWidth: 1, borderColor: col + '50' }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: col, includeFontPadding: false } as any}>{isPos ? '+' : ''}{c.impact}%</Text>
                  </View>
                </View>
                <View style={{ height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 5, width: `${fill}%`, backgroundColor: col, borderRadius: 3 } as any} />
                </View>
                <Text style={{ fontSize: 13, color: C.textSecondary, includeFontPadding: false } as any}>avg {Math.round(c.avgScore)} · {c.count} log{c.count !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          );
        }) : (
          <Text style={[lz.sBody, { color: C.textSecondary }]}>Add at least 2 logs per tag for correlations to appear.</Text>
        )}
      </GCard>

      {timePat.length > 0 ? (
        <GCard>
          <Text style={[lz.sTitle, { color: C.textPrimary }]}>Time of Day Patterns</Text>
          <Text style={[lz.sBody, { color: C.textSecondary }]}>When do you peak? Your historical average by slot.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {timePat.map(tp => {
              const col  = getScoreColor(tp.avgScore);
              const pct  = Math.round(((tp.avgScore - baseline) / Math.max(baseline, 1)) * 100);
              const isP  = pct >= 0;
              return (
                <View key={tp.timeOfDay} style={{ flex: 1, alignItems: 'center', gap: 4, backgroundColor: col + '10', borderRadius: Radius.lg, paddingVertical: 12, borderWidth: 1, borderColor: col + '30' }}>
                  <Text style={{ fontSize: 20 }}>{tp.timeOfDay === 'morning' ? '🌅' : tp.timeOfDay === 'afternoon' ? '☀️' : tp.timeOfDay === 'evening' ? '🌆' : '🌙'}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: col, includeFontPadding: false } as any}>{Math.round(tp.avgScore)}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: isP ? '#4ADE80' : '#FF6B6B', includeFontPadding: false } as any}>{isP ? '+' : ''}{pct}%</Text>
                  <Text style={{ fontSize: 9, color: C.textSecondary, textTransform: 'capitalize', includeFontPadding: false } as any}>{tp.timeOfDay}</Text>
                </View>
              );
            })}
          </View>
        </GCard>
      ) : null}

      {/* ── Mood Lab Usage Section ── */}
      <GCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="waves" size={16} color="#7C83FF" />
          <View style={{ flex: 1 }}>
            <Text style={[lz.sTitle, { color: C.textPrimary }]}>Mood Lab Usage</Text>
            <Text style={[lz.sBody, { color: C.textSecondary }]}>How your sound & meditation sessions affect wellbeing</Text>
          </View>
        </View>

        {sessionsLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : !moodLabStats ? (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
            <MaterialIcons name="waves" size={28} color={C.textMuted} />
            <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', lineHeight: 17, includeFontPadding: false } as any}>
              No Mood Lab sessions yet.{"\n"}Use the Mood Lab tab to log sound &amp; meditation sessions.
            </Text>
          </View>
        ) : (
          <>
            {/* Summary stats row */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { val: String(moodLabStats.totalSessions), label: 'Sessions', color: '#7C83FF' },
                { val: `${moodLabStats.totalMinutes}m`, label: 'Total time', color: '#4ADE80' },
                { val: `${moodLabStats.recentCount}`, label: 'Last 30 days', color: Colors.primary },
                ...(moodLabStats.avgDelta !== null ? [{ val: (moodLabStats.avgDelta >= 0 ? '+' : '') + String(moodLabStats.avgDelta), label: 'Avg mood lift', color: moodLabStats.avgDelta >= 0 ? '#4ADE80' : '#FF6B6B' }] : []),
              ].map((item, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', backgroundColor: C.surface, borderRadius: Radius.lg, paddingVertical: 12, gap: 3, borderWidth: 1, borderColor: C.border }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: item.color, includeFontPadding: false } as any}>{item.val}</Text>
                  <Text style={{ fontSize: 8, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center', includeFontPadding: false } as any}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Top sounds */}
            {moodLabStats.topSounds.length > 0 ? (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>Most Used Sounds</Text>
                {moodLabStats.topSounds.map((s, i) => {
                  const maxCount = moodLabStats.topSounds[0].count;
                  const fill = Math.round((s.count / Math.max(maxCount, 1)) * 100);
                  const deltaColor = s.avgDelta === null ? C.textMuted : s.avgDelta >= 0 ? '#4ADE80' : '#FF6B6B';
                  return (
                    <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', width: 14, includeFontPadding: false } as any}>{i + 1}</Text>
                      <Text style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{getCatEmoji(s.category)}</Text>
                      <View style={{ flex: 1, gap: 3 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: C.textPrimary, flex: 1, includeFontPadding: false } as any} numberOfLines={1}>{s.name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>{s.count}x</Text>
                            {s.avgDelta !== null ? (
                              <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.full, backgroundColor: deltaColor + '20', borderWidth: 1, borderColor: deltaColor + '40' }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: deltaColor, includeFontPadding: false } as any}>{s.avgDelta >= 0 ? '+' : ''}{s.avgDelta}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' }}>
                          <View style={{ height: 4, width: `${fill}%` as any, backgroundColor: '#7C83FF', borderRadius: 2 }} />
                        </View>
                        <Text style={{ fontSize: 9, color: C.textMuted, textTransform: 'capitalize', includeFontPadding: false } as any}>{s.category}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* Category breakdown */}
            {moodLabStats.categories.length > 0 ? (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>By Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {moodLabStats.categories.map(cat => {
                    const dc = cat.avgDelta === null ? C.textMuted : cat.avgDelta >= 0 ? '#4ADE80' : '#FF6B6B';
                    return (
                      <View key={cat.cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: C.border }}>
                        <Text style={{ fontSize: 13 }}>{getCatEmoji(cat.cat)}</Text>
                        <View>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: C.textPrimary, textTransform: 'capitalize', includeFontPadding: false } as any}>{cat.cat}</Text>
                          <Text style={{ fontSize: 9, color: C.textMuted, includeFontPadding: false } as any}>
                            {cat.count}x{cat.avgDelta !== null ? ` · avg ${cat.avgDelta >= 0 ? '+' : ''}${cat.avgDelta}` : ''}
                          </Text>
                        </View>
                        {cat.avgDelta !== null ? (
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dc }} />
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderRadius: Radius.md, padding: 8, marginTop: 2 }}>
              <MaterialIcons name="info-outline" size={11} color={C.textMuted} />
              <Text style={{ fontSize: 9, color: C.textMuted, flex: 1, lineHeight: 13, includeFontPadding: false } as any}>Mood lift = average score change after vs before a session. Log mood before &amp; after each session for richer data.</Text>
            </View>
          </>
        )}
      </GCard>

      <GCard>
        <Text style={[lz.sTitle, { color: C.textPrimary }]}>Your Baseline</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 60, height: 60, borderRadius: 16, borderWidth: 2, borderColor: getScoreColor(Math.round(baseline)) + '60', backgroundColor: getScoreColor(Math.round(baseline)) + '12', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: getScoreColor(Math.round(baseline)), includeFontPadding: false } as any}>{Math.round(baseline)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{getScoreLabel(Math.round(baseline))}</Text>
            <Text style={{ fontSize: 13, color: C.textSecondary, lineHeight: 20, includeFontPadding: false } as any}>All-time average across {entries.length} logs. Impact % above is relative to this.</Text>
          </View>
        </View>
      </GCard>
    </View>
  );
}

// =============================================================================
// LAYER 5 — FORECAST
// =============================================================================
function LayerForecast({ entries, weatherData, timePat, tagCorr, baseline, forecastAvg, artState, onRegen, tempUnit, fitnessData }: {
  entries: MoodLogEntry[]; weatherData: any; timePat: any[]; tagCorr: any[];
  baseline: number | null; forecastAvg: number; artState: ArtState; onRegen: () => void; tempUnit?: 'C' | 'F';
  fitnessData?: any[];
}) {
  const { colors: C } = useTheme();
  const router = useRouter();
  const toDisplay = (c?: number) => {
    if (c == null) return null;
    return tempUnit === 'F' ? Math.round(c * 9/5 + 32) : Math.round(c);
  };
  const CANVAS_H = 220;
  if (!baseline || entries.length < 5) return <Empty icon="explore" title="Need more data" sub="Log at least 5 moods to unlock your emotional forecast" />;

  const hourN = new Date().getHours();

  const slots = Array.from({ length: 8 }, (_, i) => {
    const sh      = (hourN + (i + 1) * 6) % 24;
    const isSleep = sh >= 22 || sh < 6;
    const tod     = sh < 12 ? 'morning' : sh < 17 ? 'afternoon' : sh < 21 ? 'evening' : 'night';
    const tp      = !isSleep ? timePat.find(t => t.timeOfDay === tod) : null;
    const sc      = isSleep ? null : (tp ? tp.avgScore : baseline);
    const lbl     = sh === 0 ? '12am' : sh < 12 ? `${sh}am` : sh === 12 ? '12pm' : `${sh - 12}pm`;
    return { sh, tod, score: sc, label: lbl, isSleep };
  });

  const wakingSlots = slots.filter(s => !s.isSleep && s.score !== null);
  const displayAvg  = wakingSlots.length
    ? Math.round(wakingSlots.reduce((s, sl) => s + (sl.score as number), 0) / wakingSlots.length)
    : forecastAvg;
  const displayCol  = getScoreColor(displayAvg);
  const firstWaking = slots.find(s => !s.isSleep && s.score !== null);
  const nCol = firstWaking ? getScoreColor(firstWaking.score as number) : displayCol;

  const peak     = timePat.length ? timePat.reduce((mx, tp) => tp.avgScore > mx.avgScore ? tp : mx, timePat[0]) : null;
  const rE       = entries.slice(-7);
  const socCount = rE.filter(e => (e.additionalTags ?? []).some(t => ['social_energizing', 'social_draining'].includes(t))).length;

  // Forecast lines: each entry carries metadata for consistent color treatment
  type ForecastLine = { text: string; kind: 'today' | 'tomorrow' | 'sleep' | 'note' | 'weather' | 'social' };
  const forecastLines = useMemo<ForecastLine[]>(() => {
    const lines: ForecastLine[] = [];
    const todayLabel = hourN < 18 ? 'Today' : 'Tonight';
    const todayWaking    = slots.filter((s, i) => i < 3 && !s.isSleep && s.score !== null);
    const tomorrowWaking = slots.filter((s, i) => i >= 2 && !s.isSleep && s.score !== null);
    const hasSleep       = slots.some(s => s.isSleep);
    if (todayWaking.length) {
      const avg = Math.round(todayWaking.reduce((s, sl) => s + (sl.score as number), 0) / todayWaking.length);
      const q   = avg >= 70 ? 'looks strong' : avg >= 55 ? 'should be steady' : 'may feel lower';
      const pp  = peak && todayWaking.some(sl => sl.tod === peak.timeOfDay) ? ` Your ${peak.timeOfDay} tends to be your peak (avg ${Math.round(peak.avgScore)}).` : '';
      lines.push({ text: `${todayLabel}: ${q} around ${avg}.${pp}`, kind: 'today' });
    }
    if (hasSleep) lines.push({ text: 'Tonight (sleep window): Energy and mood reset naturally overnight. No forecast for sleep hours.', kind: 'sleep' });
    if (tomorrowWaking.length) {
      const byTod = tomorrowWaking.reduce((acc, sl) => {
        if (!acc[sl.tod]) acc[sl.tod] = [];
        acc[sl.tod].push(sl.score as number);
        return acc;
      }, {} as Record<string, number[]>);
      const todOrder = ['morning', 'afternoon', 'evening'];
      const tmParts: string[] = [];
      todOrder.forEach(tod => {
        if (!byTod[tod]) return;
        const avg = Math.round(byTod[tod].reduce((s, n) => s + n, 0) / byTod[tod].length);
        const q   = avg >= 70 ? 'strong' : avg >= 55 ? 'steady' : 'lower';
        const isPeak = peak?.timeOfDay === tod;
        tmParts.push(`${tod} ${q} at ${avg}${isPeak ? ' ★ your peak slot' : ''}`);
      });
      if (tmParts.length) lines.push({ text: `Tomorrow: ${tmParts.join(' · ')}.`, kind: 'tomorrow' });
    }
    if (socCount >= 3) lines.push({ text: 'Note: Social load has been high recently — expect lower social battery tomorrow.', kind: 'social' });
    if (weatherData?.condition) lines.push({ text: `Weather: ${weatherData.condition} conditions may influence your mood.`, kind: 'weather' });
    return lines;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, hourN, peak, socCount, weatherData?.condition]);

  return (
    <View style={{ gap: 16 }}>
      <Canvas artUrl={artState.url} loading={artState.loading} height={CANVAS_H} onRegen={onRegen} onFail={onRegen} showRetryOnFail={!!(artState.error)} gradient="soft">
        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 52, fontWeight: '900', color: displayCol, includeFontPadding: false } as any}>{displayAvg}</Text>
          <Text style={{ fontSize: 15, color: G_MUTED, fontWeight: '600', includeFontPadding: false } as any}>waking hours forecast</Text>
        </View>
      </Canvas>

      <GCard style={{ borderLeftWidth: 3, borderLeftColor: nCol }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <MaterialIcons name="article" size={14} color={nCol} />
          <Text style={[lz.sTitle, { color: nCol }]}>Your 48-Hour Forecast</Text>
        </View>
        <View style={{ gap: 10 }}>
          {forecastLines.map((fl, i) => {
            const { text, kind } = fl;
            const isSleep  = kind === 'sleep';
            const isNote   = kind === 'note' || kind === 'social';
            const isWeather = kind === 'weather';
            // Unified secondary color for all annotation lines (note / weather / social)
            const dotColor = isSleep ? C.textMuted
              : isNote || isWeather ? C.textSecondary
              : i === 0 ? nCol : C.primary;
            const textColor = isSleep ? C.textMuted
              : isNote || isWeather ? C.textSecondary
              : C.textPrimary;
            const iconName = isSleep ? 'bedtime'
              : isWeather ? 'wb-sunny'
              : isNote ? 'info-outline'
              : i === 0 ? 'today' : 'schedule';
            return (
              <View key={i} style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                paddingBottom: i < forecastLines.length - 1 ? 10 : 0,
                borderBottomWidth: i < forecastLines.length - 1 ? 1 : 0,
                borderBottomColor: C.border,
              }}>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: dotColor + '20',
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1,
                }}>
                  <MaterialIcons name={iconName as any} size={12} color={dotColor} />
                </View>
                <Text style={{
                  flex: 1, fontSize: 12,
                  color: textColor,
                  lineHeight: 18,
                  fontWeight: i === 0 ? '600' : '400',
                  includeFontPadding: false,
                } as any}>{text}</Text>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
          <MaterialIcons name="info-outline" size={11} color={C.textMuted} />
          <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>Based on your time-of-day patterns · baseline {Math.round(baseline)}</Text>
        </View>
      </GCard>

      <GCard>
        <Text style={[lz.sTitle, { color: C.textPrimary }]}>Next 48 Hours</Text>
        <Text style={[lz.sBody, { color: C.textSecondary, marginTop: -4 }]}>Tap a slot to see your history for that time of day</Text>
        <ForecastSlots
          slots={slots}
          entries={entries}
          baseline={baseline}
          timePat={timePat}
          fitnessData={fitnessData}
        />
        {(() => {
          const sleepEntries = (fitnessData ?? []).filter((d: any) => d.sleepHours != null).slice(0, 14);
          const avgSleep = sleepEntries.length
            ? parseFloat((sleepEntries.reduce((acc: number, d: any) => acc + (d.sleepHours ?? 0), 0) / sleepEntries.length).toFixed(1))
            : null;
          if (!avgSleep) return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderRadius: Radius.md, padding: 8 }}>
              <Text style={{ fontSize: 11, color: C.textMuted, includeFontPadding: false } as any}>
                Δ vs your <Text style={{ fontWeight: '700', color: C.textSecondary }}>{Math.round(baseline)}</Text> baseline · 😴 sleep window — sync fitness data for sleep tracking
              </Text>
            </View>
          );
          const sleepColor = avgSleep >= 8 ? '#4ADE80' : avgSleep >= 7 ? '#A3E635' : avgSleep >= 6 ? '#FFD060' : '#FF6B6B';
          const sleepTip = avgSleep >= 8 ? 'Great sleep supports mood stability.' : avgSleep >= 7 ? 'Good sleep. Aim for 8h for optimal mood.' : avgSleep >= 6 ? 'Below optimal — extra sleep may boost your scores.' : 'Sleep deprivation significantly lowers mood. Prioritize rest.';
          return (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderRadius: Radius.md, padding: 8 }}>
                <Text style={{ fontSize: 11, color: C.textMuted, includeFontPadding: false } as any}>
                  Δ vs your <Text style={{ fontWeight: '700', color: C.textSecondary }}>{Math.round(baseline)}</Text> baseline score
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: sleepColor + '12', borderRadius: Radius.md, padding: 10, borderWidth: 1, borderColor: sleepColor + '30' }}>
                <Text style={{ fontSize: 22 }}>😴</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: sleepColor, includeFontPadding: false } as any}>{avgSleep}h avg</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: sleepColor, includeFontPadding: false } as any}>{avgSleep >= 8 ? 'Excellent' : avgSleep >= 7 ? 'Good' : avgSleep >= 6 ? 'Fair' : 'Low'}</Text>
                    <Text style={{ fontSize: 9, color: C.textMuted, includeFontPadding: false } as any}>({sleepEntries.length} nights tracked)</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: C.textSecondary, lineHeight: 14, marginTop: 2, includeFontPadding: false } as any}>{sleepTip}</Text>
                </View>
              </View>
            </View>
          );
        })()}
      </GCard>

      <GCard>
        <Text style={[lz.sTitle, { color: C.textPrimary }]}>How your forecast is built</Text>
        <Text style={[lz.sBody, { color: C.textSecondary }]}>Your forecast uses your personal historical time-of-day patterns — not generic data. Each 6-hour slot projects the average mood you have scored at that time of day across all your past logs, then adjusts for recent trends and environmental context.</Text>
        <View style={{ gap: 8, marginTop: 4 }}>
          {[{ e: '⏰', l: 'Time of day patterns', d: 'Your historical average for morning / afternoon / evening / night slots' },
            { e: '📈', l: 'Recent momentum', d: 'Whether your last 7 days trended up or down vs your baseline' },
            { e: '👥', l: 'Social load', d: 'Recent consecutive social days lower the forecast social battery' },
            { e: '🌤️', l: 'Weather signal', d: 'Current conditions add atmospheric context to narrative' }]
            .map((x, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Text style={{ fontSize: 16, width: 22 }}>{x.e}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{x.l}</Text>
                  <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 19, includeFontPadding: false } as any}>{x.d}</Text>
                </View>
              </View>
            ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, backgroundColor: C.surface, borderRadius: Radius.md, padding: 10 }}>
          <MaterialIcons name="info-outline" size={13} color={C.textMuted} />
          <Text style={{ fontSize: 9, color: C.textMuted, flex: 1, lineHeight: 13, includeFontPadding: false } as any}>Accuracy improves as you log more. Minimum 5 logs needed. More logs at varied times = sharper predictions.</Text>
        </View>
      </GCard>

      <GCard style={{ borderLeftWidth: 3, borderLeftColor: Colors.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="auto-awesome" size={15} color={Colors.primary} />
          <Text style={[lz.sTitle, { color: Colors.primary }]}>Forecast updates with every log</Text>
        </View>
        <Text style={[lz.sBody, { color: C.textSecondary, lineHeight: 18 }]}>Your forecast recalibrates automatically each time you log a new mood. More logs at varied times of day = sharper, more personalised predictions.</Text>
        <Pressable
          onPress={() => router.push('/(tabs)/checkin')}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: Colors.primary, borderRadius: Radius.lg,
            paddingVertical: 12, paddingHorizontal: 20, marginTop: 4,
            opacity: pressed ? 0.8 : 1,
          }]}
        >
          <MaterialIcons name="add-circle" size={16} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', includeFontPadding: false } as any}>Log Your Mood Now</Text>
          <MaterialIcons name="arrow-forward" size={14} color="#fff" />
        </Pressable>
      </GCard>

      {weatherData ? (
        <GCard>
          <Text style={[lz.sTitle, { color: C.textPrimary }]}>Weather Context</Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {weatherData.temperature !== undefined ? <View style={[lz.wChip, { backgroundColor: C.surface, borderColor: C.border }]}><Text style={[lz.wVal, { color: C.textPrimary }]}>{toDisplay(weatherData.temperature)}°{tempUnit ?? 'C'}</Text><Text style={[lz.wLbl, { color: C.textMuted }]}>Temp</Text></View> : null}
            {weatherData.condition ? <View style={[lz.wChip, { backgroundColor: C.surface, borderColor: C.border }]}><Text style={[lz.wVal, { color: C.textPrimary }]}>{weatherData.condition}</Text><Text style={[lz.wLbl, { color: C.textMuted }]}>Conditions</Text></View> : null}
            {weatherData.humidity !== undefined ? <View style={[lz.wChip, { backgroundColor: C.surface, borderColor: C.border }]}><Text style={[lz.wVal, { color: C.textPrimary }]}>{Math.round(weatherData.humidity)}%</Text><Text style={[lz.wLbl, { color: C.textMuted }]}>Humidity</Text></View> : null}
          </View>
        </GCard>
      ) : null}
    </View>
  );
}

// =============================================================================
// FORECAST SLOTS — clickable 48-hour tiles with historical breakdown
// =============================================================================
type SlotEntry = { sh: number; tod: string; score: number | null; label: string; isSleep: boolean };

function ForecastSlots({ slots, entries, baseline, timePat, fitnessData }: {
  slots: SlotEntry[];
  entries: MoodLogEntry[];
  baseline: number;
  timePat: any[];
  fitnessData?: any[];
}) {
  const { colors: C } = useTheme();
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [selSleepIdx, setSelSleepIdx] = useState<number | null>(null);

  // ── Sleep analytics from fitness data ──────────────────────────────────────
  const sleepStats = useMemo(() => {
    const allSleep = (fitnessData ?? []).filter((d: any) => d.sleepHours != null)
      .sort((a: any, b: any) => b.date.localeCompare(a.date));
    if (!allSleep.length) return null;

    // Last 30 nights
    const last30 = allSleep.slice(0, 30);
    const avgSleep = parseFloat((last30.reduce((s: number, d: any) => s + d.sleepHours, 0) / last30.length).toFixed(1));
    const last7 = allSleep.slice(0, 7);
    const avg7 = last7.length ? parseFloat((last7.reduce((s: number, d: any) => s + d.sleepHours, 0) / last7.length).toFixed(1)) : null;
    const best  = Math.max(...last30.map((d: any) => d.sleepHours as number));
    const worst = Math.min(...last30.map((d: any) => d.sleepHours as number));
    const lastNight = allSleep[0]?.sleepHours as number ?? null;

    // Trend: last 7 vs prior 7
    const prior7 = allSleep.slice(7, 14);
    const priorAvg = prior7.length ? parseFloat((prior7.reduce((s: number, d: any) => s + d.sleepHours, 0) / prior7.length).toFixed(1)) : null;
    const trend = avg7 && priorAvg
      ? (avg7 > priorAvg + 0.2 ? 'improving' : avg7 < priorAvg - 0.2 ? 'declining' : 'stable')
      : 'stable';

    // Distribution buckets
    const dist = { under6: 0, s6to7: 0, s7to8: 0, over8: 0 };
    last30.forEach((d: any) => {
      if (d.sleepHours < 6) dist.under6++;
      else if (d.sleepHours < 7) dist.s6to7++;
      else if (d.sleepHours < 8) dist.s7to8++;
      else dist.over8++;
    });

    // Day-of-week pattern
    const dowMap: Record<number, { total: number; count: number }> = {};
    last30.forEach((d: any) => {
      const dow = new Date(d.date + 'T12:00:00').getDay();
      if (!dowMap[dow]) dowMap[dow] = { total: 0, count: 0 };
      dowMap[dow].total += d.sleepHours;
      dowMap[dow].count++;
    });
    const dowAvg: { day: string; avg: number }[] = [];
    const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let d = 0; d < 7; d++) {
      if (dowMap[d] && dowMap[d].count >= 2) {
        dowAvg.push({ day: DOW_SHORT[d], avg: parseFloat((dowMap[d].total / dowMap[d].count).toFixed(1)) });
      }
    }

    // Past month nightly list (most recent 30)
    const nights = last30.map((d: any) => ({
      date: d.date as string,
      hours: d.sleepHours as number,
    }));

    return { avgSleep, avg7, best, worst, lastNight, trend, priorAvg, dist, dowAvg, nights, count: last30.length };
  }, [fitnessData]);

  // Build historical breakdown for a given time-of-day
  const getHistory = useCallback((tod: string) => {
    const matching = entries.filter(e => e.timeOfDay === tod);
    if (!matching.length) return null;
    const avg = Math.round(matching.reduce((s, e) => s + e.score, 0) / matching.length);
    const best  = Math.max(...matching.map(e => e.score));
    const worst = Math.min(...matching.map(e => e.score));
    const tagCount: Record<string, { count: number; totalScore: number }> = {};
    matching.forEach(e => {
      const tags = [e.primaryTag, ...(e.additionalTags ?? [])].filter(Boolean) as string[];
      tags.forEach(t => {
        if (!tagCount[t]) tagCount[t] = { count: 0, totalScore: 0 };
        tagCount[t].count++;
        tagCount[t].totalScore += e.score;
      });
    });
    const topTags = Object.entries(tagCount)
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 4)
      .map(([id, v]) => ({ id, count: v.count, avg: Math.round(v.totalScore / v.count) }));
    const recent = [...matching].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
    return { avg, best, worst, count: matching.length, topTags, recent };
  }, [entries]);

  const selSlot = selIdx !== null ? slots[selIdx] : null;
  const selHistory = selSlot && !selSlot.isSleep ? getHistory(selSlot.tod) : null;

  const sleepColor = (h: number) => h >= 8 ? '#4ADE80' : h >= 7 ? '#A3E635' : h >= 6 ? '#FFD060' : '#FF6B6B';
  const sleepLabel = (h: number) => h >= 8 ? 'Excellent' : h >= 7 ? 'Good' : h >= 6 ? 'Fair' : 'Low';

  return (
    <View style={{ gap: 12 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 4, paddingHorizontal: 2 }}
      >
        {slots.map((s, i) => {
          if (s.isSleep) {
            const isSel = selSleepIdx === i;
            const avgSleep = sleepStats?.avgSleep ?? null;
            const lastNight = sleepStats?.lastNight ?? null;
            const sc = avgSleep != null ? sleepColor(avgSleep) : C.textMuted;
            return (
              <Pressable key={i} onPress={() => { setSelIdx(null); setSelSleepIdx(isSel ? null : i); }}
                style={({ pressed }) => [{
                  width: 76, alignItems: 'center', gap: 4,
                  backgroundColor: avgSleep != null ? sc + '18' : C.surface,
                  borderRadius: Radius.lg,
                  paddingVertical: 10, paddingHorizontal: 6,
                  borderWidth: isSel ? 2 : 1,
                  borderColor: isSel ? sc : avgSleep != null ? sc + '40' : C.border,
                }, pressed && { opacity: 0.75 }]}>
                <Text style={{ fontSize: 18 }}>😴</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: avgSleep != null ? sc : C.textMuted, includeFontPadding: false } as any}>Sleep</Text>
                {avgSleep != null ? (
                  <>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: sc, includeFontPadding: false } as any}>{avgSleep}h</Text>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: sc, includeFontPadding: false } as any}>{sleepLabel(avgSleep)}</Text>
                    {lastNight != null ? (
                      <Text style={{ fontSize: 8, color: C.textMuted, textAlign: 'center', includeFontPadding: false } as any}>Last: {lastNight}h</Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={{ fontSize: 9, color: C.textMuted, textAlign: 'center', lineHeight: 12, includeFontPadding: false } as any}>No data</Text>
                )}
                <View style={{ height: 1, width: '80%', backgroundColor: avgSleep != null ? sc + '40' : C.border, marginVertical: 1 }} />
                <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '600', includeFontPadding: false } as any}>{s.label}</Text>
                {sleepStats ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 }}>
                    <MaterialIcons name="bar-chart" size={9} color={C.textMuted} />
                    <Text style={{ fontSize: 8, color: C.textMuted, includeFontPadding: false } as any}>{sleepStats.count}d</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          }
          const isSel = selIdx === i;
          const sc    = s.score as number;
          const col   = getScoreColor(sc);
          const delta = Math.round(sc - baseline);
          const isPos = delta >= 0;
          const hist  = getHistory(s.tod);
          return (
            <Pressable key={i} onPress={() => { setSelSleepIdx(null); setSelIdx(isSel ? null : i); }}
              style={({ pressed }) => [{
                width: 76, alignItems: 'center', gap: 5,
                backgroundColor: isSel ? col + '25' : col + '12',
                borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 6,
                borderWidth: isSel ? 2 : 1.5,
                borderColor: isSel ? col : col + '40',
              }, pressed && { opacity: 0.75 }]}>
              <Text style={{ fontSize: 20 }}>{s.tod === 'morning' ? '🌅' : s.tod === 'afternoon' ? '☀️' : s.tod === 'evening' ? '🌆' : '🌙'}</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: col, includeFontPadding: false } as any}>{Math.round(sc)}</Text>
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: isPos ? '#4ADE8020' : '#FF6B6B20' }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: isPos ? '#4ADE80' : '#FF6B6B', includeFontPadding: false } as any}>
                  {isPos ? '+' : ''}{delta}
                </Text>
              </View>
              <View style={{ height: 1, width: '80%', backgroundColor: col + '30', marginVertical: 1 }} />
              <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '700', includeFontPadding: false } as any}>{s.label}</Text>
              <Text style={{ fontSize: 9, color: col, fontWeight: '600', textTransform: 'capitalize', includeFontPadding: false } as any}>{s.tod}</Text>
              {hist ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 }}>
                  <MaterialIcons name="history" size={9} color={C.textMuted} />
                  <Text style={{ fontSize: 8, color: C.textMuted, includeFontPadding: false } as any}>{hist.count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sleep historical breakdown panel */}
      {selSleepIdx !== null && slots[selSleepIdx]?.isSleep ? (
        <View style={{
          backgroundColor: C.surface, borderRadius: Radius.lg,
          borderWidth: 1, borderColor: sleepStats ? sleepColor(sleepStats.avgSleep) + '40' : C.border,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            padding: 12, borderBottomWidth: 1, borderBottomColor: C.border,
            backgroundColor: sleepStats ? sleepColor(sleepStats.avgSleep) + '12' : C.surfaceElevated,
          }}>
            <Text style={{ fontSize: 22 }}>😴</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>
                Sleep Window · {slots[selSleepIdx].label}
              </Text>
              <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>
                {sleepStats ? `${sleepStats.count} nights tracked · avg ${sleepStats.avgSleep}h` : 'No sleep data synced yet'}
              </Text>
            </View>
            <Pressable onPress={() => setSelSleepIdx(null)} hitSlop={10}>
              <MaterialIcons name="close" size={16} color={C.textMuted} />
            </Pressable>
          </View>

          <View style={{ padding: 12, gap: 14 }}>
            {sleepStats ? (
              <>
                {/* Summary stats */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { val: `${sleepStats.avgSleep}h`, label: '30-night avg', color: sleepColor(sleepStats.avgSleep) },
                    { val: sleepStats.avg7 ? `${sleepStats.avg7}h` : '—', label: '7-night avg', color: sleepStats.avg7 ? sleepColor(sleepStats.avg7) : C.textMuted },
                    { val: `${sleepStats.best}h`, label: 'Best night', color: '#4ADE80' },
                    { val: `${sleepStats.worst}h`, label: 'Worst night', color: '#FF6B6B' },
                  ].map((item, ii) => (
                    <View key={ii} style={{
                      flex: 1, alignItems: 'center', backgroundColor: C.surfaceElevated,
                      borderRadius: Radius.md, paddingVertical: 10, gap: 2,
                      borderWidth: 1, borderColor: C.border,
                    }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: item.color, includeFontPadding: false } as any}>{item.val}</Text>
                      <Text style={{ fontSize: 8, color: C.textMuted, textAlign: 'center', fontWeight: '600', includeFontPadding: false } as any}>{item.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Trend insight */}
                <View style={{
                  flexDirection: 'row', alignItems: 'flex-start', gap: 8,
                  backgroundColor: sleepColor(sleepStats.avgSleep) + '10', borderRadius: Radius.md,
                  padding: 10, borderWidth: 1, borderColor: sleepColor(sleepStats.avgSleep) + '30',
                }}>
                  <MaterialIcons
                    name={sleepStats.trend === 'improving' ? 'trending-up' : sleepStats.trend === 'declining' ? 'trending-down' : 'trending-flat'}
                    size={16}
                    color={sleepStats.trend === 'improving' ? '#4ADE80' : sleepStats.trend === 'declining' ? '#FF6B6B' : '#FFD060'}
                    style={{ marginTop: 1 }}
                  />
                  <Text style={{ flex: 1, fontSize: 11, color: C.textSecondary, lineHeight: 16, includeFontPadding: false } as any}>
                    {sleepStats.trend === 'improving'
                      ? `Sleep trending up — your last 7 nights avg ${sleepStats.avg7}h vs ${sleepStats.priorAvg}h the prior week. Keep it up.`
                      : sleepStats.trend === 'declining'
                      ? `Sleep trending down — last 7 nights avg ${sleepStats.avg7}h vs ${sleepStats.priorAvg}h the prior week. Prioritise wind-down routine.`
                      : `Sleep stable — last 7 nights avg ${sleepStats.avg7}h, consistent with prior week (${sleepStats.priorAvg}h).`
                    }
                  </Text>
                </View>

                {/* Sleep quality distribution */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>Nights distribution (last 30)</Text>
                  {[
                    { label: '8h+ Excellent', count: sleepStats.dist.over8, color: '#4ADE80' },
                    { label: '7–8h Good', count: sleepStats.dist.s7to8, color: '#A3E635' },
                    { label: '6–7h Fair', count: sleepStats.dist.s6to7, color: '#FFD060' },
                    { label: '<6h Low', count: sleepStats.dist.under6, color: '#FF6B6B' },
                  ].map((row, ii) => {
                    const pct = Math.round((row.count / Math.max(sleepStats.count, 1)) * 100);
                    return (
                      <View key={ii} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 10, color: row.color, fontWeight: '700', width: 76, includeFontPadding: false } as any}>{row.label}</Text>
                        <View style={{ flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ height: 6, width: `${pct}%` as any, backgroundColor: row.color, borderRadius: 3 }} />
                        </View>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: row.color, width: 28, textAlign: 'right', includeFontPadding: false } as any}>{row.count}n</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Day-of-week pattern */}
                {sleepStats.dowAvg.length >= 4 ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>Average by day of week</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {sleepStats.dowAvg.map(dw => {
                        const dc = sleepColor(dw.avg);
                        return (
                          <View key={dw.day} style={{
                            flex: 1, alignItems: 'center', gap: 3,
                            backgroundColor: dc + '12', borderRadius: Radius.md,
                            paddingVertical: 8, borderWidth: 1, borderColor: dc + '30',
                          }}>
                            <Text style={{ fontSize: 9, fontWeight: '700', color: C.textMuted, includeFontPadding: false } as any}>{dw.day}</Text>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: dc, includeFontPadding: false } as any}>{dw.avg}h</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {/* Past month nightly list */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>Past month — night by night</Text>
                  <View style={{ gap: 4, maxHeight: 260 }}>
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      style={{ maxHeight: 260 }}
                    >
                      {sleepStats.nights.map((night, ni) => {
                        const nc = sleepColor(night.hours);
                        const vsAvg = parseFloat((night.hours - sleepStats.avgSleep).toFixed(1));
                        const isPos = vsAvg >= 0;
                        const dateLabel = new Date(night.date + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                        return (
                          <View key={night.date} style={{
                            flexDirection: 'row', alignItems: 'center', gap: 10,
                            paddingVertical: 7, paddingHorizontal: 10,
                            borderRadius: Radius.md,
                            backgroundColor: ni % 2 === 0 ? C.surfaceElevated : 'transparent',
                            marginBottom: 2,
                          }}>
                            <Text style={{ fontSize: 9, color: C.textMuted, width: 72, includeFontPadding: false } as any}>{dateLabel}</Text>
                            {/* Bar */}
                            <View style={{ flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
                              <View style={{ height: 6, width: `${Math.min((night.hours / 10) * 100, 100)}%` as any, backgroundColor: nc, borderRadius: 3 }} />
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '900', color: nc, width: 30, textAlign: 'right', includeFontPadding: false } as any}>{night.hours}h</Text>
                            <Text style={{ fontSize: 9, fontWeight: '700', color: isPos ? '#4ADE80' : '#FF6B6B', width: 30, textAlign: 'right', includeFontPadding: false } as any}>
                              {isPos ? '+' : ''}{vsAvg}
                            </Text>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: nc, flexShrink: 0 }} />
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surfaceElevated, borderRadius: Radius.md, padding: 8 }}>
                    <MaterialIcons name="info-outline" size={11} color={C.textMuted} />
                    <Text style={{ flex: 1, fontSize: 9, color: C.textMuted, lineHeight: 13, includeFontPadding: false } as any}>
                      Bar fills relative to 10h max. Delta column shows vs your {sleepStats.avgSleep}h average. Quality: 🟢 8h+ · 🟡 7–8h · 🟠 6–7h · 🔴 {'<'}6h
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center', gap: 10, paddingVertical: 20 }}>
                <Text style={{ fontSize: 28 }}>😴</Text>
                <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', lineHeight: 18, includeFontPadding: false } as any}>
                  No sleep data synced yet.{'\n'}Sync fitness data from the Me tab or connect Apple Health / Google Health to track your nightly sleep here.
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {/* Historical breakdown panel */}
      {selSlot && !selSlot.isSleep ? (
        <View style={{
          backgroundColor: C.surface, borderRadius: Radius.lg,
          borderWidth: 1, borderColor: getScoreColor(Math.round(selSlot.score ?? baseline)) + '40',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            padding: 12, borderBottomWidth: 1, borderBottomColor: C.border,
            backgroundColor: getScoreColor(Math.round(selSlot.score ?? baseline)) + '12',
          }}>
            <Text style={{ fontSize: 22 }}>{selSlot.tod === 'morning' ? '🌅' : selSlot.tod === 'afternoon' ? '☀️' : selSlot.tod === 'evening' ? '🌆' : '🌙'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.textPrimary, textTransform: 'capitalize', includeFontPadding: false } as any}>
                {selSlot.tod} · {selSlot.label}
              </Text>
              <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>
                Forecast: {Math.round(selSlot.score ?? baseline)} · Δ {Math.round((selSlot.score ?? baseline) - baseline) >= 0 ? '+' : ''}{Math.round((selSlot.score ?? baseline) - baseline)} vs baseline
              </Text>
            </View>
            <Pressable onPress={() => setSelIdx(null)} hitSlop={10}>
              <MaterialIcons name="close" size={16} color={C.textMuted} />
            </Pressable>
          </View>

          <View style={{ padding: 12, gap: 12 }}>
            {selHistory ? (
              <>
                {/* Summary stats */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { val: String(selHistory.avg), label: 'Historical avg', color: getScoreColor(selHistory.avg) },
                    { val: String(selHistory.best), label: 'Best', color: getScoreColor(selHistory.best) },
                    { val: String(selHistory.worst), label: 'Worst', color: getScoreColor(selHistory.worst) },
                    { val: String(selHistory.count), label: 'Total logs', color: C.textPrimary },
                  ].map((item, ii) => (
                    <View key={ii} style={{
                      flex: 1, alignItems: 'center', backgroundColor: C.surfaceElevated,
                      borderRadius: Radius.md, paddingVertical: 10, gap: 2,
                      borderWidth: 1, borderColor: C.border,
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: item.color, includeFontPadding: false } as any}>{item.val}</Text>
                      <Text style={{ fontSize: 8, color: C.textMuted, textAlign: 'center', fontWeight: '600', includeFontPadding: false } as any}>{item.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Top tags */}
                {selHistory.topTags.length > 0 ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>Common context at this time</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {selHistory.topTags.map(t => {
                        const tag = CONTEXT_TAGS.find(x => x.id === t.id);
                        if (!tag) return null;
                        const tc = getScoreColor(t.avg);
                        return (
                          <View key={t.id} style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            backgroundColor: tc + '15', paddingHorizontal: 9, paddingVertical: 4,
                            borderRadius: Radius.full, borderWidth: 1, borderColor: tc + '35',
                          }}>
                            <Text style={{ fontSize: 12 }}>{tag.emoji}</Text>
                            <View>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{tag.label}</Text>
                              <Text style={{ fontSize: 8, color: C.textMuted, includeFontPadding: false } as any}>{t.count}x · avg {t.avg}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {/* Recent logs */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>Recent {selSlot.tod} logs</Text>
                  {selHistory.recent.map(e => {
                    const tag = CONTEXT_TAGS.find(x => x.id === e.primaryTag);
                    const ec = getScoreColor(e.score);
                    return (
                      <View key={e.id} style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        backgroundColor: C.surfaceElevated, borderRadius: Radius.md,
                        padding: 8, borderWidth: 1, borderColor: ec + '25',
                      }}>
                        <Text style={{ fontSize: 15, fontWeight: '900', color: ec, width: 26, textAlign: 'center', includeFontPadding: false } as any}>{e.score}</Text>
                        <View style={{ flex: 1, gap: 1 }}>
                          <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>{new Date(e.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                          {tag ? <Text style={{ fontSize: 10, fontWeight: '600', color: C.textPrimary, includeFontPadding: false } as any}>{tag.emoji} {tag.label}</Text> : null}
                          {e.note ? <Text style={{ fontSize: 9, color: C.textMuted, includeFontPadding: false } as any} numberOfLines={1}>{e.note}</Text> : null}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <Text style={{ fontSize: 9, color: C.textMuted, includeFontPadding: false } as any}>{getScoreLabel(e.score)}</Text>
                          {(() => {
                            const delta = e.score - Math.round(selHistory!.avg);
                            const isP = delta >= 0;
                            return (
                              <Text style={{ fontSize: 9, fontWeight: '700', color: isP ? '#4ADE80' : '#FF6B6B', includeFontPadding: false } as any}>
                                {isP ? '+' : ''}{delta} vs {selSlot.tod} avg
                              </Text>
                            );
                          })()}
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Comparison insight */}
                <View style={{
                  flexDirection: 'row', alignItems: 'flex-start', gap: 8,
                  backgroundColor: C.surfaceElevated, borderRadius: Radius.md, padding: 10,
                  borderWidth: 1, borderColor: C.border,
                }}>
                  <MaterialIcons name="lightbulb-outline" size={14} color={Colors.primary} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 11, color: C.textSecondary, lineHeight: 16, includeFontPadding: false } as any}>
                    {(() => {
                      const histAvg = selHistory.avg;
                      const fcast   = Math.round(selSlot.score ?? baseline);
                      const diff    = fcast - histAvg;
                      if (Math.abs(diff) <= 3) return `Your ${selSlot.tod} forecast (${fcast}) is right on track with your historical ${selSlot.tod} average (${histAvg}).`;
                      if (diff > 0)  return `Forecast (${fcast}) is ${diff} pts above your usual ${selSlot.tod} average (${histAvg}). Conditions suggest a better-than-usual ${selSlot.tod}.`;
                      return `Forecast (${fcast}) is ${Math.abs(diff)} pts below your usual ${selSlot.tod} average (${histAvg}). Consider what helps you most at this time of day.`;
                    })()}
                  </Text>
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 16 }}>
                <MaterialIcons name="history" size={28} color={C.textMuted} />
                <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', lineHeight: 18, includeFontPadding: false } as any}>
                  No historical logs at {selSlot.tod} yet.{"\n"}Log more moods during the {selSlot.tod} to see patterns here.
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// =============================================================================
// LAYER 6 — MOOD PRINT
// =============================================================================
function LayerPrint({ entries, stats, artState, onRegen }: {
  entries: MoodLogEntry[]; stats: any; artState: ArtState; onRegen: () => void;
}) {
  const { colors: C } = useTheme();
  const router = useRouter();
  const CANVAS_H = Math.min(CONTENT_W, 420);
  if (!stats) return <Empty icon="fingerprint" title="Need more data" sub="Log at least 3 moods to generate your unique Mood Print" />;

  const avgCol = getScoreColor(Math.round(stats.avg));
  const scoreBandLabel =
    stats.avg >= 90 ? 'Prismatic iridescent — blazing white-gold ridges'
    : stats.avg >= 80 ? 'Golden amber — luminous warm sunrise ridges'
    : stats.avg >= 70 ? 'Coral rose — vibrant warm pulsing ridges'
    : stats.avg >= 60 ? 'Teal emerald — cool crystalline clean ridges'
    : stats.avg >= 50 ? 'Lavender haze — dreamy translucent soft ridges'
    : stats.avg >= 40 ? 'Cobalt indigo — cold compressed dark ridges'
    : stats.avg >= 30 ? 'Crimson rust — cracked eroded burnt ridges'
    : 'Obsidian void — near-black barely-visible ridges';

  const descriptors = [
    `Score ${Math.round(stats.avg)}/100 → ${scoreBandLabel}`,
    `${stats.volatility} pattern → ${stats.volatility === 'stable' ? 'perfect smooth concentric rings' : stats.volatility === 'variable' ? 'organic undulating hand-drawn waves' : 'shattered crystalline kaleidoscope shards'}`,
    `${stats.trend === 'improving' ? 'Improving trend → light blooms outward ↗' : stats.trend === 'declining' ? 'Declining trend → colors implode inward ↘' : 'Stable trend → perfect radial symmetry →'}`,
    stats.topTag ? `dominant: ${CONTEXT_TAGS.find(t => t.id === stats.topTag.tagId)?.label ?? ''}` : null,
  ].filter(Boolean) as string[];

  return (
    <View style={{ gap: 16 }}>
      <Canvas artUrl={artState.url} loading={artState.loading} height={CANVAS_H} onRegen={onRegen} onFail={onRegen} showRetryOnFail={!!(artState.error)} gradient="full">
        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <MaterialIcons name="fingerprint" size={28} color={avgCol + 'CC'} />
          <Text style={{ fontSize: 40, fontWeight: '900', color: avgCol, includeFontPadding: false } as any}>{Math.round(stats.avg)}</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.80)', fontWeight: '700', letterSpacing: 2.5, includeFontPadding: false } as any}>MOOD PRINT</Text>
          <Text style={{ fontSize: 13, color: G_MUTED, includeFontPadding: false } as any}>{stats.count} logs · {stats.volatility}</Text>
        </View>
      </Canvas>

      <GCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="palette" size={15} color={avgCol} />
          <Text style={[lz.sTitle, { color: avgCol }]}>About your Mood Print art</Text>
        </View>
        <Text style={[lz.sBody, { color: C.textSecondary }]}>Your Mood Print is a macro fingerprint — rendered as if scanned under a forensic microscope and coloured by your emotional data. No two prints look the same.</Text>
        <View style={{ gap: 8, marginTop: 4 }}>
          {[
            { e: '🔍', l: stats.volatility === 'stable' ? 'Perfect loop whorl — tight concentric ridges' : stats.volatility === 'variable' ? 'Arch-loop composite — bifurcating organic ridges' : 'Fragmented delta — shattered ridge endings, broken whorl', d: `Your pattern is ${stats.volatility} — ${stats.volatility === 'stable' ? 'consistent mood = mathematically precise closed-loop ridges' : stats.volatility === 'variable' ? 'moderate variation = organic ridge splits and forks' : 'high variation = ridge endings, gaps, fragmented delta structure'}` },
            { e: '🎨', l: scoreBandLabel, d: `Score ${Math.round(stats.avg)} determines ridge color. At 90+ blazing iridescent white-gold; 80+ warm amber sunrise; 70+ vibrant coral rose; 60+ cool teal emerald; 50+ dreamy lavender; 40+ cold cobalt; 30+ burnt crimson; below 30 near-black obsidian.` },
            { e: stats.trend === 'improving' ? '✨' : stats.trend === 'declining' ? '🌑' : '⚖️', l: stats.trend === 'improving' ? 'High contrast — bright luminous valleys' : stats.trend === 'declining' ? 'Low contrast — dark shadowed channels' : 'Balanced contrast — soft grey valleys', d: `Trend is ${stats.trend} — ${stats.trend === 'improving' ? 'valleys between ridges are bright and crisp, high contrast' : stats.trend === 'declining' ? 'valleys are dark and murky, ridges barely lift from background' : 'mid-tone valleys, even ridge-to-valley contrast ratio'}` },
            { e: stats.avgEnergy > 0.6 ? '⚡' : stats.avgEnergy > 0.4 ? '🌤️' : '🌫️', l: stats.avgEnergy > 0.65 ? 'Bold thick ridges — neon glow halation' : stats.avgEnergy > 0.4 ? 'Medium-weight ridges — clean smooth lines' : 'Faint thin ridges — faded washed-out lines', d: `Energy avg ${Math.round(stats.avgEnergy * 100)}% controls ridge weight. High energy = thick vivid ridges with glow; Low = barely-there faded lines.` },
          ].map((x, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Text style={{ fontSize: 16, width: 24 }}>{x.e}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: avgCol, includeFontPadding: false } as any}>{x.l}</Text>
                <Text style={{ fontSize: 13, color: C.textMuted, lineHeight: 19, includeFontPadding: false } as any}>{x.d}</Text>
              </View>
            </View>
          ))}
        </View>
      </GCard>

      <GCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="fingerprint" size={15} color={avgCol} />
          <Text style={[lz.sTitle, { color: avgCol }]}>Your Emotional Signature</Text>
        </View>
        <Text style={[lz.sBody, { color: C.textSecondary }]}>A macro forensic fingerprint coloured by your emotional data — unique to you. Updates as your patterns shift.</Text>
        {descriptors.map((d, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: avgCol }} />
            <Text style={{ fontSize: 14, color: C.textPrimary, lineHeight: 20, includeFontPadding: false } as any}>{d}</Text>
          </View>
        ))}
      </GCard>

      <StatRow items={[
        { val: String(Math.round(stats.avg)), label: 'Avg mood', color: avgCol },
        { val: String(stats.count), label: 'Total logs' },
        { val: stats.volatility, label: 'Pattern' },
        { val: stats.trend === 'improving' ? '↗' : stats.trend === 'declining' ? '↘' : '→', label: 'Trend', color: stats.trend === 'improving' ? '#4ADE80' : stats.trend === 'declining' ? '#FF6B6B' : '#FFD060' },
      ]} />

      <GCard style={{ borderLeftWidth: 3, borderLeftColor: Colors.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="auto-awesome" size={15} color={Colors.primary} />
          <Text style={[lz.sTitle, { color: Colors.primary }]}>Print evolves with every log</Text>
        </View>
        <Text style={[lz.sBody, { color: C.textSecondary, lineHeight: 18 }]}>Your Mood Print — the forensic fingerprint canvas — regenerates automatically each time you log a new mood. As your patterns and trends shift, the ridge color, weight, and whorl structure shift with them.</Text>
        <Pressable
          onPress={() => router.push('/(tabs)/checkin')}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: Colors.primary, borderRadius: Radius.lg,
            paddingVertical: 12, paddingHorizontal: 20, marginTop: 4,
            opacity: pressed ? 0.8 : 1,
          }]}
        >
          <MaterialIcons name="add-circle" size={16} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', includeFontPadding: false } as any}>Log Your Mood Now</Text>
          <MaterialIcons name="arrow-forward" size={14} color="#fff" />
        </Pressable>
      </GCard>

      {stats.topTag ? (() => {
        const tag = CONTEXT_TAGS.find(t => t.id === stats.topTag.tagId);
        return tag ? (
          <GCard>
            <Text style={[lz.sTitle, { color: C.textPrimary }]}>Dominant Context</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 32 }}>{tag.emoji}</Text>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{tag.label}</Text>
                <Text style={{ fontSize: 11, color: C.textMuted, includeFontPadding: false } as any}>Most correlated context</Text>
              </View>
            </View>
          </GCard>
        ) : null;
      })() : null}

      <GCard>
        <Text style={[lz.sTitle, { color: C.textPrimary }]}>Ridge color → 8 score bands</Text>
        <View style={{ gap: 6 }}>
          {[
            { range: '90–100', desc: 'Iridescent white-gold prismatic ridges — blazing rainbow shimmer', color: '#FFD700' },
            { range: '80–89', desc: 'Luminous amber sunrise ridges — warm inner glow', color: '#FFA500' },
            { range: '70–79', desc: 'Vibrant coral salmon rose ridges — warm radiant pulse', color: '#FF7F7F' },
            { range: '60–69', desc: 'Cool mint teal emerald ridges — crystalline precision', color: '#4ADE80' },
            { range: '50–59', desc: 'Soft lavender periwinkle ridges — dreamy translucent', color: '#A78BFA' },
            { range: '40–49', desc: 'Dark cobalt indigo steel ridges — cold compressed', color: '#7C83FF' },
            { range: '30–39', desc: 'Deep crimson rust ridges — cracked and eroded', color: '#DC2626' },
            { range: '0–29', desc: 'Obsidian near-black ridges — barely visible void', color: '#6B7280' },
          ].map((x, i) => {
            const isCurrent = Math.round(stats.avg) >= parseInt(x.range.split('–')[0]) && Math.round(stats.avg) <= parseInt(x.range.split('–')[1] ?? '100');
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isCurrent ? x.color + '15' : 'transparent', borderRadius: Radius.md, paddingHorizontal: isCurrent ? 8 : 0, paddingVertical: isCurrent ? 5 : 2, borderWidth: isCurrent ? 1 : 0, borderColor: x.color + '40' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: x.color, flexShrink: 0 }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: x.color, width: 52, includeFontPadding: false } as any}>{x.range}</Text>
                <Text style={{ flex: 1, fontSize: 12, color: isCurrent ? C.textPrimary : C.textMuted, lineHeight: 17, includeFontPadding: false } as any}>{x.desc}{isCurrent ? ' ← you' : ''}</Text>
              </View>
            );
          })}
        </View>
      </GCard>
    </View>
  );
}
