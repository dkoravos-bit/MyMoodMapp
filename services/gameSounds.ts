/**
 * Game Sound Effects — MyMoodMapp
 *
 * Synthesised on-device via Web Audio API (web) or PCM WAV + expo-av (native).
 * No audio files needed. All sounds are < 200ms and designed to feel satisfying.
 *
 * API
 * ───
 *   playBubblePop(variation?)   — bubble wrap pop
 *   playBubbleAllPopped()       — victory fanfare
 *   playBreathPhase(phase)      — whoosh for inhale / exhale / hold
 *   playSandStroke()            — soft brush for zen sand
 *   play2048Slide()             — tile slide click
 *   play2048Merge(tileValue)    — satisfying merge chime (pitch scales with value)
 *   play2048GameOver()          — low thud
 *   play2048Win()               — bright fanfare
 *   playMandalaPlace()          — crystal ping (pitch varies per ring)
 *   playPixelPaint()            — tiny soft click
 */

import { Platform } from 'react-native';
// expo-audio replaces expo-av. Loaded via lazy require inside functions to
// avoid any module-level native initialization that caused SIGABRT on iOS 26.
function _getExpoAudioPlayer() {
  if (Platform.OS === 'web') return null;
  try { return require('expo-audio').createAudioPlayer; } catch { return null; }
}

// ── Pure-JS base64 encoder (no btoa on Android) ───────────────────────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i+1] ?? 0, b2 = bytes[i+2] ?? 0;
    out.push(
      B64[b0 >> 2],
      B64[((b0 & 3) << 4) | (b1 >> 4)],
      i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=',
      i + 2 < bytes.length ? B64[b2 & 63] : '=',
    );
  }
  return out.join('');
}

// ── WAV builder ───────────────────────────────────────────────────────────
const SR = 22050;

function buildWav(samples: Float32Array): string {
  // Normalise
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const scale = peak > 0.001 ? 0.85 / peak : 1;

  const N = samples.length;
  const buf = new Uint8Array(44 + N * 2);
  const setU32 = (off: number, v: number) => {
    buf[off]=v&0xff; buf[off+1]=(v>>8)&0xff;
    buf[off+2]=(v>>16)&0xff; buf[off+3]=(v>>24)&0xff;
  };
  // RIFF header
  buf[0]=0x52;buf[1]=0x49;buf[2]=0x46;buf[3]=0x46; setU32(4,36+N*2);
  buf[8]=0x57;buf[9]=0x41;buf[10]=0x56;buf[11]=0x45;
  buf[12]=0x66;buf[13]=0x6d;buf[14]=0x74;buf[15]=0x20; setU32(16,16);
  buf[20]=1;buf[21]=0; buf[22]=1;buf[23]=0; // PCM mono
  setU32(24,SR); setU32(28,SR*2); buf[32]=2;buf[33]=0; buf[34]=16;buf[35]=0;
  buf[36]=0x64;buf[37]=0x61;buf[38]=0x74;buf[39]=0x61; setU32(40,N*2);
  for (let i = 0; i < N; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] * scale));
    const v = s < 0 ? Math.round(s*32768) : Math.round(s*32767);
    buf[44+i*2] = v & 0xff; buf[44+i*2+1] = (v >> 8) & 0xff;
  }
  return `data:audio/wav;base64,${toBase64(buf)}`;
}

// ── Small pool of one-shot expo-av sounds (reused to keep memory low) ─────
const soundPool: any[] = [];
async function playWav(uri: string, volume = 1.0): Promise<void> {
  if (Platform.OS === 'web') return; // web uses AudioContext path
  const createAudioPlayer = _getExpoAudioPlayer();
  if (!createAudioPlayer) return;
  try {
    const player = createAudioPlayer({ uri });
    player.volume = Math.max(0, Math.min(1, volume));
    player.loop = false;
    player.play();
    soundPool.push(player);
    // Auto-clean after estimated playback (expo-audio doesn't have a simple
    // synchronous status callback equivalent — use a generous timeout cleanup)
    setTimeout(() => {
      try { player.remove(); } catch {}
      const idx = soundPool.indexOf(player);
      if (idx >= 0) soundPool.splice(idx, 1);
    }, 3000);
  } catch {}
}

