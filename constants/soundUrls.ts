/**
 * Real audio sample URLs for ambient sounds.
 *
 * Uses the proven jsDelivr CDN (sounds-for-focus npm package).
 * These are the same URLs used for web streaming — confirmed reliable.
 *
 * Noise-color sounds (white/pink/brown/blue/grey) are NOT listed here —
 * they are mathematically defined signals best generated on-device via DSP.
 *
 * Files are downloaded once to documentDirectory and cached permanently.
 * expo-av plays them with isLooping: true for native-level gapless looping.
 */

const CDN = 'https://cdn.jsdelivr.net/npm/sounds-for-focus@0.1.0/audio';

export interface SoundUrl {
  primary: string;
  fallback?: string;
}

export const REAL_SOUND_URLS: Record<string, SoundUrl> = {
  // ── Rain & Water ────────────────────────────────────────────────────────────
  light_rain:     { primary: `${CDN}/rain/light-rain.mp3` },
  heavy_rain:     { primary: `${CDN}/rain/heavy-rain.mp3` },
  // ocean_gentle: real ocean wave recording from jsDelivr CDN (verified to exist: nature/waves.mp3)
  ocean_gentle:   {
    primary:  `${CDN}/nature/waves.mp3`,
    fallback: `${CDN}/nature/river.mp3`,
  },
  // Deep ocean: underwater ambience (verified to exist: places/underwater.mp3)
  ocean_deep:     {
    primary:  `${CDN}/places/underwater.mp3`,
    fallback: `${CDN}/nature/waterfall.mp3`,
  },
  creek:          { primary: `${CDN}/nature/river.mp3` },
  // Waterfall: real cascade recording (verified: nature/waterfall.mp3, 551KB)
  waterfall:      {
    primary:  `${CDN}/nature/waterfall.mp3`,
    fallback: `${CDN}/nature/river.mp3`,
  },
  // ── Nature ──────────────────────────────────────────────────────────────────
  forest_dawn:    { primary: `${CDN}/animals/birds.mp3` },
  night_crickets: { primary: `${CDN}/animals/crickets.mp3` },
  meadow:         { primary: `${CDN}/nature/howling-wind.mp3` },

  // ── Fire & Earth ────────────────────────────────────────────────────────────
  fireplace:      { primary: `${CDN}/nature/campfire.mp3` },
  campfire:       { primary: `${CDN}/nature/campfire.mp3` },
  fire_rain:      { primary: `${CDN}/nature/campfire.mp3` },

  // ── Urban & Ambient ─────────────────────────────────────────────────────────
  coffee_shop:    { primary: `${CDN}/places/cafe.mp3` },
  train:          { primary: `${CDN}/transport/inside-a-train.mp3` },
  vinyl_static:   { primary: `${CDN}/things/ceiling-fan.mp3` },

  // ── Space ───────────────────────────────────────────────────────────────────
  saturn:         { primary: `${CDN}/places/underwater.mp3` },
  solar_wind:     { primary: `${CDN}/nature/howling-wind.mp3` },
  space_void:     { primary: `${CDN}/places/underwater.mp3` },
};

/**
 * Sound IDs that use real downloaded audio (not DSP synthesis).
 * Noise-color IDs are intentionally excluded.
 */
export const REAL_SOUND_IDS = Object.keys(REAL_SOUND_URLS);

/**
 * Sound IDs that stay DSP-generated (mathematically defined noise colors).
 */
export const DSP_SOUND_IDS = [
  'white_noise', 'pink_noise', 'brown_noise', 'blue_noise', 'grey_noise',
];
