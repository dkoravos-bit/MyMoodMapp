/**
 * MoodBeat — Beat-making stress-relief game
 * Extracted to its own file to reduce Hermes JS bundle parse size.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
// expo-audio replaces expo-av — lazy require to avoid module-level native init
function _getMbCreateAudioPlayer(): any {
  if (Platform.OS === 'web') return null;
  try { return require('expo-audio').createAudioPlayer; } catch { return null; }
}
function _getMbSetAudioMode(): any {
  if (Platform.OS === 'web') return null;
  try { return require('expo-audio').setAudioModeAsync; } catch { return null; }
}
import { Radius, Spacing } from '@/constants/theme';
import type { DarkColors } from '@/constants/theme';

// ── Web Audio context ──────────────────────────────────────────────────────
function getMoodBeatCtx(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  try {
    const W = window as any;
    const Cls = W.AudioContext || W.webkitAudioContext;
    if (!Cls) return null;
    if (!W.__moodBeatCtx || W.__moodBeatCtx.state === 'closed') W.__moodBeatCtx = new Cls();
    return W.__moodBeatCtx as AudioContext;
  } catch { return null; }
}

async function mbResumeCtx(): Promise<AudioContext | null> {
  if (Platform.OS !== 'web') return null;
  try {
    const ctx = getMoodBeatCtx();
    if (!ctx) return null;
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx;
  } catch { return null; }
}

function mbPlayBuffer(ctx: AudioContext, buf: AudioBuffer, when: number, vol: number) {
  try {
    const g = ctx.createGain(); g.gain.value = Math.max(0, Math.min(1, vol)); g.connect(ctx.destination);
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(g);
    src.start(when); src.onended = () => { try { g.disconnect(); } catch {} };
  } catch {}
}

// ── Drum synthesisers ──────────────────────────────────────────────────────
function mbSynthKick(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.55); const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / sr; const hz = 150 * Math.exp(-t * 30) + 40; const env = Math.exp(-t * 7);
    out[i] = Math.sin(2 * Math.PI * hz * t) * env * 0.9;
  }
  const clickN = Math.floor(sr * 0.003);
  for (let i = 0; i < Math.min(clickN, N); i++) out[i] += (Math.random() * 2 - 1) * (1 - i / clickN) * 0.3;
  return out;
}
function mbSynthSnare(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.22); const out = new Float32Array(N); let lp = 0;
  for (let i = 0; i < N; i++) {
    const t = i / sr; const env = Math.exp(-t * 14); const noise = Math.random() * 2 - 1;
    lp = 0.55 * noise + 0.45 * lp; out[i] = lp * env * 0.6;
    out[i] += Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 25) * 0.4;
  }
  return out;
}
function mbSynthHatClosed(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.055); const out = new Float32Array(N);
  for (let i = 0; i < N; i++) { const t = i / sr; const env = Math.exp(-t * 70); out[i] = (Math.random() * 2 - 1) * env * 0.55; }
  return out;
}
function mbSynthHatOpen(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.38); const out = new Float32Array(N);
  for (let i = 0; i < N; i++) { const t = i / sr; const env = Math.exp(-t * 8); out[i] = (Math.random() * 2 - 1) * env * 0.5; }
  return out;
}
function mbSynthClap(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.18); const out = new Float32Array(N);
  const offsets = [0, Math.floor(sr * 0.006), Math.floor(sr * 0.013)];
  offsets.forEach((off, layer) => {
    const decay = 18 + layer * 5;
    for (let i = 0; i + off < N; i++) { const t = i / sr; out[i + off] += (Math.random() * 2 - 1) * Math.exp(-t * decay) * 0.4; }
  });
  return out;
}
function mbSynthTom(sr: number, freq: number): Float32Array {
  const N = Math.ceil(sr * 0.35); const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / sr; const hz = freq * Math.exp(-t * 12) + freq * 0.35; const env = Math.exp(-t * 9);
    out[i] = Math.sin(2 * Math.PI * hz * t) * env * 0.75;
  }
  return out;
}
function mbSynth808(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.9); const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / sr; const hz = 65 * Math.exp(-t * 3) + 35; const env = Math.exp(-t * 2.5);
    out[i] = Math.sin(2 * Math.PI * hz * t) * env * 0.9;
  }
  return out;
}
function mbSynthCrash(sr: number): Float32Array {
  const N = Math.ceil(sr * 1.4); const out = new Float32Array(N);
  for (let i = 0; i < N; i++) { const t = i / sr; out[i] = (Math.random() * 2 - 1) * Math.exp(-t * 4) * 0.45; }
  return out;
}
function mbSynthRim(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.06); const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / sr; const env = Math.exp(-t * 55);
    out[i] = Math.sin(2 * Math.PI * 420 * t) * env * 0.5 + (Math.random() * 2 - 1) * env * 0.25;
  }
  return out;
}
function mbSynthShaker(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.07); const out = new Float32Array(N);
  for (let i = 0; i < N; i++) { const t = i / sr; out[i] = (Math.random() * 2 - 1) * Math.exp(-t * 50) * 0.4; }
  return out;
}
function mbSynthCowbell(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.5); const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / sr; const env = Math.exp(-t * 8);
    out[i] = (Math.sin(2 * Math.PI * 540 * t) * 0.55 + Math.sin(2 * Math.PI * 847 * t) * 0.35) * env * 0.5;
  }
  return out;
}
function mbSynthSnap(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.05); const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / sr; const env = Math.exp(-t * 80);
    out[i] = (Math.random() * 2 - 1) * env * 0.45 + Math.sin(2 * Math.PI * 900 * t) * env * 0.25;
  }
  return out;
}
function mbSynthPerc(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.12); const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / sr; const hz = 300 * Math.exp(-t * 20) + 100; const env = Math.exp(-t * 20);
    out[i] = Math.sin(2 * Math.PI * hz * t) * env * 0.6 + (Math.random() * 2 - 1) * env * 0.2;
  }
  return out;
}
function mbSynthBassNote(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.35); const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / sr; const env = Math.exp(-t * 6);
    out[i] = Math.sin(2 * Math.PI * 90 * t) * 0.6 * env + Math.sin(2 * Math.PI * 180 * t) * 0.25 * env;
  }
  return out;
}
function mbSynthChord(sr: number): Float32Array {
  const N = Math.ceil(sr * 0.4); const out = new Float32Array(N);
  const freqs = [261.63, 329.63, 392.0, 523.25];
  for (let i = 0; i < N; i++) {
    const t = i / sr; const env = Math.exp(-t * 5);
    for (const f of freqs) out[i] += Math.sin(2 * Math.PI * f * t) * env * 0.18;
  }
  return out;
}

type MbDrumId = 'kick'|'snare'|'hat_c'|'hat_o'|'clap'|'tom_h'|'tom_l'|'s808'|'crash'|'rim'|'shaker'|'cowbell'|'snap'|'perc'|'bass'|'chord';

export interface MbPad {
  id: MbDrumId;
  name: string;
  emoji: string;
  color: string;
  row: number;
}

export const MB_KITS: { name: string; pads: MbPad[] }[] = [
  { name: 'Hip Hop', pads: [
    { id: 'kick',    name: 'KICK',  emoji: '💣', color: '#F5A623', row: 0 },
    { id: 'snare',   name: 'SNARE', emoji: '🥁', color: '#FF6B6B', row: 1 },
    { id: 'hat_c',   name: 'HAT',   emoji: '🎩', color: '#4ADE80', row: 2 },
    { id: 'clap',    name: 'CLAP',  emoji: '👏', color: '#7C83FF', row: 3 },
    { id: 'tom_h',   name: 'TOM H', emoji: '🔴', color: '#FB923C', row: 4 },
    { id: 'tom_l',   name: 'TOM L', emoji: '🟠', color: '#F59E0B', row: 5 },
    { id: 's808',    name: '808',   emoji: '💥', color: '#A78BFA', row: 6 },
    { id: 'hat_o',   name: 'OPEN',  emoji: '🔔', color: '#38BDF8', row: 7 },
    { id: 'crash',   name: 'CRASH', emoji: '💫', color: '#E879F9', row: -1 },
    { id: 'rim',     name: 'RIM',   emoji: '🎵', color: '#4ECDC4', row: -1 },
    { id: 'shaker',  name: 'SHAKR', emoji: '🎲', color: '#95E06C', row: -1 },
    { id: 'cowbell', name: 'COWBL', emoji: '🐮', color: '#FFD166', row: -1 },
    { id: 'snap',    name: 'SNAP',  emoji: '✌️', color: '#F472B6', row: -1 },
    { id: 'perc',    name: 'PERC',  emoji: '🎶', color: '#34D399', row: -1 },
    { id: 'bass',    name: 'BASS',  emoji: '🎸', color: '#60A5FA', row: -1 },
    { id: 'chord',   name: 'CHORD', emoji: '🎹', color: '#C084FC', row: -1 },
  ]},
  { name: 'Electronic', pads: [
    { id: 'kick',    name: 'SUB',    emoji: '💣', color: '#F5A623', row: 0 },
    { id: 'snare',   name: 'PUNCH',  emoji: '⚡', color: '#FF6B6B', row: 1 },
    { id: 'hat_c',   name: 'HAT',    emoji: '🔩', color: '#4ADE80', row: 2 },
    { id: 'clap',    name: 'LAYRD',  emoji: '🌊', color: '#7C83FF', row: 3 },
    { id: 's808',    name: '808',    emoji: '💥', color: '#A78BFA', row: 4 },
    { id: 'hat_o',   name: 'OPEN',   emoji: '🔔', color: '#38BDF8', row: 5 },
    { id: 'perc',    name: 'ZAP',    emoji: '⚡', color: '#FB923C', row: 6 },
    { id: 'chord',   name: 'STAB',   emoji: '🎹', color: '#C084FC', row: 7 },
    { id: 'crash',   name: 'REVCYM', emoji: '💫', color: '#E879F9', row: -1 },
    { id: 'rim',     name: 'SNARE2', emoji: '🎵', color: '#4ECDC4', row: -1 },
    { id: 'snap',    name: 'SNAP',   emoji: '✌️', color: '#F472B6', row: -1 },
    { id: 'shaker',  name: 'NOISE',  emoji: '📻', color: '#95E06C', row: -1 },
    { id: 'tom_h',   name: 'TOM H',  emoji: '🔴', color: '#FB923C', row: -1 },
    { id: 'tom_l',   name: 'TOM L',  emoji: '🟠', color: '#F59E0B', row: -1 },
    { id: 'bass',    name: 'BASS',   emoji: '🎸', color: '#60A5FA', row: -1 },
    { id: 'cowbell', name: 'FX',     emoji: '🐮', color: '#FFD166', row: -1 },
  ]},
  { name: 'Lo-Fi', pads: [
    { id: 'kick',    name: 'VINYL', emoji: '🎞️', color: '#F5A623', row: 0 },
    { id: 'snare',   name: 'DUSTY', emoji: '🌫️', color: '#FF6B6B', row: 1 },
    { id: 'hat_c',   name: 'JAZZY', emoji: '🎩', color: '#4ADE80', row: 2 },
    { id: 'chord',   name: 'PIANO', emoji: '🎹', color: '#C084FC', row: 3 },
    { id: 'bass',    name: 'BASS',  emoji: '🎸', color: '#60A5FA', row: 4 },
    { id: 'hat_o',   name: 'OPEN',  emoji: '🔔', color: '#38BDF8', row: 5 },
    { id: 'shaker',  name: 'VINYL', emoji: '🎲', color: '#95E06C', row: 6 },
    { id: 'snap',    name: 'SNAP',  emoji: '✌️', color: '#F472B6', row: 7 },
    { id: 'clap',    name: 'CLAP',  emoji: '👏', color: '#7C83FF', row: -1 },
    { id: 'perc',    name: 'WOOD',  emoji: '🪵', color: '#34D399', row: -1 },
    { id: 'tom_h',   name: 'CONGA', emoji: '🔴', color: '#FB923C', row: -1 },
    { id: 'tom_l',   name: 'BONGO', emoji: '🟠', color: '#F59E0B', row: -1 },
    { id: 'cowbell', name: 'BELL',  emoji: '🔔', color: '#FFD166', row: -1 },
    { id: 's808',    name: '808',   emoji: '💥', color: '#A78BFA', row: -1 },
    { id: 'rim',     name: 'RIM',   emoji: '🎵', color: '#4ECDC4', row: -1 },
    { id: 'crash',   name: 'CRASH', emoji: '💫', color: '#E879F9', row: -1 },
  ]},
  { name: 'Live / Rock', pads: [
    { id: 'kick',    name: 'ROOM',    emoji: '🏠', color: '#F5A623', row: 0 },
    { id: 'snare',   name: 'RIM',     emoji: '🥁', color: '#FF6B6B', row: 1 },
    { id: 'hat_c',   name: 'RIDE',    emoji: '🎩', color: '#4ADE80', row: 2 },
    { id: 'crash',   name: 'CRASH',   emoji: '💫', color: '#E879F9', row: 3 },
    { id: 'tom_h',   name: 'TOM H',   emoji: '🔴', color: '#FB923C', row: 4 },
    { id: 'tom_l',   name: 'FLOOR',   emoji: '🟠', color: '#F59E0B', row: 5 },
    { id: 'hat_o',   name: 'OPEN',    emoji: '🔔', color: '#38BDF8', row: 6 },
    { id: 'clap',    name: 'HANDCLP', emoji: '👏', color: '#7C83FF', row: 7 },
    { id: 'rim',     name: 'XSTICK',  emoji: '🎵', color: '#4ECDC4', row: -1 },
    { id: 'cowbell', name: 'COWBL',   emoji: '🐮', color: '#FFD166', row: -1 },
    { id: 'shaker',  name: 'TAMB',    emoji: '🎲', color: '#95E06C', row: -1 },
    { id: 'snap',    name: 'SNAP',    emoji: '✌️', color: '#F472B6', row: -1 },
    { id: 'bass',    name: 'BASS',    emoji: '🎸', color: '#60A5FA', row: -1 },
    { id: 'chord',   name: 'CHORD',   emoji: '🎹', color: '#C084FC', row: -1 },
    { id: 'perc',    name: 'PERC',    emoji: '🎶', color: '#34D399', row: -1 },
    { id: 's808',    name: '808',     emoji: '💥', color: '#A78BFA', row: -1 },
  ]},
];

export const MB_NUM_STEPS = 16;
export const MB_NUM_TRACKS = 8;

// ── WAV builder ────────────────────────────────────────────────────────────
const B64C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function mbBuildWavUri(samples: Float32Array): string {
  const sr = 22050; const N = samples.length;
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const scale = peak > 0.001 ? 0.85 / peak : 1;
  const buf = new Uint8Array(44 + N * 2);
  const s32 = (off: number, v: number) => {
    buf[off]=v&0xff;buf[off+1]=(v>>8)&0xff;buf[off+2]=(v>>16)&0xff;buf[off+3]=(v>>24)&0xff;
  };
  buf[0]=0x52;buf[1]=0x49;buf[2]=0x46;buf[3]=0x46; s32(4,36+N*2);
  buf[8]=0x57;buf[9]=0x41;buf[10]=0x56;buf[11]=0x45;
  buf[12]=0x66;buf[13]=0x6d;buf[14]=0x74;buf[15]=0x20; s32(16,16);
  buf[20]=1;buf[21]=0;buf[22]=1;buf[23]=0;
  s32(24,sr);s32(28,sr*2);buf[32]=2;buf[33]=0;buf[34]=16;buf[35]=0;
  buf[36]=0x64;buf[37]=0x61;buf[38]=0x74;buf[39]=0x61; s32(40,N*2);
  for (let i = 0; i < N; i++) {
    const sv = Math.max(-1, Math.min(1, samples[i] * scale));
    const v = sv < 0 ? Math.round(sv*32768) : Math.round(sv*32767);
    buf[44+i*2]=v&0xff; buf[44+i*2+1]=(v>>8)&0xff;
  }
  const parts: string[] = [];
  for (let i = 0; i < buf.length; i += 3) {
    const b0=buf[i],b1=buf[i+1]??0,b2=buf[i+2]??0;
    parts.push(B64C[b0>>2],B64C[((b0&3)<<4)|(b1>>4)],i+1<buf.length?B64C[((b1&15)<<2)|(b2>>6)]:'=',i+2<buf.length?B64C[b2&63]:'=');
  }
  return `data:audio/wav;base64,${parts.join('')}`;
}

function mbGetSamples(id: MbDrumId): Float32Array {
  const sr = 22050;
  switch (id) {
    case 'kick':    return mbSynthKick(sr);
    case 'snare':   return mbSynthSnare(sr);
    case 'hat_c':   return mbSynthHatClosed(sr);
    case 'hat_o':   return mbSynthHatOpen(sr);
    case 'clap':    return mbSynthClap(sr);
    case 'tom_h':   return mbSynthTom(sr, 200);
    case 'tom_l':   return mbSynthTom(sr, 130);
    case 's808':    return mbSynth808(sr);
    case 'crash':   return mbSynthCrash(sr);
    case 'rim':     return mbSynthRim(sr);
    case 'shaker':  return mbSynthShaker(sr);
    case 'cowbell': return mbSynthCowbell(sr);
    case 'snap':    return mbSynthSnap(sr);
    case 'perc':    return mbSynthPerc(sr);
    case 'bass':    return mbSynthBassNote(sr);
    case 'chord':   return mbSynthChord(sr);
    default:        return mbSynthSnare(sr);
  }
}

// Module-level caches — survive component remounts
const _mbWebBufCache: Partial<Record<MbDrumId, AudioBuffer>> = {};
const _mbNativeUriCache: Partial<Record<MbDrumId, string>> = {};
let _mbAudioModeSet = false;
let _mbAudioModePromise: Promise<void> | null = null;

function mbEnsureAudioMode(): Promise<void> {
  if (_mbAudioModeSet) return Promise.resolve();
  if (_mbAudioModePromise) return _mbAudioModePromise;
  const setAudioMode = _getMbSetAudioMode();
  if (!setAudioMode) { _mbAudioModeSet = true; return Promise.resolve(); }
  _mbAudioModePromise = setAudioMode({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
  } as any).then(() => { _mbAudioModeSet = true; }).catch(() => { _mbAudioModeSet = true; });
  return _mbAudioModePromise;
}

function mbTriggerSound(id: MbDrumId, vol = 0.85): void {
  if (Platform.OS === 'web') {
    mbResumeCtx().then(ctx => {
      if (!ctx) return;
      try {
        if (!_mbWebBufCache[id]) {
          const samples = mbGetSamples(id);
          const ab = ctx.createBuffer(1, samples.length, 22050);
          ab.copyToChannel(samples, 0);
          _mbWebBufCache[id] = ab;
        }
        mbPlayBuffer(ctx, _mbWebBufCache[id]!, ctx.currentTime, vol);
      } catch {}
    }).catch(() => {});
  } else {
    (async () => {
      try {
        const createAudioPlayer = _getMbCreateAudioPlayer();
        if (!createAudioPlayer) return;
        await mbEnsureAudioMode();
        if (!_mbNativeUriCache[id]) {
          _mbNativeUriCache[id] = mbBuildWavUri(mbGetSamples(id));
        }
        const uri = _mbNativeUriCache[id]!;
        const player = createAudioPlayer({ uri });
        player.volume = Math.max(0, Math.min(1, vol));
        player.loop = false;
        player.play();
        // Auto-cleanup after generous timeout
        setTimeout(() => { try { player.remove(); } catch {} }, 3000);
      } catch {}
    })();
  }
}

// ── MoodBeat Component ──────────────────────────────────────────────────────
export default function MoodBeatGame({ C }: { C: typeof DarkColors }) {
  const [screenW, setScreenW] = useState(() => Math.max(320, Dimensions.get('window').width || 320));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window: w }) => {
      setScreenW(Math.max(320, w.width || 320));
    });
    return () => sub?.remove();
  }, []);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [mode, setMode] = useState<'pads' | 'sequencer'>('pads');
  const [kitIdx, setKitIdx] = useState(0);
  const [bpm, setBpm] = useState(95);
  const [swing, setSwing] = useState(20);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [steps, setSteps] = useState<boolean[][]>(() =>
    Array.from({ length: MB_NUM_TRACKS }, () => Array(MB_NUM_STEPS).fill(false))
  );
  const [padFlash, setPadFlash] = useState<Partial<Record<MbDrumId, boolean>>>({});
  const [trackFlash, setTrackFlash] = useState<boolean[]>(Array(MB_NUM_TRACKS).fill(false));

  const triggerSound = useCallback((id: MbDrumId, vol = 0.85) => {
    try { mbTriggerSound(id, vol); } catch {}
  }, []);

  const stepsRef   = useRef(steps);
  const bpmRef     = useRef(bpm);
  const kitIdxRef  = useRef(kitIdx);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef    = useRef(-1);
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { kitIdxRef.current = kitIdx; }, [kitIdx]);

  useEffect(() => () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const tapTimesRef = useRef<number[]>([]);
  const handleTapTempo = useCallback(() => {
    const now = Date.now();
    const taps = tapTimesRef.current;
    taps.push(now);
    if (taps.length > 1 && now - taps[taps.length - 2] > 2500) taps.splice(0, taps.length - 1);
    if (taps.length > 8) taps.shift();
    if (taps.length >= 2) {
      const intervals = taps.slice(1).map((t, i) => t - taps[i]);
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(Math.max(40, Math.min(200, Math.round(60000 / avgMs))));
    }
  }, []);

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (mountedRef.current) { setCurrentStep(-1); setTrackFlash(Array(MB_NUM_TRACKS).fill(false)); }
      return;
    }
    stepRef.current = -1;
    const intervalMs = Math.max(50, Math.round((60000 / bpm) / 4));
    timerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      const nextStep = (stepRef.current + 1) % MB_NUM_STEPS;
      stepRef.current = nextStep;
      const safeKitIdx = Math.min(kitIdxRef.current, MB_KITS.length - 1);
      const kit = MB_KITS[safeKitIdx];
      const curSteps = stepsRef.current;
      const activeIds: MbDrumId[] = [];
      for (let t = 0; t < MB_NUM_TRACKS; t++) {
        if (curSteps[t]?.[nextStep]) {
          const pad = kit.pads.find(p => p.row === t);
          if (pad) { triggerSound(pad.id, 0.85); activeIds.push(pad.id); }
        }
      }
      setCurrentStep(nextStep);
      if (activeIds.length > 0) {
        setTrackFlash(prev => prev.map((_, t) => {
          const pad = MB_KITS[Math.min(kitIdxRef.current, MB_KITS.length - 1)].pads.find(p => p.row === t);
          return pad ? activeIds.includes(pad.id) : false;
        }));
        setTimeout(() => { if (mountedRef.current) setTrackFlash(Array(MB_NUM_TRACKS).fill(false)); }, 80);
      }
    }, intervalMs);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [playing, bpm, triggerSound]);

  const handlePadPress = useCallback((pad: MbPad) => {
    try { triggerSound(pad.id, 0.9); } catch {}
    setPadFlash(prev => ({ ...prev, [pad.id]: true }));
    setTimeout(() => { if (mountedRef.current) setPadFlash(prev => ({ ...prev, [pad.id]: false })); }, 100);
  }, [triggerSound]);

  const toggleStep = useCallback((track: number, step: number) => {
    setSteps(prev => {
      const next = prev.map(row => [...row]);
      next[track][step] = !next[track][step];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSteps(Array.from({ length: MB_NUM_TRACKS }, () => Array(MB_NUM_STEPS).fill(false)));
  }, []);

  const loadPreset = useCallback((preset: 'four-on-floor' | 'boom-bap' | 'breakbeat') => {
    const p = Array.from({ length: MB_NUM_TRACKS }, () => Array(MB_NUM_STEPS).fill(false));
    if (preset === 'four-on-floor') {
      p[0] = [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0].map(Boolean);
      p[1] = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean);
      p[2] = [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0].map(Boolean);
      p[3] = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1].map(Boolean);
    } else if (preset === 'boom-bap') {
      p[0] = [1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0].map(Boolean);
      p[1] = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean);
      p[2] = [1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1].map(Boolean);
      p[3] = [0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0].map(Boolean);
    } else {
      p[0] = [1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0].map(Boolean);
      p[1] = [0,0,1,0,0,0,1,0,0,0,0,1,0,0,1,0].map(Boolean);
      p[2] = [1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,0].map(Boolean);
      p[4] = [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1].map(Boolean);
    }
    setSteps(p);
  }, []);

  const SW = screenW;
  const HEADER_H = 100;
  const padSize = Math.max(60, Math.min(80, Math.floor((SW - 24) / 4) - 4));
  const seqRowH = 40;
  const seqCellW = Math.max(18, Math.floor((SW - 68) / MB_NUM_STEPS));
  const kit = MB_KITS[kitIdx];

  return (
    <View style={{ flex: 1, backgroundColor: '#080A18', paddingTop: HEADER_H }}>
      {/* Kit + BPM header */}
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', gap: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {MB_KITS.map((k, i) => (
            <Pressable key={k.name} onPress={() => setKitIdx(i)}
              style={({ pressed }) => [{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: kitIdx === i ? '#38BDF8' : 'rgba(255,255,255,0.15)', backgroundColor: kitIdx === i ? '#38BDF820' : 'transparent' }, pressed && { opacity: 0.7 }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: kitIdx === i ? '#38BDF8' : 'rgba(255,255,255,0.5)', includeFontPadding: false } as any}>{k.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ alignItems: 'center', minWidth: 48 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#38BDF8', includeFontPadding: false } as any}>{bpm}</Text>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 1, includeFontPadding: false } as any}>BPM</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', width: 26, includeFontPadding: false } as any}>BPM</Text>
              <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                <View style={{ height: 4, width: `${((bpm - 40) / 160) * 100}%` as any, backgroundColor: '#38BDF8', borderRadius: 2 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Pressable onPress={() => setBpm(b => Math.max(40, b - 1))} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', includeFontPadding: false } as any}>-</Text></Pressable>
                <Pressable onPress={() => setBpm(b => Math.min(200, b + 1))} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', includeFontPadding: false } as any}>+</Text></Pressable>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', width: 26, includeFontPadding: false } as any}>SWG</Text>
              <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                <View style={{ height: 4, width: `${(swing / 70) * 100}%` as any, backgroundColor: '#A78BFA', borderRadius: 2 }} />
              </View>
              <Text style={{ fontSize: 10, color: '#A78BFA', fontWeight: '700', width: 26, textAlign: 'right', includeFontPadding: false } as any}>{swing}%</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Pressable onPress={() => setSwing(s => Math.max(0, s - 5))} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', includeFontPadding: false } as any}>-</Text></Pressable>
                <Pressable onPress={() => setSwing(s => Math.min(70, s + 5))} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', includeFontPadding: false } as any}>+</Text></Pressable>
              </View>
            </View>
          </View>
          <Pressable onPress={handleTapTempo}
            style={({ pressed }) => [{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg, backgroundColor: '#38BDF815', borderWidth: 1.5, borderColor: '#38BDF840', alignItems: 'center' }, pressed && { backgroundColor: '#38BDF840', transform: [{ scale: 0.95 }] }]}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#38BDF8', includeFontPadding: false } as any}>TAP</Text>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', includeFontPadding: false } as any}>TEMPO</Text>
          </Pressable>
        </View>
      </View>

      {/* Mode toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
        <Pressable onPress={() => setMode('pads')}
          style={({ pressed }) => [{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: mode === 'pads' ? '#38BDF8' : 'rgba(255,255,255,0.1)', backgroundColor: mode === 'pads' ? '#38BDF820' : 'transparent' }, pressed && { opacity: 0.7 }]}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: mode === 'pads' ? '#38BDF8' : 'rgba(255,255,255,0.4)', includeFontPadding: false } as any}>🥁 Live Pads</Text>
        </Pressable>
        <Pressable onPress={() => setMode('sequencer')}
          style={({ pressed }) => [{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: mode === 'sequencer' ? '#A78BFA' : 'rgba(255,255,255,0.1)', backgroundColor: mode === 'sequencer' ? '#A78BFA20' : 'transparent' }, pressed && { opacity: 0.7 }]}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: mode === 'sequencer' ? '#A78BFA' : 'rgba(255,255,255,0.4)', includeFontPadding: false } as any}>🎛️ Sequencer</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 12, paddingBottom: 120 }}>
        {/* Pad Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignSelf: 'center', width: padSize * 4 + 12 }}>
          {kit.pads.map((pad) => {
            const isFlashing = padFlash[pad.id] === true;
            return (
              <Pressable key={pad.id} onPress={() => handlePadPress(pad)}
                style={({ pressed }) => [{
                  width: padSize, height: padSize, borderRadius: 12,
                  backgroundColor: isFlashing ? pad.color + '50' : pad.color + '18',
                  borderWidth: 2,
                  borderColor: isFlashing ? pad.color : pad.color + '50',
                  alignItems: 'center', justifyContent: 'center', gap: 3,
                  shadowColor: isFlashing ? pad.color : 'transparent',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: isFlashing ? 0.9 : 0,
                  shadowRadius: isFlashing ? 14 : 0,
                  elevation: isFlashing ? 6 : 0,
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                }]}>
                <Text style={{ fontSize: padSize > 70 ? 22 : 18 }}>{pad.emoji}</Text>
                <Text style={{ fontSize: padSize > 70 ? 11 : 9, fontWeight: '800', color: pad.color, includeFontPadding: false } as any}>{pad.name}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Sequencer */}
        {mode === 'sequencer' ? (
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', paddingLeft: 56 }}>
              {Array.from({ length: MB_NUM_STEPS }, (_, i) => (
                <View key={i} style={{ width: seqCellW, height: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: currentStep === i ? 'rgba(56,189,248,0.25)' : 'transparent', borderRadius: 3 }}>
                  {i % 4 === 0 ? <Text style={{ fontSize: 8, fontWeight: '700', color: currentStep === i ? '#38BDF8' : 'rgba(255,255,255,0.25)', includeFontPadding: false } as any}>{i/4+1}</Text> : null}
                </View>
              ))}
            </View>
            {Array.from({ length: MB_NUM_TRACKS }, (_, track) => {
              const pad = kit.pads.find(p => p.row === track);
              if (!pad) return null;
              const isFlash = trackFlash[track] === true;
              return (
                <View key={track} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Pressable onPress={() => handlePadPress(pad)} style={[{ width: 50, height: seqRowH, borderRadius: 8, backgroundColor: isFlash ? pad.color + '40' : pad.color + '15', borderWidth: 1.5, borderColor: isFlash ? pad.color : pad.color + '40', alignItems: 'center', justifyContent: 'center', shadowColor: isFlash ? pad.color : 'transparent', shadowOpacity: isFlash ? 0.8 : 0, shadowRadius: 8, elevation: isFlash ? 4 : 0 }]}>
                    <Text style={{ fontSize: 14 }}>{pad.emoji}</Text>
                    <Text style={{ fontSize: 7, fontWeight: '800', color: pad.color, includeFontPadding: false } as any}>{pad.name}</Text>
                  </Pressable>
                  {Array.from({ length: MB_NUM_STEPS }, (_, step) => {
                    const active = steps[track][step];
                    const isCurrent = currentStep === step && playing;
                    const isDownbeat = step % 4 === 0;
                    return (
                      <Pressable key={step} onPress={() => toggleStep(track, step)}
                        style={[{ width: seqCellW, height: seqRowH, borderRadius: 5,
                          backgroundColor: active ? (isCurrent ? pad.color : pad.color + '90') : (isCurrent ? 'rgba(255,255,255,0.15)' : isDownbeat ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'),
                          borderWidth: isCurrent ? 1.5 : 1,
                          borderColor: active ? pad.color : isCurrent ? 'rgba(255,255,255,0.4)' : isDownbeat ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                        }]} />
                    );
                  })}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Preset patterns */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.2, textTransform: 'uppercase', includeFontPadding: false } as any}>Quick Patterns</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['four-on-floor', 'boom-bap', 'breakbeat'] as const).map(p => (
              <Pressable key={p} onPress={() => loadPreset(p)}
                style={({ pressed }) => [{ flex: 1, paddingVertical: 8, borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }, pressed && { opacity: 0.7 }]}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', includeFontPadding: false, textAlign: 'center' } as any}>
                  {p === 'four-on-floor' ? '🎶 4-on-Floor' : p === 'boom-bap' ? '🥊 Boom Bap' : '💥 Breakbeat'}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={clearAll}
              style={({ pressed }) => [{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.lg, backgroundColor: 'rgba(255,107,107,0.08)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.2)', alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF6B6B', includeFontPadding: false } as any}>✕</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: Radius.lg, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
          <MaterialIcons name="lightbulb-outline" size={13} color="rgba(255,255,255,0.3)" />
          <Text style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 16, includeFontPadding: false } as any}>
            Tap pads live · Switch to Sequencer to program patterns · All sounds synthesized on-device
          </Text>
        </View>
      </ScrollView>

      {/* Transport bar */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0D0F1E', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingVertical: 10, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 2, flex: 1 }}>
          {Array.from({ length: 16 }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: currentStep === i && playing ? '#38BDF8' : i % 4 === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)' }} />
          ))}
        </View>
        <Pressable
          onPress={() => setPlaying(p => !p)}
          style={({ pressed }) => [{ width: 52, height: 52, borderRadius: 26, backgroundColor: playing ? '#FF6B6B20' : '#38BDF820', borderWidth: 2, borderColor: playing ? '#FF6B6B' : '#38BDF8', alignItems: 'center', justifyContent: 'center', shadowColor: playing ? '#FF6B6B' : '#38BDF8', shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <MaterialIcons name={playing ? 'stop' : 'play-arrow'} size={28} color={playing ? '#FF6B6B' : '#38BDF8'} />
        </Pressable>
      </View>
    </View>
  );
}