// ── Web Audio helpers ─────────────────────────────────────────────────────
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const W = window as any;
  const Cls = W.AudioContext || W.webkitAudioContext;
  if (!Cls) return null;
  if (!W.__gameSoundCtx || W.__gameSoundCtx.state === 'closed') {
    W.__gameSoundCtx = new Cls();
  }
  return W.__gameSoundCtx as AudioContext;
}

// Returns a ready (running) AudioContext, resuming if needed.
async function getReadyCtx(): Promise<AudioContext | null> {
  const ctx = getCtx();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch {}
  }
  return ctx;
}

function webPlayBuffer(ctx: AudioContext, buffer: AudioBuffer, volume = 1.0): void {
  const gain = ctx.createGain();
  gain.gain.value = volume;
  gain.connect(ctx.destination);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(gain);
  src.start();
  src.onended = () => { try { gain.disconnect(); } catch {} };
}

function makeBuffer(ctx: AudioContext, samples: Float32Array): AudioBuffer {
  const buf = ctx.createBuffer(1, samples.length, SR);
  buf.copyToChannel(samples, 0);
  return buf;
}

// ── DSP helpers ────────────────────────────────────────────────────────────

function envelope(N: number, attackFrac: number, decayFrac: number, sustain: number, releaseFrac: number): Float32Array {
  const env = new Float32Array(N);
  const atk = Math.floor(N * attackFrac);
  const dec = Math.floor(N * decayFrac);
  const rel = Math.floor(N * releaseFrac);
  const sus = N - atk - dec - rel;
  for (let i = 0; i < atk; i++) env[i] = i / Math.max(1, atk);
  for (let i = 0; i < dec; i++) env[atk + i] = 1 - (1 - sustain) * (i / Math.max(1, dec));
  for (let i = 0; i < sus; i++) env[atk + dec + i] = sustain;
  for (let i = 0; i < rel; i++) env[atk + dec + sus + i] = sustain * (1 - i / Math.max(1, rel));
  return env;
}

