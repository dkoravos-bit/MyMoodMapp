/**
 * Sound Library — SoundScape + FrequencyLab definitions
 *
 * Sources:
 *  - Web:    All ambient sounds generated via Web Audio API (zero network).
 *  - Native: Streams CC0/public-domain audio from archive.org + NASA.
 *
 * Audio sourcing guide (for production CDN hosting):
 *  Noise colors:  Generate via Web Audio API — no files needed.
 *  Rain/Water:    Freesound.org (CC0) or BBC Sound Effects (RemArc licence).
 *  Nature:        BBC Sound Effects (broadcast quality) or Freesound CC0.
 *  Fire/Urban:    Freesound CC0 or Zapsplat.com.
 *  Space sounds:  NASA open audio — nasa.gov/solar-system/sounds (no restrictions).
 *  Frequencies:   Generate via Web Audio API — all 40+ tones, zero files.
 *
 * For production: download CC0 sounds → normalise to –14 LUFS → encode as
 * 192kbps MP3 → upload to your own CDN (Cloudflare R2 / AWS S3+CloudFront).
 */

export type SoundCategory =
  | 'noise'
  | 'rain'
  | 'nature'
  | 'fire'
  | 'urban'
  | 'space'
  | 'binaural'
  | 'solfeggio'
  | 'brainwave'
  | 'tones';

export interface SoundTrack {
  id: string;
  name: string;
  category: SoundCategory;
  emoji: string;
  description: string;
  tags: string[];
  /** Used on native as a streaming fallback. On web, sound is generated. */
  url: string;
  bestFor: string[];
  /** Source attribution for display */
  source?: string;
}

export interface FrequencyPreset {
  id: string;
  name: string;
  emoji: string;
  hz: number;
  leftHz?: number;
  rightHz?: number;
  beatHz?: number;
  description: string;
  category: 'solfeggio' | 'brainwave' | 'binaural' | 'tone';
  intention: 'sleep' | 'meditate' | 'focus' | 'heal' | 'energize';
  color: string;
}

export interface QuickMode {
  id: string;
  name: string;
  emoji: string;
  description: string;
  soundId: string;
  freqId: string;
  timerMinutes: number;
  color: string;
}

// ── SoundScape Library ────────────────────────────────────────────────────────

