/**
 * SoundCache — Offline-first audio file manager for MyMoodMapp
 *
 * Two caching strategies:
 *
 * ① REAL AUDIO  (nature / ambient sounds)
 *   Downloads a CC0 MP3/OGG from the internet once, stores it in
 *   documentDirectory (persists across launches and OS cache clears).
 *   Falls back to a secondary URL if the primary fails.
 *   Falls back to DSP generation if both URLs fail.
 *
 * ② DSP SYNTHESIS  (noise-color sounds: white/pink/brown/blue/grey)
 *   Generates a seamless PCM WAV on-device via soundLab.ts, stores it in
 *   cacheDirectory (acceptable to lose on low-storage, regenerates easily).
 *
 * In both cases expo-av plays the local file with isLooping: true for
 * native-level gapless looping — zero JS-thread activity at loop boundaries.
 *
 * API
 * ───
 *   getSoundFilePath(id)       → local file path (or null if not cached)
 *   ensureSoundCached(id)      → downloads/generates if needed, returns path
 *   precacheAllSounds()        → fills cache in background (staggered)
 *   clearSoundCache()          → deletes all cached files
 *   getSoundCacheStats()        → { real, dsp, totalMb }
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { REAL_SOUND_URLS, DSP_SOUND_IDS, REAL_SOUND_IDS } from '@/constants/soundUrls';
import { buildSeamlessWavForId } from './soundLab';

// ── Version tags ──────────────────────────────────────────────────────────────
// Bump REAL_VER when swapping source URLs; bump DSP_VER when DSP code changes.
const REAL_VER = 'r5'; // bumped: thunderstorm now uses jungle.mp3 (heavy rain + wind, verified CDN)
const DSP_VER  = 'v4';

// All sound IDs managed by this service
export const ALL_SOUND_IDS = [...REAL_SOUND_IDS, ...DSP_SOUND_IDS];

// ── Path helpers ──────────────────────────────────────────────────────────────

/** Real-audio files go to documentDirectory — persists forever */
function getRealDir(): string {
  return `${FileSystem.documentDirectory}snd_real/${REAL_VER}/`;
}

/** DSP-generated WAVs go to cacheDirectory — OK to lose */
function getDspDir(): string {
  return `${FileSystem.cacheDirectory}snd_dsp/${DSP_VER}/`;
}

function getRealPath(id: string): string {
  return `${getRealDir()}${id}.mp3`;
}

function getDspPath(id: string): string {
  return `${getDspDir()}${id}.wav`;
}

async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the local file path for a sound if it is already cached,
 * otherwise returns null.
 */
export async function getSoundFilePath(id: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    if (REAL_SOUND_IDS.includes(id)) {
      const path = getRealPath(id);
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && (info as any).size > 5000) return path;
    } else {
      const path = getDspPath(id);
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && (info as any).size > 1000) return path;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Ensures a sound is cached locally, downloading or generating it if needed.
 * Returns the local file path, or null if all attempts failed.
 */
export async function ensureSoundCached(id: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  // ── Already cached? ──────────────────────────────────────────────────────
  const existing = await getSoundFilePath(id);
  if (existing) return existing;

  // ── Real audio download ──────────────────────────────────────────────────
  if (REAL_SOUND_IDS.includes(id)) {
    const urls = REAL_SOUND_URLS[id];
    if (!urls) return null;

    await ensureDir(getRealDir());
    const dest = getRealPath(id);

    for (const url of [urls.primary, urls.fallback].filter(Boolean) as string[]) {
      try {
        const res = await FileSystem.downloadAsync(url, dest);
        if (res.status === 200) {
          const info = await FileSystem.getInfoAsync(dest);
          if (info.exists && (info as any).size > 5000) {
            return dest;
          }
          // file too small — delete and try next URL
          await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
        }
      } catch {
        await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
      }
    }

    // Both URLs failed — fall through to DSP synthesis as last resort
    console.warn(`[SoundCache] Download failed for "${id}", falling back to DSP`);
  }

  // ── DSP synthesis (noise colors + fallback for failed downloads) ──────────
  try {
    const dataUri: string | null = await new Promise((resolve) => {
      setTimeout(() => {
        try   { resolve(buildSeamlessWavForId(id)); }
        catch { resolve(null); }
      }, 0);
    });
    if (!dataUri) return null;

    const base64 = dataUri.replace(/^data:audio\/wav;base64,/, '');
    if (!base64 || base64.length < 100) return null;

    await ensureDir(getDspDir());
    const path = getDspPath(id);
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const info = await FileSystem.getInfoAsync(path);
    if (info.exists && (info as any).size > 1000) return path;
    return null;
  } catch {
    return null;
  }
}

/**
 * Pre-caches all sounds in the background with a stagger to stay non-blocking.
 * Skips sounds that are already cached.
 *
 * @param onProgress optional callback(soundId, cachedCount, totalCount)
 */
export async function precacheAllSounds(
  onProgress?: (id: string, cached: number, total: number) => void,
): Promise<void> {
  if (Platform.OS === 'web') return;

  let cached = 0;
  const total = ALL_SOUND_IDS.length;

  // Download real sounds first (bandwidth-dependent), then generate DSP sounds
  const ordered = [...REAL_SOUND_IDS, ...DSP_SOUND_IDS];

  for (const id of ordered) {
    try {
      const existing = await getSoundFilePath(id);
      if (!existing) {
        await ensureSoundCached(id);
      }
      cached++;
      onProgress?.(id, cached, total);
    } catch {
      // non-fatal
    }
    // 300ms stagger between sounds to keep UI thread responsive
    await new Promise(r => setTimeout(r, 300));
  }
}

/**
 * Deletes all cached audio files (both real downloads and DSP WAVs).
 */
export async function clearSoundCache(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const realBase = `${FileSystem.documentDirectory}snd_real/`;
    const info = await FileSystem.getInfoAsync(realBase);
    if (info.exists) await FileSystem.deleteAsync(realBase, { idempotent: true });
  } catch {}
  try {
    const dspBase = `${FileSystem.cacheDirectory}snd_dsp/`;
    const info = await FileSystem.getInfoAsync(dspBase);
    if (info.exists) await FileSystem.deleteAsync(dspBase, { idempotent: true });
  } catch {}
}

/**
 * Returns cache stats for display in the UI.
 */
export async function getSoundCacheStats(): Promise<{
  realCached: number;
  dspCached: number;
  totalCount: number;
  totalMb: number;
}> {
  if (Platform.OS === 'web') {
    return { realCached: 0, dspCached: 0, totalCount: 0, totalMb: 0 };
  }

  let realCached = 0;
  let dspCached = 0;
  let totalBytes = 0;

  for (const id of REAL_SOUND_IDS) {
    try {
      const info = await FileSystem.getInfoAsync(getRealPath(id));
      if (info.exists && (info as any).size > 5000) {
        realCached++;
        totalBytes += (info as any).size ?? 0;
      }
    } catch {}
  }
  for (const id of DSP_SOUND_IDS) {
    try {
      const info = await FileSystem.getInfoAsync(getDspPath(id));
      if (info.exists && (info as any).size > 1000) {
        dspCached++;
        totalBytes += (info as any).size ?? 0;
      }
    } catch {}
  }

  return {
    realCached,
    dspCached,
    totalCount: ALL_SOUND_IDS.length,
    totalMb: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
  };
}