function expDecay(N: number, tau: number): Float32Array {
  const env = new Float32Array(N);
  for (let i = 0; i < N; i++) env[i] = Math.exp(-i / tau);
  return env;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOUND GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

// ── Bubble wrap pop ───────────────────────────────────────────────────────
// Short bandpass-filtered noise burst with sub-bass thump — the classic pop
function makeBubblePop(variation = 0): Float32Array {
  // variation 0–1 changes pitch slightly for natural variety
  const dur = 0.08 + variation * 0.04; // 80–120 ms
  const N = Math.ceil(SR * dur);
  const out = new Float32Array(N);

  // Sub-bass thump component (like air releasing)
  const thumpHz = 120 + variation * 60;
  const thumpDecay = expDecay(N, SR * 0.025);
  for (let i = 0; i < N; i++) {
    out[i] += Math.sin(2 * Math.PI * thumpHz * i / SR) * thumpDecay[i] * 0.5;
  }

  // Broadband noise burst (the pop sound itself)
  const env = expDecay(N, SR * 0.018);
  // Simple one-pole LP filter to shape the noise
  let prev = 0;
  const lp = 0.3 + variation * 0.15; // cutoff varies
  for (let i = 0; i < N; i++) {
    const w = Math.random() * 2 - 1;
    prev = lp * w + (1 - lp) * prev;
    out[i] += prev * env[i] * 0.8;
  }

  // High click transient at very start
  const clickLen = Math.floor(SR * 0.004);
  for (let i = 0; i < Math.min(clickLen, N); i++) {
    out[i] += (Math.random() * 2 - 1) * (1 - i / clickLen) * 0.4;
  }

  return out;
}

// ── All-popped celebration ───────────────────────────────────────────────
function makeAllPopped(): Float32Array {
  const dur = 0.6;
  const N = Math.ceil(SR * dur);
  const out = new Float32Array(N);
  const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  for (let f = 0; f < freqs.length; f++) {
    const startSample = Math.floor(SR * f * 0.10);
    const noteDur = Math.floor(SR * 0.25);
    for (let i = 0; i < noteDur && startSample + i < N; i++) {
      const env = i < SR * 0.01 ? i / (SR * 0.01) : Math.exp(-(i - SR * 0.01) / (SR * 0.08));
      out[startSample + i] += Math.sin(2 * Math.PI * freqs[f] * i / SR) * env * 0.25;
      out[startSample + i] += Math.sin(2 * Math.PI * freqs[f] * 2 * i / SR) * env * 0.08;
    }
  }
  return out;
}

// ── Breathing phase — realistic breath synthesis ─────────────────────────
//
// Three-layer model for efficiency + realism:
//
//  1. PINK-TINTED NOISE — two-stage LP pre-filter tilts white noise toward
//     1/f spectrum (real breath has more low-frequency energy than white).
//
//  2. THREE-POLE FORMANT CASCADE (one-pole LP per formant) — shapes the
//     noise into nasal cavity resonances (inhale) or open-mouth resonances
//     (exhale).  Three poles is enough to be convincingly human without
//     the CPU cost of the five-pole version that caused the JS freeze.
//
//  3. NATURAL AMPLITUDE ENVELOPE — inhale eases in slowly (diaphragm
//     resistance), holds steady, tapers at top.  Exhale peaks quickly
//     then slowly decays (passive lung recoil).
//
//  4. RESPIRATORY TREMOR (~1.8 Hz ±4% AM) — the natural diaphragm wobble.
//
// Hold: complete silence.
function makeBreathWhoosh(phase: 'inhale' | 'exhale' | 'hold', durationSecs?: number): Float32Array {
  if (phase === 'hold') return new Float32Array(Math.ceil(SR * 0.05));

  const dur = durationSecs ?? (phase === 'inhale' ? 1.8 : 2.2);
  const N   = Math.ceil(SR * dur);
  const samples = new Float32Array(N);

  // ── 1. Pink-tinted noise (two one-pole LP pre-filters) ────────────────
  // Converts white noise toward 1/f — vastly cheaper than full Kellet algorithm
  let pinkA = 0, pinkB = 0;
  const pinkAlphaA = 0.98; // very low shelf ~11 Hz
  const pinkAlphaB = 0.92; // low shelf ~55 Hz
  const pinkNoise = (): number => {
    const w = Math.random() * 2 - 1;
    pinkA = pinkAlphaA * pinkA + (1 - pinkAlphaA) * w;
    pinkB = pinkAlphaB * pinkB + (1 - pinkAlphaB) * w;
    return (w * 0.35 + pinkA * 0.40 + pinkB * 0.25);
  };

  // ── 2. Amplitude envelope ─────────────────────────────────────────────
  const getAmp = (t: number): number => {
    if (phase === 'inhale') {
      if (t < 0.12) return Math.pow(t / 0.12, 0.7);   // concave-up start
      if (t < 0.72) return 1.0;                          // full flow
      return Math.pow(1.0 - (t - 0.72) / 0.28, 1.5);   // taper at top
    } else {
      if (t < 0.05) return t / 0.05;                    // instant onset
      if (t < 0.20) return 1.0;                          // peak plateau
      return Math.pow(1.0 - (t - 0.20) / 0.80, 0.60);  // long passive fade
    }
  };

  // ── 3. Three-pole formant cascade (one-pole LP each) ─────────────────
  // Inhale: nasal passage — tight mid-forward resonances
  //   F1 ~ 350 Hz  nasal body / muffled low
  //   F2 ~ 900 Hz  pharyngeal "hhhh" character
  //   F3 ~ 2800 Hz airy high-frequency shimmer
  //
  // Exhale: open mouth — warmer, more open-vowel
  //   F1 ~ 550 Hz  open-mouth body
  //   F2 ~ 1100 Hz throat resonance
  //   F3 ~ 3200 Hz lip-turbulence shimmer
  const f1hz = phase === 'inhale' ? 350  : 550;
  const f2hz = phase === 'inhale' ? 900  : 1100;
  const f3hz = phase === 'inhale' ? 2800 : 3200;

  const a1 = Math.exp(-2 * Math.PI * f1hz / SR);
  const a2 = Math.exp(-2 * Math.PI * f2hz / SR);
  const a3 = Math.exp(-2 * Math.PI * f3hz / SR);

  // Mix weights — lower poles carry more energy
  const w1 = phase === 'inhale' ? 0.50 : 0.48;
  const w2 = phase === 'inhale' ? 0.32 : 0.34;
  const w3 = 0.18;

  let lp1 = 0, lp2 = 0, lp3 = 0;

  // ── 4. Chest sub-bass on exhale (one-pole LP ~80 Hz) ─────────────────
  let chest = 0;
  const chestA = Math.exp(-2 * Math.PI * 80 / SR);

  // ── 5. Respiratory tremor ─────────────────────────────────────────────
  const tremorHz = 1.8;

  // ── Render loop ───────────────────────────────────────────────────────
  for (let i = 0; i < N; i++) {
    const t   = i / N;
    const amp = getAmp(t);
    const tremor = 1.0 + 0.04 * Math.sin(2 * Math.PI * tremorHz * i / SR);

    const p = pinkNoise();

    // Three-pole formant shaping
    lp1 = (1 - a1) * p   + a1 * lp1;
    lp2 = (1 - a2) * p   + a2 * lp2;
    lp3 = (1 - a3) * p   + a3 * lp3;
    let sig = lp1 * w1 + lp2 * w2 + lp3 * w3;

    // Chest rumble on exhale — adds warmth/body
    if (phase === 'exhale') {
      chest = (1 - chestA) * p + chestA * chest;
      sig += chest * 0.22;
    }

    samples[i] = sig * amp * tremor;
  }

  // Smooth boundaries to eliminate clicks
  const fadeN = Math.min(Math.floor(SR * 0.035), N);
  for (let i = 0; i < fadeN; i++) {
    const w = i / fadeN;
    samples[i]         *= w;
    samples[N - 1 - i] *= w;
  }

  return samples;
}

// ── Zen sand — soothing rake-through-sand stroke ────────────────────────
// 280 ms of deep, low-frequency scraping.  Sub-bass dominant, warm mid, tiny
// shimmer — sounds like fingers or a rake dragged slowly through fine dry sand.
function makeSandStroke(): Float32Array {
  const dur = 0.28;
  const N   = Math.ceil(SR * dur);
  const sandOut = new Float32Array(N);

  // Smooth onset / sustained body / slow release
  const ATK = Math.floor(N * 0.12);
  const REL = Math.floor(N * 0.38);
  const SUS = N - ATK - REL;
  const getEnv = (i: number): number => {
    if (i < ATK)       return (i / ATK) * (i / ATK);
    if (i < ATK + SUS) return 1.0;
    return Math.pow(1.0 - (i - ATK - SUS) / REL, 1.4);
  };

  // One-pole LP coefficients
  const subA  = Math.exp(-2 * Math.PI * 65  / SR);  // 65 Hz  sub-bass body
  const midA  = Math.exp(-2 * Math.PI * 160 / SR);  // 160 Hz warm scrape
  const shimA = Math.exp(-2 * Math.PI * 550 / SR);  // 550 Hz faint shimmer

  let subLP = 0, midLP = 0, shimLP = 0;

  // Slow grain-texture modulation (~9 Hz)
  const chatHz = 9;

  for (let i = 0; i < N; i++) {
    const raw = Math.random() * 2 - 1;
    subLP  = (1 - subA)  * raw + subA  * subLP;
    midLP  = (1 - midA)  * raw + midA  * midLP;
    shimLP = (1 - shimA) * raw + shimA * shimLP;

    const chat = 0.90 + 0.10 * Math.abs(Math.sin(2 * Math.PI * chatHz * i / SR));
    const sig  = subLP * 0.58 + midLP * 0.35 + shimLP * 0.07;
    sandOut[i] = sig * getEnv(i) * chat * 0.6;
  }

  const fadeN = Math.min(Math.floor(SR * 0.010), N);
  for (let i = 0; i < fadeN; i++) {
    sandOut[i]         *= i / fadeN;
    sandOut[N - 1 - i] *= i / fadeN;
  }

  return sandOut;
}

// ── 2048 tile slide ───────────────────────────────────────────────────────
function make2048Slide(): Float32Array {
  const N = Math.ceil(SR * 0.07);
  const out = new Float32Array(N);
  const env = expDecay(N, SR * 0.02);
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const w = Math.random() * 2 - 1;
    prev = 0.4 * w + 0.6 * prev;
    out[i] = prev * env[i] * 0.5;
  }
  // Add a brief high-freq transient
  const clickN = Math.floor(SR * 0.005);
  for (let i = 0; i < Math.min(clickN, N); i++) {
    out[i] += (Math.random() * 2 - 1) * (1 - i / clickN) * 0.3;
  }
  return out;
}

