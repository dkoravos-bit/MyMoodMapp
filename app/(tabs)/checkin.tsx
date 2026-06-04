/**
 * MyMoodMapp — Log Tab
 *
 * Default view: Today's combined score + timeline of all today's entries.
 * Tap any entry to view full detail. "New Log" starts the 4-step check-in.
 *
 * Steps: body → mind → tag → journal → done (returns to today view)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  PanResponder,
  Dimensions,
  Animated,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

// Recording uses expo-av's Audio.Recording API (stable, proven on iOS 17+)
// expo-audio's useAudioRecorder hook has a known bug producing empty/silent files
// (see github.com/expo/expo/issues/40174 and #41656)
// Playback of the recorded preview uses expo-av's Sound API
let _ExpoAvAudio: any = null;
if (typeof require !== 'undefined') {
  try { _ExpoAvAudio = require('expo-av').Audio; } catch {}
}
import * as FileSystem from 'expo-file-system';
import { Colors, DarkColors, Typography, Spacing, Radius, Shadows, getGlass } from '@/constants/theme';
import { ScoreBubble } from '@/components/ui/GlassCard';
import { useTheme } from '@/contexts/ThemeContext';
import { VibeButton } from '@/components/ui/VibeButton'; // VibeButton kept as component name — internal implementation detail
import {
  CONTEXT_TAGS,
  ContextTag,
  MoodLogEntry,
  getScoreColor,
  getScoreEmoji,
  getScoreLabel,
  calcWellnessScore,
  calcTagWeightDelta,
  getTimeOfDay,
  getTimeOfDayEmoji,
} from '@/constants/moodlog';
import { buildMoodLogEntry, saveMoodLogEntry } from '@/services/moodlog';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateStreak } from '@/services/storage';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useApp } from '@/hooks/useApp';
import { WebMaxWidth } from '@/components/layout/WebLayout';

type Step = 'today' | 'body' | 'mind' | 'tag' | 'journal' | 'done' | 'detail';

const TIME_FORMAT_KEY = 'moodlog_use24hour';

/** Format a stored HH:MM string or epoch timestamp into 12h or 24h display */
function formatTime(timeStr: string | null | undefined, timestamp: number, use24Hour: boolean): string {
  if (!timeStr && !timestamp) return '';
  // Parse from stored HH:MM string if available, else fall back to timestamp
  let hours = 0;
  let minutes = 0;
  if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
    [hours, minutes] = timeStr.split(':').map(Number);
  } else if (timestamp) {
    const d = new Date(timestamp);
    hours = d.getHours();
    minutes = d.getMinutes();
  }
  if (use24Hour) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${period}`;
}

// SW is used as a fallback for slider track width — resolved reactively via onLayout
const SW = Math.max(Dimensions.get('window').width || 375, 320);

// ─── Mood Slider ──────────────────────────────────────────────────────────────
// Uses absolute pageX tracking for 1:1 finger-to-thumb response (no sensitivity
// multiplier). Track width is measured from layout so it always fills the card.

function MoodSlider({
  value, onChange, leftLabel, rightLabel, leftEmoji, rightEmoji, color,
}: {
  value: number; onChange: (v: number) => void;
  leftLabel: string; rightLabel: string;
  leftEmoji: string; rightEmoji: string; color: string;
}) {
  const THUMB = 40;
  const TRACK_PAD = 0; // track fills the full card width via flex

  const trackWrapRef = useRef<View>(null);
  const trackLayout = useRef({ x: 0, width: SW - Spacing.lg * 4 });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  // Animated scale for press feedback
  const thumbScale = useRef(new Animated.Value(1)).current;

  const clampToTrack = (pageX: number): number => {
    const { x, width } = trackLayout.current;
    const RANGE = width - THUMB;
    const local = pageX - x - THUMB / 2;
    const clamped = Math.max(0, Math.min(RANGE, local));
    return (clamped / Math.max(1, RANGE)) * 2 - 1;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (e) => {
        // Re-measure on every touch start for accurate coordinates after scroll
        trackWrapRef.current?.measure((_x, _y, w, _h, pageX) => {
          trackLayout.current = { x: pageX, width: w };
        });
        const raw = clampToTrack(e.nativeEvent.pageX);
        onChangeRef.current(Math.round(raw * 1000) / 1000);
        Animated.spring(thumbScale, { toValue: 1.3, useNativeDriver: true, friction: 5, tension: 300 }).start();
      },
      onPanResponderMove: (e) => {
        // Direct absolute tracking — 1:1 with finger, no lag
        const raw = clampToTrack(e.nativeEvent.pageX);
        onChangeRef.current(Math.round(raw * 1000) / 1000);
      },
      onPanResponderRelease: () => {
        Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 300 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 300 }).start();
      },
    })
  ).current;

  const normalized = (value + 1) / 2;
  const pct = Math.round(normalized * 100);

  return (
    <View style={sliderStyles.container}>
      {/* Centered label row */}
      <View style={sliderStyles.labelsRow}>
        <View style={sliderStyles.endLabel}>
          <Text style={sliderStyles.endEmoji}>{leftEmoji}</Text>
          <Text style={sliderStyles.endText}>{leftLabel}</Text>
        </View>
        <View style={[sliderStyles.centerBadge, { backgroundColor: color + '20', borderColor: color + '60' }]}>
          <Text style={[sliderStyles.centerPct, { color }]}>{pct}%</Text>
        </View>
        <View style={[sliderStyles.endLabel, { alignItems: 'flex-end' }]}>
          <Text style={sliderStyles.endEmoji}>{rightEmoji}</Text>
          <Text style={sliderStyles.endText}>{rightLabel}</Text>
        </View>
      </View>

      {/* Full-width touch area — track measured on layout */}
      <View
        ref={trackWrapRef}
        style={sliderStyles.trackWrap}
        onLayout={(e) => {
          // Immediate measure on layout + cache
          trackWrapRef.current?.measure((_x, _y, w, _h, pageX) => {
            trackLayout.current = { x: pageX, width: e.nativeEvent.layout.width };
          });
        }}
        {...panResponder.panHandlers}
      >
        <View style={sliderStyles.track}>
          <View style={[sliderStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
          <Animated.View style={[
            sliderStyles.thumb,
            {
              left: `${pct}%`,
              marginLeft: -(THUMB / 2),
              borderColor: color,
              backgroundColor: color,
              transform: [{ scale: thumbScale }],
            }
          ]} />
        </View>
      </View>
    </View>
  );
}

function makeSliderStyles(C: typeof DarkColors) {
  return StyleSheet.create({
    container: { gap: Spacing.md },
    labelsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    endLabel: { gap: 2, alignItems: 'flex-start', flex: 1 },
    endEmoji: { fontSize: 24 },
    endText: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    centerBadge: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1.5, alignItems: 'center', minWidth: 68 },
    centerPct: { fontSize: Typography.fontSizes.lg, fontWeight: Typography.fontWeights.bold, includeFontPadding: false },
    trackWrap: { width: '100%', paddingVertical: 18 },
    track: { width: '100%', height: 10, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'visible', position: 'relative' },
    fill: { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: Radius.full },
    thumb: { position: 'absolute', top: -15, width: 40, height: 40, borderRadius: 20, borderWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 8 },
  });
}
let sliderStyles = makeSliderStyles(Colors);

// ─── Mini Slider ──────────────────────────────────────────────────────────────
function MiniSlider({ value, onChange, label, emoji, color }: {
  value: number; onChange: (v: number) => void; label: string; emoji: string; color: string;
}) {
  const THUMB = 30;

  const trackWrapRef = useRef<View>(null);
  const trackLayout = useRef({ x: 0, width: SW - Spacing.lg * 2 - 96 });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const thumbScale = useRef(new Animated.Value(1)).current;

  const clampToTrack = (pageX: number): number => {
    const { x, width } = trackLayout.current;
    const RANGE = width - THUMB;
    const local = pageX - x - THUMB / 2;
    return Math.max(0, Math.min(1, Math.round((Math.max(0, Math.min(RANGE, local)) / Math.max(1, RANGE)) * 1000) / 1000));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (e) => {
        // Re-measure on every touch for accurate coords after scroll
        trackWrapRef.current?.measure((_x, _y, w, _h, pageX) => {
          trackLayout.current = { x: pageX, width: w };
        });
        onChangeRef.current(clampToTrack(e.nativeEvent.pageX));
        Animated.spring(thumbScale, { toValue: 1.3, useNativeDriver: true, friction: 5, tension: 300 }).start();
      },
      onPanResponderMove: (e) => {
        onChangeRef.current(clampToTrack(e.nativeEvent.pageX));
      },
      onPanResponderRelease: () => {
        Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 300 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(thumbScale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 300 }).start();
      },
    })
  ).current;

  const pct = Math.round(value * 100);

  return (
    <View style={miniStyles.row}>
      <Text style={miniStyles.emoji}>{emoji}</Text>
      <Text style={miniStyles.label}>{label}</Text>
      <View
        ref={trackWrapRef}
        style={miniStyles.trackWrap}
        onLayout={(e) => {
          // Immediate measure on layout + cache
          trackWrapRef.current?.measure((_x, _y, w, _h, pageX) => {
            trackLayout.current = { x: pageX, width: e.nativeEvent.layout.width };
          });
        }}
        {...panResponder.panHandlers}
      >
        <View style={miniStyles.track}>
          <View style={[miniStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
          <Animated.View style={[
            miniStyles.thumb,
            { left: `${pct}%`, marginLeft: -(THUMB / 2), borderColor: color, backgroundColor: color, transform: [{ scale: thumbScale }] }
          ]} />
        </View>
      </View>
      <Text style={[miniStyles.pct, { color }]}>{pct}%</Text>
    </View>
  );
}

function makeMiniStyles(C: typeof DarkColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    emoji: { fontSize: 18, width: 22 },
    label: { fontSize: Typography.fontSizes.xs, color: C.textMuted, width: 44, includeFontPadding: false },
    trackWrap: { flex: 1, paddingVertical: 14 },
    track: { width: '100%', height: 8, backgroundColor: C.border, borderRadius: Radius.full, position: 'relative', overflow: 'visible' },
    fill: { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: Radius.full },
    thumb: { position: 'absolute', top: -11, width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
    pct: { fontSize: Typography.fontSizes.xs, fontWeight: '700', width: 34, textAlign: 'right', includeFontPadding: false },
  });
}
let miniStyles = makeMiniStyles(Colors);

// ─── Tag Category Filter ──────────────────────────────────────────────────────
const TAG_CATEGORIES = ['all', 'lifestyle', 'social', 'environment', 'health'] as const;
type TagCategory = typeof TAG_CATEGORIES[number];

// ─── Voice Recorder ───────────────────────────────────────────────────────────
// Uses expo-audio's useAudioRecorder hook (the correct API — not the old class).
// Auto-transcribes immediately when recording stops.
function VoiceRecorder({
  onRecordingComplete,
  onTranscriptReady,
}: {
  onRecordingComplete: (uri: string) => void;
  onTranscriptReady: (text: string) => void;
}) {
  // Web: microphone recording not supported — show note
  if (Platform.OS === 'web') {
    return (
      <View style={[vrStyles.recordBtn, { borderStyle: 'dashed', opacity: 0.65 }]}>
        <MaterialIcons name="mic-off" size={20} color={Colors.textMuted} />
        <Text style={vrStyles.recordBtnText}>Voice recording is only available in the mobile app (iOS/Android)</Text>
      </View>
    );
  }
  return <VoiceRecorderNative onRecordingComplete={onRecordingComplete} onTranscriptReady={onTranscriptReady} />;
}

// Inner component — only rendered on native, so hooks are safe to call
// Uses expo-av Audio.Recording.createAsync() — the proven, stable iOS recording API.
// expo-audio's useAudioRecorder has confirmed bugs producing empty/silent files
// (github.com/expo/expo/issues/40174, #41656). expo-av recording is battle-tested.
function VoiceRecorderNative({
  onRecordingComplete,
  onTranscriptReady,
}: {
  onRecordingComplete: (uri: string) => void;
  onTranscriptReady: (text: string) => void;
}) {
  const [recording, setRecording] = useState<any>(null); // expo-av Recording instance
  const [soundObj, setSoundObj] = useState<any>(null);   // expo-av Sound instance for playback

  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [transcribed, setTranscribed] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  const onTranscriptReadyRef = useRef(onTranscriptReady);
  onRecordingCompleteRef.current = onRecordingComplete;
  onTranscriptReadyRef.current = onTranscriptReady;

  useEffect(() => {
    return () => {
      if (soundObj) { try { soundObj.unloadAsync?.(); } catch {} }
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, [soundObj]);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };
  const stopPulse = () => { pulseAnim.stopAnimation(); pulseAnim.setValue(1); };

  const runTranscription = async (uri: string) => {
    if (!uri) return;
    setTranscribing(true);
    setTranscribeError(null);
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error('Audio file not found after recording.');
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      if (!base64 || base64.length < 50) throw new Error('Recording appears empty — try speaking closer to the mic.');
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
      const mimeMap: Record<string, string> = { m4a: 'audio/m4a', mp4: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac', caf: 'audio/x-caf', ogg: 'audio/ogg', webm: 'audio/webm' };
      const mimeType = mimeMap[ext] ?? 'audio/m4a';
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('transcribe-voice', { body: { audioBase64: base64, mimeType } });
      if (error) {
        let msg = error.message ?? 'Transcription failed';
        if (error instanceof FunctionsHttpError) {
          try { const statusCode = error.context?.status ?? 500; const txt = await error.context?.text(); msg = `[${statusCode}] ${txt ?? msg}`; } catch {}
        }
        throw new Error(msg);
      }
      const transcript: string = data?.transcript ?? '';
      if (transcript.trim()) { setTranscribed(true); onTranscriptReadyRef.current(transcript.trim()); }
      else setTranscribeError('No speech detected. Try speaking again.');
    } catch (e: any) {
      console.error('[VoiceRecorder] transcription error:', e);
      setTranscribeError(e?.message ?? String(e));
    } finally { setTranscribing(false); }
  };

  // If expo-av is unavailable, show disabled state
  if (!_ExpoAvAudio) {
    return (
      <View style={[vrStyles.recordBtn, { borderStyle: 'dashed', opacity: 0.65 }]}>
        <MaterialIcons name="mic-off" size={20} color={Colors.textMuted} />
        <Text style={vrStyles.recordBtnText}>Voice recording unavailable — update the app to enable this feature</Text>
      </View>
    );
  }

  const startRecording = async () => {
    try {
      setPermError(null);
      // Step 1: Request microphone permission via expo-av
      const { granted } = await _ExpoAvAudio.requestPermissionsAsync();
      if (!granted) {
        setPermError('Microphone permission denied. Enable it in Settings → Privacy → Microphone.');
        return;
      }
      // Step 2: Unload any previous sound
      if (soundObj) { try { await soundObj.unloadAsync?.(); } catch {} setSoundObj(null); }
      setRecordedUri(null); setDuration(0); setTranscribeError(null); setTranscribed(false);
      // Step 3: Configure audio session for RECORDING via expo-av
      // setAudioModeAsync with allowsRecordingIOS:true routes the iOS AVAudioSession
      // to PlayAndRecord category, which activates the microphone input.
      // This is the ONLY reliable way — no manual AudioSession.setCategory needed.
      await _ExpoAvAudio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      // Step 4: Create and start the recording in one atomic call
      // createAsync handles prepareToRecord + record internally — no race conditions
      const { recording: rec } = await _ExpoAvAudio.Recording.createAsync(
        _ExpoAvAudio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
      startPulse();
      durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (e: any) {
      console.error('[VoiceRecorder] startRecording error:', e);
      setTranscribeError('Could not start recording — ' + (e?.message ?? 'check microphone permissions'));
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      stopPulse();
      setIsRecording(false);
      if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
      // Stop and unload the recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI() ?? '';
      setRecording(null);
      // Restore audio session to PLAYBACK mode so Mood Lab sounds work
      try {
        await _ExpoAvAudio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
      } catch {}
      // Also restore via expo-audio's AudioSession for the soundLab player
      try {
        const ea = require('expo-audio');
        if (ea?.AudioSession?.setCategory) await ea.AudioSession.setCategory('Playback');
        if (ea?.AudioSession?.setActive) await ea.AudioSession.setActive(true);
      } catch {}
      if (uri) {
        setRecordedUri(uri);
        onRecordingCompleteRef.current(uri);
        await runTranscription(uri);
      } else {
        setTranscribeError('Recording failed — no audio file was created. Try again.');
      }
    } catch (e: any) {
      console.error('[VoiceRecorder] stopRecording error:', e);
      setTranscribeError('Recording stopped unexpectedly: ' + (e?.message ?? 'unknown error'));
      setIsRecording(false);
    }
  };

  const togglePlayback = async () => {
    if (!recordedUri) return;
    if (soundObj) {
      if (isPlaying) {
        try { await soundObj.pauseAsync?.(); } catch {}
        setIsPlaying(false);
      } else {
        try { await soundObj.playAsync?.(); } catch {}
        setIsPlaying(true);
      }
      return;
    }
    try {
      if (!_ExpoAvAudio) return;
      const { sound } = await _ExpoAvAudio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true },
        (status: any) => { if (status.didJustFinish) setIsPlaying(false); }
      );
      setSoundObj(sound);
      setIsPlaying(true);
    } catch (e) { console.error('[VoiceRecorder] playback error:', e); }
  };

  const handleRetryTranscription = async () => { if (!recordedUri) return; setTranscribed(false); await runTranscription(recordedUri); };
  const handleDiscard = () => {
    if (soundObj) { try { soundObj.unloadAsync?.(); } catch {} }
    setSoundObj(null); setTranscribed(false); setTranscribeError(null); setIsPlaying(false); setRecordedUri(null); setDuration(0);
  };
  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (permError) {
    return (
      <View style={[vrStyles.recordBtn, { borderStyle: 'solid', borderColor: Colors.error + '60' }]}>
        <MaterialIcons name="mic-off" size={20} color={Colors.error} />
        <Text style={[vrStyles.recordBtnText, { color: Colors.error }]}>{permError}</Text>
      </View>
    );
  }

  if (recordedUri) {
    return (
      <View style={vrStyles.playbackCard}>
        <View style={vrStyles.playbackRow}>
          <Pressable onPress={togglePlayback} disabled={transcribing} style={({ pressed }) => [vrStyles.playBtn, pressed && { opacity: 0.8 }]}>
            <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={22} color={Colors.primary} />
          </Pressable>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={vrStyles.playbackLabel}>Voice memo · {fmtDur(duration)}</Text>
            {transcribing ? <Text style={vrStyles.playbackDuration}>Transcribing...</Text>
              : transcribed ? <Text style={[vrStyles.playbackDuration, { color: Colors.success }]}>Added to journal ✓</Text>
              : null}
          </View>
          <Pressable onPress={handleDiscard} hitSlop={8} disabled={transcribing}>
            <MaterialIcons name="close" size={18} color={Colors.textMuted} />
          </Pressable>
        </View>
        <View style={vrStyles.waveRow}>
          {Array.from({ length: 24 }, (_, i) => (
            <View key={i} style={[vrStyles.waveDot, { height: 4 + Math.sin(i * 0.8) * 8 + (i * 3) % 7, backgroundColor: transcribed ? Colors.success + '60' : Colors.primary + '60' }]} />
          ))}
        </View>
        <View style={vrStyles.actionsRow}>
          {transcribing ? (
            <View style={vrStyles.transcribingRow}><ActivityIndicator size="small" color={Colors.primary} /><Text style={vrStyles.transcribingText}>Transcribing with AI...</Text></View>
          ) : transcribed ? (
            <View style={vrStyles.successRow}><MaterialIcons name="check-circle" size={14} color={Colors.success} /><Text style={vrStyles.successText}>Transcript added to your journal entry</Text></View>
          ) : transcribeError ? (
            <View style={vrStyles.errorRow}>
              <MaterialIcons name="error-outline" size={13} color={Colors.error} />
              <Text style={vrStyles.transcribeError}>{transcribeError}</Text>
              <Pressable onPress={handleRetryTranscription} style={({ pressed }) => [vrStyles.retryBtn, pressed && { opacity: 0.8 }]}>
                <Text style={vrStyles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={isRecording ? stopRecording : startRecording}
      style={({ pressed }) => [vrStyles.recordBtn, isRecording && vrStyles.recordBtnActive, pressed && { opacity: 0.85 }]}
    >
      {isRecording ? (
        <React.Fragment>
          <Animated.View style={[vrStyles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
          <MaterialIcons name="stop" size={22} color="#FF6B6B" />
          <View style={{ gap: 1 }}>
            <Text style={vrStyles.recordBtnText}>Tap to stop · auto-transcribes</Text>
            <Text style={vrStyles.recordBtnDuration}>{fmtDur(duration)}</Text>
          </View>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <MaterialIcons name="mic" size={22} color={Colors.textMuted} />
          <Text style={vrStyles.recordBtnText}>Tap to record voice journal</Text>
        </React.Fragment>
      )}
    </Pressable>
  );
}

function makeVrStyles(C: typeof DarkColors) {
  return StyleSheet.create({
    recordBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', minHeight: 60 },
    recordBtnActive: { borderColor: '#FF6B6B', backgroundColor: '#FF6B6B10', borderStyle: 'solid' },
    recordBtnText: { fontSize: Typography.fontSizes.sm, color: C.textMuted, includeFontPadding: false },
    recordBtnDuration: { fontSize: Typography.fontSizes.xs, color: '#FF6B6B', fontWeight: '700', includeFontPadding: false },
    pulseRing: { position: 'absolute', left: 10, width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#FF6B6B40' },
    playbackCard: { backgroundColor: C.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '40', gap: Spacing.sm },
    playbackRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    playbackLabel: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    playbackDuration: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.primary, includeFontPadding: false },
    waveRow: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 20, overflow: 'hidden' },
    waveDot: { width: 3, borderRadius: 2 },
    actionsRow: { gap: Spacing.xs },
    transcribingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    transcribingText: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    successRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    successText: { fontSize: Typography.fontSizes.xs, color: C.success, fontWeight: '600', includeFontPadding: false },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
    transcribeError: { flex: 1, fontSize: Typography.fontSizes.xs, color: C.error, includeFontPadding: false },
    retryBtn: { backgroundColor: C.primarySoft, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: C.primary + '40' },
    retryBtnText: { fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '700', includeFontPadding: false },
  });
}
let vrStyles = makeVrStyles(Colors);

// ─── Dimension Bar ────────────────────────────────────────────────────────────
function DimBar({ label, value, leftEmoji, rightEmoji, color }: {
  label: string; value: number; leftEmoji: string; rightEmoji: string; color: string;
}) {
  return (
    <View style={dbStyles.row}>
      <Text style={dbStyles.emoji}>{leftEmoji}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={dbStyles.trackRow}>
          <View style={dbStyles.track}>
            <View style={[dbStyles.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: color }]} />
          </View>
          <Text style={[dbStyles.pct, { color }]}>{Math.round(value * 100)}%</Text>
        </View>
        <Text style={dbStyles.label}>{label}</Text>
      </View>
      <Text style={dbStyles.emoji}>{rightEmoji}</Text>
    </View>
  );
}

function makeDbStyles(C: typeof DarkColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    emoji: { fontSize: 16, width: 20, textAlign: 'center' },
    trackRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    track: { flex: 1, height: 8, backgroundColor: C.border, borderRadius: Radius.full, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: Radius.full },
    pct: { fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right', includeFontPadding: false },
    label: { fontSize: 10, color: C.textMuted, includeFontPadding: false },
  });
}
let dbStyles = makeDbStyles(Colors);

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={siStyles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[siStyles.dot, i + 1 === current && siStyles.dotActive, i + 1 < current && siStyles.dotDone]} />
      ))}
      <Text style={siStyles.text}>{current}/{total}</Text>
    </View>
  );
}

function makeSiStyles(C: typeof DarkColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xl },
    dot: { width: 28, height: 4, borderRadius: 2, backgroundColor: C.border },
    dotActive: { backgroundColor: C.primary, width: 40 },
    dotDone: { backgroundColor: C.primary + '60' },
    text: { fontSize: Typography.fontSizes.xs, color: C.textMuted, marginLeft: 4, includeFontPadding: false },
  });
}
let siStyles = makeSiStyles(Colors);

function makeCheckinStyles(C: typeof DarkColors, isDark = true) {
  const G = getGlass(isDark);
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.background },
    scroll: { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing['3xl'] },
    todayHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.xl },
    todayDateLabel: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    todayPageTitle: { fontSize: Typography.fontSizes['2xl'], fontWeight: Typography.fontWeights.bold, color: C.textPrimary, includeFontPadding: false },
    todayHeaderRight: { alignItems: 'flex-end', gap: 4 },
    entryCountBadge: { backgroundColor: C.primarySoft, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: C.primary + '40' },
    entryCountText: { fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '700', includeFontPadding: false },
    timeFormatToggle: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.primarySoft, paddingHorizontal: 9, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, borderColor: C.primary + '40', minHeight: 28 },
    timeFormatToggleText: { fontSize: 11, color: C.primary, fontWeight: '700', includeFontPadding: false },
    combinedCard: { flexDirection: 'row', gap: Spacing.lg, backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, marginBottom: Spacing.lg, ...Shadows.sm, alignItems: 'center', overflow: 'visible' },
    combinedScoreCircle: { width: 84, height: 84, borderRadius: Radius.xl, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', gap: 1, flexShrink: 0 },
    combinedEmoji: { fontSize: 24 },
    combinedScoreNum: { fontSize: 26, fontWeight: '900', includeFontPadding: false },
    combinedScoreLabel: { fontSize: 10, fontWeight: '700', includeFontPadding: false },
    combinedRight: { flex: 1, gap: Spacing.xs, justifyContent: 'center' },
    combinedTitle: { fontSize: Typography.fontSizes.sm, fontWeight: Typography.fontWeights.semibold, color: C.textPrimary, includeFontPadding: false },
    combinedSub: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    combinedDims: { gap: 4, marginTop: 2 },
    emptyCard: { backgroundColor: G.cardBgLight, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: G.cardBorderLight, marginBottom: Spacing.lg },
    emptyEmoji: { fontSize: 40 },
    emptyTitle: { fontSize: Typography.fontSizes.lg, fontWeight: '700', color: C.textPrimary, includeFontPadding: false },
    emptySub: { fontSize: Typography.fontSizes.sm, color: C.textMuted, textAlign: 'center', includeFontPadding: false },
    newLogBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.primary, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.xl, ...Shadows.sm },
    newLogIconWrap: { width: 40, height: 40, borderRadius: Radius.lg, backgroundColor: 'rgba(8,9,26,0.18)', alignItems: 'center', justifyContent: 'center' },
    newLogTitle: { fontSize: Typography.fontSizes.md, fontWeight: Typography.fontWeights.bold, color: '#08091A', includeFontPadding: false },
    newLogSub: { fontSize: Typography.fontSizes.xs, color: 'rgba(8,9,26,0.6)', includeFontPadding: false },
    timelineSection: { marginBottom: Spacing.xl },
    timelineSectionTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.lg, includeFontPadding: false },
    timeline: { gap: 0 },
    timelineItem: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
    timelineLeft: { alignItems: 'center', width: 44, paddingTop: 14 },
    timelineTime: { fontSize: 10, color: C.textMuted, fontWeight: '600', includeFontPadding: false, marginBottom: 4 },
    timelineDot: { width: 10, height: 10, borderRadius: 5, zIndex: 1 },
    timelineLine: { width: 2, flex: 1, backgroundColor: C.border, marginTop: 4 },
    timelineCard: { flex: 1, backgroundColor: G.cardBgLight, borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
    timelineCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    timelineScore: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
    timelineScoreEmoji: { fontSize: 12 },
    timelineScoreNum: { fontSize: Typography.fontSizes.sm, fontWeight: '900', includeFontPadding: false },
    timelineTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
    timelineTagEmoji: { fontSize: 12 },
    timelineTagLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '600', includeFontPadding: false },
    timelineIndicators: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    timelineDims: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    timelineJournalPreview: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, fontStyle: 'italic', lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
    timelineExtraTags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
    timelineExtraTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
    timelineExtraTagText: { fontSize: 10, fontWeight: '600', includeFontPadding: false },
    hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingHorizontal: Spacing.sm },
    hintText: { flex: 1, fontSize: 10, color: C.textMuted, lineHeight: 14, includeFontPadding: false },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.lg, minHeight: 36 },
    backBtnText: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, includeFontPadding: false },
    detailHero: { flexDirection: 'row', gap: Spacing.lg, backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, marginBottom: Spacing.xl, alignItems: 'center', overflow: 'visible' }, // already visible
    detailScoreCircle: { width: 88, height: 88, borderRadius: Radius.xl, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0 },
    detailScoreEmoji: { fontSize: 26 },
    detailScoreNum: { fontSize: 28, fontWeight: '900', includeFontPadding: false },
    detailScoreLabel: { fontSize: 10, fontWeight: '700', includeFontPadding: false },
    detailHeroRight: { flex: 1, gap: Spacing.xs },
    detailTime: { fontSize: Typography.fontSizes['2xl'], fontWeight: '900', color: C.textPrimary, includeFontPadding: false },
    detailDate: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    detailTodBadge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full },
    detailTodText: { fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '600', includeFontPadding: false },
    detailSection: { marginBottom: Spacing.xl, gap: Spacing.md },
    detailSectionTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
    detailSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    detailDimCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, gap: Spacing.md },
    detailTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    detailTag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1 },
    detailTagEmoji: { fontSize: 20 },
    detailTagLabel: { fontSize: Typography.fontSizes.sm, fontWeight: '700', includeFontPadding: false },
    detailTagPrimary: { fontSize: 9, color: C.textMuted, includeFontPadding: false },
    detailJournalCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder },
    detailJournalText: { fontSize: Typography.fontSizes.sm, color: C.textPrimary, lineHeight: Typography.fontSizes.sm * 1.7, includeFontPadding: false },
    detailNoteCard: { backgroundColor: C.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.border },
    detailNoteText: { fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false },
    detailLogAgainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: C.primarySoft, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: C.primary + '40' },
    detailLogAgainText: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: C.primary, includeFontPadding: false },
    stepHeader: { marginBottom: Spacing.sm },
    stepTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: Spacing.sm },
    timeChip: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    bigQ: { fontSize: 28, fontWeight: Typography.fontWeights.bold, color: C.textPrimary, lineHeight: 36, marginBottom: Spacing.xs, includeFontPadding: false },
    bigQSub: { fontSize: Typography.fontSizes.sm, color: C.textMuted, marginBottom: Spacing.xl, includeFontPadding: false },
    sliderCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, marginBottom: Spacing.lg, ...Shadows.sm },
    miniSliderCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, marginBottom: Spacing.lg, gap: Spacing.md, ...Shadows.sm },
    scorePill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.full, borderWidth: 1.5, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, alignSelf: 'center' },
    scorePillNum: { fontSize: Typography.fontSizes.xl, fontWeight: Typography.fontWeights.bold, includeFontPadding: false },
    scorePillLabel: { fontSize: Typography.fontSizes.sm, fontWeight: Typography.fontWeights.medium, includeFontPadding: false },
    aiEmotionCard: { backgroundColor: C.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1.5, borderColor: C.primary + '40', gap: Spacing.sm },
    aiEmotionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    aiLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.success + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, borderColor: C.success + '35' },
    aiLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
    aiLiveBadgeText: { fontSize: 10, fontWeight: '700', color: C.success, includeFontPadding: false },
    aiEmotionTime: { fontSize: 10, color: C.textMuted, includeFontPadding: false },
    aiEmotionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    aiEmotionEmoji: { fontSize: 32 },
    aiEmotionName: { fontSize: Typography.fontSizes.md, fontWeight: '700', includeFontPadding: false },
    aiEmotionConf: { fontSize: 10, color: C.textMuted, backgroundColor: C.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, includeFontPadding: false },
    aiEmotionMeta: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false },
    aiApplyBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.primarySoft, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: C.primary + '40', minHeight: 44 },
    aiApplyBtnText: { flex: 1, fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.primary, includeFontPadding: false },
    aiAppliedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xs },
    aiAppliedText: { flex: 1, fontSize: Typography.fontSizes.xs, color: C.success, fontWeight: '600', includeFontPadding: false },
    aiEmotionOffCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.border, opacity: 0.7 },
    aiEmotionOffText: { flex: 1, fontSize: Typography.fontSizes.xs, color: C.textMuted, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
    aiEmotionWarmCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.primarySoft, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '40' },
    aiEmotionWarmTitle: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: C.primary, includeFontPadding: false },
    aiEmotionWarmSub: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false },
    detailAiCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: C.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '30' },
    detailAiEmoji: { fontSize: 32, width: 40, textAlign: 'center' },
    detailAiEmotion: { fontSize: Typography.fontSizes.md, fontWeight: '700', includeFontPadding: false },
    detailAiMeta: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, includeFontPadding: false },
    detailAiNotes: { fontSize: Typography.fontSizes.xs, color: C.textMuted, fontStyle: 'italic', lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
    catScroll: { marginBottom: Spacing.md },
    catContent: { gap: Spacing.sm, paddingHorizontal: 2, paddingVertical: 4 },
    catChip: { paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border },
    catChipActive: { backgroundColor: C.primarySoft, borderColor: C.primary },
    catChipText: { fontSize: Typography.fontSizes.xs, color: C.textMuted, includeFontPadding: false },
    catChipTextActive: { color: C.primary, fontWeight: '700' },
    tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
    tagCard: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.lg, alignItems: 'center', gap: 2, minWidth: 88, flexGrow: 1 },
    tagEmoji: { fontSize: 20 },
    tagLabel: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, textAlign: 'center', includeFontPadding: false },
    weightBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: Radius.full, borderWidth: 1, marginTop: 1 },
    weightBadgeText: { fontSize: 8, fontWeight: '800', includeFontPadding: false },
    primaryBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: Radius.full, marginTop: 1 },
    primaryBadgeText: { fontSize: 8, color: '#fff', fontWeight: '700', includeFontPadding: false },
    scoreImpactCard: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, marginBottom: Spacing.sm, gap: 2 },
    selectedSummary: { gap: Spacing.sm, marginBottom: Spacing.md },
    selectedSummaryLabel: { fontSize: Typography.fontSizes.xs, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, includeFontPadding: false },
    selectedTagsList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    selectedTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1 },
    selectedTagText: { fontSize: Typography.fontSizes.xs, fontWeight: '600', includeFontPadding: false },
    journalCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, borderWidth: 1, borderColor: G.cardBorder, marginBottom: Spacing.lg, overflow: 'hidden' },
    journalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: C.border },
    journalHeaderText: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: C.textPrimary, flex: 1, includeFontPadding: false },
    journalHeaderSub: { fontSize: 10, color: C.textMuted, includeFontPadding: false },
    wordCount: { fontSize: 10, color: C.textMuted, includeFontPadding: false },
    journalInput: { padding: Spacing.lg, color: C.textPrimary, fontSize: Typography.fontSizes.md, minHeight: 140, textAlignVertical: 'top', lineHeight: Typography.fontSizes.md * 1.7 },
    transcriptPreview: { backgroundColor: C.primarySoft, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: C.primary + '30', marginBottom: Spacing.lg, gap: Spacing.xs },
    transcriptHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    transcriptHeaderText: { fontSize: Typography.fontSizes.xs, color: C.primary, fontWeight: '600', includeFontPadding: false },
    transcriptText: { fontSize: Typography.fontSizes.xs, color: C.textSecondary, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
    promptsCard: { backgroundColor: G.cardBg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: G.cardBorder, marginBottom: Spacing.lg, gap: Spacing.sm },
    promptsTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, includeFontPadding: false },
    promptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.xs },
    promptEmoji: { fontSize: 14 },
    promptText: { flex: 1, fontSize: Typography.fontSizes.sm, color: C.textSecondary, lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
    footer: { padding: Spacing.lg, paddingBottom: Spacing.xl },
    footerRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
    backIconBtn: { width: 52, height: 52, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CheckinScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const { isDark } = useTheme();
  const styles = React.useMemo(() => {
    // Rebuild all sub-component styles with current theme
    sliderStyles = makeSliderStyles(C);
    miniStyles = makeMiniStyles(C);
    vrStyles = makeVrStyles(C);
    dbStyles = makeDbStyles(C);
    siStyles = makeSiStyles(C);
    return makeCheckinStyles(C, isDark);
  }, [C, isDark]);
  const {
    setStreak, setMoodLogEntries, moodLogEntries, todayMoodLogEntries,
  } = useApp();

  const [step, setStep] = useState<Step>('today');
  const [use24Hour, setUse24Hour] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<MoodLogEntry | null>(null);

  // Check-in form state
  const [bodyWeight, setBodyWeight] = useState(0);
  const [bodyTension, setBodyTension] = useState(0);
  const [bodyEase, setBodyEase] = useState(0);
  const [mind, setMind] = useState(0);
  const [energy, setEnergy] = useState(0.5);
  const [focus, setFocus] = useState(0.5);
  const [primaryTag, setPrimaryTag] = useState<string | null>(null);
  const [additionalTags, setAdditionalTags] = useState<string[]>([]);
  const [journalText, setJournalText] = useState('');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load persisted time format preference
  useEffect(() => {
    AsyncStorage.getItem(TIME_FORMAT_KEY).then(val => {
      if (val !== null) setUse24Hour(val === '1');
    });
  }, []);

  const toggleTimeFormat = useCallback(async () => {
    setUse24Hour(prev => {
      const next = !prev;
      AsyncStorage.setItem(TIME_FORMAT_KEY, next ? '1' : '0');
      return next;
    });
  }, []);
  const [tagCategory, setTagCategory] = useState<TagCategory>('all');

  const timeOfDay = getTimeOfDay();

  // Derived body score — average of the 3 physical sliders
  const body = (bodyWeight + bodyTension + bodyEase) / 3;

  // Score includes tag weights — primary tag full weight, additional tags half weight
  const selectedTagIds = [primaryTag, ...additionalTags].filter(Boolean) as string[];
  const score = calcWellnessScore({ body, mind, energy, focus }, selectedTagIds);
  const baseScore = calcWellnessScore({ body, mind, energy, focus });
  const tagDelta = calcTagWeightDelta(selectedTagIds);
  const scoreColor = getScoreColor(score);

  const visibleTags = tagCategory === 'all'
    ? CONTEXT_TAGS
    : CONTEXT_TAGS.filter(t => t.category === tagCategory);

  const MAX_ADDITIONAL = 5;
  const toggleAdditionalTag = (id: string) => {
    if (additionalTags.includes(id)) {
      setAdditionalTags(additionalTags.filter(t => t !== id));
    } else if (additionalTags.length < MAX_ADDITIONAL) {
      setAdditionalTags([...additionalTags, id]);
    }
  };

  const handleTranscriptReady = (text: string) => {
    setTranscript(text);
    setJournalText(prev => prev ? `${prev}\n\n${text}` : text);
  };

  const resetForm = () => {
    setBodyWeight(0); setBodyTension(0); setBodyEase(0);
    setMind(0); setEnergy(0.5); setFocus(0.5);
    setPrimaryTag(null); setAdditionalTags([]);
    setJournalText(''); setAudioUri(null); setTranscript(null);
    setTagCategory('all');
  };

  const handleSave = async () => {
    if (!primaryTag) return;
    setSaving(true);
    const combinedNote = journalText.trim();
    const entry = buildMoodLogEntry(
      { body, mind, energy, focus },
      primaryTag,
      additionalTags,
      combinedNote,
    );
    const enrichedEntry = {
      ...entry,
      journalText: combinedNote || undefined,
      audioUri: audioUri ?? undefined,
      transcript: transcript ?? undefined,
    };
    const updated = await saveMoodLogEntry(enrichedEntry as any);
    const newStreak = await updateStreak();
    setMoodLogEntries(updated);
    setStreak(newStreak);
    setSaving(false);
    resetForm();
    setStep('today');
  };

  // ── TODAY VIEW ────────────────────────────────────────────────────────────────
  if (step === 'today') {
    // Combined daily score = average of all today's entries
    const todayEntries = [...todayMoodLogEntries].sort((a, b) => b.timestamp - a.timestamp);
    const combinedScore = todayEntries.length
      ? Math.round(todayEntries.reduce((s, e) => s + e.score, 0) / todayEntries.length)
      : null;
    const combinedColor = combinedScore !== null ? getScoreColor(combinedScore) : Colors.primary;

    // Combined dimension averages
    const combinedBody = todayEntries.length
      ? todayEntries.reduce((s, e) => s + e.dimensions.body, 0) / todayEntries.length
      : null;
    const combinedMind = todayEntries.length
      ? todayEntries.reduce((s, e) => s + e.dimensions.mind, 0) / todayEntries.length
      : null;
    const combinedEnergy = todayEntries.length
      ? todayEntries.reduce((s, e) => s + e.dimensions.energy, 0) / todayEntries.length
      : null;
    const combinedFocus = todayEntries.length
      ? todayEntries.reduce((s, e) => s + e.dimensions.focus, 0) / todayEntries.length
      : null;

    const today = new Date();
    const dateLabel = today.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <WebMaxWidth>
          {/* Header */}
          <View style={styles.todayHeader}>
            <View>
              <Text style={styles.todayDateLabel}>{dateLabel}</Text>
              <Text style={styles.todayPageTitle}>Today's Log</Text>
            </View>
            <View style={styles.todayHeaderRight}>
              {/* 12/24h toggle */}
              <Pressable
                onPress={toggleTimeFormat}
                style={({ pressed }) => [styles.timeFormatToggle, pressed && { opacity: 0.75 }]}
                accessibilityLabel={use24Hour ? 'Switch to 12-hour time' : 'Switch to 24-hour time'}
              >
                <Text style={styles.timeFormatToggleText}>{use24Hour ? '24h' : '12h'}</Text>
                <MaterialIcons name="swap-horiz" size={13} color={Colors.primary} />
              </Pressable>
              {todayEntries.length > 0 ? (
                <View style={styles.entryCountBadge}>
                  <Text style={styles.entryCountText}>{todayEntries.length} {todayEntries.length === 1 ? 'entry' : 'entries'}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Combined Score Card */}
          {combinedScore !== null ? (
            <View style={[styles.combinedCard, { borderColor: combinedColor + '50' }]}>
              <ScoreBubble
                score={combinedScore}
                emoji={getScoreEmoji(combinedScore)}
                label={getScoreLabel(combinedScore)}
                size="large"
              />
              <View style={styles.combinedRight}>
                <Text style={styles.combinedTitle}>Combined score</Text>
                <Text style={styles.combinedSub}>Average of {todayEntries.length} {todayEntries.length === 1 ? 'entry' : 'entries'} today</Text>
                {combinedBody !== null ? (
                  <View style={styles.combinedDims}>
                    <MiniDimChip label="Body" value={(combinedBody + 1) / 2} color={Colors.primary} />
                    <MiniDimChip label="Mind" value={(combinedMind! + 1) / 2} color={Colors.secondary} />
                    <MiniDimChip label="Energy" value={combinedEnergy!} color={Colors.success} />
                    <MiniDimChip label="Focus" value={combinedFocus!} color={Colors.warning} />
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            // No entries yet — empty state
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>{getTimeOfDayEmoji(timeOfDay)}</Text>
              <Text style={styles.emptyTitle}>No entries yet today</Text>
              <Text style={styles.emptySub}>Log how you're feeling — takes about 8 seconds</Text>
            </View>
          )}

          {/* New Entry CTA */}
          <Pressable
            onPress={() => { resetForm(); setStep('body'); }}
            style={({ pressed }) => [styles.newLogBtn, pressed && { opacity: 0.88 }]}
          >
            <View style={styles.newLogIconWrap}>
              <MaterialIcons name="add" size={22} color="#08091A" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.newLogTitle}>New entry</Text>
              <Text style={styles.newLogSub}>Body · mind · context · journal</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={18} color="#08091A" />
          </Pressable>

          {/* Timeline */}
          {todayEntries.length > 0 ? (
            <View style={styles.timelineSection}>
              <Text style={styles.timelineSectionTitle}>Today's entries</Text>
              <View style={styles.timeline}>
                {todayEntries.map((entry, index) => {
                  const tag = CONTEXT_TAGS.find(t => t.id === entry.primaryTag);
                  const eColor = getScoreColor(entry.score);
                  const isLast = index === todayEntries.length - 1;

                  return (
                    <Pressable
                      key={entry.id}
                      onPress={() => { setSelectedEntry(entry); setStep('detail'); }}
                      style={({ pressed }) => [styles.timelineItem, pressed && { opacity: 0.82 }]}
                    >
                      {/* Time column */}
                      <View style={styles.timelineLeft}>
                        <Text style={styles.timelineTime}>{formatTime(entry.time, entry.timestamp, use24Hour)}</Text>
                        <View style={[styles.timelineDot, { backgroundColor: eColor }]} />
                        {!isLast ? <View style={styles.timelineLine} /> : null}
                      </View>

                      {/* Entry card */}
                      <View style={[styles.timelineCard, { borderColor: eColor + '30' }]}>
                        <View style={styles.timelineCardTop}>
                          {/* Score badge */}
                          <View style={[styles.timelineScore, { backgroundColor: eColor + '18', borderColor: eColor + '40' }]}>
                            <Text style={styles.timelineScoreEmoji}>{getScoreEmoji(entry.score)}</Text>
                            <Text style={[styles.timelineScoreNum, { color: eColor }]}>{entry.score}</Text>
                          </View>

                          {/* Tag */}
                          {tag ? (
                            <View style={[styles.timelineTag, { backgroundColor: tag.color + '15' }]}>
                              <Text style={styles.timelineTagEmoji}>{tag.emoji}</Text>
                              <Text style={[styles.timelineTagLabel, { color: tag.color }]}>{tag.label}</Text>
                            </View>
                          ) : null}

                          <View style={{ flex: 1 }} />

                          {/* Indicators */}
                          <View style={styles.timelineIndicators}>
                            {entry.journalText ? <MaterialIcons name="edit-note" size={14} color={Colors.secondary} /> : null}
                            {(entry as any).audioUri ? <MaterialIcons name="mic" size={14} color={Colors.primary} /> : null}
                            {/* selfieUri field is legacy — voice/journal indicators only */}
                          </View>

                          <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
                        </View>

                        {/* Dimension mini bars */}
                        <View style={styles.timelineDims}>
                          <TimelineDimBar value={(entry.dimensions.body + 1) / 2} color={Colors.primary} label="B" />
                          <TimelineDimBar value={(entry.dimensions.mind + 1) / 2} color={Colors.secondary} label="M" />
                          <TimelineDimBar value={entry.dimensions.energy} color={Colors.success} label="E" />
                          <TimelineDimBar value={entry.dimensions.focus} color={Colors.warning} label="F" />
                        </View>

                        {/* Journal preview */}
                        {entry.journalText ? (
                          <Text style={styles.timelineJournalPreview} numberOfLines={2}>
                            "{entry.journalText}"
                          </Text>
                        ) : null}

                        {/* Additional tags */}
                        {entry.additionalTags.length > 0 ? (
                          <View style={styles.timelineExtraTags}>
                            {entry.additionalTags.slice(0, 3).map(tid => {
                              const t = CONTEXT_TAGS.find(x => x.id === tid);
                              return t ? (
                                <View key={tid} style={[styles.timelineExtraTag, { backgroundColor: t.color + '15', borderColor: t.color + '30' }]}>
                                  <Text style={{ fontSize: 10 }}>{t.emoji}</Text>
                                  <Text style={[styles.timelineExtraTagText, { color: t.color }]}>{t.label}</Text>
                                </View>
                              ) : null;
                            })}
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Hint */}
          <View style={styles.hintRow}>
            <MaterialIcons name="info-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.hintText}>Log multiple times per day — morning, afternoon, evening — to see time-of-day patterns.</Text>
          </View>
        </WebMaxWidth>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────────
  if (step === 'detail' && selectedEntry) {
    const e = selectedEntry;
    const eColor = getScoreColor(e.score);
    const primaryTagObj = CONTEXT_TAGS.find(t => t.id === e.primaryTag);
    const allTagObjs = [e.primaryTag, ...e.additionalTags]
      .map(id => CONTEXT_TAGS.find(t => t.id === id))
      .filter(Boolean) as ContextTag[];
    const logDate = new Date(e.timestamp);
    const dateStr = logDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <WebMaxWidth>
          {/* Back button */}
          <Pressable
            onPress={() => setStep('today')}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="arrow-back" size={18} color={Colors.textSecondary} />
            <Text style={styles.backBtnText}>Today's log</Text>
          </Pressable>

          {/* Score hero */}
          <View style={styles.detailHero}>
            <ScoreBubble
              score={e.score}
              emoji={getScoreEmoji(e.score)}
              label={getScoreLabel(e.score)}
              size="large"
            />
            <View style={styles.detailHeroRight}>
              <Text style={styles.detailTime}>{formatTime(e.time, e.timestamp, use24Hour)}</Text>
              <Text style={styles.detailDate}>{dateStr}</Text>
              <View style={[styles.detailTodBadge, { backgroundColor: Colors.primarySoft }]}>
                <Text style={styles.detailTodText}>
                  {getTimeOfDayEmoji(e.timeOfDay)} {e.timeOfDay.charAt(0).toUpperCase() + e.timeOfDay.slice(1)}
                </Text>
              </View>
            </View>
          </View>

          {/* Dimension breakdown */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Dimension breakdown</Text>
            <View style={styles.detailDimCard}>
              <DimBar label="Body" value={(e.dimensions.body + 1) / 2} leftEmoji="🏋️" rightEmoji="🪁" color={Colors.primary} />
              <DimBar label="Mind" value={(e.dimensions.mind + 1) / 2} leftEmoji="🌫️" rightEmoji="💡" color={Colors.secondary} />
              <DimBar label="Energy" value={e.dimensions.energy} leftEmoji="🪫" rightEmoji="⚡" color={Colors.success} />
              <DimBar label="Focus" value={e.dimensions.focus} leftEmoji="💭" rightEmoji="🎯" color={Colors.warning} />
            </View>
          </View>

          {/* Context tags */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Context</Text>
            <View style={styles.detailTagsRow}>
              {allTagObjs.map((t, i) => (
                <View key={t.id} style={[styles.detailTag, { backgroundColor: t.color + '20', borderColor: t.color + '40' }, i === 0 && { borderWidth: 1.5 }]}>
                  <Text style={styles.detailTagEmoji}>{t.emoji}</Text>
                  <View>
                    <Text style={[styles.detailTagLabel, { color: t.color }]}>{t.label}</Text>
                    {i === 0 ? <Text style={styles.detailTagPrimary}>Primary</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Journal */}
          {e.journalText ? (
            <View style={styles.detailSection}>
              <View style={styles.detailSectionTitleRow}>
                <MaterialIcons name="book" size={14} color={Colors.secondary} />
                <Text style={styles.detailSectionTitle}>Journal</Text>
                {(e as any).audioUri ? <MaterialIcons name="mic" size={13} color={Colors.primary} /> : null}
              </View>
              <View style={styles.detailJournalCard}>
                <Text style={styles.detailJournalText}>{e.journalText}</Text>
              </View>
            </View>
          ) : null}



          {/* Note */}
          {e.note && e.note !== e.journalText ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Quick note</Text>
              <View style={styles.detailNoteCard}>
                <Text style={styles.detailNoteText}>{e.note}</Text>
              </View>
            </View>
          ) : null}

          {/* Log again button */}
          <Pressable
            onPress={() => { resetForm(); setStep('body'); }}
            style={({ pressed }) => [styles.detailLogAgainBtn, pressed && { opacity: 0.8 }]}
          >
            <MaterialIcons name="add" size={16} color={Colors.primary} />
            <Text style={styles.detailLogAgainText}>Log a new entry</Text>
          </Pressable>
        </WebMaxWidth>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── BODY ─────────────────────────────────────────────────────────────────────
  if (step === 'body') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <WebMaxWidth>
          <View style={styles.stepHeader}>
            <Pressable onPress={() => setStep('today')} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="arrow-back" size={18} color={Colors.textSecondary} />
              <Text style={styles.backBtnText}>Today</Text>
            </Pressable>
          </View>
          <StepIndicator current={1} total={4} />
          <View style={styles.stepTitleRow}>
            <Text style={styles.timeChip}>{getTimeOfDayEmoji(timeOfDay)} {timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)}</Text>
          </View>
          <Text style={styles.bigQ}>How does your body{'\n'}feel right now?</Text>
          <Text style={styles.bigQSub}>Physical weight, tension, ease</Text>

          <View style={styles.sliderCard}>
            <MoodSlider value={bodyWeight} onChange={setBodyWeight} leftLabel="Heavy" rightLabel="Light" leftEmoji="🏋️" rightEmoji="🪁" color={Colors.primary} />
          </View>

          <View style={styles.sliderCard}>
            <MoodSlider value={bodyTension} onChange={setBodyTension} leftLabel="Tense" rightLabel="Relaxed" leftEmoji="😤" rightEmoji="😌" color={Colors.secondary} />
          </View>

          <View style={styles.sliderCard}>
            <MoodSlider value={bodyEase} onChange={setBodyEase} leftLabel="Stiff" rightLabel="Fluid" leftEmoji="🪨" rightEmoji="🌊" color={Colors.success} />
          </View>
        </WebMaxWidth>
        </ScrollView>
        <View style={styles.footer}>
          <WebMaxWidth><VibeButton label="Next →" onPress={() => setStep('mind')} /></WebMaxWidth>
        </View>
      </SafeAreaView>
    );
  }

  // ── MIND ─────────────────────────────────────────────────────────────────────
  if (step === 'mind') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <WebMaxWidth>
          <StepIndicator current={2} total={4} />
          <Text style={styles.bigQ}>How's your mind{'\n'}right now?</Text>
          <Text style={styles.bigQSub}>Clarity, fog, mood, emotional tone</Text>

          <View style={styles.sliderCard}>
            <MoodSlider value={mind} onChange={setMind} leftLabel="Dark" rightLabel="Clear" leftEmoji="🌫️" rightEmoji="💡" color={Colors.secondary} />
          </View>

          <View style={styles.sliderCard}>
            <MoodSlider value={energy * 2 - 1} onChange={v => setEnergy((v + 1) / 2)} leftLabel="Drained" rightLabel="Energised" leftEmoji="🪫" rightEmoji="⚡" color={Colors.success} />
          </View>

          <View style={styles.sliderCard}>
            <MoodSlider value={focus * 2 - 1} onChange={v => setFocus((v + 1) / 2)} leftLabel="Scattered" rightLabel="Locked in" leftEmoji="💭" rightEmoji="🎯" color={Colors.warning} />
          </View>

          <View style={[styles.scorePill, { borderColor: scoreColor + '40', backgroundColor: scoreColor + '12' }]}>
            <Text style={[styles.scorePillNum, { color: scoreColor }]}>{score}</Text>
            <Text style={[styles.scorePillLabel, { color: scoreColor }]}>{getScoreLabel(score)}</Text>
          </View>
        </WebMaxWidth>
        </ScrollView>
        <View style={styles.footer}>
          <WebMaxWidth>
          <View style={styles.footerRow}>
            <Pressable onPress={() => setStep('body')} style={styles.backIconBtn}>
              <MaterialIcons name="arrow-back" size={20} color={Colors.textSecondary} />
            </Pressable>
            <VibeButton label="Next →" onPress={() => setStep('tag')} style={{ flex: 1 }} />
          </View>
          </WebMaxWidth>
        </View>
      </SafeAreaView>
    );
  }

  // ── TAG ───────────────────────────────────────────────────────────────────────
  if (step === 'tag') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <WebMaxWidth>
            <StepIndicator current={3} total={4} />
            <Text style={styles.bigQ}>What's the main thing{'\n'}affecting this?</Text>
            <Text style={styles.bigQSub}>Tap one primary · up to 5 more · each tag adjusts your score</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
              {TAG_CATEGORIES.map(cat => (
                <Pressable key={cat} onPress={() => setTagCategory(cat)} style={[styles.catChip, tagCategory === cat && styles.catChipActive]}>
                  <Text style={[styles.catChipText, tagCategory === cat && styles.catChipTextActive]}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.tagsGrid}>
              {visibleTags.map(tag => {
                const isPrimary = primaryTag === tag.id;
                const isAdditional = additionalTags.includes(tag.id);
                const isSelected = isPrimary || isAdditional;
                const wt = tag.weight;
                const isPos = wt > 0;
                const wtColor = wt > 0 ? '#4ADE80' : wt < 0 ? '#FF6B6B' : '#94A3B8';
                const wtLabel = wt === 0 ? '±0' : (isPos ? '+' : '') + String(wt);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => {
                      if (!primaryTag || isPrimary) { setPrimaryTag(isPrimary ? null : tag.id); }
                      else { toggleAdditionalTag(tag.id); }
                    }}
                    style={({ pressed }) => [
                      styles.tagCard,
                      isPrimary && { backgroundColor: tag.color + '25', borderColor: tag.color, borderWidth: 2 },
                      isAdditional && { backgroundColor: tag.color + '12', borderColor: tag.color + '60', borderWidth: 1.5 },
                      !isSelected && { backgroundColor: C.surfaceElevated, borderColor: C.border, borderWidth: 1 },
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Text style={styles.tagEmoji}>{tag.emoji}</Text>
                    <Text style={[styles.tagLabel, isSelected && { color: tag.color, fontWeight: '700' }]}>{tag.label}</Text>
                    {/* Weight badge */}
                    <View style={[styles.weightBadge, { backgroundColor: wtColor + '20', borderColor: wtColor + '50' }]}>
                      <Text style={[styles.weightBadgeText, { color: wtColor }]}>{wtLabel}</Text>
                    </View>
                    {isPrimary ? (
                      <View style={[styles.primaryBadge, { backgroundColor: tag.color }]}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {primaryTag ? (
              <View style={styles.selectedSummary}>
                {/* Live score impact bar */}
                <View style={[styles.scoreImpactCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: C.textMuted, includeFontPadding: false } as any}>Score with context</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 11, color: C.textMuted, includeFontPadding: false } as any}>
                        base <Text style={{ fontWeight: '700', color: getScoreColor(baseScore) }}>{baseScore}</Text>
                      </Text>
                      {tagDelta !== 0 ? (
                        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: (tagDelta > 0 ? '#4ADE80' : '#FF6B6B') + '20', borderWidth: 1, borderColor: (tagDelta > 0 ? '#4ADE80' : '#FF6B6B') + '50' }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: tagDelta > 0 ? '#4ADE80' : '#FF6B6B', includeFontPadding: false } as any}>
                            {tagDelta > 0 ? '+' : ''}{tagDelta} context
                          </Text>
                        </View>
                      ) : null}
                      <Text style={{ fontSize: 16, fontWeight: '900', color: scoreColor, includeFontPadding: false } as any}>{score}</Text>
                    </View>
                  </View>
                  <View style={{ height: 6, backgroundColor: C.border, borderRadius: 999, overflow: 'hidden', marginTop: 4 }}>
                    <View style={{ height: 6, width: `${score}%` as any, backgroundColor: scoreColor, borderRadius: 999 }} />
                  </View>
                  <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 3, includeFontPadding: false } as any}>
                    Primary tag = full weight · additional tags = half weight each · {MAX_ADDITIONAL - additionalTags.length} more can be added
                  </Text>
                </View>
                <Text style={styles.selectedSummaryLabel}>Logged context:</Text>
                <View style={styles.selectedTagsList}>
                  {[primaryTag, ...additionalTags].map((id, i) => {
                    const t = CONTEXT_TAGS.find(x => x.id === id)!;
                    if (!t) return null;
                    const eff = Math.round(t.weight * (i === 0 ? 1.0 : 0.5));
                    const effColor = eff > 0 ? '#4ADE80' : eff < 0 ? '#FF6B6B' : '#94A3B8';
                    return (
                      <View key={id} style={[styles.selectedTag, { backgroundColor: t.color + '20', borderColor: t.color + '40' }]}>
                        <Text>{t.emoji}</Text>
                        <Text style={[styles.selectedTagText, { color: t.color }]}>{t.label}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: effColor, includeFontPadding: false } as any}>
                          {eff > 0 ? '+' : ''}{eff !== 0 ? eff : '±0'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </WebMaxWidth>
          </ScrollView>
          <View style={styles.footer}>
            <WebMaxWidth>
            <View style={styles.footerRow}>
              <Pressable onPress={() => setStep('mind')} style={styles.backIconBtn}>
                <MaterialIcons name="arrow-back" size={20} color={Colors.textSecondary} />
              </Pressable>
              <VibeButton label="Next →" onPress={() => setStep('journal')} disabled={!primaryTag} style={{ flex: 1 }} />
            </View>
            </WebMaxWidth>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── JOURNAL ───────────────────────────────────────────────────────────────────
  if (step === 'journal') {
    const wordCount = journalText.trim() ? journalText.trim().split(/\s+/).length : 0;
    const hasContent = journalText.trim().length > 0 || !!audioUri;

    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <WebMaxWidth>
            <StepIndicator current={4} total={4} />
            <Text style={styles.bigQ}>How are you feeling?</Text>
            <Text style={styles.bigQSub}>Journal entry — type, speak, or skip</Text>

            <View style={[styles.scorePill, { borderColor: scoreColor + '40', backgroundColor: scoreColor + '12', alignSelf: 'flex-start', marginBottom: Spacing.xl }]}>
              <Text style={[styles.scorePillNum, { color: scoreColor }]}>{score}</Text>
              <Text style={[styles.scorePillLabel, { color: scoreColor }]}>{getScoreLabel(score)}</Text>
            </View>

            <View style={styles.journalCard}>
              <View style={styles.journalHeader}>
                <MaterialIcons name="edit" size={15} color={Colors.secondary} />
                <Text style={styles.journalHeaderText}>Write it out</Text>
                {wordCount > 0 ? <Text style={styles.wordCount}>{wordCount} words</Text> : null}
              </View>
              <TextInput
                style={styles.journalInput}
                placeholder="What's on your mind right now?"
                placeholderTextColor={Colors.textMuted}
                multiline
                value={journalText}
                onChangeText={setJournalText}
                textAlignVertical="top"
                autoFocus={false}
              />
            </View>

            <View style={styles.journalCard}>
              <View style={styles.journalHeader}>
                <MaterialIcons name="mic" size={15} color={Colors.primary} />
                <Text style={styles.journalHeaderText}>Speak it out</Text>
                <Text style={styles.journalHeaderSub}>AI transcription available</Text>
              </View>
              <VoiceRecorder
                onRecordingComplete={(uri) => setAudioUri(uri)}
                onTranscriptReady={handleTranscriptReady}
              />
            </View>

            {transcript ? (
              <View style={styles.transcriptPreview}>
                <View style={styles.transcriptHeader}>
                  <MaterialIcons name="auto-awesome" size={13} color={Colors.primary} />
                  <Text style={styles.transcriptHeaderText}>Transcript added to journal</Text>
                </View>
                <Text style={styles.transcriptText} numberOfLines={3}>{transcript}</Text>
              </View>
            ) : null}

            {journalText.length === 0 && !audioUri ? (
              <View style={styles.promptsCard}>
                <Text style={styles.promptsTitle}>Need a starting point?</Text>
                {[
                  'What was the most energizing part of your day?',
                  'What drained you the most today?',
                  'Where did you feel most yourself today?',
                  'What would you tell tomorrow-you about today?',
                ].map((p, i) => (
                  <Pressable key={i} onPress={() => setJournalText(prev => prev ? prev : p + ' ')} style={({ pressed }) => [styles.promptRow, pressed && { opacity: 0.7 }]}>
                    <Text style={styles.promptEmoji}>✏️</Text>
                    <Text style={styles.promptText}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </WebMaxWidth>
          </ScrollView>
          <View style={styles.footer}>
            <WebMaxWidth>
            <View style={styles.footerRow}>
              <Pressable onPress={() => setStep('tag')} style={styles.backIconBtn}>
                <MaterialIcons name="arrow-back" size={20} color={Colors.textSecondary} />
              </Pressable>
              <VibeButton
                label={saving ? 'Saving...' : hasContent ? 'Save check-in' : 'Skip & save'}
                onPress={handleSave}
                disabled={saving}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
            </WebMaxWidth>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return null;
}

// ─── Mini Dim Chip ─────────────────────────────────────────────────────────────
function MiniDimChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={mdcStyles.chip}>
      <Text style={[mdcStyles.label, { color }]} numberOfLines={1}>{label}</Text>
      <View style={mdcStyles.track}>
        <View style={[mdcStyles.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[mdcStyles.pct, { color }]}>{Math.round(value * 100)}</Text>
    </View>
  );
}
const mdcStyles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 9, fontWeight: '700', width: 40, includeFontPadding: false },
  track: { width: 32, height: 4, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
  pct: { fontSize: 9, fontWeight: '700', width: 20, includeFontPadding: false },
});
// Note: mdcStyles and tdbStyles use module-level Colors (mutable object) — they
// get correct values after ThemeContext.syncColors() on theme toggle since
// these sub-components are always rendered inside CheckinScreen which remounts.

// ─── Timeline Dim Bar ──────────────────────────────────────────────────────────
function TimelineDimBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <View style={tdbStyles.row}>
      <Text style={[tdbStyles.label, { color }]}>{label}</Text>
      <View style={tdbStyles.track}>
        <View style={[tdbStyles.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}
const tdbStyles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 9, fontWeight: '700', width: 10, includeFontPadding: false },
  track: { flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
});