export const SOUNDSCAPES: SoundTrack[] = [

  // ── Noise Colors (all synthesised — no streaming on any platform) ─────────
  {
    id: 'white_noise',
    name: 'White Noise',
    category: 'noise',
    emoji: '〰️',
    description: 'Equal energy across all frequencies. The classic sleep and masking noise — blocks out every other sound evenly.',
    tags: ['sleep', 'focus', 'masking'],
    url: 'white_noise',
    bestFor: ['Sleep', 'Studying', 'Tinnitus relief'],
    source: 'Generated · Web Audio API',
  },
  {
    id: 'pink_noise',
    name: 'Pink Noise',
    category: 'noise',
    emoji: '🌸',
    description: 'Energy decreases at higher frequencies — deeper and softer than white. Research links pink noise to improved deep sleep quality and memory consolidation.',
    tags: ['sleep', 'memory', 'relaxation'],
    url: 'pink_noise',
    bestFor: ['Deep sleep', 'Memory', 'Relaxation'],
    source: 'Generated · Web Audio API',
  },
  {
    id: 'brown_noise',
    name: 'Brown Noise',
    category: 'noise',
    emoji: '🤎',
    description: 'Deep, rich rumble — like a powerful waterfall or distant thunder. The internet\'s favourite for focus and ADHD.',
    tags: ['focus', 'ADHD', 'deep'],
    url: 'brown_noise',
    bestFor: ['Deep focus', 'ADHD', 'Reading'],
    source: 'Generated · Web Audio API',
  },
  {
    id: 'blue_noise',
    name: 'Blue Noise',
    category: 'noise',
    emoji: '💙',
    description: 'Bright, higher-pitched — the derivative of white noise. Popular for tinnitus masking and audio dithering.',
    tags: ['tinnitus', 'bright', 'masking'],
    url: 'blue_noise',
    bestFor: ['Tinnitus relief', 'Hyper-alertness reduction', 'Audio dithering'],
    source: 'Generated · Web Audio API',
  },
  {
    id: 'grey_noise',
    name: 'Grey Noise',
    category: 'noise',
    emoji: '🩶',
    description: 'Psychoacoustically flat — engineered to sound equally loud at every frequency to the human ear. Very neutral, non-fatiguing.',
    tags: ['neutral', 'non-fatiguing', 'flat'],
    url: 'grey_noise',
    bestFor: ['Long work sessions', 'Sensitive hearing', 'Non-fatiguing background'],
    source: 'Generated · Web Audio API',
  },

  // ── Rain & Water ──────────────────────────────────────────────────────────
  {
    id: 'light_rain',
    name: 'Light Rain on Leaves',
    category: 'rain',
    emoji: '🌧️',
    description: 'Gentle, irregular rainfall through a forest canopy. Deeply soothing and one of the most universally calming natural sounds.',
    tags: ['sleep', 'relax', 'nature'],
    url: 'light_rain',
    bestFor: ['Sleep', 'Relaxation', 'Reading'],
    source: 'Real recording · jsDelivr CDN',
  },
  {
    id: 'heavy_rain',
    name: 'Heavy Rain on Roof',
    category: 'rain',
    emoji: '🌊',
    description: 'Intense rain drumming overhead. Powerful masking effect ideal for blocking out unpredictable environmental noise.',
    tags: ['sleep', 'masking', 'cozy'],
    url: 'heavy_rain',
    bestFor: ['Deep sleep', 'Noise masking', 'Cozy evenings'],
    source: 'Real recording · jsDelivr CDN',
  },
  {
    id: 'ocean_gentle',
    name: 'Ocean Waves (Gentle)',
    category: 'rain',
    emoji: '🏖️',
    description: 'Slow rhythmic waves with a natural ebb-and-flow cycle. The predictable rhythm is a direct parasympathetic nervous system trigger.',
    tags: ['relax', 'parasympathetic', 'rhythmic'],
    url: 'ocean_gentle',
    bestFor: ['Relaxation', 'Meditation', 'Stress relief'],
    source: 'Real recording · jsDelivr CDN',
  },
  {
    id: 'ocean_deep',
    name: 'Deep Ocean',
    category: 'rain',
    emoji: '🌊',
    description: 'The muffled, womb-like resonance of deep underwater. Profound bass rumble with gentle wave undulation — extreme relaxation.',
    tags: ['deep', 'womb', 'profound'],
    url: 'ocean_deep',
    bestFor: ['Meditation', 'Anxiety relief', 'Profound relaxation'],
    source: 'Real recording · jsDelivr CDN',
  },
  {
    id: 'creek',
    name: 'Babbling Brook',
    category: 'rain',
    emoji: '💧',
    description: 'Light, irregular creek with gentle gurgles. Refreshing and mentally clearing without the heavy low end of ocean or rain.',
    tags: ['focus', 'fresh', 'nature'],
    url: 'creek',
    bestFor: ['Light focus', 'Morning energy', 'Meditation'],
    source: 'Real recording · jsDelivr CDN',
  },
  {
    id: 'waterfall',
    name: 'Waterfall Cascade',
    category: 'rain',
    emoji: '🏔️',
    description: 'Powerful roaring cascade — the full-body rush of standing near a real waterfall. Intense white-noise masking with a deep organic bass rumble that drowns out everything else.',
    tags: ['focus', 'masking', 'powerful'],
    url: 'waterfall',
    bestFor: ['Deep focus', 'Noise masking', 'Stress relief'],
    source: 'Real recording · jsDelivr CDN',
  },
  // ── Nature ────────────────────────────────────────────────────────────────
  {
    id: 'forest_dawn',
    name: 'Forest at Dawn',
    category: 'nature',
    emoji: '🌲',
    description: 'Birds waking up in a lush forest with a light breeze. Morning energy and connection to nature in one sound.',
    tags: ['morning', 'birds', 'energize'],
    url: 'forest_dawn',
    bestFor: ['Morning routine', 'Light energy', 'Mindfulness'],
    source: 'Real recording · jsDelivr CDN',
  },
  {
    id: 'night_crickets',
    name: 'Night Forest (Crickets)',
    category: 'nature',
    emoji: '🦗',
    description: 'Summer night crickets with a soft forest background. The rhythmic pulse is one of the most effective natural sleep-induction sounds.',
    tags: ['sleep', 'summer', 'night'],
    url: 'night_crickets',
    bestFor: ['Sleep', 'Evening wind-down', 'Summer nights'],
    source: 'Real recording · jsDelivr CDN',
  },
  {
    id: 'meadow',
    name: 'Meadow Ambience',
    category: 'nature',
    emoji: '🌼',
    description: 'Light breeze through grass, distant bees and birds in an open sunny meadow. Calm alertness without distraction.',
    tags: ['calm', 'nature', 'light'],
    url: 'meadow',
    bestFor: ['Gentle work', 'Calm focus', 'Mindfulness'],
    source: 'Real recording · jsDelivr CDN',
  },

  // ── Fire & Earth ──────────────────────────────────────────────────────────
  {
    id: 'fireplace',
    name: 'Fireplace Crackling',
    category: 'fire',
    emoji: '🔥',
    description: 'Warm, irregular crackling fire. The random crackle pattern is deeply comforting — perfect for cold evenings and winding down.',
    tags: ['cozy', 'warm', 'relax'],
    url: 'fireplace',
    bestFor: ['Relaxation', 'Evening wind-down', 'Cozy atmosphere'],
    source: 'Real recording · jsDelivr CDN',
  },
  {
    id: 'campfire',
    name: 'Outdoor Campfire',
    category: 'fire',
    emoji: '🏕️',
    description: 'Open-air campfire with more intense crackles and distant night sounds. The outdoor setting feels expansive and grounding.',
    tags: ['camping', 'outdoor', 'grounding'],
    url: 'campfire',
    bestFor: ['Grounding', 'Storytelling mood', 'Evening ritual'],
    source: 'Real recording · jsDelivr CDN',
  },
  {
    id: 'fire_rain',
    name: 'Fireplace + Rain',
    category: 'fire',
    emoji: '🏠',
    description: 'The ultimate cozy combination: crackling fire inside while rain falls outside. One of the most popular comfort sounds worldwide.',
    tags: ['cozy', 'layered', 'winter'],
    url: 'fire_rain',
    bestFor: ['Evening', 'Reading', 'Deep relaxation'],
    source: 'Real recording · jsDelivr CDN',
  },

  // ── Urban & Ambient ───────────────────────────────────────────────────────
  {
    id: 'coffee_shop',
    name: 'Coffee Shop Murmur',
    category: 'urban',
    emoji: '☕',
    description: 'Proven by research to boost creative focus. The 70dB ambient noise sweet spot — enough activity to stimulate abstract thinking without distraction.',
    tags: ['focus', 'creative', 'social'],
    url: 'coffee_shop',
    bestFor: ['Creative work', 'Writing', 'Coding'],
    source: 'Real recording · jsDelivr CDN',
  },
  {
    id: 'train',
    name: 'Train Journey',
    category: 'urban',
    emoji: '🚂',
    description: 'Rhythmic rail clacking with a low engine rumble. The predictable mechanical rhythm is exceptionally effective for sustained focus.',
    tags: ['focus', 'rhythmic', 'travel'],
    url: 'train',
    bestFor: ['Deep focus', 'Long work sessions', 'Reading'],
    source: 'Real recording · jsDelivr CDN',
  },
  {
    id: 'vinyl_static',
    name: 'Vinyl Record Static',
    category: 'urban',
    emoji: '📻',
    description: 'Warm hiss of a vinyl record between tracks. Nostalgic, low-level, and remarkably non-fatiguing — like white noise but cozier.',
    tags: ['warm', 'nostalgic', 'gentle'],
    url: 'vinyl_static',
    bestFor: ['Background ambience', 'Reading', 'Unwinding'],
    source: 'Generated · Web Audio API',
  },

  // ── Space Sounds ─────────────────────────────────────────────────────────
  // Inspired by NASA open audio recordings (government works, no copyright).
  // Generated synthetically here; original NASA recordings available free at
  // nasa.gov/solar-system/sounds and soundcloud.com/nasa
  {
    id: 'saturn',
    name: 'Saturn Radio Waves',
    category: 'space',
    emoji: '🪐',
    description: 'Synthesised from NASA\'s Cassini spacecraft recordings of Saturn\'s electromagnetic field. Eerie, deep, extraordinary — unlike anything on Earth.',
    tags: ['space', 'unique', 'meditative'],
    url: 'saturn',
    bestFor: ['Deep meditation', 'Unique focus', 'Relaxation'],
    source: 'Inspired by NASA open audio',
  },
  {
    id: 'solar_wind',
    name: 'Solar Wind',
    category: 'space',
    emoji: '☀️',
    description: 'The sound of charged particles streaming from the Sun interacting with Earth\'s magnetic field — synthesised from NASA ionospheric recordings.',
    tags: ['space', 'electromagnetic', 'atmospheric'],
    url: 'solar_wind',
    bestFor: ['Focus', 'Meditation', 'Grounding'],
    source: 'Inspired by NASA open audio',
  },
  {
    id: 'space_void',
    name: 'Deep Space Void',
    category: 'space',
    emoji: '🌌',
    description: 'Near silence with ultra-low resonant drones — the acoustic texture of deep space. Minimal and profoundly calming.',
    tags: ['minimal', 'profound', 'meditative'],
    url: 'space_void',
    bestFor: ['Deep meditation', 'Sensory reduction', 'Profound relaxation'],
    source: 'Generated · Web Audio API',
  },
];

