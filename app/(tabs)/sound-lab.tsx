/**
 * Sound Lab — MyMoodMapp
 * Two modules: SoundScape (ambient audio) + FrequencyLab (healing Hz)
 * Plus mood check-in after each session for correlation tracking
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
  Dimensions,
  PanResponder,
  AppState,
  // Note: PanResponder kept — used by ZenSandGame, Game2048, DotMandalaGame, PixelArtGame, MoodDeltaSlider
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useTheme } from '@/contexts/ThemeContext';
import { DarkColors, Typography, Spacing, Radius, Shadows, getGlass } from '@/constants/theme';
import {
  SOUNDSCAPES,
  FREQUENCY_PRESETS,
  QUICK_MODES,
  SoundCategory,
  FrequencyPreset,
  SoundTrack,
  INTENTION_LABELS,
} from '@/constants/sounds';
import {
  playAmbientSound,
  stopAmbientSound,
  setAmbientVolume,
  pauseAmbientSound,
  resumeAmbientSound,
  logSoundSession,
  getSoundCorrelations,
  isToneSupported,
  playTone,
  stopTone,
  canGenerateSound,
  playGeneratedSound,
  stopGeneratedSound,
  setGeneratedSoundVolume,
  getNoiseSessionSeconds,
  configureAudioSession,
  isLockscreenAudioSupported,
  SoundCorrelation,
} from '@/services/soundLab';
import {
  playBubblePop,
  playBubbleAllPopped,
  playBreathPhase,
  playSandStroke,
  play2048Slide,
  play2048Merge,
  play2048GameOver,
  play2048Win,
  playMandalaPlace,
  playPixelPaint,
} from '@/services/gameSounds';
import { checkSubscription } from '@/services/subscription';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebMaxWidth } from '@/components/layout/WebLayout';
import MoodBeatGame, { MB_KITS, MB_NUM_STEPS, MB_NUM_TRACKS } from '@/components/feature/MoodBeatGame';
import type { MbPad } from '@/components/feature/MoodBeatGame';
import PixelArtGame from '@/components/feature/PixelArtGame';
import { precacheAllSounds } from '@/services/soundCache';

// react-native-webview is used directly for the meditation video player —
// more reliable than react-native-youtube-iframe which errors on many devices.
let _WebViewComponent: any = null;
if (Platform.OS !== 'web') {
  try { _WebViewComponent = require('react-native-webview').WebView; } catch {}
}

// ─── Types/constants for disabled stub functions only ────────────────────────────
type MbDrumId = 'kick'|'snare'|'hat_c'|'hat_o'|'clap'|'tom_h'|'tom_l'|'s808'|'crash'|'rim'|'shaker'|'cowbell'|'snap'|'perc'|'bass'|'chord';
interface PbnRegion { id: number; color: string; label: string; cells: number[]; }
type GameMode = 'freeform' | 'paint-by-number';
function useMbAudio() { return { triggerSound: (_id: MbDrumId, _vol?: number): void => {} }; }

type Module = 'soundscape' | 'frequency' | 'meditation' | 'games';
type Intention = 'all' | 'sleep' | 'meditate' | 'focus' | 'heal' | 'energize';
type MeditationCategory = 'all' | 'sleep' | 'anxiety' | 'mindfulness' | 'focus' | 'frequencies';

const FREE_LIMIT_SECS = 15 * 60;
const FREE_MEDITATION_LIMIT = 3;
const FREE_MEDITATION_COUNT_KEY = 'free_meditation_count';
const FREE_GAME_IDS = new Set(['breathing-bubble', 'bubble-wrap']);

// ─── Meditation data ──────────────────────────────────────────────────────────
interface MeditationVideo {
  id: string;
  title: string;
  channel: string;
  duration: string;
  youtubeId: string;
  category: MeditationCategory;
  emoji: string;
  description: string;
  tags: string[];
}

const MEDITATION_VIDEOS: MeditationVideo[] = [
  { id: 'mm-sleep-fear', title: 'Release Fear & Worry – Deep Sleep', channel: 'The Mindful Movement', duration: '60 min', youtubeId: '_jc9w7zTbB0', category: 'sleep', emoji: '🌙', description: 'Release all worry and fears with Sara Raymond for a tranquil night sleep.', tags: ['Sleep', 'Deep Rest', 'Fear'] },
  { id: 'med-delta-sleep', title: 'Delta Waves Deep Sleep – Relaxing Music', channel: 'Meditative Mind', duration: '3 hr', youtubeId: 'tybOi4hjZFQ', category: 'sleep', emoji: '🛌', description: 'Deep delta brainwave music designed to guide you into the deepest stages of sleep.', tags: ['Sleep', 'Delta', 'Brainwave'] },
  { id: 'ywa-bedtime', title: 'Yoga For Bedtime – Wind Down', channel: 'Yoga With Adriene', duration: '20 min', youtubeId: 'v7AYKMP6rOE', category: 'sleep', emoji: '🌜', description: 'Gentle yoga sequence to release the body and calm the mind before sleep.', tags: ['Sleep', 'Yoga', 'Relaxation'] },
  { id: 'med-sleep-music', title: 'Sleep Music – Calm Piano & Soft Sounds', channel: 'Meditative Mind', duration: '3 hr', youtubeId: '77ZozI0rw7w', category: 'sleep', emoji: '🎹', description: 'Soothing piano melodies with soft ambient textures to ease you into restful sleep.', tags: ['Sleep', 'Piano', 'Calm'] },
  { id: 'mm-anxiety', title: 'Guided Meditation for Anxiety & Stress Relief', channel: 'The Mindful Movement', duration: '20 min', youtubeId: 'O-6f5wQXSu8', category: 'anxiety', emoji: '🌿', description: 'Gently release tension and return to a calm, grounded state.', tags: ['Anxiety', 'Stress Relief', 'Calm'] },
  { id: 'mm-overthinking', title: 'Calm an Overactive Mind – Reduce Worry', channel: 'The Mindful Movement', duration: '23 min', youtubeId: 'wi2Q_7C1OfM', category: 'anxiety', emoji: '🌊', description: 'Release anxiety and overthinking — quiet the overactive mind and experience peace in the present moment.', tags: ['Anxiety', 'Overthinking', 'Peace'] },
  { id: 'med-528-anxiety', title: '528 Hz + 174 Hz – Full Body Cell Regeneration', channel: 'Meditative Mind', duration: '3.5 hr', youtubeId: '7xJw6eBEJQs', category: 'anxiety', emoji: '💫', description: 'Healing 528 Hz love frequency combined with 174 Hz to calm the nervous system and ease anxiety.', tags: ['Anxiety', '528 Hz', 'Healing'] },
  { id: 'ywa-for-anxiety', title: 'Yoga For Anxiety & Stress', channel: 'Yoga With Adriene', duration: '20 min', youtubeId: 'hJbRpHZr_d0', category: 'anxiety', emoji: '🕊️', description: 'A gentle yoga practice to move stuck energy and find relief from anxiety.', tags: ['Anxiety', 'Yoga', 'Movement'] },
  { id: 'jd-morning', title: '15-Min Morning Meditation for Inner Calm', channel: 'Divine Vision', duration: '18 min', youtubeId: 'hiA1HpG00AM', category: 'mindfulness', emoji: '🌅', description: 'Elevate your mindset, increase focus, and set a positive tone for the day ahead.', tags: ['Morning', 'Mindfulness', 'Gratitude'] },
  { id: 'jd-healing', title: '25-Min Self Healing Meditation', channel: 'Divine Vision', duration: '26 min', youtubeId: 'OLgL0ut88-Q', category: 'mindfulness', emoji: '💛', description: 'Align your vibrations with a future reality and attract new opportunities into your life.', tags: ['Healing', 'Mindfulness', 'Self-Love'] },
  { id: 'ywa-morning-yoga', title: 'Energizing Morning Yoga Sequence', channel: 'Yoga With Adriene', duration: '24 min', youtubeId: 'K-Ina_WW4Yc', category: 'mindfulness', emoji: '🧘', description: 'Wake up the mind and body with this energizing morning yoga practice.', tags: ['Morning', 'Movement', 'Energy'] },
  { id: 'mm-self-love', title: 'Self Love Meditation – Heal & Embrace Your Worth', channel: 'The Mindful Movement', duration: '21 min', youtubeId: 'robRtmRLiRM', category: 'mindfulness', emoji: '💚', description: 'Rediscover self-love and soothe your spirit — a journey of self-acceptance and inner peace.', tags: ['Mindfulness', 'Self-Love', 'Kindness'] },
  { id: 'gm-focus-clarity', title: '10-Min Meditation for Focus & Clarity', channel: 'Goodful', duration: '10 min', youtubeId: 'vzKryaN44ss', category: 'focus', emoji: '🎯', description: 'A calming guided meditation to sharpen mental clarity, reduce mental chatter, and prime your mind for deep focused work.', tags: ['Focus', 'Clarity', 'Mental Sharpness'] },
  { id: 'med-40hz-focus', title: '40 Hz Gamma Binaural Beats – Super Focus', channel: 'SleepTube', duration: '2 hr', youtubeId: 'Z8ANihFXlgU', category: 'focus', emoji: '⚡', description: 'Gamma brainwave entrainment to synchronize your brain at 40Hz — sharpen focus, memory, and cognitive performance.', tags: ['Focus', 'Gamma', 'Brainwave'] },
  { id: 'ywk-morning-power', title: '15-Min Morning Power Yoga – Wake Up & Energize', channel: 'Yoga with Kassandra', duration: '15 min', youtubeId: 'MHLFy4JsIiM', category: 'focus', emoji: '🌄', description: 'A short power yoga flow to build internal heat, boost energy, and set a strong tone for the day — no props required.', tags: ['Energy', 'Movement', 'Morning'] },
  { id: 'med-963hz', title: '963 Hz – You Are the Universe (Manifest & Awaken)', channel: 'Meditative Mind', duration: '6 hr', youtubeId: 'WI3F9RKSAQY', category: 'frequencies', emoji: '👁️', description: 'The highest solfeggio frequency — 963 Hz activates the pineal gland, elevates consciousness, and reconnects you to pure awareness and manifestation.', tags: ['963 Hz', 'Pineal Gland', 'Solfeggio'] },
  { id: 'med-432hz', title: '432 Hz – Deep Relaxation Healing Music', channel: 'Meditative Mind', duration: '3 hr', youtubeId: 'dJD8FwBrZ3w', category: 'frequencies', emoji: '🎵', description: 'Tuned to the natural frequency of the universe — deeply calming and harmonizing.', tags: ['432 Hz', 'Healing', 'Calm'] },
  { id: 'med-396hz', title: '396 Hz – Let Go of Fear & Guilt', channel: 'Meditative Mind', duration: '9 hr', youtubeId: 'LU_lEl-n5Ec', category: 'frequencies', emoji: '🌀', description: 'Solfeggio frequency 396 Hz to liberate you from fear, guilt, and subconscious negative blocks.', tags: ['396 Hz', 'Solfeggio', 'Release'] },
  { id: 'med-solfeggio-all', title: 'All 9 Solfeggio Frequencies', channel: 'Meditative Mind', duration: '60 min', youtubeId: 'Nn1FwzqrmSo', category: 'frequencies', emoji: '🌑', description: 'All nine solfeggio frequencies (174–963 Hz) for complete energetic healing and alignment.', tags: ['Solfeggio', 'All Frequencies', 'Chakra'] },
];

const MEDITATION_CATEGORIES: { key: MeditationCategory; label: string; emoji: string }[] = [
  { key: 'all', label: 'All', emoji: '✨' },
  { key: 'sleep', label: 'Sleep', emoji: '😴' },
  { key: 'anxiety', label: 'Anxiety', emoji: '🌿' },
  { key: 'mindfulness', label: 'Mindfulness', emoji: '🧘' },
  { key: 'focus', label: 'Focus', emoji: '🎯' },
  { key: 'frequencies', label: 'Frequencies', emoji: '🎵' },
];

const SOUND_CATEGORIES: { key: SoundCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'noise', label: 'Noise' },
  { key: 'rain', label: 'Rain & Water' },
  { key: 'nature', label: 'Nature' },
  { key: 'fire', label: 'Fire' },
  { key: 'urban', label: 'Urban' },
  { key: 'space', label: '🚀 Space' },
];

const FREQ_CATEGORIES = [
  { key: 'all' as const, label: 'All' },
  { key: 'solfeggio' as const, label: 'Solfeggio' },
  { key: 'brainwave' as const, label: 'Brainwave' },
  { key: 'binaural' as const, label: 'Binaural' },
  { key: 'tone' as const, label: 'Tones' },
];

const INTENTIONS: { key: Intention; label: string; emoji: string }[] = [
  { key: 'all', label: 'All', emoji: '✨' },
  { key: 'sleep', label: 'Sleep', emoji: '😴' },
  { key: 'meditate', label: 'Meditate', emoji: '🧘' },
  { key: 'focus', label: 'Focus', emoji: '🎯' },
  { key: 'heal', label: 'Heal', emoji: '💚' },
  { key: 'energize', label: 'Energize', emoji: '⚡' },
];

const TIMER_OPTIONS = [0, 15, 30, 45, 60, 90];
// 0 = "No limit" is FREE — never lock it behind Pro
const PRO_TIMER_OPTIONS = new Set([30, 45, 60, 90]);

function makeStyles(C: typeof DarkColors, isDark = true) {
  const G = getGlass(isDark);
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    scroll: { padding: Spacing.lg, paddingBottom: 120 },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.border,
    },
    headerTitle: { fontSize: Typography.fontSizes['2xl'], fontWeight: '800', color: C.textPrimary, includeFontPadding: false },
    headerSub: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    moduleTabs: {
      flexDirection: 'row', marginHorizontal: Spacing.lg,
      marginTop: Spacing.lg, marginBottom: Spacing.md,
      backgroundColor: G.cardBgLight, borderRadius: Radius.xl,
      padding: 4, borderWidth: 1, borderColor: G.cardBorderLight,
    },
    moduleTab: {
      flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 3, paddingVertical: 9, paddingHorizontal: 4, borderRadius: Radius.lg,
      minWidth: 0,
    },
    moduleTabActive: { backgroundColor: C.primary },
    moduleTabText: { fontSize: 11, fontWeight: '700', color: C.textMuted, includeFontPadding: false, textAlign: 'center' },
    moduleTabTextActive: { color: '#08091A' },
    chipBar: { marginBottom: Spacing.lg },
    chipContent: { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
    chip: {
      paddingHorizontal: Spacing.md, paddingVertical: 8,
      borderRadius: Radius.full, borderWidth: 1,
      borderColor: C.border, backgroundColor: C.surfaceElevated,
    },
    chipActive: { backgroundColor: C.primary, borderColor: C.primary },
    chipText: { fontSize: Typography.fontSizes.xs, fontWeight: '600', color: C.textMuted, includeFontPadding: false },
    chipTextActive: { color: '#08091A' },
    nowPlayingBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      paddingBottom: 24, borderTopWidth: 1, borderColor: G.navBorder,
      ...Shadows.md,
    },
    nowPlayingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    nowPlayingInfo: { flex: 1, gap: 2 },
    nowPlayingName: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    nowPlayingMeta: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    stopBtn: {
      width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.error + '20', borderWidth: 1, borderColor: C.error + '40',
    },
    volRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
    volTrack: { flex: 1, height: 4, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' },
    volFill: { height: '100%', borderRadius: Radius.full },
    volBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
    soundGrid: { gap: Spacing.md },
    soundCard: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: G.cardBg, borderRadius: Radius.xl,
      padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder,
    },
    soundCardActive: { borderWidth: 2 },
    soundEmoji: { fontSize: 28, width: 40, textAlign: 'center' },
    soundInfo: { flex: 1, gap: 3 },
    soundName: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    soundDesc: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
    soundBestFor: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 3 },
    soundTag: { backgroundColor: C.primarySoft, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
    soundTagText: { fontSize: 10, color: C.primary, fontWeight: '600', includeFontPadding: false },
    soundSource: { fontSize: 9, color: C.textMuted, marginTop: 2, includeFontPadding: false },
    playBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    freqCard: {
      borderRadius: Radius.xl, padding: Spacing.lg,
      borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.sm,
      backgroundColor: G.cardBg,
    },
    freqCardActive: { borderWidth: 2 },
    freqHero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    freqEmoji: { fontSize: 32 },
    freqHzBig: { fontSize: Typography.fontSizes['3xl'], fontWeight: '900', includeFontPadding: false },
    freqHzUnit: { fontSize: Typography.fontSizes.sm, fontWeight: '500', color: C.textMuted, includeFontPadding: false },
    freqName: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    freqDesc: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
    freqBottom: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    freqBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    freqBadgeText: { fontSize: 10, fontWeight: '700', includeFontPadding: false },
    freqPlayBtn: {
      marginLeft: 'auto' as any, width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
    },
    binauralBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.secondary + '20', borderRadius: Radius.lg,
      padding: Spacing.sm, borderWidth: 1, borderColor: C.secondary + '40',
    },
    binauralText: { fontSize: Typography.fontSizes.xs, color: C.secondary, flex: 1, includeFontPadding: false },
    timerRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
      backgroundColor: G.cardBgLight, borderRadius: Radius.xl,
      padding: Spacing.md, marginBottom: Spacing.lg,
      borderWidth: 1, borderColor: G.cardBorderLight,
    },
    timerChip: { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1, borderColor: C.border },
    timerChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    timerChipText: { fontSize: Typography.fontSizes.xs, fontWeight: '600', color: C.textMuted, includeFontPadding: false },
    timerChipTextActive: { color: '#08091A' },
    timerLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, includeFontPadding: false },
    moodModal: {
      backgroundColor: G.cardBg, borderRadius: Radius.xl,
      padding: Spacing.xl, borderWidth: 1.5, borderColor: C.primary + '50',
      gap: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.md,
    },
    moodModalTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '800', color: C.textPrimary, includeFontPadding: false },
    moodModalSub: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, includeFontPadding: false },
    moodBtns: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'center' },
    moodBtn: {
      flex: 1, alignItems: 'center', gap: Spacing.sm,
      backgroundColor: C.surface, borderRadius: Radius.xl,
      padding: Spacing.lg, borderWidth: 1.5, borderColor: C.border,
    },
    moodBtnEmoji: { fontSize: 28 },
    moodBtnLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, includeFontPadding: false },
    sliderTrack: { height: 8, borderRadius: Radius.full, backgroundColor: C.border, overflow: 'hidden' },
    sliderFill: { height: '100%', borderRadius: Radius.full },
    sliderThumb: {
      position: 'absolute', top: -14, width: 36, height: 36,
      borderRadius: 18, borderWidth: 3, alignItems: 'center', justifyContent: 'center',
      ...Shadows.md,
    },
    sliderLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, includeFontPadding: false },
    confirmBtn: { borderRadius: Radius.xl, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
    confirmBtnText: { fontSize: Typography.fontSizes.md, fontWeight: '800', color: '#08091A', includeFontPadding: false },
    corrCard: {
      backgroundColor: G.cardBg, borderRadius: Radius.xl,
      padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md,
    },
    corrRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    corrName: { flex: 1, fontSize: Typography.fontSizes.sm, fontWeight: '600', color: C.textPrimary, includeFontPadding: false },
    corrRate: { fontSize: Typography.fontSizes.sm, fontWeight: '800', includeFontPadding: false },
    corrSessions: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    sectionLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md, includeFontPadding: false },
    nativeFreqNote: {
      flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
      backgroundColor: C.secondary + '15', borderRadius: Radius.lg,
      padding: Spacing.md, borderWidth: 1, borderColor: C.secondary + '40',
      marginBottom: Spacing.lg,
    },
    nativeFreqText: { flex: 1, fontSize: Typography.fontSizes.xs, color: C.secondary, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
    platformNote: {
      flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
      borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1,
      marginBottom: Spacing.md,
    },
    platformNoteText: { flex: 1, fontSize: Typography.fontSizes.xs, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mood Slider Checkin component
// ─────────────────────────────────────────────────────────────────────────────

function moodLabel(v: number): string {
  if (v >= 4) return 'Much Better';
  if (v >= 2) return 'Better';
  if (v >= 1) return 'Slightly Better';
  if (v === 0) return 'Same';
  if (v >= -1) return 'Slightly Worse';
  if (v >= -3) return 'Worse';
  return 'Much Worse';
}

function moodEmoji(v: number): string {
  if (v >= 4) return '😄';
  if (v >= 2) return '😊';
  if (v >= 1) return '🙂';
  if (v === 0) return '😐';
  if (v >= -1) return '😕';
  if (v >= -3) return '😔';
  return '😞';
}

function sliderColor(v: number, C: typeof DarkColors): string {
  if (v > 0) return C.success;
  if (v < 0) return C.error;
  return C.textMuted;
}

function MoodDeltaSlider({ C, value, onChange }: { C: typeof DarkColors; value: number; onChange: (v: number) => void }) {
  const { isDark } = useTheme();
  const G = getGlass(isDark);
  const THUMB = 44;
  const STEPS = 5;
  const trackRef = useRef<View>(null);
  const trackLayout = useRef({ x: 0, width: 300 });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const thumbScale = useRef(new Animated.Value(1)).current;

  const clampToTrack = (pageX: number): number => {
    const { x, width } = trackLayout.current;
    const RANGE = width - THUMB;
    const local = pageX - x - THUMB / 2;
    const fraction = Math.max(0, Math.min(RANGE, local)) / Math.max(1, RANGE);
    return Math.round(fraction * 2 * STEPS - STEPS);
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (e) => {
      onChangeRef.current(clampToTrack(e.nativeEvent.pageX));
      Animated.spring(thumbScale, { toValue: 1.25, useNativeDriver: true, friction: 6, tension: 200 }).start();
    },
    onPanResponderMove: (e) => { onChangeRef.current(clampToTrack(e.nativeEvent.pageX)); },
    onPanResponderRelease: () => { Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 200 }).start(); },
    onPanResponderTerminate: () => { Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 200 }).start(); },
  })).current;

  const color = sliderColor(value, C);
  const normalized = (value + STEPS) / (STEPS * 2);
  const pct = Math.round(normalized * 100);
  const fillLeft = value >= 0 ? 50 : pct;
  const fillWidth = value >= 0 ? pct - 50 : 50 - pct;

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2, alignItems: 'flex-start', flex: 1 }}>
          <Text style={{ fontSize: 22 }}>😞</Text>
          <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>Worse</Text>
        </View>
        <View style={{ paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1.5, borderColor: color + '60', backgroundColor: color + '20', alignItems: 'center', minWidth: 108 }}>
          <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color, includeFontPadding: false } as any}>{moodLabel(value)}</Text>
        </View>
        <View style={{ gap: 2, alignItems: 'flex-end', flex: 1 }}>
          <Text style={{ fontSize: 22 }}>😄</Text>
          <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>Better</Text>
        </View>
      </View>
      <View ref={trackRef} style={{ width: '100%', paddingVertical: 18 }}
        onLayout={(e) => { trackRef.current?.measure((_x, _y, _w, _h, pageX) => { trackLayout.current = { x: pageX, width: e.nativeEvent.layout.width }; }); }}
        {...pan.panHandlers}
      >
        <View style={{ width: '100%', height: 10, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'visible', position: 'relative' }}>
          <View style={{ position: 'absolute', top: 0, height: '100%', left: `${fillLeft}%` as any, width: `${fillWidth}%` as any, backgroundColor: color, borderRadius: Radius.full }} />
          <View style={{ position: 'absolute', left: '50%', marginLeft: -1, top: -4, width: 2, height: 18, backgroundColor: C.textMuted + '50', borderRadius: 1 }} />
          <Animated.View style={[{
            position: 'absolute', left: `${pct}%` as any, marginLeft: -(THUMB / 2), top: -(THUMB / 2 - 5),
            width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3, borderColor: color,
            backgroundColor: G.navBg, alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 8,
          }, { transform: [{ scale: thumbScale }] }]}>
            <Text style={{ fontSize: 20 }}>{moodEmoji(value)}</Text>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

interface MoodSliderCheckinProps {
  C: typeof DarkColors;
  styles: ReturnType<typeof makeStyles>;
  moodSliderValue: number;
  setMoodSliderValue: (v: number) => void;
  onConfirm: () => void;
  onSkip: () => void;
}

function MoodSliderCheckin({ C, styles, moodSliderValue, setMoodSliderValue, onConfirm, onSkip }: MoodSliderCheckinProps) {
  const color = sliderColor(moodSliderValue, C);
  return (
    <View style={[styles.moodModal, { borderColor: color + '60' }]}>
      <View style={{ alignItems: 'center', gap: Spacing.sm }}>
        <Text style={{ fontSize: 40 }}>{moodEmoji(moodSliderValue)}</Text>
        <Text style={[styles.moodModalTitle, { textAlign: 'center' }]}>How do you feel now?</Text>
        <Text style={[styles.moodModalSub, { textAlign: 'center' }]}>Compared to before your session</Text>
      </View>
      <MoodDeltaSlider C={C} value={moodSliderValue} onChange={setMoodSliderValue} />
      <Pressable onPress={onConfirm} style={({ pressed }) => [styles.confirmBtn, { backgroundColor: color, opacity: pressed ? 0.85 : 1 }]}>
        <Text style={styles.confirmBtnText}>Save — {moodLabel(moodSliderValue)}</Text>
      </Pressable>
      <Pressable onPress={onSkip} style={{ alignSelf: 'center' }}>
        <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>Skip</Text>
      </Pressable>
    </View>
  );
}

export default function SoundLabScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { colors: C } = useTheme();
  const { isDark } = useTheme();
  const G = getGlass(isDark);
  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  const [module, setModule] = useState<Module>('soundscape');
  const [soundCategory, setSoundCategory] = useState<SoundCategory | 'all'>('all');
  const [freqCategory, setFreqCategory] = useState<string>('all');
  const [intentionFilter, setIntentionFilter] = useState<Intention>('all');
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [toneVolume, setToneVolume] = useState(0.3);

  const [playingSound, setPlayingSound] = useState<SoundTrack | null>(null);
  const [playingFreq, setPlayingFreq] = useState<FrequencyPreset | null>(null);
  const [soundLoading, setSoundLoading] = useState(false);
  const [soundError, setSoundError] = useState<string | null>(null);

  const [sessionActive, setSessionActive] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const sessionStartRef = useRef<number>(0);
  const sessionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isPro, setIsPro] = useState(false);
  const [proLoading, setProLoading] = useState(true);
  const [showProModal, setShowProModal] = useState(false);
  const [showMoodCheckin, setShowMoodCheckin] = useState(false);
  const [lastSession, setLastSession] = useState<{ id: string; name: string; category: string } | null>(null);

  const [meditationCategory, setMeditationCategory] = useState<MeditationCategory>('all');
  const [selectedVideo, setSelectedVideo] = useState<MeditationVideo | null>(null);
  const [meditationMoodCheckin, setMeditationMoodCheckin] = useState<MeditationVideo | null>(null);
  const [freeMeditationCount, setFreeMeditationCount] = useState(0);

  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [gamesMoodCheckin, setGamesMoodCheckin] = useState<string | null>(null);
  const gamesStartRef = useRef<number>(0);
  const meditationStartRef = useRef<number>(0);
  const [correlations, setCorrelations] = useState<SoundCorrelation[]>([]);
  const [moodSliderValue, setMoodSliderValue] = useState(0);

  const router = useRouter();
  const { module: initialModule } = useLocalSearchParams<{ module?: string }>();

  useEffect(() => {
    AsyncStorage.getItem(FREE_MEDITATION_COUNT_KEY)
      .then(v => { if (v) setFreeMeditationCount(parseInt(v) || 0); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialModule && ['soundscape', 'frequency', 'meditation', 'games'].includes(initialModule)) {
      setModule(initialModule as Module);
    }
  }, [initialModule]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const run = async () => {
      try { await precacheAllSounds(); } catch {}
    };
    const t = setTimeout(run, 10000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      configureAudioSession(false).catch(() => {});
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    checkSubscription().then(s => {
      if (mounted) {
        const pro = s.subscribed || s.tier !== 'free';
        setIsPro(pro);
        setProLoading(false);
        if (Platform.OS !== 'web') configureAudioSession(pro).catch(() => {});
      }
    }).catch(() => { if (mounted) setProLoading(false); });
    return () => { mounted = false; };
  }, [user?.id]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        configureAudioSession(isPro).catch(() => {});
      } else if (nextState === 'background' || nextState === 'inactive') {
        try {
          const ea = require('expo-audio');
          if (ea?.AudioSession?.setActive) {
            ea.AudioSession.setActive(true).catch(() => {});
          }
        } catch {}
      }
    });
    return () => sub.remove();
  }, [isPro]);

  useEffect(() => {
    if (isPro || !sessionActive) return;
    if (sessionSeconds >= FREE_LIMIT_SECS) {
      handleStop(false).then(() => setShowProModal(true));
    }
  }, [sessionSeconds, isPro, sessionActive]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (sessionActive) {
      pulseLoopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]));
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => { pulseLoopRef.current?.stop(); };
  }, [sessionActive]);

  useEffect(() => {
    if (user?.id) getSoundCorrelations(user.id).then(setCorrelations).catch(() => {});
  }, [user?.id, showMoodCheckin]);

  useEffect(() => {
    if (!sessionActive || timerMinutes === 0) { setTimerRemaining(0); return; }
    setTimerRemaining(timerMinutes * 60);
    const interval = setInterval(() => {
      setTimerRemaining(prev => {
        if (prev <= 1) { clearInterval(interval); handleStop(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionActive, timerMinutes]);

  useEffect(() => {
    if (sessionActive) {
      sessionStartRef.current = Date.now();
      sessionIntervalRef.current = setInterval(() => {
        setSessionSeconds(Math.floor((Date.now() - sessionStartRef.current) / 1000));
      }, 1000);
    } else {
      if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current);
      setSessionSeconds(0);
    }
    return () => { if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current); };
  }, [sessionActive]);

  const handlePlaySound = async (sound: SoundTrack) => {
    if (playingSound?.id === sound.id) { await handleStop(false); return; }
    setSoundLoading(true);
    setSoundError(null);
    setSessionPaused(false);
    try {
      if (Platform.OS === 'web' && canGenerateSound(sound.id)) {
        const started = playGeneratedSound(sound.id, volume);
        if (!started) throw new Error('Web Audio API not available. Try Chrome or Safari.');
      } else {
        await playAmbientSound(sound.id, volume, isPro, { name: sound.name, category: sound.category, emoji: sound.emoji });
      }
      setPlayingSound(sound);
      setSessionActive(true);
      setLastSession({ id: sound.id, name: sound.name, category: sound.category });
    } catch (e: any) {
      setSoundError(e.message ?? 'Could not generate this sound.');
    } finally {
      setSoundLoading(false);
    }
  };

  const handlePauseResume = async () => {
    if (sessionPaused) { await resumeAmbientSound(); setSessionPaused(false); }
    else { await pauseAmbientSound(); setSessionPaused(true); }
  };

  const handlePlayFreq = async (freq: FrequencyPreset) => {
    if (playingFreq?.id === freq.id) { stopTone(); setPlayingFreq(null); return; }
    await playTone(freq, toneVolume);
    setPlayingFreq(freq);
    setLastSession({ id: freq.id, name: freq.name, category: freq.category });
  };

  const handleStop = async (fromTimer = false) => {
    const nativeElapsed = await stopAmbientSound();
    const webElapsed = stopGeneratedSound();
    stopTone();
    setPlayingSound(null);
    setPlayingFreq(null);
    setSessionActive(false);
    setSessionPaused(false);
    setTimerRemaining(0);
    const duration = nativeElapsed || webElapsed || sessionSeconds;
    if (duration >= 10 && lastSession) setShowMoodCheckin(true);
    else setLastSession(null);
  };

  const handleMoodAfter = async () => {
    const delta = moodSliderValue;
    if (user?.id && lastSession && sessionSeconds >= 10) {
      await logSoundSession(user.id, lastSession.id, lastSession.name, lastSession.category, sessionSeconds, { moodBefore: 5, moodAfter: 5 + delta });
      getSoundCorrelations(user.id).then(setCorrelations).catch(() => {});
    }
    setShowMoodCheckin(false);
    setLastSession(null);
    setMoodSliderValue(0);
  };

  const handleVolumeChange = async (direction: 'up' | 'down') => {
    const next = Math.max(0, Math.min(1, volume + (direction === 'up' ? 0.1 : -0.1)));
    setVolume(next);
    if (Platform.OS === 'web' && playingSound && canGenerateSound(playingSound.id)) {
      setGeneratedSoundVolume(next);
    } else {
      await setAmbientVolume(next);
    }
  };

  const filteredSounds = useMemo(() => SOUNDSCAPES.filter(s => soundCategory === 'all' || s.category === soundCategory), [soundCategory]);
  const filteredFreqs = useMemo(() => FREQUENCY_PRESETS.filter(f => {
    const catMatch = freqCategory === 'all' || f.category === freqCategory;
    const intMatch = intentionFilter === 'all' || f.intention === intentionFilter;
    return catMatch && intMatch;
  }), [freqCategory, intentionFilter]);

  const handleTimerSelect = (t: number) => {
    if (!isPro && PRO_TIMER_OPTIONS.has(t)) { setShowProModal(true); return; }
    setTimerMinutes(t);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const activeColor = playingFreq ? (playingFreq.color ?? C.secondary) : C.primary;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mood Lab</Text>
          <Text style={styles.headerSub}>Ambient soundscapes & healing frequencies</Text>
        </View>
        {sessionActive ? (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: activeColor }} />
          </Animated.View>
        ) : null}
      </View>

      {/* Module tabs */}
      <View style={styles.moduleTabs}>
        <Pressable onPress={() => setModule('soundscape')} style={[styles.moduleTab, module === 'soundscape' && styles.moduleTabActive]}>
          <MaterialIcons name="music-note" size={18} color={module === 'soundscape' ? '#08091A' : C.textMuted} />
          <Text style={[styles.moduleTabText, module === 'soundscape' && styles.moduleTabTextActive]} numberOfLines={1}>Sounds</Text>
        </Pressable>
        <Pressable onPress={() => setModule('frequency')} style={[styles.moduleTab, module === 'frequency' && styles.moduleTabActive]}>
          <MaterialIcons name="waves" size={18} color={module === 'frequency' ? '#08091A' : C.textMuted} />
          <Text style={[styles.moduleTabText, module === 'frequency' && styles.moduleTabTextActive]} numberOfLines={1}>Frequency</Text>
        </Pressable>
        <Pressable onPress={() => setModule('meditation')} style={[styles.moduleTab, module === 'meditation' && styles.moduleTabActive]}>
          <View style={{ position: 'relative', alignItems: 'center' }}>
            <MaterialIcons name="self-improvement" size={18} color={module === 'meditation' ? '#08091A' : C.textMuted} />
            {!isPro && freeMeditationCount > 0 ? (
              <View style={{
                position: 'absolute', top: -5, right: -10,
                backgroundColor: freeMeditationCount >= FREE_MEDITATION_LIMIT ? C.error : '#F5A623',
                borderRadius: 7, paddingHorizontal: 4, paddingVertical: 1, minWidth: 18, alignItems: 'center',
              }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: '#fff', includeFontPadding: false } as any}>
                  {freeMeditationCount}/{FREE_MEDITATION_LIMIT}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.moduleTabText, module === 'meditation' && styles.moduleTabTextActive]} numberOfLines={1}>Meditate</Text>
        </Pressable>
        <Pressable onPress={() => setModule('games')} style={[styles.moduleTab, module === 'games' && styles.moduleTabActive]}>
          <MaterialIcons name="games" size={18} color={module === 'games' ? '#08091A' : C.textMuted} />
          <Text style={[styles.moduleTabText, module === 'games' && styles.moduleTabTextActive]} numberOfLines={1}>Games</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { alignItems: 'stretch' }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <WebMaxWidth>
        {showMoodCheckin ? (
          <MoodSliderCheckin C={C} styles={styles} moodSliderValue={moodSliderValue} setMoodSliderValue={setMoodSliderValue}
            onConfirm={() => handleMoodAfter()}
            onSkip={() => { setShowMoodCheckin(false); setLastSession(null); setMoodSliderValue(0); }}
          />
        ) : null}

        {module === 'soundscape' ? (
          <>
            <View style={{ backgroundColor: C.primary + '12', borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: C.primary + '30', flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary + '25', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="music-note" size={24} color={C.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>Ambient Soundscapes</Text>
                <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: 16, includeFontPadding: false } as any}>
                  {SOUNDSCAPES.length} real recorded soundscapes — rain, forest, ocean, fire and more. Downloaded once, stored on device, plays offline. Loops gaplessly. Mood tracked after every session.
                </Text>
              </View>
            </View>

            <Text style={styles.timerLabel}>Sleep / Focus Timer</Text>
            <View style={styles.timerRow}>
              {TIMER_OPTIONS.map(t => {
                const locked = !isPro && PRO_TIMER_OPTIONS.has(t);
                const isActive = timerMinutes === t;
                return (
                  <Pressable key={t} onPress={() => handleTimerSelect(t)} style={[styles.timerChip, isActive && styles.timerChipActive, locked && { opacity: 0.6 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {locked ? <MaterialIcons name="lock" size={10} color={C.textMuted} /> : null}
                      <Text style={[styles.timerChipText, isActive && styles.timerChipTextActive]}>{t === 0 ? 'No limit' : `${t}m`}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {!isPro ? (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>
                  Free: 15 min max per session · <Text style={{ color: C.primary }} onPress={() => setShowProModal(true)}>Upgrade to Pro</Text> for unlimited
                </Text>
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chipContent}>
              {SOUND_CATEGORIES.map(cat => (
                <Pressable key={cat.key} onPress={() => setSoundCategory(cat.key as SoundCategory | 'all')} style={[styles.chip, soundCategory === cat.key && styles.chipActive]}>
                  <Text style={[styles.chipText, soundCategory === cat.key && styles.chipTextActive]}>{cat.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={[styles.platformNote, { backgroundColor: C.success + '12', borderColor: C.success + '40' }]}>
              <MaterialIcons name="check-circle" size={14} color={C.success} />
              <Text style={[styles.platformNoteText, { color: C.success }]}>
                {Platform.OS === 'web'
                  ? 'Sounds generated on-device via Web Audio API — no network required.'
                  : 'Real audio samples downloaded once and stored on device — plays offline with gapless looping. Noise colors generated on-device.'}
                {Platform.OS !== 'web' && isPro ? ' Background + lockscreen controls active.' : ''}
              </Text>
            </View>
            {isLockscreenAudioSupported() ? (
              <View style={[styles.platformNote, { backgroundColor: C.primary + '12', borderColor: C.primary + '40', marginBottom: Spacing.md }]}>
                <MaterialIcons name="lock-open" size={14} color={C.primary} />
                <Text style={[styles.platformNoteText, { color: C.primary }]}>Plays on locked screen — audio continues when screen locks</Text>
              </View>
            ) : (
              <View style={[styles.platformNote, { backgroundColor: C.warning + '12', borderColor: C.warning + '40', marginBottom: Spacing.md }]}>
                <MaterialIcons name="info-outline" size={14} color={C.warning} />
                <Text style={[styles.platformNoteText, { color: C.warning }]}>Lockscreen audio requires the installed app (APK/IPA). Download the APK from the top-right toolbar to test.</Text>
              </View>
            )}

            {soundError ? (
              <View style={{ backgroundColor: C.errorSoft, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: C.error + '40' }}>
                <Text style={{ color: C.error, fontSize: Typography.fontSizes.xs, includeFontPadding: false } as any}>{soundError}</Text>
              </View>
            ) : null}

            <View style={styles.soundGrid}>
              {filteredSounds.map(sound => {
                const isActive = playingSound?.id === sound.id;
                return (
                  <Pressable key={sound.id} onPress={() => handlePlaySound(sound)}
                    style={({ pressed }) => [styles.soundCard, isActive && [styles.soundCardActive, { borderColor: C.primary }], pressed && { opacity: 0.85 }]}>
                    <Animated.Text style={[styles.soundEmoji, isActive && { transform: [{ scale: pulseAnim }] }]}>{sound.emoji}</Animated.Text>
                    <View style={styles.soundInfo}>
                      <Text style={[styles.soundName, isActive && { color: C.primary }]}>{sound.name}</Text>
                      <Text style={styles.soundDesc} numberOfLines={2}>{sound.description}</Text>
                      <View style={styles.soundBestFor}>
                        {sound.bestFor.slice(0, 2).map((tag: string) => (
                          <View key={tag} style={styles.soundTag}><Text style={styles.soundTagText}>{tag}</Text></View>
                        ))}
                      </View>
                      {sound.source ? <Text style={styles.soundSource}>{sound.source}</Text> : null}
                    </View>
                    <View style={[styles.playBtn, { backgroundColor: isActive ? C.primary + '20' : C.surfaceElevated, borderRadius: 22, borderWidth: 1, borderColor: isActive ? C.primary : C.border }]}>
                      {soundLoading && isActive ? <ActivityIndicator size="small" color={C.primary} /> : <MaterialIcons name={isActive ? 'pause' : 'play-arrow'} size={22} color={isActive ? C.primary : C.textMuted} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {module === 'frequency' ? (
          <>
            <View style={{ backgroundColor: C.success + '12', borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: C.success + '30', flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.success + '25', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="waves" size={24} color={C.success} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>Healing Frequencies</Text>
                <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: 16, includeFontPadding: false } as any}>
                  {FREQUENCY_PRESETS.length} solfeggio tones, binaural beats and brainwave frequencies — generated locally, no internet needed.
                </Text>
              </View>
            </View>

            <View style={[styles.nativeFreqNote, { backgroundColor: C.success + '12', borderColor: C.success + '40' }]}>
              <MaterialIcons name="check-circle" size={16} color={C.success} />
              <Text style={[styles.nativeFreqText, { color: C.success }]}>All {FREQUENCY_PRESETS.length} frequencies available on this device — generated locally, no internet needed. Pure sine waves and binaural beats.</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chipContent}>
              {INTENTIONS.map(intent => (
                <Pressable key={intent.key} onPress={() => setIntentionFilter(intent.key)} style={[styles.chip, intentionFilter === intent.key && styles.chipActive]}>
                  <Text style={[styles.chipText, intentionFilter === intent.key && styles.chipTextActive]}>{intent.emoji} {intent.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg }} contentContainerStyle={styles.chipContent}>
              {FREQ_CATEGORIES.map(cat => (
                <Pressable key={cat.key} onPress={() => setFreqCategory(cat.key)} style={[styles.chip, freqCategory === cat.key && styles.chipActive]}>
                  <Text style={[styles.chipText, freqCategory === cat.key && styles.chipTextActive]}>{cat.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {Platform.OS === 'web' ? (
              <View style={{ marginBottom: Spacing.lg }}>
                <Text style={styles.timerLabel}>Tone Volume</Text>
                <View style={styles.volRow}>
                  <Pressable onPress={() => { const n = Math.max(0, toneVolume - 0.1); setToneVolume(n); }} style={styles.volBtn}><MaterialIcons name="volume-down" size={18} color={C.textMuted} /></Pressable>
                  <View style={styles.volTrack}><View style={[styles.volFill, { width: `${Math.round(toneVolume * 100)}%`, backgroundColor: C.secondary }]} /></View>
                  <Pressable onPress={() => { const n = Math.min(1, toneVolume + 0.1); setToneVolume(n); }} style={styles.volBtn}><MaterialIcons name="volume-up" size={18} color={C.textMuted} /></Pressable>
                  <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, width: 36, textAlign: 'right', includeFontPadding: false } as any}>{Math.round(toneVolume * 100)}%</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.platformNote, { backgroundColor: C.primarySoft, borderColor: C.primary + '40', marginBottom: Spacing.lg }]}>
                <MaterialIcons name="volume-up" size={14} color={C.primary} />
                <Text style={[styles.platformNoteText, { color: C.primary }]}>Use your device volume buttons to adjust tone volume.</Text>
              </View>
            )}

            <View style={styles.soundGrid}>
              {filteredFreqs.map(freq => {
                const isActive = playingFreq?.id === freq.id;
                const color = freq.color ?? C.secondary;
                return (
                  <Pressable key={freq.id} onPress={() => handlePlayFreq(freq)}
                    style={({ pressed }) => [styles.freqCard, isActive && [styles.freqCardActive, { borderColor: color }], { backgroundColor: isActive ? color + '10' : C.surfaceElevated }, pressed && { opacity: 0.85 }]}>
                    {freq.category === 'binaural' ? (
                      <View style={styles.binauralBadge}>
                        <MaterialIcons name="headphones" size={13} color={C.secondary} />
                        <Text style={styles.binauralText}>Requires headphones — different tones in each ear</Text>
                      </View>
                    ) : null}
                    <View style={styles.freqHero}>
                      <Animated.Text style={[styles.freqEmoji, isActive && { transform: [{ scale: pulseAnim }] }]}>{freq.emoji}</Animated.Text>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                          <Text style={[styles.freqHzBig, { color }]}>{freq.hz}</Text>
                          <Text style={styles.freqHzUnit}>Hz</Text>
                        </View>
                        <Text style={[styles.freqName, isActive && { color }]}>{freq.name}</Text>
                      </View>
                      <Pressable onPress={() => handlePlayFreq(freq)} style={[styles.freqPlayBtn, { backgroundColor: isActive ? color + '20' : C.surface, borderWidth: 1, borderColor: isActive ? color : C.border }]}>
                        <MaterialIcons name={isActive ? 'pause' : 'play-arrow'} size={22} color={isActive ? color : C.textMuted} />
                      </Pressable>
                    </View>
                    <Text style={styles.freqDesc}>{freq.description}</Text>
                    {freq.category === 'binaural' && freq.leftHz && freq.rightHz ? (
                      <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>L: {freq.leftHz} Hz · R: {freq.rightHz} Hz → Beat: {freq.beatHz} Hz</Text>
                    ) : null}
                    <View style={styles.freqBottom}>
                      <View style={[styles.freqBadge, { backgroundColor: color + '20' }]}><Text style={[styles.freqBadgeText, { color }]}>{freq.category}</Text></View>
                      <View style={[styles.freqBadge, { backgroundColor: C.primarySoft }]}><Text style={[styles.freqBadgeText, { color: C.primary }]}>{INTENTION_LABELS[freq.intention]}</Text></View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {module === 'games' ? (
          <GamesModule
            C={C}
            isPro={isPro}
            onSelectGame={(id) => { setSelectedGame(id); gamesStartRef.current = Date.now(); }}
            onShowProModal={() => setShowProModal(true)}
          />
        ) : null}

        {gamesMoodCheckin ? (
          <MoodSliderCheckin C={C} styles={styles} moodSliderValue={moodSliderValue} setMoodSliderValue={setMoodSliderValue}
            onConfirm={async () => {
              if (user?.id && gamesMoodCheckin) {
                const elapsed = Math.floor((Date.now() - gamesStartRef.current) / 1000);
                await logSoundSession(user.id, 'game-' + gamesMoodCheckin, gamesMoodCheckin, 'game', elapsed, { moodBefore: 5, moodAfter: 5 + moodSliderValue });
                getSoundCorrelations(user.id).then(setCorrelations).catch(() => {});
              }
              setGamesMoodCheckin(null); setMoodSliderValue(0);
            }}
            onSkip={() => { setGamesMoodCheckin(null); setMoodSliderValue(0); }}
          />
        ) : null}

        {module === 'meditation' ? (
          <MeditationModule
            C={C}
            styles={styles}
            meditationCategory={meditationCategory}
            setMeditationCategory={setMeditationCategory}
            isPro={isPro}
            freeMeditationCount={freeMeditationCount}
            onSelectVideo={(video) => {
              if (!isPro && freeMeditationCount >= FREE_MEDITATION_LIMIT) {
                setShowProModal(true);
                return;
              }
              if (!isPro) {
                const next = freeMeditationCount + 1;
                setFreeMeditationCount(next);
                AsyncStorage.setItem(FREE_MEDITATION_COUNT_KEY, String(next)).catch(() => {});
              }
              setSelectedVideo(video);
              meditationStartRef.current = Date.now();
            }}
          />
        ) : null}

        {meditationMoodCheckin ? (
          <MoodSliderCheckin C={C} styles={styles} moodSliderValue={moodSliderValue} setMoodSliderValue={setMoodSliderValue}
            onConfirm={async () => {
              if (user?.id && meditationMoodCheckin) {
                const elapsed = Math.floor((Date.now() - meditationStartRef.current) / 1000);
                await logSoundSession(user.id, meditationMoodCheckin.id, meditationMoodCheckin.title, 'meditation', elapsed, { moodBefore: 5, moodAfter: 5 + moodSliderValue });
                getSoundCorrelations(user.id).then(setCorrelations).catch(() => {});
              }
              setMeditationMoodCheckin(null); setMoodSliderValue(0);
            }}
            onSkip={() => { setMeditationMoodCheckin(null); setMoodSliderValue(0); }}
          />
        ) : null}

        {correlations.length > 0 && !showMoodCheckin ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>Your Sound-Mood Map</Text>
            <View style={styles.corrCard}>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false } as any}>Based on your mood check-ins before and after sessions.</Text>
              {correlations.slice(0, 5).map(corr => (
                <View key={corr.soundId} style={styles.corrRow}>
                  <Text style={styles.corrName} numberOfLines={1}>{corr.soundName}</Text>
                  <Text style={styles.corrSessions}>{corr.sessionCount}x</Text>
                  <Text style={[styles.corrRate, { color: corr.improvementRate >= 60 ? C.success : corr.improvementRate >= 40 ? C.warning : C.error }]}>{corr.improvementRate}% better</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
        </WebMaxWidth>
      </ScrollView>

      {showProModal ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }}>
          <View style={{ backgroundColor: isDark ? 'rgba(18,16,36,0.97)' : 'rgba(245,244,255,0.98)', borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1.5, borderColor: C.primary + '60', width: '100%', gap: Spacing.lg,
          shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
        }}>
            <View style={{ alignItems: 'center', gap: Spacing.sm }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="star" size={32} color={C.primary} />
              </View>
              <Text style={{ fontSize: Typography.fontSizes.xl, fontWeight: '800', color: C.textPrimary, textAlign: 'center', includeFontPadding: false } as any}>Mood Lab Pro</Text>
              <Text style={{ fontSize: Typography.fontSizes.sm, color: C.textSecondary, textAlign: 'center', lineHeight: 20, includeFontPadding: false } as any}>Unlock the full Mood Lab experience</Text>
            </View>
            <View style={{ gap: Spacing.sm }}>
              {[
                { icon: 'timer-off', label: 'Unlimited sound sessions', sub: `Free: ${FREE_LIMIT_SECS / 60} min max per session` },
                { icon: 'self-improvement', label: 'Unlimited guided meditation', sub: `Free: ${FREE_MEDITATION_LIMIT} sessions lifetime` },
                { icon: 'games', label: 'All 7 stress relief games', sub: 'Free: Breathing Bubble + Bubble Wrap only' },
                { icon: 'bar-chart', label: 'Full mood-sound analytics', sub: 'See which sounds improve your mood most' },
              ].map(f => (
                <View key={f.icon} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={f.icon as any} size={18} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any}>{f.label}</Text>
                    <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>{f.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Pressable onPress={() => { setShowProModal(false); router.push('/profile' as any); }}
              style={({ pressed }) => [{ backgroundColor: C.primary, borderRadius: Radius.xl, paddingVertical: 14, alignItems: 'center', opacity: pressed ? 0.85 : 1 }]}>
              <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: '#08091A', includeFontPadding: false } as any}>Start 30-Day Free Trial</Text>
            </Pressable>
            <Pressable onPress={() => setShowProModal(false)} style={{ alignSelf: 'center' }}>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false } as any}>Maybe later</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {selectedGame ? (
        <GameModal gameId={selectedGame} C={C} onClose={() => {
          const elapsed = Math.floor((Date.now() - gamesStartRef.current) / 1000);
          setSelectedGame(null);
          if (elapsed >= 20) setGamesMoodCheckin(selectedGame);
        }} />
      ) : null}

      {selectedVideo ? (
        <MeditationVideoModal video={selectedVideo} C={C} onClose={() => {
          setSelectedVideo(null);
          const elapsed = Math.floor((Date.now() - meditationStartRef.current) / 1000);
          if (elapsed >= 30) setMeditationMoodCheckin(selectedVideo);
        }} />
      ) : null}

      {(playingSound || playingFreq || sessionActive) ? (
        <View style={[styles.nowPlayingBar, { backgroundColor: G.navBg }]}>
          <View style={styles.nowPlayingRow}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }], width: 44, height: 44, borderRadius: 22, backgroundColor: activeColor + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: activeColor + '60' }}>
              <MaterialIcons name={playingFreq ? 'waves' : 'music-note'} size={20} color={activeColor} />
            </Animated.View>
            <View style={styles.nowPlayingInfo}>
              <Text style={styles.nowPlayingName} numberOfLines={1}>
                {playingSound?.name ?? playingFreq?.name ?? 'Playing...'}{playingFreq ? ` · ${playingFreq.hz} Hz` : ''}
              </Text>
              <Text style={styles.nowPlayingMeta}>
                {sessionPaused ? 'Paused · ' : ''}{formatTime(sessionSeconds)}
                {!isPro && sessionActive && !sessionPaused
                  ? ` · Free limit: ${formatTime(Math.max(0, FREE_LIMIT_SECS - sessionSeconds))} left`
                  : timerRemaining > 0 ? ` · ${formatTime(timerRemaining)} left` : timerMinutes > 0 ? ` · ${timerMinutes}m` : ''}
              </Text>
            </View>
            {Platform.OS !== 'web' && playingSound ? (
              <Pressable onPress={handlePauseResume} style={[styles.stopBtn, { backgroundColor: activeColor + '20', borderColor: activeColor + '40', marginRight: 6 }]}>
                <MaterialIcons name={sessionPaused ? 'play-arrow' : 'pause'} size={20} color={activeColor} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => handleStop(false)} style={styles.stopBtn}>
              <MaterialIcons name="stop" size={20} color={C.error} />
            </Pressable>
          </View>
          {playingSound ? (
            <View style={styles.volRow}>
              <Pressable onPress={() => handleVolumeChange('down')} style={styles.volBtn}><MaterialIcons name="volume-down" size={16} color={C.textMuted} /></Pressable>
              <View style={styles.volTrack}><View style={[styles.volFill, { width: `${Math.round(volume * 100)}%`, backgroundColor: activeColor }]} /></View>
              <Pressable onPress={() => handleVolumeChange('up')} style={styles.volBtn}><MaterialIcons name="volume-up" size={16} color={C.textMuted} /></Pressable>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textMuted, width: 36, textAlign: 'right', includeFontPadding: false } as any}>{Math.round(volume * 100)}%</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// =============================================================================
// GAMES MODULE
// =============================================================================

interface StressGame {
  id: string; title: string; emoji: string; category: string; duration: string;
  description: string; tags: string[]; color: string; mechanism: string;
}

const STRESS_GAMES: StressGame[] = [
  { id: 'breathing-bubble', title: 'Breathing Bubble', emoji: '🫧', category: 'Breathing', duration: '1–10 min', description: 'Follow the expanding bubble through 4-7-8 breathing cycles. The single most effective technique for acute anxiety.', tags: ['Anxiety', 'Panic', 'Focus'], color: '#7C83FF', mechanism: 'Activates the vagus nerve — shifts nervous system from fight-or-flight to rest-and-digest in 2–3 cycles.' },
  { id: 'bubble-wrap', title: 'Bubble Wrap', emoji: '💆', category: 'Tactile', duration: 'Unlimited', description: 'Pop virtual bubbles one by one. Clinically studied — repetitive tactile action suppresses amygdala firing within 60 seconds.', tags: ['Restlessness', 'Irritability', 'Quick Relief'], color: '#4ADE80', mechanism: 'Repetitive fine motor actions activate the cerebellum and suppress threat responses.' },
  { id: 'zen-sand', title: 'Zen Sand Garden', emoji: '🏖️', category: 'Tactile', duration: 'Unlimited', description: 'Draw patterns in virtual sand. The lines fade slowly as new ones are drawn — impermanence as therapy.', tags: ['Stress', 'Overthinking', 'Meditation'], color: '#FB923C', mechanism: 'Physical drawing activates the prefrontal cortex while quieting the default mode network — your rumination engine.' },
  { id: 'game-2048', title: '2048', emoji: '🧩', category: 'Puzzle', duration: '5–20 min', description: 'Slide tiles to combine matching numbers. Light cognitive load displaces anxious thoughts without adding new stress.', tags: ['Anxiety', 'Racing Thoughts', 'Focus'], color: '#F59E0B', mechanism: 'Occupies the default mode network — the same network responsible for rumination and worry — with low-stakes problem solving.' },
  { id: 'dot-mandala', title: 'Dot Mandala', emoji: '🌸', category: 'Flow', duration: '5–15 min', description: 'Place dots that auto-mirror into perfect symmetrical mandalas. Every placement looks beautiful — nothing to get wrong.', tags: ['Anxiety', 'Perfectionism', 'Creative'], color: '#A78BFA', mechanism: 'Symmetry creation activates reward circuits while the visual pattern-making induces a light flow state.' },
  { id: 'pixel-art', title: 'Pixel Art', emoji: '🎨', category: 'Flow', duration: '10–30 min', description: 'Fill a grid one square at a time to reveal a hidden picture. The gradual reveal is deeply satisfying and meditative.', tags: ['Insomnia', 'Restlessness', 'Creative'], color: '#F472B6', mechanism: 'Systematic completion tasks restore a sense of control and agency — the core antidote to anxiety.' },
  { id: 'beat-maker', title: 'MoodBeat', emoji: '🎛️', category: 'Flow', duration: '5–30 min', description: 'Create beats on a professional 4×4 pad grid with a 16-step sequencer. Live tap pads, program patterns, and control BPM and swing — from beginner-friendly to producer-grade.', tags: ['Stress', 'Creative', 'Focus'], color: '#38BDF8', mechanism: 'Rhythmic music production activates the dopamine reward circuit while demanding just enough cognitive engagement to crowd out anxious thoughts.' },
];

const GAME_CATEGORIES = [
  { key: 'all', label: 'All', emoji: '✨' },
  { key: 'Breathing', label: 'Breathing', emoji: '🌬️' },
  { key: 'Tactile', label: 'Tactile', emoji: '👆' },
  { key: 'Puzzle', label: 'Puzzle', emoji: '🧩' },
  { key: 'Flow', label: 'Flow', emoji: '🎨' },
];

function GamesModule({ C, isPro, onSelectGame, onShowProModal }: {
  C: typeof DarkColors; isPro: boolean;
  onSelectGame: (id: string) => void; onShowProModal: () => void;
}) {
  const [catFilter, setCatFilter] = useState<string>('all');
  const filtered = STRESS_GAMES.filter(g => catFilter === 'all' || g.category === catFilter);

  return (
    <View style={{ gap: Spacing.lg }}>
      <View style={{ backgroundColor: '#F472B6' + '12', borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: '#F472B6' + '30', flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F472B6' + '25', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="games" size={24} color="#F472B6" />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>Stress Relief Games</Text>
          <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: 16, includeFontPadding: false } as any}>
            {STRESS_GAMES.length} science-backed games — breathing, tactile, puzzle, pixel art, beat-making and flow states.
          </Text>
        </View>
      </View>

      {!isPro ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#F5A623' + '12', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: '#F5A623' + '35' }}>
          <MaterialIcons name="lock-open" size={14} color="#F5A623" />
          <Text style={{ flex: 1, fontSize: Typography.fontSizes.xs, color: '#F5A623', lineHeight: 16, includeFontPadding: false } as any}>
            <Text style={{ fontWeight: '800' } as any}>Breathing Bubble</Text> and <Text style={{ fontWeight: '800' } as any}>Bubble Wrap</Text> are free.{' '}
            <Text style={{ fontWeight: '700', textDecorationLine: 'underline' } as any} onPress={onShowProModal}>Upgrade to Pro</Text> to unlock all 6 games.
          </Text>
        </View>
      ) : null}

      <View style={{ backgroundColor: C.secondary + '10', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.secondary + '30' }}>
        <Text style={{ fontSize: Typography.fontSizes.xs, color: C.secondary, lineHeight: 16, includeFontPadding: false } as any}>
          💡 These games work by displacing anxious rumination from the default mode network and activating the parasympathetic nervous system. Even 60 seconds is clinically effective.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: 2, paddingVertical: 4 }}>
        {GAME_CATEGORIES.map(cat => {
          const active = catFilter === cat.key;
          return (
            <Pressable key={cat.key} onPress={() => setCatFilter(cat.key)}
              style={({ pressed }) => [{ paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primary + '20' : C.surfaceElevated }, pressed && { opacity: 0.75 }]}>
              <Text style={{ fontSize: Typography.fontSizes.xs, fontWeight: '700', color: active ? C.primary : C.textMuted, includeFontPadding: false } as any}>{cat.emoji} {cat.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ gap: Spacing.md }}>
        {filtered.map(game => {
          const isLocked = !isPro && !FREE_GAME_IDS.has(game.id);
          return (
            <Pressable key={game.id}
              onPress={() => { if (isLocked) { onShowProModal(); return; } onSelectGame(game.id); }}
              style={({ pressed }) => [{ backgroundColor: C.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1.5, borderColor: C.border, gap: Spacing.md, opacity: isLocked ? 0.65 : 1 }, pressed && { opacity: isLocked ? 0.45 : 0.85, borderColor: game.color + '60' }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                <View style={{ width: 60, height: 60, borderRadius: Radius.xl, backgroundColor: game.color + '20', borderWidth: 1.5, borderColor: game.color + '40', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 28 }}>{game.emoji}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>{game.title}</Text>
                    {!isPro ? (
                      FREE_GAME_IDS.has(game.id) ? (
                        <View style={{ backgroundColor: '#4ADE80' + '20', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: '#4ADE80' + '40' }}>
                          <Text style={{ fontSize: 9, color: '#4ADE80', fontWeight: '800', includeFontPadding: false } as any}>FREE</Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F5A623' + '20', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: '#F5A623' + '40' }}>
                          <MaterialIcons name="lock" size={9} color="#F5A623" />
                          <Text style={{ fontSize: 9, color: '#F5A623', fontWeight: '800', includeFontPadding: false } as any}>PRO</Text>
                        </View>
                      )
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <View style={{ backgroundColor: game.color + '15', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: game.color + '30' }}>
                      <Text style={{ fontSize: 10, color: game.color, fontWeight: '700', includeFontPadding: false } as any}>{game.category}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.border, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <MaterialIcons name="schedule" size={10} color={C.textMuted} />
                      <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '600', includeFontPadding: false } as any}>{game.duration}</Text>
                    </View>
                  </View>
                </View>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isLocked ? '#F5A623' + '15' : game.color + '15', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isLocked ? '#F5A623' + '30' : game.color + '30' }}>
                  <MaterialIcons name={isLocked ? 'lock' : 'play-arrow'} size={22} color={isLocked ? '#F5A623' : game.color} />
                </View>
              </View>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: 16, includeFontPadding: false } as any}>{game.description}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.surface, borderRadius: Radius.lg, padding: Spacing.sm, borderWidth: 1, borderColor: C.border }}>
                <MaterialIcons name="psychology" size={13} color={C.textMuted} />
                <Text style={{ flex: 1, fontSize: 10, color: C.textMuted, lineHeight: 14, includeFontPadding: false } as any}>{game.mechanism}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {game.tags.map(tag => (
                  <View key={tag} style={{ backgroundColor: C.surface, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: '600', includeFontPadding: false } as any}>{tag}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: Spacing.sm }}>
        <MaterialIcons name="info-outline" size={12} color={C.textMuted} />
        <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>All games built in-app · No internet required · Mood tracked per session</Text>
      </View>
    </View>
  );
}

// =============================================================================
// GAME MODAL
// =============================================================================
function GameModal({ gameId, C, onClose }: { gameId: string; C: typeof DarkColors; onClose: () => void }) {
  const game = STRESS_GAMES.find(g => g.id === gameId);
  if (!game) return null;

  const renderGame = () => {
    switch (gameId) {
      case 'breathing-bubble': return <BreathingBubbleGame C={C} />;
      case 'bubble-wrap':      return <BubbleWrapGame C={C} />;
      case 'zen-sand':         return <ZenSandGame C={C} />;
      case 'game-2048':        return <Game2048 C={C} />;
      case 'dot-mandala':      return <DotMandalaGame C={C} />;
      case 'pixel-art':        return <PixelArtGame C={C} />;
      case 'beat-maker':       return <MoodBeatGame C={C} />;
      default:                 return null;
    }
  };

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent={Platform.OS === 'android'}>
      <View style={{ flex: 1, backgroundColor: '#08091A' }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: 52, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }}>
          <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
          </Pressable>
          <Text style={{ fontSize: 18 }}>{game.emoji}</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: 'rgba(255,255,255,0.9)', includeFontPadding: false } as any}>{game.title}</Text>
          <View style={{ flex: 1 }} />
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: game.color + '30', borderWidth: 1, borderColor: game.color + '50' }}>
            <Text style={{ fontSize: 10, color: game.color, fontWeight: '700', includeFontPadding: false } as any}>{game.duration}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>{renderGame()}</View>
      </View>
    </Modal>
  );
}

// =============================================================================
// GAME 1 — BREATHING BUBBLE
// =============================================================================
function BreathingBubbleGame({ C }: { C: typeof DarkColors }) {
  const phases = [
    { label: 'Inhale', duration: 6000, color: '#7C83FF', instruction: 'Breathe in slowly through your nose', seconds: 6 },
    { label: 'Hold', duration: 7000, color: '#F5A623', instruction: 'Hold gently — stay still', seconds: 7 },
    { label: 'Exhale', duration: 9000, color: '#4ECDC4', instruction: 'Release slowly through your mouth', seconds: 9 },
  ];
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0.35)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const phaseRef = useRef(0);
  const runningRef = useRef(false);
  const cyclesRef = useRef(0);
  const rotLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const lastPhaseRef = useRef(-1);
  const { width: SW, height: SH } = Dimensions.get('window');
  const bubbleMax = Math.min(SW * 0.62, SH * 0.38, 280);

  const runCycle = () => {
    const runPhase = (idx: number) => {
      if (!runningRef.current) return;
      const phase = phases[idx];
      phaseRef.current = idx;
      setPhaseIdx(idx);
      setProgress(0);
      setCountdown(phase.seconds);
      const targetScale = idx === 0 ? 1.0 : idx === 1 ? 1.0 : 0.35;
      const startScale  = idx === 0 ? 0.35 : idx === 1 ? 1.0 : 1.0;
      scaleAnim.setValue(startScale);
      if (lastPhaseRef.current !== idx) { lastPhaseRef.current = idx; }
      Animated.timing(scaleAnim, { toValue: targetScale, duration: phase.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start(({ finished }) => {
        if (!finished || !runningRef.current) return;
        const next = (idx + 1) % phases.length;
        if (next === 0) { cyclesRef.current += 1; setCycles(cyclesRef.current); }
        runPhase(next);
      });
      const start = Date.now();
      const tick = () => {
        if (!runningRef.current || phaseRef.current !== idx) return;
        const elapsed = (Date.now() - start) / phase.duration;
        const p = Math.min(elapsed, 1);
        setProgress(p);
        setCountdown(Math.ceil(phase.seconds * (1 - p)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    runPhase(0);
  };

  const start = () => {
    runningRef.current = true; setRunning(true); setCycles(0); cyclesRef.current = 0;
    rotLoopRef.current = Animated.loop(Animated.timing(rotateAnim, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true }));
    rotLoopRef.current.start();
    glowLoopRef.current = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.4, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    glowLoopRef.current.start();
    runCycle();
  };

  const stop = () => {
    runningRef.current = false; lastPhaseRef.current = -1; setRunning(false);
    rotLoopRef.current?.stop(); glowLoopRef.current?.stop();
    scaleAnim.stopAnimation(); scaleAnim.setValue(0.35);
    rotateAnim.setValue(0); glowAnim.setValue(0.4);
    setPhaseIdx(0); setProgress(0); setCountdown(0);
  };

  useEffect(() => () => { runningRef.current = false; scaleAnim.stopAnimation(); rotLoopRef.current?.stop(); glowLoopRef.current?.stop(); }, []);

  const phase = phases[phaseIdx];
  const activeColor = running ? phase.color : '#7C83FF';
  const rotDeg = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotRevDeg = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const PETALS = 6;
  const petalAngles = Array.from({ length: PETALS }, (_, i) => (i * 360) / PETALS);

  return (
    <View style={{ flex: 1, backgroundColor: '#08091A', alignItems: 'center', justifyContent: 'space-between', paddingTop: 100, paddingBottom: 32, paddingHorizontal: 24 }}>
      <View style={{ width: bubbleMax, height: bubbleMax, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ position: 'absolute', width: bubbleMax, height: bubbleMax, borderRadius: bubbleMax / 2, borderWidth: 1, borderColor: activeColor + '25', borderStyle: 'dashed', transform: [{ rotate: rotDeg }] }} />
        {petalAngles.map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const r = bubbleMax * 0.285;
          return <View key={i} style={{ position: 'absolute', width: bubbleMax * 0.57, height: bubbleMax * 0.57, borderRadius: bubbleMax, borderWidth: 0.8, borderColor: activeColor + '18', left: bubbleMax / 2 - bubbleMax * 0.285 + r * Math.cos(rad), top: bubbleMax / 2 - bubbleMax * 0.285 + r * Math.sin(rad) }} />;
        })}
        <Animated.View style={{ position: 'absolute', width: bubbleMax * 0.78, height: bubbleMax * 0.78, borderRadius: bubbleMax / 2, borderWidth: 1, borderColor: activeColor + '35', transform: [{ rotate: rotRevDeg }] }}>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const r2 = bubbleMax * 0.37;
            return <View key={i} style={{ position: 'absolute', width: i % 3 === 0 ? 5 : 3, height: i % 3 === 0 ? 5 : 3, borderRadius: 3, backgroundColor: activeColor + (i % 3 === 0 ? '80' : '40'), left: r2 + r2 * Math.cos(a) - (i % 3 === 0 ? 2.5 : 1.5), top: r2 + r2 * Math.sin(a) - (i % 3 === 0 ? 2.5 : 1.5) }} />;
          })}
        </Animated.View>
        <Animated.View style={{ width: bubbleMax * 0.58, height: bubbleMax * 0.58, borderRadius: bubbleMax / 2, backgroundColor: activeColor + '15', borderWidth: 2.5, borderColor: activeColor + '70', alignItems: 'center', justifyContent: 'center', shadowColor: activeColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 24, elevation: 12, transform: [{ scale: scaleAnim }] }}>
          <Animated.View style={{ position: 'absolute', width: '75%', height: '75%', borderRadius: 999, borderWidth: 1, borderColor: activeColor + '50', opacity: glowAnim }} />
          <Text style={{ fontSize: running ? 44 : 32, fontWeight: '900', color: activeColor, includeFontPadding: false } as any}>{running ? countdown : '✦'}</Text>
        </Animated.View>
        {running ? <View style={{ position: 'absolute', width: bubbleMax + 12, height: bubbleMax + 12, borderRadius: (bubbleMax + 12) / 2, borderWidth: 3, borderColor: 'transparent', borderTopColor: activeColor + '90', transform: [{ rotate: `${progress * 360 - 90}deg` }] }} /> : null}
      </View>
      <View style={{ alignItems: 'center', gap: 10, minHeight: 80 }}>
        {running ? (
          <>
            <Text style={{ fontSize: 30, fontWeight: '900', color: activeColor, letterSpacing: 2, includeFontPadding: false } as any}>{phase.label.toUpperCase()}</Text>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', textAlign: 'center', includeFontPadding: false } as any}>{phase.instruction}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {phases.map((p, i) => <View key={i} style={{ width: phaseIdx === i ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: phaseIdx === i ? p.color : 'rgba(255,255,255,0.2)' }} />)}
            </View>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 22, fontWeight: '800', color: 'rgba(255,255,255,0.9)', textAlign: 'center', includeFontPadding: false } as any}>4 · 7 · 8 Breathing</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20, includeFontPadding: false } as any}>{'Inhale 4s  ·  Hold 7s  ·  Exhale 8s\nActivates the parasympathetic nervous system'}</Text>
          </>
        )}
      </View>
      {cycles > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4ECDC415', borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 8, borderWidth: 1, borderColor: '#4ECDC440' }}>
          <MaterialIcons name="check-circle" size={16} color="#4ECDC4" />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#4ECDC4', includeFontPadding: false } as any}>{cycles} cycle{cycles !== 1 ? 's' : ''} complete</Text>
        </View>
      ) : <View style={{ height: 36 }} />}
      <Pressable onPress={running ? stop : start} style={({ pressed }) => [{ borderRadius: Radius.xl, paddingVertical: 16, paddingHorizontal: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: running ? '#FF6B6B20' : activeColor + '20', borderWidth: 2, borderColor: running ? '#FF6B6B' : activeColor, shadowColor: running ? '#FF6B6B' : activeColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8, opacity: pressed ? 0.75 : 1 }]}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: running ? '#FF6B6B' : activeColor, letterSpacing: 0.5, includeFontPadding: false } as any}>{running ? 'End Session' : 'Begin Breathing'}</Text>
      </Pressable>
    </View>
  );
}

// =============================================================================
// GAME 2 — BUBBLE WRAP
// =============================================================================
function BubbleWrapGame({ C }: { C: typeof DarkColors }) {
  const { width: SW } = Dimensions.get('window');
  const COLS = 7; const ROWS = 10; const TOTAL = COLS * ROWS;
  const GEM_COLORS = ['#7C83FF', '#A78BFA', '#F472B6', '#4ECDC4', '#F5A623', '#4ADE80', '#FF6B6B'];
  const [popped, setPopped] = useState<boolean[]>(() => Array(TOTAL).fill(false));
  const [popCount, setPopCount] = useState(0);
  const scalesRef = useRef<Animated.Value[]>(Array.from({ length: TOTAL }, () => new Animated.Value(1)));
  const opacitiesRef = useRef<Animated.Value[]>(Array.from({ length: TOTAL }, () => new Animated.Value(1)));
  const glowRef = useRef<Animated.Value[]>(Array.from({ length: TOTAL }, () => new Animated.Value(0)));
  const allPopped = popCount >= TOTAL;

  const reset = () => {
    setPopped(Array(TOTAL).fill(false)); setPopCount(0);
    scalesRef.current.forEach(a => a.setValue(1));
    opacitiesRef.current.forEach(a => a.setValue(1));
    glowRef.current.forEach(a => a.setValue(0));
  };

  const handlePop = (i: number) => {
    if (popped[i]) return;
    playBubblePop();
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scalesRef.current[i], { toValue: 1.45, duration: 60, useNativeDriver: true }),
        Animated.timing(glowRef.current[i], { toValue: 1, duration: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scalesRef.current[i], { toValue: 0.05, duration: 150, useNativeDriver: true }),
        Animated.timing(opacitiesRef.current[i], { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(glowRef.current[i], { toValue: 0, duration: 150, useNativeDriver: true }),
      ]),
    ]).start();
    setPopped(prev => { const next = [...prev]; next[i] = true; return next; });
    setPopCount(p => { const next = p + 1; if (next >= TOTAL) setTimeout(() => playBubbleAllPopped(), 100); return next; });
  };

  const SIDE_PAD = 20; const GAP = 5;
  const cellW = Math.floor((SW - SIDE_PAD * 2 - GAP * (COLS - 1)) / COLS);
  const pct = Math.round((popCount / TOTAL) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: '#08091A', alignItems: 'center', paddingTop: 96 }}>
      <View style={{ width: '100%', paddingHorizontal: SIDE_PAD, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', includeFontPadding: false } as any}>POPPED</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', includeFontPadding: false } as any}>{pct}%</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', includeFontPadding: false } as any}>REMAINING</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: '#4ADE80', includeFontPadding: false } as any}>{popCount}</Text>
          <Text style={{ fontSize: 32, fontWeight: '900', color: 'rgba(255,255,255,0.25)', includeFontPadding: false } as any}>{TOTAL - popCount}</Text>
        </View>
        <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
          <View style={{ height: 4, width: `${pct}%` as any, backgroundColor: '#4ADE80', borderRadius: 2 }} />
        </View>
      </View>
      {allPopped ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <Text style={{ fontSize: 64 }}>💎</Text>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#4ADE80', letterSpacing: 1, includeFontPadding: false } as any}>ALL CRYSTALS SHATTERED</Text>
          <Pressable onPress={reset} style={({ pressed }) => [{ backgroundColor: '#4ADE8020', borderRadius: Radius.xl, paddingVertical: 14, paddingHorizontal: 36, borderWidth: 2, borderColor: '#4ADE80' }, pressed && { opacity: 0.75 }]}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#4ADE80', includeFontPadding: false } as any}>New Crystal Grid</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SIDE_PAD, paddingBottom: 20 }}>
          <View style={{ gap: GAP }}>
            {Array.from({ length: ROWS }, (_, row) => (
              <View key={row} style={{ flexDirection: 'row', gap: GAP }}>
                {Array.from({ length: COLS }, (_, col) => {
                  const i = row * COLS + col;
                  const isPopped = popped[i];
                  const gemColor = GEM_COLORS[col];
                  const glowOpacity = glowRef.current[i].interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
                  return (
                    <Pressable key={col} onPress={() => handlePop(i)} hitSlop={2}>
                      <Animated.View style={[{ width: cellW, height: cellW, borderRadius: cellW * 0.22, alignItems: 'center', justifyContent: 'center', transform: [{ scale: scalesRef.current[i] }], opacity: opacitiesRef.current[i] },
                        isPopped ? { backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' } : { backgroundColor: gemColor + '18', borderWidth: 1.5, borderColor: gemColor + '55', shadowColor: gemColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 }]}>
                        {!isPopped ? (
                          <>
                            <View style={{ width: cellW * 0.5, height: cellW * 0.5, borderRadius: cellW * 0.1, backgroundColor: gemColor + '30', transform: [{ rotate: '45deg' }] }} />
                            <View style={{ position: 'absolute', top: cellW * 0.15, left: cellW * 0.2, width: cellW * 0.18, height: cellW * 0.08, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)', transform: [{ rotate: '-30deg' }] }} />
                            <Animated.View style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: cellW * 0.22, backgroundColor: gemColor, opacity: glowOpacity }} />
                          </>
                        ) : (
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                        )}
                      </Animated.View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      {!allPopped ? (
        <Pressable onPress={reset} style={({ pressed }) => [{ paddingVertical: 12, paddingHorizontal: 24 }, pressed && { opacity: 0.6 }]}>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontWeight: '600', includeFontPadding: false } as any}>Reset Grid</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// =============================================================================
// GAME 3 — ZEN SAND
// =============================================================================
type StrokePoint = { x: number; y: number; color: string; size: number; opacity: number };

function ZenSandGame({ C }: { C: typeof DarkColors }) {
  const { width: SW, height: SH } = Dimensions.get('window');
  const PALETTE = ['#7C83FF', '#F472B6', '#4ECDC4', '#F5A623', '#4ADE80', '#FF6B6B', '#A78BFA', '#38BDF8'];
  const BRUSH_SIZES = [6, 10, 16, 24];
  const [points, setPoints] = useState<StrokePoint[]>([]);
  const [brushColor, setBrushColor] = useState(PALETTE[0]);
  const [brushSize, setBrushSize] = useState(10);
  const [strokeCount, setStrokeCount] = useState(0);
  const colorRef = useRef(brushColor); const sizeRef = useRef(brushSize);
  colorRef.current = brushColor; sizeRef.current = brushSize;
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastSandSoundRef = useRef(0);

  const addStrokeLine = (x: number, y: number) => {
    const newPts: StrokePoint[] = [];
    const last = lastPointRef.current;
    if (last) {
      const dx = x - last.x; const dy = y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.ceil(dist / (sizeRef.current * 0.5)));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        newPts.push({ x: last.x + dx * t, y: last.y + dy * t, color: colorRef.current, size: sizeRef.current, opacity: 0.85 });
      }
    } else {
      newPts.push({ x, y, color: colorRef.current, size: sizeRef.current, opacity: 0.85 });
    }
    lastPointRef.current = { x, y };
    setPoints(prev => [...prev, ...newPts]);
  };

  const sandPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true, onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true, onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (e) => { lastPointRef.current = null; addStrokeLine(e.nativeEvent.locationX, e.nativeEvent.locationY); playSandStroke(); lastSandSoundRef.current = Date.now(); },
    onPanResponderMove: (e) => { addStrokeLine(e.nativeEvent.locationX, e.nativeEvent.locationY); const now = Date.now(); if (now - lastSandSoundRef.current > 120) { playSandStroke(); lastSandSoundRef.current = now; } },
    onPanResponderRelease: () => { lastPointRef.current = null; setStrokeCount(s => s + 1); },
  }), []);

  const clear = () => { setPoints([]); setStrokeCount(0); };
  const TOOLBAR_H = 72;
  const canvasH = SH - 100 - TOOLBAR_H - 32;
  const canvasW = SW;

  return (
    <View style={{ flex: 1, backgroundColor: '#08091A' }}>
      <View style={{ width: canvasW, height: canvasH, backgroundColor: '#060714', overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }} {...sandPan.panHandlers}>
        {Array.from({ length: 40 }, (_, i) => <View key={i} style={{ position: 'absolute', width: i % 7 === 0 ? 2.5 : 1.5, height: i % 7 === 0 ? 2.5 : 1.5, borderRadius: 2, backgroundColor: `rgba(255,255,255,${0.04 + (i % 5) * 0.03})`, left: ((i * 197 + 43) % canvasW), top: ((i * 313 + 71) % canvasH) }} />)}
        {[0.22, 0.40, 0.58].map((r, i) => <View key={i} style={{ position: 'absolute', width: canvasW * r * 2, height: canvasW * r * 2, borderRadius: canvasW * r, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.04)', left: canvasW / 2 - canvasW * r, top: canvasH / 2 - canvasW * r }} />)}
        {points.map((pt, i) => <View key={i} style={{ position: 'absolute', width: pt.size, height: pt.size, borderRadius: pt.size / 2, backgroundColor: pt.color, opacity: pt.opacity, left: pt.x - pt.size / 2, top: pt.y - pt.size / 2, shadowColor: pt.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: pt.size * 0.9 }} />)}
      </View>
      <View style={{ height: TOOLBAR_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, backgroundColor: '#08091A' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
          {PALETTE.map(c => <Pressable key={c} onPress={() => setBrushColor(c)} style={[{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: brushColor === c ? 3 : 1.5, borderColor: brushColor === c ? '#fff' : 'transparent' }]} />)}
          <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 }} />
          {BRUSH_SIZES.map(s => <Pressable key={s} onPress={() => setBrushSize(s)} style={[{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: brushSize === s ? 1.5 : 1, borderColor: brushSize === s ? brushColor : 'rgba(255,255,255,0.12)', backgroundColor: brushSize === s ? brushColor + '20' : 'transparent' }]}><View style={{ width: Math.max(4, s * 0.55), height: Math.max(4, s * 0.55), borderRadius: s, backgroundColor: brushColor, opacity: brushSize === s ? 1 : 0.4 }} /></Pressable>)}
        </ScrollView>
        <Pressable onPress={clear} style={({ pressed }) => [{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }, pressed && { opacity: 0.6 }]}>
          <MaterialIcons name="refresh" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', paddingBottom: 8 }}>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', includeFontPadding: false } as any}>{points.length} points · {strokeCount} strokes</Text>
      </View>
    </View>
  );
}

// =============================================================================
// GAME 4 — 2048
// =============================================================================
type Grid2048 = (number | null)[][];

function newGrid(): Grid2048 { const g: Grid2048 = Array.from({ length: 4 }, () => Array(4).fill(null)); addTile(g); addTile(g); return g; }
function addTile(g: Grid2048) { const empty: [number, number][] = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!g[r][c]) empty.push([r, c]); if (!empty.length) return; const [r, c] = empty[Math.floor(Math.random() * empty.length)]; g[r][c] = Math.random() < 0.9 ? 2 : 4; }
function slideRow(row: (number | null)[]): { row: (number | null)[]; score: number } {
  const vals = row.filter(Boolean) as number[]; let score = 0; const merged: number[] = []; let i = 0;
  while (i < vals.length) { if (i + 1 < vals.length && vals[i] === vals[i + 1]) { merged.push(vals[i] * 2); score += vals[i] * 2; i += 2; } else { merged.push(vals[i]); i++; } }
  while (merged.length < 4) merged.push(0);
  return { row: merged.map(v => v || null), score };
}
function moveGrid(g: Grid2048, dir: 'left' | 'right' | 'up' | 'down'): { grid: Grid2048; score: number; moved: boolean } {
  let totalScore = 0; const next: Grid2048 = JSON.parse(JSON.stringify(g)); let moved = false;
  const applyRow = (row: (number | null)[]) => { const { row: r, score } = slideRow(row); totalScore += score; if (JSON.stringify(r) !== JSON.stringify(row)) moved = true; return r; };
  if (dir === 'left') { for (let r = 0; r < 4; r++) next[r] = applyRow(next[r]); }
  else if (dir === 'right') { for (let r = 0; r < 4; r++) next[r] = applyRow([...next[r]].reverse()).reverse(); }
  else if (dir === 'up') { for (let c = 0; c < 4; c++) { const col = applyRow(next.map(r => r[c])); col.forEach((v, r) => { next[r][c] = v; }); } }
  else { for (let c = 0; c < 4; c++) { const col = applyRow(next.map(r => r[c]).reverse()).reverse(); col.forEach((v, r) => { next[r][c] = v; }); } }
  return { grid: next, score: totalScore, moved };
}

const TILE_STYLES: Record<number, { bg: string; border: string; text: string; glow: string }> = {
  2: { bg: '#1a1f3a', border: '#7C83FF40', text: '#9aa0ff', glow: '#7C83FF' }, 4: { bg: '#1d1a3a', border: '#A78BFA60', text: '#b8a0ff', glow: '#A78BFA' },
  8: { bg: '#2a1035', border: '#F472B660', text: '#f9a0d0', glow: '#F472B6' }, 16: { bg: '#2d0e28', border: '#FF6B9060', text: '#ff9bba', glow: '#FF6B90' },
  32: { bg: '#2d1408', border: '#F5A62360', text: '#ffc870', glow: '#F5A623' }, 64: { bg: '#1e2200', border: '#C8E03060', text: '#d8f050', glow: '#C8E030' },
  128: { bg: '#002820', border: '#4ECDC470', text: '#7eeae8', glow: '#4ECDC4' }, 256: { bg: '#001f2a', border: '#38BDF870', text: '#70d8ff', glow: '#38BDF8' },
  512: { bg: '#0a0a30', border: '#818CF870', text: '#a0a8ff', glow: '#818CF8' }, 1024: { bg: '#1a0a25', border: '#E879F970', text: '#f0a0ff', glow: '#E879F9' },
  2048: { bg: '#200a00', border: '#F5A62380', text: '#ffe0a0', glow: '#F5A623' },
};

function Game2048({ C }: { C: typeof DarkColors }) {
  const { width: SW, height: SH } = Dimensions.get('window');
  const [grid, setGrid] = useState<Grid2048>(() => newGrid());
  const [score, setScore] = useState(0); const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false); const [won, setWon] = useState(false);
  const mergeAnimsRef = useRef<Record<string, Animated.Value>>({});

  const swipePan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6,
    onPanResponderRelease: (_, gs) => {
      if (gameOver) return;
      const { dx, dy } = gs;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      const dir: 'left' | 'right' | 'up' | 'down' = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      setGrid(prev => {
        const { grid: next, score: add, moved } = moveGrid(prev, dir);
        if (!moved) return prev;
        play2048Slide(); addTile(next);
        setScore(s => { const ns = s + add; setBest(b => Math.max(b, ns)); if (add > 0) { mergeAnimsRef.current[`${Date.now()}`] = new Animated.Value(1); play2048Merge(add); } return ns; });
        const justWon = next.flat().some(v => v === 2048);
        if (justWon) { setWon(true); setTimeout(() => play2048Win(), 50); }
        const { moved: cL } = moveGrid(next, 'left'); const { moved: cR } = moveGrid(next, 'right');
        const { moved: cU } = moveGrid(next, 'up'); const { moved: cD } = moveGrid(next, 'down');
        if (!cL && !cR && !cU && !cD) { setGameOver(true); setTimeout(() => play2048GameOver(), 50); }
        return next;
      });
    },
  }), [gameOver]);

  const restart = () => { setGrid(newGrid()); setScore(0); setGameOver(false); setWon(false); };
  const BOARD_PAD = 20;
  const boardSize = Math.min(SW - BOARD_PAD * 2, SH * 0.52, 380);
  const GAP = 7; const tileSize = Math.floor((boardSize - GAP * 5) / 4);
  const tileFont = tileSize > 76 ? 22 : tileSize > 60 ? 18 : 14;

  return (
    <View style={{ flex: 1, backgroundColor: '#08091A', alignItems: 'center', justifyContent: 'space-evenly', paddingTop: 96, paddingHorizontal: BOARD_PAD }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {[['SCORE', score], ['BEST', best]].map(([label, val]) => (
          <View key={String(label)} style={{ alignItems: 'center', minWidth: 88, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: Radius.lg, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, includeFontPadding: false } as any}>{String(label)}</Text>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#F5A623', includeFontPadding: false } as any}>{String(val)}</Text>
          </View>
        ))}
        <Pressable onPress={restart} style={({ pressed }) => [{ alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }, pressed && { opacity: 0.7 }]}>
          <MaterialIcons name="refresh" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </View>
      <View style={{ width: boardSize, height: boardSize, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.xl, padding: GAP, gap: GAP, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'column', shadowColor: '#7C83FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 }} {...swipePan.panHandlers}>
        {grid.map((row, r) => (
          <View key={r} style={{ flex: 1, flexDirection: 'row', gap: GAP }}>
            {row.map((val, c) => {
              const ts = val ? (TILE_STYLES[val] ?? { bg: '#111830', border: '#ffffff20', text: '#ffffffaa', glow: '#ffffff' }) : null;
              return (
                <View key={c} style={{ flex: 1, borderRadius: Radius.md, backgroundColor: ts ? ts.bg : 'rgba(255,255,255,0.03)', borderWidth: ts ? 1.5 : 1, borderColor: ts ? ts.border : 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', shadowColor: ts ? ts.glow : 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: ts ? 0.5 : 0, shadowRadius: 8, elevation: ts ? 4 : 0 }}>
                  {val ? (
                    <>
                      <View style={{ position: 'absolute', width: tileSize * 0.35, height: tileSize * 0.35, borderRadius: 4, opacity: 0.15, backgroundColor: ts!.glow, transform: [{ rotate: '45deg' }] }} />
                      <Text style={{ fontSize: val >= 1024 ? tileFont - 2 : tileFont, fontWeight: '900', color: ts!.text, includeFontPadding: false, textShadowColor: ts!.glow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 } as any}>{val}</Text>
                    </>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
        {(gameOver || won) ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,9,26,0.88)', borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <Text style={{ fontSize: 44 }}>{won ? '✦' : '⬡'}</Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: won ? '#F5A623' : 'rgba(255,255,255,0.6)', letterSpacing: 1, includeFontPadding: false } as any}>{won ? 'YOU REACHED 2048' : 'GAME OVER'}</Text>
            <Pressable onPress={restart} style={({ pressed }) => [{ backgroundColor: '#F5A62320', borderRadius: Radius.lg, paddingHorizontal: 28, paddingVertical: 12, borderWidth: 2, borderColor: '#F5A623' }, pressed && { opacity: 0.75 }]}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#F5A623', includeFontPadding: false } as any}>Play Again</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center', includeFontPadding: false } as any}>Swipe to merge tiles · Reach 2048</Text>
    </View>
  );
}

// =============================================================================
// GAME 5 — DOT MANDALA
// =============================================================================
interface MandalaPoint { x: number; y: number; color: string; size: number; ring: number; }

function DotMandalaGame({ C }: { C: typeof DarkColors }) {
  const { width: SW, height: SH } = Dimensions.get('window');
  const COLORS = ['#A78BFA', '#F472B6', '#4ECDC4', '#F5A623', '#7C83FF', '#4ADE80', '#FF6B6B', '#38BDF8', '#E879F9'];
  const SIZES = [6, 10, 16, 24, 34]; const SYMMETRIES = [3, 4, 6, 8, 12];
  const [points, setPoints] = useState<MandalaPoint[]>([]);
  const [dotColor, setDotColor] = useState(COLORS[0]); const [dotSize, setDotSize] = useState(10); const [symmetry, setSymmetry] = useState(8); const [ringCount, setRingCount] = useState(0);
  const colorRef = useRef(dotColor); const sizeRef = useRef(dotSize); const symRef = useRef(symmetry);
  colorRef.current = dotColor; sizeRef.current = dotSize; symRef.current = symmetry;
  const centerRef = useRef({ x: 0, y: 0 });
  const canvasW = SW; const TOOLBAR_H = 88; const canvasH = SH - 100 - TOOLBAR_H - 20;
  const lastMandalaSoundRef = useRef(0);

  const placeDots = (px: number, py: number) => {
    const cx = centerRef.current.x; const cy = centerRef.current.y;
    const dx = px - cx; const dy = py - cy;
    const r = Math.sqrt(dx * dx + dy * dy);
    const baseAngle = Math.atan2(dy, dx);
    const sym = symRef.current;
    const newPoints: MandalaPoint[] = [];
    for (let i = 0; i < sym; i++) {
      const a1 = baseAngle + (i * 2 * Math.PI) / sym;
      const a2 = -(baseAngle) + (i * 2 * Math.PI) / sym;
      newPoints.push({ x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1), color: colorRef.current, size: sizeRef.current, ring: Math.floor(r / 30) });
      newPoints.push({ x: cx + r * Math.cos(a2), y: cy + r * Math.sin(a2), color: colorRef.current, size: sizeRef.current, ring: Math.floor(r / 30) });
    }
    setPoints(prev => [...prev, ...newPoints]);
  };

  const dotPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true, onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true, onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (e) => {
      placeDots(e.nativeEvent.locationX, e.nativeEvent.locationY);
      const cx = centerRef.current.x; const cy = centerRef.current.y;
      const dx = e.nativeEvent.locationX - cx; const dy = e.nativeEvent.locationY - cy;
      playMandalaPlace(Math.floor(Math.sqrt(dx*dx+dy*dy) / 30));
      lastMandalaSoundRef.current = Date.now();
    },
    onPanResponderMove: (e) => {
      placeDots(e.nativeEvent.locationX, e.nativeEvent.locationY);
      const now = Date.now();
      if (now - lastMandalaSoundRef.current > 180) {
        const cx = centerRef.current.x; const cy = centerRef.current.y;
        const dx = e.nativeEvent.locationX - cx; const dy = e.nativeEvent.locationY - cy;
        playMandalaPlace(Math.floor(Math.sqrt(dx*dx+dy*dy) / 30));
        lastMandalaSoundRef.current = now;
      }
    },
    onPanResponderRelease: () => { setRingCount(r => r + 1); },
  }), []);

  const clear = () => { setPoints([]); setRingCount(0); };
  const FOL_R = Math.min(canvasW, canvasH) * 0.14;
  const folCenters = [{ x: 0, y: 0 }, ...Array.from({ length: 6 }, (_, i) => ({ x: FOL_R * Math.cos((i * Math.PI) / 3), y: FOL_R * Math.sin((i * Math.PI) / 3) })), ...Array.from({ length: 6 }, (_, i) => ({ x: FOL_R * 2 * Math.cos((i * Math.PI) / 3 + Math.PI / 6) * 0.866, y: FOL_R * 2 * Math.sin((i * Math.PI) / 3 + Math.PI / 6) * 0.866 }))];

  return (
    <View style={{ flex: 1, backgroundColor: '#06071A' }}>
      <View style={{ width: canvasW, height: canvasH, overflow: 'hidden' }} onLayout={e => { centerRef.current = { x: e.nativeEvent.layout.width / 2, y: e.nativeEvent.layout.height / 2 }; }} {...dotPan.panHandlers}>
        {folCenters.map((fc, i) => <View key={i} style={{ position: 'absolute', width: FOL_R * 2, height: FOL_R * 2, borderRadius: FOL_R, borderWidth: 0.5, borderColor: dotColor + '18', left: canvasW / 2 + fc.x - FOL_R, top: canvasH / 2 + fc.y - FOL_R }} />)}
        {[0.12, 0.22, 0.34, 0.46, 0.58].map((r, i) => <View key={i} style={{ position: 'absolute', width: canvasW * r * 2, height: canvasW * r * 2, borderRadius: canvasW * r, borderWidth: 0.4, borderColor: 'rgba(255,255,255,0.05)', left: canvasW / 2 - canvasW * r, top: canvasH / 2 - canvasW * r }} />)}
        <View style={{ position: 'absolute', left: canvasW / 2 - 0.5, top: canvasH / 2 - 18, width: 1, height: 36, backgroundColor: dotColor + '30' }} />
        <View style={{ position: 'absolute', left: canvasW / 2 - 18, top: canvasH / 2 - 0.5, width: 36, height: 1, backgroundColor: dotColor + '30' }} />
        {points.map((pt, i) => <View key={i} style={{ position: 'absolute', width: pt.size, height: pt.size, borderRadius: pt.size / 2, backgroundColor: pt.color, left: pt.x - pt.size / 2, top: pt.y - pt.size / 2, opacity: 0.9, shadowColor: pt.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: pt.size * 0.8, elevation: 4 }} />)}
      </View>
      <View style={{ height: TOOLBAR_H, paddingHorizontal: 16, paddingTop: 8, backgroundColor: '#06071A' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
          {COLORS.map(c => <Pressable key={c} onPress={() => setDotColor(c)} style={[{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, borderWidth: dotColor === c ? 3 : 1.5, borderColor: dotColor === c ? '#fff' : 'transparent' }]} />)}
          <View style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 2 }} />
          {SIZES.map(s => <Pressable key={s} onPress={() => setDotSize(s)} style={[{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: dotSize === s ? 2 : 1, borderColor: dotSize === s ? dotColor : 'rgba(255,255,255,0.12)', backgroundColor: dotSize === s ? dotColor + '20' : 'transparent' }]}><View style={{ width: Math.max(4, s * 0.5), height: Math.max(4, s * 0.5), borderRadius: s, backgroundColor: dotColor, opacity: dotSize === s ? 1 : 0.4 }} /></Pressable>)}
          <View style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 2 }} />
          {SYMMETRIES.map(s => <Pressable key={s} onPress={() => setSymmetry(s)} style={[{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, borderWidth: symmetry === s ? 2 : 1, borderColor: symmetry === s ? dotColor : 'rgba(255,255,255,0.12)', backgroundColor: symmetry === s ? dotColor + '20' : 'transparent' }]}><Text style={{ fontSize: 12, fontWeight: '800', color: symmetry === s ? dotColor : 'rgba(255,255,255,0.35)', includeFontPadding: false } as any}>{s}×</Text></Pressable>)}
          <Pressable onPress={clear} style={({ pressed }) => [{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }, pressed && { opacity: 0.6 }]}>
            <MaterialIcons name="refresh" size={16} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </ScrollView>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', textAlign: 'center', marginTop: 6, includeFontPadding: false } as any}>{points.length} dots · {ringCount} rings · symmetry {symmetry}×</Text>
      </View>
    </View>
  );
}

// =============================================================================
// STUBS
// =============================================================================
function _pixelArtStub_noop(): void {}
function _extractColorRegions_stub_DISABLED_NOOP(imageUri: string, cols: number, rows: number): Promise<{ palette: string[]; regions: PbnRegion[]; pixelColors: string[] }> { return Promise.resolve({ palette: [], regions: [], pixelColors: [] }); }
function _PixelArtGame_INLINE_DISABLED({ C }: { C: typeof DarkColors }) { return null; }
function _mbUnused(): null { return null; }
async function _mbUnused2(): Promise<null> { return null; }
function _mbUnused3(_sr: number): number[] { return []; }
function _unusedPlaceholder_noop() {}

// =============================================================================
// MEDITATION MODULE COMPONENT
// =============================================================================
function MeditationModule({ C, styles, meditationCategory, setMeditationCategory, onSelectVideo, isPro, freeMeditationCount }: {
  C: typeof DarkColors;
  styles: ReturnType<typeof makeStyles>;
  meditationCategory: MeditationCategory;
  setMeditationCategory: (c: MeditationCategory) => void;
  onSelectVideo: (v: MeditationVideo) => void;
  isPro: boolean;
  freeMeditationCount: number;
}) {
  const filtered = useMemo(() => MEDITATION_VIDEOS.filter(v => meditationCategory === 'all' || v.category === meditationCategory), [meditationCategory]);
  const sessionsLeft = FREE_MEDITATION_LIMIT - freeMeditationCount;
  const isGated = !isPro && freeMeditationCount >= FREE_MEDITATION_LIMIT;
  const CATEGORY_COLORS: Record<MeditationCategory, string> = { all: C.primary, sleep: '#7C83FF', anxiety: '#4ADE80', mindfulness: '#FB923C', focus: '#F59E0B', frequencies: '#A78BFA' };

  return (
    <View style={{ gap: Spacing.lg }}>
      <View style={{ backgroundColor: C.secondary + '12', borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: C.secondary + '30', flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.secondary + '25', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="self-improvement" size={24} color={C.secondary} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any}>Guided Meditation</Text>
          <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: 16, includeFontPadding: false } as any}>{MEDITATION_VIDEOS.length} sessions from world-class teachers · Mood tracked after each session</Text>
        </View>
      </View>

      {!isPro ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
          backgroundColor: isGated ? C.error + '12' : '#F5A623' + '12',
          borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1,
          borderColor: isGated ? C.error + '40' : '#F5A623' + '40',
        }}>
          <MaterialIcons name={isGated ? 'lock' : 'self-improvement'} size={16} color={isGated ? C.error : '#F5A623'} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: Typography.fontSizes.xs, fontWeight: '700', color: isGated ? C.error : '#F5A623', includeFontPadding: false } as any}>
              {isGated ? 'Free sessions used — upgrade to continue' : `${freeMeditationCount} of ${FREE_MEDITATION_LIMIT} free sessions used`}
            </Text>
            <Text style={{ fontSize: 10, color: C.textSecondary, includeFontPadding: false } as any}>
              {isGated ? 'Pro unlocks unlimited guided meditation sessions.' : `${sessionsLeft} session${sessionsLeft !== 1 ? 's' : ''} remaining on the free plan.`}
            </Text>
          </View>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: 2, paddingVertical: 4 }}>
        {MEDITATION_CATEGORIES.map(cat => {
          const active = meditationCategory === cat.key;
          const cc = CATEGORY_COLORS[cat.key];
          return (
            <Pressable key={cat.key} onPress={() => setMeditationCategory(cat.key)}
              style={({ pressed }) => [{ paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: active ? cc : C.border, backgroundColor: active ? cc + '20' : C.surfaceElevated }, pressed && { opacity: 0.75 }]}>
              <Text style={{ fontSize: Typography.fontSizes.xs, fontWeight: '700', color: active ? cc : C.textMuted, includeFontPadding: false } as any}>{cat.emoji} {cat.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.primary + '10', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '30' }}>
        <MaterialIcons name="play-circle-outline" size={16} color={C.primary} />
        <Text style={{ flex: 1, fontSize: Typography.fontSizes.xs, color: C.primary, lineHeight: 16, includeFontPadding: false } as any}>
          {Platform.OS === 'web' ? 'Videos open in an embedded YouTube player. An internet connection is required.' : 'Tap any session to start — video plays inside the app. Mood is tracked automatically when you close.'}
        </Text>
      </View>

      <View style={{ gap: Spacing.md }}>
        {filtered.map(video => {
          const cc = CATEGORY_COLORS[video.category];
          return (
            <Pressable key={video.id} onPress={() => onSelectVideo(video)}
              style={({ pressed }) => [{ backgroundColor: C.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: C.border, gap: Spacing.sm, opacity: isGated ? 0.6 : 1 }, pressed && { opacity: isGated ? 0.45 : 0.85, borderColor: isGated ? C.error + '40' : cc + '60' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }}>
                <View style={{ width: 76, height: 54, borderRadius: Radius.md, backgroundColor: cc + '20', borderWidth: 1, borderColor: cc + '40', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {Platform.OS === 'web' ? (
                    <img src={'https://img.youtube.com/vi/' + video.youtubeId + '/mqdefault.jpg'} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' } as any} />
                  ) : (
                    <Text style={{ fontSize: 26 }}>{video.emoji}</Text>
                  )}
                  <View style={{ position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={isGated ? 'lock' : 'play-arrow'} size={18} color={isGated ? '#F5A623' : '#fff'} />
                  </View>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.textPrimary, includeFontPadding: false } as any} numberOfLines={2}>{video.title}</Text>
                  <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false } as any}>{video.channel}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.border, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 }}>
                      <MaterialIcons name="schedule" size={10} color={C.textMuted} />
                      <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '600', includeFontPadding: false } as any}>{video.duration}</Text>
                    </View>
                    <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: cc + '15', borderWidth: 1, borderColor: cc + '30' }}>
                      <Text style={{ fontSize: 10, color: cc, fontWeight: '700', includeFontPadding: false } as any}>
                        {MEDITATION_CATEGORIES.find(c => c.key === video.category)?.emoji} {MEDITATION_CATEGORIES.find(c => c.key === video.category)?.label}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false } as any} numberOfLines={2}>{video.description}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {video.tags.map(tag => (<View key={tag} style={{ backgroundColor: C.surface, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 }}><Text style={{ fontSize: 9, color: C.textMuted, fontWeight: '600', includeFontPadding: false } as any}>{tag}</Text></View>))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: Spacing.sm }}>
        <MaterialIcons name="info-outline" size={12} color={C.textMuted} />
        <Text style={{ fontSize: 10, color: C.textMuted, includeFontPadding: false } as any}>Content hosted on YouTube · Free to stream · Mood tracked per session</Text>
      </View>
    </View>
  );
}

// =============================================================================
// MEDITATION VIDEO MODAL
// =============================================================================
function MeditationVideoModal({ video, C, onClose }: { video: MeditationVideo; C: typeof DarkColors; onClose: () => void }) {
  const youtubeWatchUrl = 'https://www.youtube.com/watch?v=' + video.youtubeId;
  const CATEGORY_COLORS: Record<MeditationCategory, string> = { all: C.primary, sleep: '#7C83FF', anxiety: '#4ADE80', mindfulness: '#FB923C', focus: '#F59E0B', frequencies: '#A78BFA' };
  const cc = CATEGORY_COLORS[video.category];

  if (Platform.OS === 'web') {
    const embedUrl = 'https://www.youtube.com/embed/' + video.youtubeId + '?autoplay=0&rel=0&playsinline=1&enablejsapi=1&controls=1&origin=https://www.youtube.com';
    const [embedError, setEmbedError] = useState(false);

    return (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: Spacing.xl }}>
        <View style={{ backgroundColor: C.surfaceElevated, borderRadius: Radius.xl, width: '100%', maxWidth: 700, overflow: 'hidden', borderWidth: 1.5, borderColor: cc + '50', ...Shadows.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surfaceElevated }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontSize: Typography.fontSizes.md, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any} numberOfLines={2}>{video.title}</Text>
              <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false } as any}>{video.channel} · {video.duration}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="close" size={22} color={C.textMuted} />
            </Pressable>
          </View>
          <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', position: 'relative' }}>
            {!embedError ? (
              <iframe key={video.youtubeId} src={embedUrl} style={{ width: '100%', height: '100%', border: 'none', display: 'block' } as any} allow="autoplay; encrypted-media; fullscreen; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onError={() => setEmbedError(true)} />
            ) : (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0A0B1E' }}>
                <MaterialIcons name="error-outline" size={32} color={cc} />
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', paddingHorizontal: 24, includeFontPadding: false } as any}>This video cannot be embedded.{'\n'}Open it on YouTube instead.</Text>
                <Pressable onPress={() => { if (typeof window !== 'undefined') window.open(youtubeWatchUrl, '_blank'); }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cc, borderRadius: Radius.lg, paddingHorizontal: 20, paddingVertical: 10 }, pressed && { opacity: 0.85 }]}>
                  <MaterialIcons name="open-in-new" size={16} color="#fff" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff', includeFontPadding: false } as any}>Watch on YouTube</Text>
                </Pressable>
              </View>
            )}
          </View>
          <View style={{ padding: Spacing.lg, gap: Spacing.sm, backgroundColor: C.surfaceElevated }}>
            <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: 16, includeFontPadding: false } as any} numberOfLines={2}>{video.description}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <MaterialIcons name="track-changes" size={12} color={C.primary} />
              <Text style={{ fontSize: 10, color: C.primary, fontWeight: '600', includeFontPadding: false } as any}>Close when done — your mood will be tracked automatically</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ─── Native: WebView loading the full YouTube watch page with embeds_referring_euri
  // spoofed to https://www.youtube.com/ — this is the exact URL format that YouTube's
  // own error page provides as its "Watch video on YouTube" link, which the user
  // confirmed plays inline within the WebView rather than leaving the app.
  // The standard embed URL (youtube.com/embed/...) triggers Error 152 on WKWebView.
  // Loading the full watch page with this referrer parameter bypasses that block.
  const screenWidth = Math.max(1, Dimensions.get('window').width);
  const playerHeight = Math.round(screenWidth * 9 / 16);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);

  // Full YouTube watch URL with embeds_referring_euri set to youtube.com — this is
  // what YouTube generates for its own inline links and bypasses WKWebView restrictions.
  const inlineWatchUrl = 'https://www.youtube.com/watch?v=' + video.youtubeId
    + '&embeds_referring_euri=https%3A%2F%2Fwww.youtube.com%2F'
    + '&source_ve_path=MTc4NDI0';

  const openInYouTube = () => {
    const appUrl = 'vnd.youtube://' + video.youtubeId;
    Linking.canOpenURL(appUrl)
      .then(canOpen => Linking.openURL(canOpen ? appUrl : youtubeWatchUrl))
      .catch(() => Linking.openURL(youtubeWatchUrl).catch(() => {}));
  };

  return (
    <Modal visible animationType="slide" transparent={false} onRequestClose={onClose} statusBarTranslucent={Platform.OS === 'android'}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingTop: 52, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.surfaceElevated, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="arrow-back" size={22} color={C.textMuted} />
          </Pressable>
          <View style={{ flex: 1, gap: 2, justifyContent: 'center' }}>
            <Text style={{ fontSize: Typography.fontSizes.sm, fontWeight: '800', color: C.textPrimary, includeFontPadding: false } as any} numberOfLines={2}>{video.title}</Text>
            <Text style={{ fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false } as any}>{video.channel} · {video.duration}</Text>
          </View>
          <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: cc + '20' }}>
            <Text style={{ fontSize: 10, color: cc, fontWeight: '700', includeFontPadding: false } as any}>{MEDITATION_CATEGORIES.find(c => c.key === video.category)?.emoji} {video.category}</Text>
          </View>
        </View>

        {/* Video player — WebView loading the full YouTube watch page with referrer spoofing */}
        <View style={{ width: screenWidth, height: playerHeight, backgroundColor: '#000' }}>
          {_WebViewComponent ? (
            <_WebViewComponent
              source={{
                uri: inlineWatchUrl,
                headers: { Referer: 'https://www.youtube.com/' },
              }}
              style={{ width: screenWidth, height: playerHeight, backgroundColor: '#000' }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              allowsFullscreenVideo
              originWhitelist={['*']}
              onLoadStart={() => { setWebViewLoading(true); setWebViewError(false); }}
              onLoadEnd={() => setWebViewLoading(false)}
              onError={() => { setWebViewLoading(false); setWebViewError(true); }}
              onHttpError={(e: any) => { if (e?.nativeEvent?.statusCode >= 400) { setWebViewLoading(false); setWebViewError(true); } }}
            />
          ) : null}
          {webViewLoading && !webViewError ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#080910' }}>
              <ActivityIndicator size="large" color={cc} />
            </View>
          ) : null}
          {webViewError ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#080910', gap: 14 }}>
              <MaterialIcons name="play-circle-outline" size={52} color={cc} />
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', paddingHorizontal: 24, includeFontPadding: false } as any}>Could not load video inline.{`\n`}Tap to open in YouTube.</Text>
              <Pressable onPress={openInYouTube} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cc, borderRadius: Radius.lg, paddingHorizontal: 20, paddingVertical: 10 }, pressed && { opacity: 0.85 }]}>
                <MaterialIcons name="play-arrow" size={18} color="#fff" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff', includeFontPadding: false } as any}>Open in YouTube</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Description + tracking info */}
        <ScrollView style={{ flex: 1, backgroundColor: C.background }} contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}>
          <Text style={{ fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: 20, includeFontPadding: false } as any}>{video.description}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {video.tags.map(tag => (<View key={tag} style={{ backgroundColor: C.surfaceElevated, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontSize: 11, color: C.textMuted, fontWeight: '600', includeFontPadding: false } as any}>{tag}</Text></View>))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary + '12', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '30' }}>
            <MaterialIcons name="track-changes" size={14} color={C.primary} />
            <Text style={{ flex: 1, fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '600', includeFontPadding: false } as any}>Tap back when done — your mood will be tracked automatically</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