// ── 2048 tile merge ───────────────────────────────────────────────────────
// Pitch scales with log2(value): 2→low, 2048→high
function make2048Merge(tileValue: number): Float32Array {
  const step = Math.log2(Math.max(2, tileValue));
  const baseHz = 220 * Math.pow(1.15, step); // ~220 Hz → ~880 Hz
  const N = Math.ceil(SR * 0.18);
  const out = new Float32Array(N);
  const env = envelope(N, 0.02, 0.0, 0.6, 0.35);
  const harmEnv = expDecay(N, SR * 0.04);
  for (let i = 0; i < N; i++) {
    out[i] = Math.sin(2 * Math.PI * baseHz * i / SR) * env[i] * 0.4;
    out[i] += Math.sin(2 * Math.PI * baseHz * 2 * i / SR) * harmEnv[i] * 0.12;
    out[i] += Math.sin(2 * Math.PI * baseHz * 3 * i / SR) * harmEnv[i] * 0.06;
  }
  return out;
}

// ── 2048 game over ────────────────────────────────────────────────────────
function make2048GameOver(): Float32Array {
  const dur = 0.5;
  const N = Math.ceil(SR * dur);
  const out = new Float32Array(N);
  const startHz = 300, endHz = 120;
  let phase = 0;
  const env = expDecay(N, SR * 0.15);
  for (let i = 0; i < N; i++) {
    const hz = startHz + (endHz - startHz) * (i / N);
    phase += 2 * Math.PI * hz / SR;
    out[i] = Math.sin(phase) * env[i] * 0.5;
    // Low rumble
    out[i] += (Math.random() * 2 - 1) * env[i] * 0.15;
  }
  return out;
}

