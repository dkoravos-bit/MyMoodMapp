/**
 * Schumann Resonance service
 * The Schumann resonances are global electromagnetic resonances excited by
 * lightning discharges in the Earth-ionosphere cavity. The base frequency
 * is ~7.83 Hz. Spikes above ~12–15 Hz correlate with elevated geomagnetic
 * activity and can affect human nervous system, sleep, and mood.
 *
 * Since no free public real-time API is reliably available, we model the
 * resonance using a combination of:
 *  - Known baseline (7.83 Hz)
 *  - Geomagnetic K-index simulation (0–9, driven by solar cycle approximation)
 *  - Time-of-day variation (ionospheric thinning at night)
 *  - Seasonal variation
 *  - Pseudo-random daily variation seeded by date (deterministic per day)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'vibe_schumann_cache';

export interface SchumannReading {
  frequency: number;        // Hz, typically 7.5–40+
  amplitude: number;        // relative power 0–100
  kIndex: number;           // geomagnetic K-index 0–9
  status: SchumannStatus;
  date: string;             // YYYY-MM-DD
  timestamp: number;
  physicalEffects: SchumannPhysicalEffect[];
  recommendation: string;
  trend: 'spiking' | 'elevated' | 'normal' | 'low';
  historicalComparison: string;
}

export type SchumannStatus = 'calm' | 'moderate' | 'elevated' | 'high' | 'extreme';

export interface SchumannPhysicalEffect {
  system: string;
  effect: string;
  severity: 'mild' | 'moderate' | 'strong';
  icon: string;
}

// Physical effects database keyed by status
const PHYSICAL_EFFECTS_DB: Record<SchumannStatus, SchumannPhysicalEffect[]> = {
  calm: [
    { system: 'Nervous system', effect: 'Deeply in sync with Earth\'s baseline frequency. Mental clarity and calm are enhanced.', severity: 'mild', icon: 'self-improvement' },
    { system: 'Sleep', effect: 'Optimal for deep, restorative sleep. REM sleep quality is typically higher during calm periods.', severity: 'mild', icon: 'bedtime' },
  ],
  moderate: [
    { system: 'Nervous system', effect: 'Slight arousal in the nervous system. Some people report heightened focus or creativity.', severity: 'mild', icon: 'psychology' },
    { system: 'Cardiovascular', effect: 'Minor elevation in heart rate variability. Blood pressure regulation may vary slightly.', severity: 'mild', icon: 'favorite' },
  ],
  elevated: [
    { system: 'Brain', effect: 'Alpha-theta brainwave entrainment disrupted. Concentration may be harder; some report heightened intuition or vivid dreams.', severity: 'moderate', icon: 'memory' },
    { system: 'Sleep', effect: 'Sleep onset may be delayed. Lighter sleep cycles, more frequent waking reported.', severity: 'moderate', icon: 'bedtime' },
    { system: 'Nervous system', effect: 'Heightened nervous system sensitivity. Anxiety-prone individuals may notice amplified stress responses.', severity: 'moderate', icon: 'electric-bolt' },
  ],
  high: [
    { system: 'Nervous system', effect: 'Strong geomagnetic stimulation — fight-or-flight system can be mildly activated. Grounding practices highly recommended.', severity: 'strong', icon: 'electric-bolt' },
    { system: 'Sleep', effect: 'Significant sleep disruption likely. Melatonin production can be suppressed by elevated EM activity.', severity: 'strong', icon: 'bedtime' },
    { system: 'Cardiovascular', effect: 'Research links high Schumann periods to increased blood pressure and heart rate in sensitive individuals.', severity: 'strong', icon: 'favorite' },
    { system: 'Head & pressure', effect: 'Increased incidence of headaches, pressure behind the eyes, and sinus sensitivity during high-activity periods.', severity: 'moderate', icon: 'face' },
  ],
  extreme: [
    { system: 'Nervous system', effect: 'Extreme geomagnetic disturbance. Autonomic nervous system dysregulation possible in sensitive people — symptoms may resemble acute anxiety.', severity: 'strong', icon: 'warning' },
    { system: 'Cardiovascular', effect: 'Highest risk window for elevated heart rate, arrhythmia sensitivity, and hypertension spikes.', severity: 'strong', icon: 'favorite' },
    { system: 'Sleep', effect: 'Deep sleep is nearly impossible for electromagnetically sensitive individuals. Dreams may be very vivid or disturbing.', severity: 'strong', icon: 'bedtime' },
    { system: 'Head & pressure', effect: 'Severe headaches, brain fog, and disorientation are frequently reported during geomagnetic storms.', severity: 'strong', icon: 'face' },
    { system: 'Immune', effect: 'Prolonged extreme periods can temporarily suppress immune response. Rest and nutrition support are critical.', severity: 'moderate', icon: 'healing' },
  ],
};

const RECOMMENDATIONS: Record<SchumannStatus, string> = {
  calm: 'Earth\'s resonance is in harmony with your nervous system today. This is an ideal time for meditation, deep focus work, and restful sleep. Spend time outdoors barefoot if possible.',
  moderate: 'A mild uptick in activity. Stay well-hydrated, reduce screen time before bed, and take conscious breathing breaks during work.',
  elevated: 'The field is active today. Ground yourself with walks on natural surfaces, reduce caffeine, and start your wind-down routine at least an hour earlier than usual.',
  high: 'High resonance activity detected. Prioritize grounding: minimize EMF exposure (airplane mode at night), eat mineral-rich foods (magnesium, potassium), and avoid high-intensity exercise late in the day.',
  extreme: 'Extreme geomagnetic disturbance. Take extra care with rest, hydration, and stress management. Sensitive individuals should avoid major decisions today and prioritize self-care above all else.',
};

// ─── Simulation Engine ────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function getSchumannReading(date: Date = new Date()): SchumannReading {
  const dateStr = date.toISOString().split('T')[0];
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const hour = date.getHours();

  // Seed from date for deterministic daily values
  const seed = date.getFullYear() * 1000 + dayOfYear;

  // Solar cycle approximation (11-year cycle, current ~cycle 25, peaked ~2025)
  const solarCyclePhase = ((date.getFullYear() - 2019) % 11) / 11;
  const solarFactor = 0.5 + 0.5 * Math.sin(2 * Math.PI * solarCyclePhase);

  // Time of day: ionosphere thins at dawn/dusk, thickens overnight
  const hourFactor = 1 + 0.15 * Math.sin((hour / 24) * 2 * Math.PI + Math.PI);

  // Seasonal: higher in boreal summer (more lightning globally)
  const seasonalFactor = 1 + 0.2 * Math.sin(((dayOfYear - 172) / 365) * 2 * Math.PI);

  // Daily pseudo-random variation
  const dailyVariation = 0.6 + seededRandom(seed) * 0.8;

  // Geomagnetic K-index (0–9): 0–3 quiet, 4–5 unsettled, 6–7 storm, 8–9 severe
  const kRaw = (solarFactor * hourFactor * seasonalFactor * dailyVariation) * 4.5;
  const kIndex = Math.min(9, Math.max(0, Math.round(kRaw)));

  // Base Schumann frequency 7.83 Hz, elevated by activity
  const baseFreq = 7.83;
  const freqBoost = kIndex * 1.8 + seededRandom(seed * 2) * 2.5;
  const frequency = parseFloat((baseFreq + freqBoost).toFixed(2));

  // Amplitude (relative power)
  const amplitude = Math.min(100, Math.round(20 + kIndex * 9 + seededRandom(seed * 3) * 15));

  // Status
  let status: SchumannStatus;
  if (kIndex <= 1) status = 'calm';
  else if (kIndex <= 3) status = 'moderate';
  else if (kIndex <= 5) status = 'elevated';
  else if (kIndex <= 7) status = 'high';
  else status = 'extreme';

  // Trend
  let trend: SchumannReading['trend'];
  if (kIndex >= 7) trend = 'spiking';
  else if (kIndex >= 5) trend = 'elevated';
  else if (kIndex >= 2) trend = 'normal';
  else trend = 'low';

  // Historical comparison
  const avgFreq = 7.83 + 3.5; // typical average with noise
  const diffPct = Math.round(((frequency - avgFreq) / avgFreq) * 100);
  const historicalComparison = diffPct > 15
    ? `${diffPct}% above typical baseline — notably active`
    : diffPct < -10
    ? `${Math.abs(diffPct)}% below baseline — unusually calm`
    : 'within typical daily range';

  return {
    frequency,
    amplitude,
    kIndex,
    status,
    date: dateStr,
    timestamp: date.getTime(),
    physicalEffects: PHYSICAL_EFFECTS_DB[status],
    recommendation: RECOMMENDATIONS[status],
    trend,
    historicalComparison,
  };
}

// ─── Cache (refresh once per hour) ───────────────────────

export async function getCachedSchumannReading(): Promise<SchumannReading | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: SchumannReading = JSON.parse(raw);
    // Stale after 60 minutes
    if (Date.now() - cached.timestamp > 60 * 60 * 1000) return null;
    return cached;
  } catch {
    return null;
  }
}

export async function fetchAndCacheSchumann(): Promise<SchumannReading> {
  const reading = getSchumannReading();
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(reading));
  return reading;
}

// ─── Display helpers ──────────────────────────────────────

export function getStatusColor(status: SchumannStatus): string {
  return {
    calm: '#4ECDC4',
    moderate: '#95E06C',
    elevated: '#FFD166',
    high: '#FF8C42',
    extreme: '#FF6B6B',
  }[status];
}

export function getStatusEmoji(status: SchumannStatus): string {
  return { calm: '🌿', moderate: '🌊', elevated: '⚡', high: '🔥', extreme: '🌪️' }[status];
}

export function getKIndexLabel(k: number): string {
  if (k <= 1) return 'Quiet';
  if (k <= 3) return 'Unsettled';
  if (k <= 5) return 'Active';
  if (k <= 7) return 'Storm';
  return 'Severe Storm';
}

export function getStatusLabel(status: SchumannStatus): string {
  return { calm: 'Calm', moderate: 'Moderate', elevated: 'Elevated', high: 'High Activity', extreme: 'Extreme' }[status];
}
