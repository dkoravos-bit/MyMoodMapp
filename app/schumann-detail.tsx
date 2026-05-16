/**
 * Schumann Resonance Detail Screen — Live Edition
 *
 * Displays the real-time Schumann spectrograph image from Tomsk Space
 * Observatory (via schumann-frequency-today.com CDN, updates every 5 min)
 * alongside live numeric data from schumannresonancelive.com API.
 * Falls back gracefully to our physics-based simulation model if either
 * source is unavailable.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  SchumannReading,
  fetchAndCacheSchumann,
  getCachedSchumannReading,
  getSchumannReading,
  getStatusColor,
  getStatusEmoji,
  getStatusLabel,
  getKIndexLabel,
  SchumannStatus,
} from '@/services/schumannResonance';

// ─── Live spectrograph image URL (Tomsk Space Observatory via CDN) ────────────
// Updates every 5 minutes. Cache-bust with current 5-min bucket timestamp.
function getLiveSpectrographUrl(): string {
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000)) * (5 * 60 * 1000);
  return `https://schumann-frequency-today.com/?img=schumann&t=${bucket}`;
}

// ─── Live JSON API from schumannresonancelive.com ─────────────────────────────
interface LiveApiData {
  frequency?: number;
  amplitude?: number;
  status?: string;
  trend?: string;
  timestamp?: string;
  kp_index?: number;
  interpretation?: string;
}

async function fetchLiveApiData(): Promise<LiveApiData | null> {
  try {
    const res = await fetch(
      'https://schumannresonancelive.com/schumann_api.php?action=current&lang=en',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const text = await res.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch {
    return null;
  }
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SPECTROGRAPH_HEIGHT = Math.round((SCREEN_WIDTH - 32) * 0.52); // ~16:8 crop

export default function SchumannDetailScreen() {
  const router = useRouter();
  const [reading, setReading] = useState<SchumannReading | null>(null);
  const [liveData, setLiveData] = useState<LiveApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<SchumannReading[]>([]);
  const [specUrl, setSpecUrl] = useState(getLiveSpectrographUrl());
  const [specLoaded, setSpecLoaded] = useState(false);
  const [specError, setSpecError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveSource, setLiveSource] = useState<'api' | 'model'>('model');
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    // Fetch reading (try cache first, then model)
    const cached = await getCachedSchumannReading();
    const current = cached ?? await fetchAndCacheSchumann();
    setReading(current);

    // Try live API
    const live = await fetchLiveApiData();
    if (live && (live.frequency || live.kp_index)) {
      setLiveData(live);
      setLiveSource('api');
    } else {
      setLiveSource('model');
    }

    // Build 7-day history
    const hist: SchumannReading[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      hist.push(getSchumannReading(d));
    }
    setHistory(hist);
    setLastUpdated(new Date());

    // Refresh spectrograph URL
    setSpecUrl(getLiveSpectrographUrl());
    setSpecLoaded(false);
    setSpecError(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));

    // Auto-refresh spectrograph every 5 minutes
    refreshTimerRef.current = setInterval(() => {
      setSpecUrl(getLiveSpectrographUrl());
      setSpecLoaded(false);
      setSpecError(false);
    }, 5 * 60 * 1000);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (loading || !reading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Tuning into Earth frequency...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Merge live API data with model reading where available
  const freq = liveData?.frequency ?? reading.frequency;
  const kIndex = liveData?.kp_index != null
    ? Math.min(9, Math.round(liveData.kp_index))
    : reading.kIndex;
  const amplitude = liveData?.amplitude ?? reading.amplitude;
  const statusColor = getStatusColor(reading.status);
  const maxK = Math.max(...history.map(h => h.kIndex), kIndex);

  // Harmonic frequencies (theoretical)
  const harmonics = [
    { n: 1, hz: 7.83, label: '1st' },
    { n: 2, hz: 14.3, label: '2nd' },
    { n: 3, hz: 20.8, label: '3rd' },
    { n: 4, hz: 27.3, label: '4th' },
    { n: 5, hz: 33.8, label: '5th' },
  ];

  const timeSince = lastUpdated
    ? (() => {
        const mins = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
        return mins < 1 ? 'just now' : `${mins}m ago`;
      })()
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Schumann Resonance</Text>
          <View style={styles.liveChip}>
            <View style={styles.liveDot} />
            <Text style={styles.liveChipText}>
              {liveSource === 'api' ? 'LIVE' : 'MODEL'} · {timeSince ?? '—'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onRefresh}
          disabled={refreshing}
          hitSlop={8}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
        >
          {refreshing
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <MaterialIcons name="refresh" size={20} color={Colors.primary} />}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >

        {/* ── Live Spectrograph ─────────────────────────────────────────── */}
        <View style={styles.specCard}>
          <View style={styles.specHeader}>
            <View style={styles.specTitleRow}>
              <MaterialIcons name="graphic-eq" size={16} color={Colors.secondary} />
              <Text style={styles.specTitle}>Live Spectrograph</Text>
              <View style={[styles.sourceBadge, { backgroundColor: Colors.secondary + '20', borderColor: Colors.secondary + '40' }]}>
                <Text style={[styles.sourceBadgeText, { color: Colors.secondary }]}>Tomsk Observatory</Text>
              </View>
            </View>
            <Text style={styles.specSub}>ELF frequency spectrum · updates every 5 min</Text>
          </View>

          <View style={[styles.specImageWrap, { height: SPECTROGRAPH_HEIGHT }]}>
            {!specLoaded && !specError ? (
              <View style={styles.specPlaceholder}>
                <ActivityIndicator color={Colors.secondary} size="large" />
                <Text style={styles.specPlaceholderText}>Loading live spectrograph…</Text>
              </View>
            ) : null}
            {specError ? (
              <View style={styles.specPlaceholder}>
                <MaterialIcons name="signal-wifi-off" size={32} color={Colors.textMuted} />
                <Text style={styles.specPlaceholderText}>Live feed unavailable</Text>
                <Text style={styles.specPlaceholderSub}>Check connection · pull to refresh</Text>
              </View>
            ) : null}
            <Image
              source={{ uri: specUrl }}
              style={[styles.specImage, specError && styles.specImageHidden]}
              contentFit="cover"
              transition={400}
              onLoad={() => { setSpecLoaded(true); setSpecError(false); }}
              onError={() => { setSpecError(true); setSpecLoaded(false); }}
            />
          </View>

          {/* Harmonic frequency labels */}
          <View style={styles.harmonicsRow}>
            {harmonics.map(h => (
              <View key={h.n} style={styles.harmonicChip}>
                <Text style={styles.harmonicN}>{h.label}</Text>
                <Text style={styles.harmonicHz}>{h.hz} Hz</Text>
              </View>
            ))}
          </View>

          <View style={styles.specFooter}>
            <MaterialIcons name="info-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.specFooterText}>
              The spectrograph shows power intensity (colour) across ELF frequencies over time. Bright horizontal bands at 7.83 Hz and its harmonics indicate active resonance.
            </Text>
          </View>
        </View>

        {/* ── Hero frequency display ────────────────────────────────────── */}
        <View style={[styles.heroCard, { borderColor: statusColor + '60' }]}>
          <View style={styles.heroTop}>
            <Text style={styles.heroEmoji}>{getStatusEmoji(reading.status)}</Text>
            <View style={{ flex: 1, gap: Spacing.xs }}>
              <Text style={[styles.heroStatus, { color: statusColor }]}>
                {getStatusLabel(reading.status)}
              </Text>
              <Text style={styles.heroDate}>
                {new Date(reading.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
              <Text style={[styles.heroBadgeText, { color: statusColor }]}>
                {reading.trend === 'spiking' ? '▲ Spiking'
                  : reading.trend === 'elevated' ? '↑ Elevated'
                  : reading.trend === 'normal' ? '→ Normal' : '↓ Low'}
              </Text>
            </View>
          </View>

          {/* Frequency metrics */}
          <View style={styles.freqRow}>
            <FreqItem value={freq.toFixed(2)} unit="Hz" label="Frequency" color={statusColor} />
            <View style={styles.freqDivider} />
            <FreqItem value={String(amplitude)} unit="%" label="Power" color={statusColor} />
            <View style={styles.freqDivider} />
            <FreqItem
              value={String(kIndex)}
              unit="Kp"
              label={getKIndexLabel(kIndex)}
              color={getKColor(kIndex)}
            />
          </View>

          {/* Deviation from baseline */}
          <View style={styles.baselineRow}>
            <View style={styles.baselineBar}>
              <View style={[styles.baselineFill, {
                width: `${Math.min(100, (freq / 40) * 100)}%`,
                backgroundColor: statusColor,
              }]} />
              <View style={styles.baselineMarker} />
            </View>
            <Text style={styles.baselineLabel}>Baseline 7.83 Hz</Text>
          </View>

          <View style={styles.compareRow}>
            <MaterialIcons name="info-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.compareText}>{reading.historicalComparison}</Text>
          </View>
        </View>

        {/* ── K-index gauge ─────────────────────────────────────────────── */}
        <View style={styles.kGaugeCard}>
          <View style={styles.kGaugeHeader}>
            <Text style={styles.sectionLabel}>Geomagnetic Kp-index (0–9)</Text>
            <View style={[styles.kValueBadge, { backgroundColor: getKColor(kIndex) + '25' }]}>
              <Text style={[styles.kValueText, { color: getKColor(kIndex) }]}>
                Kp {kIndex} — {getKIndexLabel(kIndex)}
              </Text>
            </View>
          </View>
          <View style={styles.kGaugeTrack}>
            {Array.from({ length: 10 }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.kSegment,
                  {
                    backgroundColor: getKColor(i) + (i <= kIndex ? 'FF' : '28'),
                    transform: [{ scaleY: i <= kIndex ? 1 : 0.7 }],
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.kGaugeLabels}>
            <Text style={styles.kGaugeLabelText}>0 · Quiet</Text>
            <Text style={styles.kGaugeLabelText}>5 · Active</Text>
            <Text style={styles.kGaugeLabelText}>9 · Severe Storm</Text>
          </View>
        </View>

        {/* ── 7-day activity chart ──────────────────────────────────────── */}
        <View style={styles.historyCard}>
          <Text style={styles.sectionLabel}>7-day geomagnetic activity</Text>
          <View style={styles.historyBars}>
            {history.map((h, i) => {
              const barH = Math.max(6, Math.round((h.kIndex / 9) * 64));
              const color = getStatusColor(h.status);
              const isToday = i === 6;
              const day = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][new Date(h.date + 'T12:00:00').getDay()];
              return (
                <View key={i} style={styles.historyBarCol}>
                  <Text style={[styles.historyBarFreq, { color }]}>{h.frequency.toFixed(0)}</Text>
                  <View style={[styles.historyBar, {
                    height: barH,
                    backgroundColor: isToday ? color : color + '65',
                    borderWidth: isToday ? 1.5 : 0,
                    borderColor: color,
                  }]} />
                  <Text style={[styles.historyBarDay, isToday && { color: Colors.textPrimary, fontWeight: '700' }]}>
                    {isToday ? 'Now' : day}
                  </Text>
                </View>
              );
            })}
          </View>
          {maxK >= 5 ? (
            <View style={styles.spikeNote}>
              <MaterialIcons name="warning-amber" size={13} color={Colors.warning} />
              <Text style={styles.spikeNoteText}>Peak Kp {maxK} this week — elevated sensitivity period</Text>
            </View>
          ) : null}
        </View>

        {/* ── Resonance modes ───────────────────────────────────────────── */}
        <View style={styles.modesCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="waves" size={16} color={Colors.secondary} />
            <Text style={styles.sectionTitle}>Resonance harmonics</Text>
          </View>
          <Text style={styles.modesDesc}>
            The Earth-ionosphere cavity resonates at five distinct harmonic frequencies. When the fundamental (7.83 Hz) spikes, all harmonics amplify proportionally.
          </Text>
          {harmonics.map(h => {
            const activityPct = Math.min(100, Math.round(15 + (freq / 7.83) * 15 + (h.n === 1 ? 20 : 0)));
            const hColor = h.n === 1 ? statusColor : Colors.secondary + 'CC';
            return (
              <View key={h.n} style={styles.modeRow}>
                <View style={[styles.modeNumBadge, { backgroundColor: hColor + '20' }]}>
                  <Text style={[styles.modeNum, { color: hColor }]}>{h.label}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.modeLabelRow}>
                    <Text style={styles.modeHz}>{h.hz} Hz</Text>
                    <Text style={[styles.modeActivity, { color: hColor }]}>{activityPct}% power</Text>
                  </View>
                  <View style={styles.modeBarTrack}>
                    <View style={[styles.modeBarFill, { width: `${activityPct}%`, backgroundColor: hColor }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Physical effects today ───────────────────────────────────── */}
        <View style={styles.effectsCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="healing" size={16} color={statusColor} />
            <Text style={styles.sectionTitle}>Physical effects today</Text>
          </View>
          {reading.physicalEffects.map((effect, i) => (
            <View key={i} style={[styles.effectRow, { borderLeftColor: getSeverityColor(effect.severity) }]}>
              <View style={styles.effectTop}>
                <MaterialIcons name={effect.icon as any} size={16} color={getSeverityColor(effect.severity)} />
                <Text style={[styles.effectSystem, { color: getSeverityColor(effect.severity) }]}>{effect.system}</Text>
                <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(effect.severity) + '20' }]}>
                  <Text style={[styles.severityText, { color: getSeverityColor(effect.severity) }]}>{effect.severity}</Text>
                </View>
              </View>
              <Text style={styles.effectText}>{effect.effect}</Text>
            </View>
          ))}
        </View>

        {/* ── Recommendation ───────────────────────────────────────────── */}
        <View style={[styles.recommendationCard, { borderColor: statusColor + '40', backgroundColor: statusColor + '10' }]}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="lightbulb" size={16} color={statusColor} />
            <Text style={[styles.sectionTitle, { color: statusColor }]}>Your recommendation</Text>
          </View>
          <Text style={styles.recommendationText}>{reading.recommendation}</Text>
        </View>

        {/* ── Grounding practices ──────────────────────────────────────── */}
        <View style={styles.groundingCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="spa" size={16} color={Colors.success} />
            <Text style={styles.sectionTitle}>Grounding practices</Text>
          </View>
          {[
            { icon: 'nature', tip: 'Earthing — walk barefoot on grass, soil, or sand for 10–20 min. Skin-to-earth contact neutralizes positive ions and synchronizes your bioelectrical field.' },
            { icon: 'water', tip: 'Hydration — electromagnetic sensitivity is amplified by dehydration. Drink mineral water or add a pinch of sea salt.' },
            { icon: 'bedtime', tip: 'Sleep hygiene — put your phone in airplane mode at night. During high-resonance periods, keep devices out of the bedroom entirely.' },
            { icon: 'self-improvement', tip: 'Breathwork — slow diaphragmatic breathing (4-7-8 pattern) actively shifts the nervous system out of sympathetic dominance and back toward baseline.' },
          ].map((g, i) => (
            <View key={i} style={styles.groundingRow}>
              <View style={styles.groundingIcon}>
                <MaterialIcons name={g.icon as any} size={16} color={Colors.success} />
              </View>
              <Text style={styles.groundingText}>{g.tip}</Text>
            </View>
          ))}
        </View>

        {/* ── What is Schumann Resonance ───────────────────────────────── */}
        <View style={styles.explainerCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="public" size={16} color={Colors.secondary} />
            <Text style={styles.sectionTitle}>About Schumann Resonance</Text>
          </View>
          <Text style={styles.explainerText}>
            The Schumann resonances are electromagnetic standing waves that form between Earth's surface and the ionosphere — a natural cavity ~60 km above us. Lightning strikes (~100/second globally) continuously excite these frequencies.{'\n\n'}
            The fundamental frequency of 7.83 Hz is remarkably close to human alpha and theta brainwave frequencies, which govern relaxation, creativity, and light sleep. This alignment is why fluctuations in Earth's field can synchronize with — or disrupt — biological rhythms.{'\n\n'}
            The spectrograph above is captured by receivers at Tomsk State University, Russia and reflects actual ELF power measurements. Bright bands at the harmonic frequencies indicate active resonance.
          </Text>
        </View>

        {/* ── Disclaimer ───────────────────────────────────────────────── */}
        <View style={styles.disclaimer}>
          <MaterialIcons name="info-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.disclaimerText}>
            Spectrograph: © Tomsk Space Observatory / schumann-frequency-today.com, updated every 5 minutes. Numeric model calibrated to NOAA Kp-index proxy. Not a medical device.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FreqItem({ value, unit, label, color }: { value: string; unit: string; label: string; color: string }) {
  return (
    <View style={fiStyles.wrap}>
      <Text style={[fiStyles.value, { color }]}>{value}</Text>
      <Text style={fiStyles.unit}>{unit}</Text>
      <Text style={fiStyles.label}>{label}</Text>
    </View>
  );
}
const fiStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 2 },
  value: { fontSize: Typography.fontSizes['2xl'], fontWeight: '900', includeFontPadding: false },
  unit: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  label: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', includeFontPadding: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getKColor(k: number): string {
  if (k <= 1) return '#4ECDC4';
  if (k <= 3) return '#95E06C';
  if (k <= 5) return '#FFD166';
  if (k <= 7) return '#FF8C42';
  return '#FF6B6B';
}

function getSeverityColor(severity: 'mild' | 'moderate' | 'strong'): string {
  return severity === 'mild' ? Colors.success : severity === 'moderate' ? '#FFD166' : '#FF6B6B';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: Typography.fontSizes.md, color: Colors.textSecondary, includeFontPadding: false },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  headerCenter: { flex: 1, gap: 3 },
  headerTitle: { fontSize: Typography.fontSizes.lg, fontWeight: '800', color: Colors.textPrimary, includeFontPadding: false },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  liveChipText: { fontSize: 10, fontWeight: '700', color: Colors.success, includeFontPadding: false },
  refreshBtn: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary + '40' },

  scroll: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },

  // Spectrograph card
  specCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.secondary + '50',
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    ...Shadows.sm,
  },
  specHeader: { padding: Spacing.lg, gap: 4 },
  specTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  specTitle: { flex: 1, fontSize: Typography.fontSizes.md, fontWeight: '800', color: Colors.textPrimary, includeFontPadding: false },
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  sourceBadgeText: { fontSize: 10, fontWeight: '700', includeFontPadding: false },
  specSub: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  specImageWrap: {
    width: '100%',
    backgroundColor: '#050A1A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  specImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  specImageHidden: { opacity: 0 },
  specPlaceholder: { position: 'absolute', alignItems: 'center', gap: Spacing.sm, zIndex: 1 },
  specPlaceholderText: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, includeFontPadding: false },
  specPlaceholderSub: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  harmonicsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: '#050A1A',
    borderTopWidth: 1,
    borderTopColor: Colors.secondary + '30',
  },
  harmonicChip: { alignItems: 'center', gap: 2 },
  harmonicN: { fontSize: 9, fontWeight: '700', color: Colors.secondary, includeFontPadding: false },
  harmonicHz: { fontSize: 9, color: Colors.textMuted, includeFontPadding: false },
  specFooter: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  specFooterText: { flex: 1, fontSize: 10, color: Colors.textMuted, lineHeight: 14, includeFontPadding: false },

  // Hero card
  heroCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1.5, marginBottom: Spacing.xl, gap: Spacing.lg, ...Shadows.sm,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroEmoji: { fontSize: 36 },
  heroStatus: { fontSize: Typography.fontSizes.xl, fontWeight: '800', includeFontPadding: false },
  heroDate: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  heroBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  heroBadgeText: { fontSize: Typography.fontSizes.xs, fontWeight: '700', includeFontPadding: false },
  freqRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  freqDivider: { width: 1, height: 44, backgroundColor: Colors.border },
  baselineRow: { gap: 6 },
  baselineBar: { height: 6, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'visible', position: 'relative' },
  baselineFill: { height: '100%', borderRadius: Radius.full },
  baselineMarker: { position: 'absolute', left: '19.5%', top: -2, width: 2, height: 10, backgroundColor: Colors.textMuted + '80', borderRadius: 1 },
  baselineLabel: { fontSize: 9, color: Colors.textMuted, includeFontPadding: false },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  compareText: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, flex: 1, includeFontPadding: false },

  // K-index gauge
  kGaugeCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl, gap: Spacing.md },
  kGaugeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.sm },
  kValueBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  kValueText: { fontSize: 11, fontWeight: '700', includeFontPadding: false },
  sectionLabel: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
  kGaugeTrack: { flexDirection: 'row', gap: 3, height: 20, alignItems: 'flex-end' },
  kSegment: { flex: 1, borderRadius: 4, height: '100%' },
  kGaugeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  kGaugeLabelText: { fontSize: 9, color: Colors.textMuted, includeFontPadding: false },

  // 7-day history
  historyCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl, gap: Spacing.md },
  historyBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 88, paddingTop: 20 },
  historyBarCol: { flex: 1, alignItems: 'center', gap: 3 },
  historyBarFreq: { fontSize: 8, fontWeight: '600', includeFontPadding: false },
  historyBar: { width: '100%', borderRadius: 4 },
  historyBarDay: { fontSize: 9, color: Colors.textMuted, includeFontPadding: false },
  spikeNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.warning + '15', borderRadius: Radius.md, padding: Spacing.sm },
  spikeNoteText: { flex: 1, fontSize: Typography.fontSizes.xs, color: Colors.warning, includeFontPadding: false },

  // Resonance modes
  modesCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl, gap: Spacing.md },
  modesDesc: { fontSize: Typography.fontSizes.xs, color: Colors.textSecondary, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  modeNumBadge: { width: 44, height: 28, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  modeNum: { fontSize: 10, fontWeight: '700', includeFontPadding: false },
  modeLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeHz: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: Colors.textPrimary, includeFontPadding: false },
  modeActivity: { fontSize: 11, fontWeight: '700', includeFontPadding: false },
  modeBarTrack: { height: 5, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  modeBarFill: { height: '100%', borderRadius: Radius.full },

  // Physical effects
  effectsCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl, gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: Colors.textPrimary, flex: 1, includeFontPadding: false },
  effectRow: { borderLeftWidth: 3, paddingLeft: Spacing.md, gap: 5 },
  effectTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  effectSystem: { fontSize: Typography.fontSizes.sm, fontWeight: '700', flex: 1, includeFontPadding: false },
  severityBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full },
  severityText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize', includeFontPadding: false },
  effectText: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false },

  // Recommendation
  recommendationCard: { borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, marginBottom: Spacing.xl, gap: Spacing.md },
  recommendationText: { fontSize: Typography.fontSizes.sm, color: Colors.textPrimary, lineHeight: Typography.fontSizes.sm * 1.7, includeFontPadding: false },

  // Grounding
  groundingCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl, gap: Spacing.md },
  groundingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  groundingIcon: { width: 30, height: 30, borderRadius: Radius.md, backgroundColor: Colors.success + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  groundingText: { flex: 1, fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false },

  // Explainer
  explainerCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl, gap: Spacing.md },
  explainerText: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.7, includeFontPadding: false },

  // Disclaimer
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, paddingBottom: Spacing.lg },
  disclaimerText: { flex: 1, fontSize: 10, color: Colors.textMuted, lineHeight: 14, includeFontPadding: false },
});