// ── 2048 win ──────────────────────────────────────────────────────────────
function make2048Win(): Float32Array {
  const dur = 1.0;
  const N = Math.ceil(SR * dur);
  const out = new Float32Array(N);
  const melody = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  for (let f = 0; f < melody.length; f++) {
    const start = Math.floor(SR * f * 0.16);
    const len   = Math.floor(SR * 0.22);
    for (let i = 0; i < len && start + i < N; i++) {
      const tFrac = i / len;
      const env = tFrac < 0.08 ? tFrac / 0.08 : Math.exp(-(i - len * 0.08) / (SR * 0.12));
      out[start + i] += Math.sin(2 * Math.PI * melody[f] * i / SR) * env * 0.3;
      out[start + i] += Math.sin(2 * Math.PI * melody[f] * 2 * i / SR) * env * 0.1;
    }
  }
  return out;
}

// ── Dot Mandala crystal ping ──────────────────────────────────────────────
// Pitch varies with ring distance from center
function makeMandalaPlace(ringIndex: number): Float32Array {
  const hz = 440 * Math.pow(1.12, (ringIndex % 8)); // pentatonic-ish
  const N = Math.ceil(SR * 0.22);
  const out = new Float32Array(N);
  const env = envelope(N, 0.01, 0.0, 0.5, 0.6);
  const decFast = expDecay(N, SR * 0.025);
  for (let i = 0; i < N; i++) {
    // Fundamental
    out[i] = Math.sin(2 * Math.PI * hz * i / SR) * env[i] * 0.35;
    // 2nd harmonic (bell-like)
    out[i] += Math.sin(2 * Math.PI * hz * 2.756 * i / SR) * decFast[i] * 0.15;
    // 3rd harmonic
    out[i] += Math.sin(2 * Math.PI * hz * 5.404 * i / SR) * decFast[i] * 0.06;
  }
  return out;
}