// ── Healing Frequencies ──────────────────────────────────────────────────────
// All generated via Web Audio API — zero audio files, mathematically perfect.

export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  // Solfeggio scale
  { id: 'hz_174', name: '174 Hz Foundation', emoji: '🪨', hz: 174, description: 'Pain reduction, security and grounding. The lowest Solfeggio tone — deeply stabilising.', category: 'solfeggio', intention: 'heal', color: '#8B4513' },
  { id: 'hz_285', name: '285 Hz Quantum', emoji: '🔬', hz: 285, description: 'Tissue healing and cellular regeneration. Second Solfeggio tone.', category: 'solfeggio', intention: 'heal', color: '#A0522D' },
  { id: 'hz_396', name: '396 Hz Liberation', emoji: '🔓', hz: 396, description: 'Releasing guilt, fear and grief. Root chakra activation and emotional clearing.', category: 'solfeggio', intention: 'heal', color: '#FF4444' },
  { id: 'hz_417', name: '417 Hz Undoing', emoji: '🌀', hz: 417, description: 'Facilitating change, clearing trauma and stuck emotional patterns.', category: 'solfeggio', intention: 'heal', color: '#FF8C00' },
  { id: 'hz_432', name: '432 Hz Natural', emoji: '🌿', hz: 432, description: "Nicknamed Verdi's A. Said to resonate with nature's own frequency — warmer and more organic than modern 440Hz tuning.", category: 'solfeggio', intention: 'meditate', color: '#4ECDC4' },
  { id: 'hz_528', name: '528 Hz Miracle', emoji: '💚', hz: 528, description: 'The most popular healing frequency. Associated with love, DNA repair and transformation. The heart of the Solfeggio scale.', category: 'solfeggio', intention: 'heal', color: '#4CAF50' },
  { id: 'hz_639', name: '639 Hz Connection', emoji: '💙', hz: 639, description: 'Relationships, communication, heart chakra opening. Promotes empathy and understanding.', category: 'solfeggio', intention: 'heal', color: '#2196F3' },
  { id: 'hz_741', name: '741 Hz Awakening', emoji: '💡', hz: 741, description: 'Problem solving, creative expression and cellular detoxification.', category: 'solfeggio', intention: 'focus', color: '#9C27B0' },
  { id: 'hz_852', name: '852 Hz Intuition', emoji: '👁️', hz: 852, description: 'Returning to spiritual order, third eye activation and heightened intuition.', category: 'solfeggio', intention: 'meditate', color: '#673AB7' },
  { id: 'hz_963', name: '963 Hz Divine', emoji: '✨', hz: 963, description: 'Crown chakra and pineal gland activation. The highest Solfeggio tone.', category: 'solfeggio', intention: 'meditate', color: '#F5A623' },
  // Brainwave entrainment
  { id: 'hz_1_delta', name: '1 Hz Deep Sleep', emoji: '🌑', hz: 1, description: 'Pure delta wave tone for deep dreamless sleep induction. Shown to improve nerve regeneration in research.', category: 'brainwave', intention: 'sleep', color: '#1A237E' },
  { id: 'hz_4_theta', name: '4 Hz Theta', emoji: '🌊', hz: 4, description: 'Deep meditation, memory consolidation, and creative insight. The boundary between sleep and waking.', category: 'brainwave', intention: 'meditate', color: '#0288D1' },
  { id: 'hz_783', name: '7.83 Hz Schumann', emoji: '🌍', hz: 7.83, description: "Earth's own electromagnetic resonance frequency. Associated with grounding, homeostasis and biological synchronisation.", category: 'brainwave', intention: 'heal', color: '#388E3C' },
  { id: 'hz_10_alpha', name: '10 Hz Alpha', emoji: '😌', hz: 10, description: 'Mood elevation, serotonin release and relaxed alert awareness. The calm-but-awake sweet spot.', category: 'brainwave', intention: 'meditate', color: '#0097A7' },
  { id: 'hz_14_beta', name: '14 Hz Focus', emoji: '🎯', hz: 14, description: 'Active focus and concentration onset. Low beta state — engaged but not stressed.', category: 'brainwave', intention: 'focus', color: '#FFA000' },
  { id: 'hz_40_gamma', name: '40 Hz Gamma', emoji: '⚡', hz: 40, description: 'The most researched frequency. Memory, cognitive enhancement and peak mental performance. Active area of Alzheimer\'s research.', category: 'brainwave', intention: 'focus', color: '#F5A623' },
  // Special therapeutic tones
  { id: 'hz_111', name: '111 Hz Beta Bliss', emoji: '🏛️', hz: 111, description: 'Beta endorphin release. Found resonating naturally in ancient sacred spaces — Malta temples, Newgrange, Hal Saflieni.', category: 'tone', intention: 'heal', color: '#D4A000' },
  { id: 'hz_136', name: '136.1 Hz OM', emoji: '🕉️', hz: 136.1, description: "The 'Om' frequency — Earth's year-tone. The planet's orbital motion converted to sound. Deeply centering.", category: 'tone', intention: 'meditate', color: '#FF6B35' },
  { id: 'hz_256', name: '256 Hz Middle C', emoji: '🎵', hz: 256, description: 'Scientific tuning middle C. A pure, grounding reference tone used in sound therapy and tuning instruments.', category: 'tone', intention: 'meditate', color: '#607D8B' },
  { id: 'hz_432_pure', name: '432 Hz Pure Tone', emoji: '🎶', hz: 432, description: 'The pure sine wave at 432 Hz — direct, unadorned. Some musicians retune all instruments to this natural frequency.', category: 'tone', intention: 'meditate', color: '#4ECDC4' },
  // Binaural beats
  { id: 'bin_sleep', name: 'Deep Sleep', emoji: '😴', hz: 2, leftHz: 100, rightHz: 102, beatHz: 2, description: '100Hz + 102Hz → 2Hz delta beat. Deep sleep induction. The phantom beat the brain generates equals the difference between left and right. Requires headphones.', category: 'binaural', intention: 'sleep', color: '#1A237E' },
  { id: 'bin_theta', name: 'Dream State', emoji: '💭', hz: 4, leftHz: 200, rightHz: 204, beatHz: 4, description: '200Hz + 204Hz → 4Hz theta beat. REM sleep, vivid dreams, and the hypnagogic state. Requires headphones.', category: 'binaural', intention: 'sleep', color: '#7B1FA2' },
  { id: 'bin_relax', name: 'Relaxed Focus', emoji: '🧘', hz: 10, leftHz: 200, rightHz: 210, beatHz: 10, description: '200Hz + 210Hz → 10Hz alpha beat. The gold standard for calm alertness — aware but not anxious. Requires headphones.', category: 'binaural', intention: 'meditate', color: '#00838F' },
  { id: 'bin_flow', name: 'Flow State', emoji: '🌊', hz: 14, leftHz: 300, rightHz: 314, beatHz: 14, description: '300Hz + 314Hz → 14Hz beta beat. Sustained productive flow with engaged focus. Requires headphones.', category: 'binaural', intention: 'focus', color: '#E65100' },
  { id: 'bin_gamma', name: 'Peak Performance', emoji: '🚀', hz: 40, leftHz: 300, rightHz: 340, beatHz: 40, description: '300Hz + 340Hz → 40Hz gamma beat. Maximum cognitive performance. Most researched binaural preset. Requires headphones.', category: 'binaural', intention: 'focus', color: '#F57F17' },
  { id: 'bin_creative', name: 'Creativity', emoji: '🎨', hz: 5, leftHz: 150, rightHz: 155, beatHz: 5, description: '150Hz + 155Hz → 5Hz theta beat. Creative insight, imagination and lateral thinking. Requires headphones.', category: 'binaural', intention: 'focus', color: '#AD1457' },
  { id: 'bin_anxiety', name: 'Anxiety Relief', emoji: '🕊️', hz: 10, leftHz: 250, rightHz: 260, beatHz: 10, description: '250Hz + 260Hz → 10Hz alpha beat. Clinically studied for stress and anxiety reduction. Requires headphones.', category: 'binaural', intention: 'heal', color: '#2E7D32' },
  { id: 'bin_meditation', name: 'Deep Meditation', emoji: '🔮', hz: 6, leftHz: 200, rightHz: 206, beatHz: 6, description: '200Hz + 206Hz → 6Hz theta beat. Long-term memory consolidation and deep meditative states. Requires headphones.', category: 'binaural', intention: 'meditate', color: '#4527A0' },
];