// ── Pixel art paint click ─────────────────────────────────────────────────
function makePixelClick(): Float32Array {
  const N = Math.ceil(SR * 0.025);
  const out = new Float32Array(N);
  const env = expDecay(N, SR * 0.006);
  for (let i = 0; i < N; i++) {
    out[i] = (Math.random() * 2 - 1) * env[i] * 0.35;
  }
  // Brief tonal tick
  const tickN = Math.floor(SR * 0.004);
  for (let i = 0; i < Math.min(tickN, N); i++) {
    out[i] += Math.sin(2 * Math.PI * 1800 * i / SR) * (1 - i / tickN) * 0.2;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB AUDIO BUFFER CACHE (one-time synthesis, reuse across calls)
// ─────────────────────────────────────────────────────────────────────────────
const webCache: Map<string, AudioBuffer> = new Map();

async function webPlay(key: string, buildSamples: () => Float32Array, volume = 0.9): Promise<void> {
  try {
    const ctx = await getReadyCtx();
    if (!ctx) return;
    let buf = webCache.get(key);
    if (!buf) {
      buf = makeBuffer(ctx, buildSamples());
      webCache.set(key, buf);
    }
    webPlayBuffer(ctx, buf, volume);
  } catch {}
}

// WAV data URI cache for native (built once, reused)
const nativeCache: Map<string, string> = new Map();

function nativePlay(key: string, buildSamples: () => Float32Array, volume = 0.9): void {
  try {
    let uri = nativeCache.get(key);
    if (!uri) {
      uri = buildWav(buildSamples());
      nativeCache.set(key, uri);
    }
    playWav(uri, volume);
  } catch {}
}

function play(key: string, buildSamples: () => Float32Array, volume = 0.9): void {
  if (Platform.OS === 'web') {
    webPlay(key, buildSamples, volume).catch(() => {});
  } else {
    nativePlay(key, buildSamples, volume);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

let _bubbleVariationIdx = 0;

/** Call when a bubble is popped. Cycles through 3 slight pitch variations. */
export function playBubblePop(): void {
  const v = _bubbleVariationIdx;
  _bubbleVariationIdx = (v + 1) % 3;
  const variation = v / 2; // 0, 0.5, 1.0
  // Don't cache — each pop is unique variation; key by variation slot
  play(`bubble_pop_${v}`, () => makeBubblePop(variation), 0.85);
}

/** Call when all bubbles are popped. */
export function playBubbleAllPopped(): void {
  play('bubble_all', makeAllPopped, 0.7);
}

/** Call on breathing phase change: 'inhale' | 'exhale' | 'hold' */
export function playBreathPhase(phase: 'inhale' | 'exhale' | 'hold', durationSecs?: number): void {
  if (phase === 'hold') return; // silent during hold
  if (Platform.OS === 'web') {
    getReadyCtx().then(ctx => {
      if (!ctx) return;
      try {
        const buf = makeBuffer(ctx, makeBreathWhoosh(phase, durationSecs));
        webPlayBuffer(ctx, buf, 0.92);
      } catch {}
    }).catch(() => {});
  } else {
    try {
      const uri = buildWav(makeBreathWhoosh(phase, durationSecs));
      playWav(uri, 0.92);
    } catch {}
  }
}

/** Call during sand stroke (throttle to every ~150ms to avoid spam). */
export function playSandStroke(): void {
  if (Platform.OS === 'web') {
    getReadyCtx().then(ctx => {
      if (!ctx) return;
      try {
        const buf = makeBuffer(ctx, makeSandStroke());
        webPlayBuffer(ctx, buf, 0.45);
      } catch {}
    }).catch(() => {});
  } else {
    try {
      const uri = buildWav(makeSandStroke());
      playWav(uri, 0.48);
    } catch {}
  }
}

/** Call when a tile slides. */
export function play2048Slide(): void {
  play('tile_slide', make2048Slide, 0.6);
}

/** Call when tiles merge. tileValue = the resulting merged tile number. */
export function play2048Merge(tileValue: number): void {
  // Group by power of 2 for caching
  const step = Math.min(11, Math.floor(Math.log2(Math.max(2, tileValue))));
  play(`tile_merge_${step}`, () => make2048Merge(tileValue), 0.75);
}

/** Call on game over. */
export function play2048GameOver(): void {
  play('tile_gameover', make2048GameOver, 0.6);
}

/** Call when 2048 tile is reached. */
export function play2048Win(): void {
  play('tile_win', make2048Win, 0.7);
}

/** Call when a dot is placed in mandala. ringIndex = Math.floor(distanceFromCenter / 30) */
export function playMandalaPlace(ringIndex: number): void {
  const ring = Math.min(7, Math.max(0, ringIndex % 8));
  play(`mandala_${ring}`, () => makeMandalaPlace(ring), 0.65);
}

/** Call when a pixel is painted. Throttled internally — safe to call on every move event. */
let _lastPixelSoundMs = 0;
export function playPixelPaint(): void {
  // Hard throttle: max one sound every 80ms to avoid flooding the audio thread
  const now = Date.now();
  if (now - _lastPixelSoundMs < 80) return;
  _lastPixelSoundMs = now;
  // Always cache — pixel click is a deterministic short buffer (no randomness needed)
  play('pixel_click', makePixelClick, 0.45);
}