// ── Quick Modes ───────────────────────────────────────────────────────────────

export const QUICK_MODES: QuickMode[] = [
  {
    id: 'sleep',
    name: 'Sleep',
    emoji: '😴',
    description: 'Pink noise + 2Hz delta binaural · 45 min',
    soundId: 'pink_noise',
    freqId: 'bin_sleep',
    timerMinutes: 45,
    color: '#1A237E',
  },
  {
    id: 'focus',
    name: 'Focus',
    emoji: '🎯',
    description: 'Brown noise + 40Hz gamma · no timer',
    soundId: 'brown_noise',
    freqId: 'bin_flow',
    timerMinutes: 0,
    color: '#E65100',
  },
  {
    id: 'calm',
    name: 'Calm',
    emoji: '🌊',
    description: 'Ocean waves + 432 Hz · 30 min',
    soundId: 'ocean_gentle',
    freqId: 'hz_432',
    timerMinutes: 30,
    color: '#00838F',
  },
  {
    id: 'heal',
    name: 'Heal',
    emoji: '💚',
    description: '528 Hz + forest · 20 min',
    soundId: 'forest_dawn',
    freqId: 'hz_528',
    timerMinutes: 20,
    color: '#2E7D32',
  },
  {
    id: 'energize',
    name: 'Energize',
    emoji: '⚡',
    description: 'Forest dawn + 40Hz gamma · 15 min',
    soundId: 'forest_dawn',
    freqId: 'hz_40_gamma',
    timerMinutes: 15,
    color: '#F57F17',
  },
  {
    id: 'space',
    name: 'Space',
    emoji: '🪐',
    description: 'Saturn waves + 963Hz crown · 30 min',
    soundId: 'saturn',
    freqId: 'hz_963',
    timerMinutes: 30,
    color: '#4527A0',
  },
];

export const INTENTION_LABELS: Record<string, string> = {
  sleep: 'Sleep',
  meditate: 'Meditate',
  focus: 'Focus',
  heal: 'Heal',
  energize: 'Energize',
};

export const CATEGORY_LABELS: Record<SoundCategory, string> = {
  noise: 'Noise Colors',
  rain: 'Rain & Water',
  nature: 'Nature',
  fire: 'Fire & Earth',
  urban: 'Urban & Ambient',
  space: 'Space Sounds',
  binaural: 'Binaural',
  solfeggio: 'Solfeggio',
  brainwave: 'Brainwave',
  tones: 'Tones',
};
