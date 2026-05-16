/**
 * MoodLog — Core data structures, context tags, and dimension labels.
 * Inspired by the MyFitnessPal mental model: track inputs (what affects mood)
 * and outputs (your actual mood state), then surface the correlations.
 */

// ─── Mood Outputs (the 4 dimensions you track) ───────────────────────────────

export interface MoodDimensions {
  /** Body feel: -1 (heavy/drained) → +1 (light/energized) */
  body: number;
  /** Mind feel: -1 (dark/foggy) → +1 (clear/bright) */
  mind: number;
  /** Energy level: 0 (depleted) → 1 (activated) */
  energy: number;
  /** Focus: 0 (scattered/foggy) → 1 (sharp/present) */
  focus: number;
}

/** Converts 4 dimension scores into a single 0–100 wellness score */
export function calcWellnessScore(
  d: MoodDimensions,
  selectedTagIds?: string[],
): number {
  const body = (d.body + 1) / 2;   // normalize -1..1 → 0..1
  const mind = (d.mind + 1) / 2;
  const base = Math.round((body * 0.3 + mind * 0.3 + d.energy * 0.2 + d.focus * 0.2) * 100);

  if (!selectedTagIds || selectedTagIds.length === 0) return base;

  // Sum up tag weights — primary tag carries full weight, additional tags half
  let delta = 0;
  selectedTagIds.forEach((id, i) => {
    const tag = CONTEXT_TAGS.find(t => t.id === id);
    if (!tag) return;
    const multiplier = i === 0 ? 1.0 : 0.5; // primary = full, additional = half
    delta += tag.weight * multiplier;
  });

  return Math.max(0, Math.min(100, Math.round(base + delta)));
}

/** Human-readable label for a wellness score */
export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Thriving';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Okay';
  if (score >= 35) return 'Low';
  return 'Struggling';
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#95E06C';
  if (score >= 65) return '#4ECDC4';
  if (score >= 50) return '#FFD166';
  if (score >= 35) return '#FF8C42';
  return '#FF6B6B';
}

export function getScoreEmoji(score: number): string {
  if (score >= 80) return '🌟';
  if (score >= 65) return '😊';
  if (score >= 50) return '😐';
  if (score >= 35) return '😔';
  return '💙';
}

// ─── Context Tags (the main input) ───────────────────────────────────────────
//
// weight: science-backed point adjustment applied to the base wellness score.
//   Positive = this factor reliably boosts wellbeing.
//   Negative = this factor reliably suppresses wellbeing.
//
// References:
//  • Sleep: Walker (2017) "Why We Sleep" — 1h lost sleep drops mood ~15–20pts
//  • Exercise: Blumenthal et al. (1999) JAMA — 30 min aerobic = antidepressant effect
//  • Social support: Holt-Lunstad (2015) — isolation is equivalent to smoking 15 cigs/day
//  • Sunlight: Lam (2009) seasonal affective disorder research
//  • Nutrition: Jacka (2017) "SMILES" trial — diet quality predicts mood independent of other factors
//  • Alcohol: IARC/WHO — depressant, disrupts REM sleep
//  • Mindfulness: Goyal (2014) JAMA meta-analysis — ~0.5 SD improvement
//  • Screen time: Twenge (2018) — >2h recreational screens correlates with lower wellbeing
//  • Conflict: Bolger et al. (1989) — interpersonal conflict is the strongest daily stressor
//  • Nature/cold: various exposure therapy and biophilia literature

export interface ContextTag {
  id: string;
  label: string;
  emoji: string;
  color: string;
  category: 'lifestyle' | 'social' | 'environment' | 'health';
  description: string;
  /** Score adjustment in points (-20 to +20). Applied on top of dimension base score. */
  weight: number;
}

export const CONTEXT_TAGS: ContextTag[] = [

  // ── LIFESTYLE ──────────────────────────────────────────────────────────────
  // Sleep — single biggest lever on mood (Walker 2017)
  { id: 'sleep_great',   label: 'Great sleep',      emoji: '😴', color: '#7C83FF', category: 'lifestyle', description: '8+ hours, woke refreshed & alert',       weight: 12 },
  { id: 'sleep_good',    label: 'Good sleep',        emoji: '🛌', color: '#9B8FFF', category: 'lifestyle', description: '7–8 hours, rested',                       weight: 7  },
  { id: 'sleep_okay',    label: 'Okay sleep',        emoji: '😑', color: '#B3AEFF', category: 'lifestyle', description: '6–7 hours, slightly groggy',               weight: 0  },
  { id: 'sleep_bad',     label: 'Poor sleep',        emoji: '🥱', color: '#FF8C42', category: 'lifestyle', description: '5–6 hours or restless night',              weight: -8 },
  { id: 'sleep_terrible',label: 'Terrible sleep',    emoji: '😵', color: '#FF6B6B', category: 'lifestyle', description: 'Under 5 hours or barely slept at all',     weight: -14},

  // Exercise — robust antidepressant effect (Blumenthal 1999; Craft & Perna 2004)
  { id: 'exercise_intense', label: 'Intense workout', emoji: '🏋️', color: '#4ADE80', category: 'lifestyle', description: 'HIIT, weights, hard run, sport',           weight: 12 },
  { id: 'exercise',         label: 'Exercised',        emoji: '🏃', color: '#95E06C', category: 'lifestyle', description: 'Moderate activity — walk, yoga, swim',     weight: 8  },
  { id: 'light_movement',   label: 'Light movement',   emoji: '🚶', color: '#A7F3D0', category: 'lifestyle', description: 'Short walk, stretching, standing desk',    weight: 3  },
  { id: 'no_exercise',      label: 'Sedentary',         emoji: '🛋️', color: '#8A8EBF', category: 'lifestyle', description: 'Little to no movement today',             weight: -4 },

  // Sunlight / outdoor exposure — circadian rhythm & vitamin D
  { id: 'sunlight_long',  label: 'Long time outside', emoji: '🌞', color: '#FFD166', category: 'lifestyle', description: '2+ hours in natural light',                weight: 7  },
  { id: 'sunlight',       label: 'Got outside',        emoji: '☀️', color: '#FFC107', category: 'lifestyle', description: 'Some time in daylight / fresh air',        weight: 4  },
  { id: 'nature_time',    label: 'Time in nature',     emoji: '🌲', color: '#86EFAC', category: 'lifestyle', description: 'Park, hiking, beach, garden',              weight: 6  },
  { id: 'no_sunlight',    label: 'Stayed inside',      emoji: '🏠', color: '#5B6FFF', category: 'lifestyle', description: 'No outdoor exposure today',               weight: -3 },

  // Nutrition
  { id: 'healthy_eating',  label: 'Ate well',          emoji: '🥗', color: '#86EFAC', category: 'lifestyle', description: 'Whole foods, balanced meals',              weight: 6  },
  { id: 'normal_eating',   label: 'Ate normally',       emoji: '🍽️', color: '#CBD5E1', category: 'lifestyle', description: 'Regular meals, nothing notable',          weight: 0  },
  { id: 'skipped_meals',   label: 'Skipped meals',      emoji: '⏭️', color: '#FB923C', category: 'lifestyle', description: 'Missed one or more meals',                weight: -5 },
  { id: 'poor_eating',     label: 'Ate poorly',         emoji: '🍕', color: '#FF8C42', category: 'lifestyle', description: 'Processed food, sugar spikes, junk',      weight: -6 },
  { id: 'overate',         label: 'Overate',            emoji: '🤢', color: '#FF6B6B', category: 'lifestyle', description: 'Uncomfortably full, binge episode',        weight: -5 },
  { id: 'hydrated',        label: 'Well hydrated',      emoji: '💧', color: '#38BDF8', category: 'lifestyle', description: '8+ glasses of water',                     weight: 3  },
  { id: 'dehydrated',      label: 'Dehydrated',         emoji: '🏜️', color: '#F97316', category: 'lifestyle', description: 'Dry mouth, headache, low water intake',    weight: -4 },
  { id: 'intermittent_fast', label: 'Intermittent fast', emoji: '⏱️', color: '#A78BFA', category: 'lifestyle', description: 'Fasting window 14h+',                    weight: 2  },

  // Rest / recovery
  { id: 'napped',          label: 'Took a nap',         emoji: '😪', color: '#A5B4FC', category: 'lifestyle', description: '20–90 min restorative nap',               weight: 4  },
  { id: 'rest_day',        label: 'Rest day',           emoji: '🌿', color: '#6EE7B7', category: 'lifestyle', description: 'Intentional rest & recovery',             weight: 3  },
  { id: 'late_night',      label: 'Late night',         emoji: '🌙', color: '#6366F1', category: 'lifestyle', description: 'Up past midnight, circadian disruption',   weight: -5 },
  { id: 'cold_shower',     label: 'Cold shower',        emoji: '🚿', color: '#67E8F9', category: 'lifestyle', description: 'Cold/contrast shower, mood boost',         weight: 4  },
  { id: 'overworked',      label: 'Overworked',         emoji: '💦', color: '#F87171', category: 'lifestyle', description: 'Long hours, couldn\'t stop working',       weight: -7 },
  { id: 'leisure_time',    label: 'Leisure time',       emoji: '🎉', color: '#F9A8D4', category: 'lifestyle', description: 'Hobbies, fun, recreational activity',       weight: 6  },
  { id: 'creative_work',   label: 'Creative flow',      emoji: '🎨', color: '#C084FC', category: 'lifestyle', description: 'Art, music, writing, deep creative work',  weight: 7  },

  // ── SOCIAL ─────────────────────────────────────────────────────────────────
  // Holt-Lunstad (2015): social connection = ~15pt mood benefit; isolation = biggest chronic risk
  { id: 'deep_connection', label: 'Deep connection',    emoji: '💞', color: '#F472B6', category: 'social', description: 'Meaningful 1:1 conversation or bonding',    weight: 10 },
  { id: 'social_energizing', label: 'Energizing social', emoji: '✨', color: '#FFD166', category: 'social', description: 'Time with people who lift me up',           weight: 7  },
  { id: 'social_fun',      label: 'Fun with others',    emoji: '😄', color: '#FCD34D', category: 'social', description: 'Light-hearted group time, laughter',         weight: 6  },
  { id: 'helped_someone',  label: 'Helped someone',     emoji: '🤝', color: '#86EFAC', category: 'social', description: 'Volunteered, supported, or showed up for someone', weight: 7 },
  { id: 'received_support',label: 'Received support',   emoji: '🫂', color: '#FDA4AF', category: 'social', description: 'Someone was there for me',                  weight: 8  },
  { id: 'alone_time',      label: 'Quality alone time', emoji: '🧘', color: '#4ECDC4', category: 'social', description: 'Intentional recharge solitude',             weight: 4  },
  { id: 'social_draining', label: 'Draining social',    emoji: '🔋', color: '#FF8C42', category: 'social', description: 'Exhausting or obligatory interactions',     weight: -6 },
  { id: 'conflict',        label: 'Conflict',           emoji: '💥', color: '#FF6B6B', category: 'social', description: 'Argument or tension — strongest daily stressor', weight: -10 },
  { id: 'social_anxiety',  label: 'Social anxiety',     emoji: '😰', color: '#C084FC', category: 'social', description: 'Anxious in social situations',              weight: -8 },
  { id: 'lonely',          label: 'Felt lonely',        emoji: '🫧', color: '#5B6FFF', category: 'social', description: 'Isolated or disconnected from others',      weight: -9 },
  { id: 'ignored',         label: 'Felt ignored',       emoji: '👻', color: '#94A3B8', category: 'social', description: 'Overlooked, dismissed, or invisible',        weight: -7 },
  { id: 'social_pressure', label: 'Social pressure',    emoji: '😬', color: '#FB923C', category: 'social', description: 'Peer pressure, people-pleasing burden',     weight: -6 },
  { id: 'quality_family',  label: 'Family time',        emoji: '👨‍👩‍👧', color: '#FCA5A5', category: 'social', description: 'Positive time with family',                 weight: 6  },
  { id: 'romantic_positive', label: 'Romantic moment',  emoji: '❤️', color: '#F43F5E', category: 'social', description: 'Connection with partner, date, intimacy',   weight: 8  },
  { id: 'romantic_negative', label: 'Relationship tension', emoji: '💔', color: '#E11D48', category: 'social', description: 'Partner conflict, distance, or worry',   weight: -9 },
  { id: 'too_much_social', label: 'Overstimulated',     emoji: '🫠', color: '#A78BFA', category: 'social', description: 'Social overload, need to recharge',         weight: -5 },

  // ── ENVIRONMENT ────────────────────────────────────────────────────────────
  // Work / productivity
  { id: 'work_great',      label: 'Peak performance',   emoji: '🚀', color: '#34D399', category: 'environment', description: 'Flow state, crushed goals',             weight: 9  },
  { id: 'work_good',       label: 'Work flowed',        emoji: '💼', color: '#4ECDC4', category: 'environment', description: 'Productive, purposeful day',            weight: 5  },
  { id: 'work_okay',       label: 'Average work day',   emoji: '📋', color: '#94A3B8', category: 'environment', description: 'Got through it, nothing special',       weight: 0  },
  { id: 'work_hard',       label: 'Work was hard',      emoji: '😓', color: '#FF8C42', category: 'environment', description: 'Stressful, overwhelming workload',      weight: -7 },
  { id: 'deadline',        label: 'Deadline pressure',  emoji: '⏰', color: '#FB923C', category: 'environment', description: 'Tight deadline, high pressure',         weight: -6 },
  { id: 'procrastinated',  label: 'Procrastinated',     emoji: '😶', color: '#94A3B8', category: 'environment', description: 'Avoided tasks, felt behind',            weight: -5 },
  { id: 'accomplished',    label: 'Big accomplishment', emoji: '🏆', color: '#FBBF24', category: 'environment', description: 'Completed something meaningful',        weight: 9  },
  { id: 'learned_something', label: 'Learned something', emoji: '💡', color: '#FCD34D', category: 'environment', description: 'New skill, insight, or knowledge',    weight: 5  },
  { id: 'financial_stress',label: 'Financial stress',   emoji: '💸', color: '#F87171', category: 'environment', description: 'Money worries or unexpected expense',   weight: -8 },
  { id: 'financial_win',   label: 'Financial win',      emoji: '💰', color: '#4ADE80', category: 'environment', description: 'Good financial news or milestone',      weight: 6  },

  // Weather / environment
  { id: 'weather_sunny',   label: 'Sunny & warm',       emoji: '🌞', color: '#FDE68A', category: 'environment', description: 'Bright sunshine, pleasant temperature', weight: 4  },
  { id: 'weather_nice',    label: 'Nice weather',       emoji: '🌤️', color: '#FFD166', category: 'environment', description: 'Mild, pleasant conditions',             weight: 2  },
  { id: 'weather_grey',    label: 'Grey & overcast',    emoji: '☁️', color: '#94A3B8', category: 'environment', description: 'Cloudy, flat light, low energy sky',    weight: -2 },
  { id: 'weather_bad',     label: 'Rough weather',      emoji: '🌧️', color: '#8A8EBF', category: 'environment', description: 'Heavy rain, cold, dark, or stormy',    weight: -4 },
  { id: 'full_moon',       label: 'Full moon night',    emoji: '🌕', color: '#FEF9C3', category: 'environment', description: 'Disrupted sleep, heightened feelings',  weight: -2 },

  // Life events
  { id: 'big_event',       label: 'Big event / test',   emoji: '🎯', color: '#F5A623', category: 'environment', description: 'Presentation, exam, performance',       weight: -3 },
  { id: 'big_event_done',  label: 'Nailed the big thing', emoji: '🎉', color: '#4ADE80', category: 'environment', description: 'Completed major challenge or event',  weight: 10 },
  { id: 'change',          label: 'Unexpected change',  emoji: '🌪️', color: '#FF8C42', category: 'environment', description: 'Plans disrupted or changed suddenly',   weight: -6 },
  { id: 'positive_news',   label: 'Good news',          emoji: '📬', color: '#86EFAC', category: 'environment', description: 'Uplifting personal or world news',      weight: 5  },
  { id: 'bad_news',        label: 'Bad news',           emoji: '📭', color: '#F87171', category: 'environment', description: 'Distressing personal or world news',     weight: -7 },
  { id: 'travel',          label: 'Travelled',          emoji: '✈️', color: '#67E8F9', category: 'environment', description: 'Trip, commute stress, or adventure',     weight: 3  },
  { id: 'home_stress',     label: 'Home friction',      emoji: '🏚️', color: '#FB923C', category: 'environment', description: 'Domestic issues, clutter overwhelm',   weight: -5 },
  { id: 'clean_space',     label: 'Clean & organised',  emoji: '✨', color: '#A5F3FC', category: 'environment', description: 'Tidy space supports tidy mind',         weight: 3  },
  { id: 'commute_bad',     label: 'Bad commute',        emoji: '🚗', color: '#FCA5A5', category: 'environment', description: 'Traffic, delays, stressful travel',      weight: -4 },
  { id: 'commute_good',    label: 'Easy commute',       emoji: '🚲', color: '#A7F3D0', category: 'environment', description: 'Smooth travel, pleasant ride',           weight: 2  },

  // ── HEALTH ─────────────────────────────────────────────────────────────────
  // Mental wellness practices
  { id: 'meditation',      label: 'Meditated',          emoji: '🧘', color: '#4ECDC4', category: 'health', description: '10+ min mindfulness or breathwork',          weight: 7  },
  { id: 'breathing_ex',    label: 'Breathing exercise', emoji: '🫁', color: '#67E8F9', category: 'health', description: '4-7-8, box breathing, or pranayama',         weight: 4  },
  { id: 'journalled',      label: 'Journalled',         emoji: '📓', color: '#A5B4FC', category: 'health', description: 'Wrote down thoughts or gratitude',           weight: 5  },
  { id: 'gratitude',       label: 'Gratitude practice', emoji: '🙏', color: '#FDE68A', category: 'health', description: 'Counted blessings, listed what went well',   weight: 6  },
  { id: 'therapy_coaching',label: 'Therapy / coaching', emoji: '🛋️', color: '#C084FC', category: 'health', description: 'Professional mental health session',         weight: 7  },

  // Substances & stimulants
  { id: 'caffeine',        label: 'Caffeine boost',     emoji: '☕', color: '#F5A623', category: 'health', description: '1–2 coffees, felt alert',                   weight: 2  },
  { id: 'caffeine_crash',  label: 'Caffeine crash',     emoji: '😮‍💨', color: '#FB923C', category: 'health', description: 'Too much caffeine, jittery or crashed',   weight: -4 },
  { id: 'alcohol',         label: 'Alcohol',            emoji: '🍷', color: '#FF6B6B', category: 'health', description: 'Any alcoholic drink — depressant, disrupts REM', weight: -7 },
  { id: 'alcohol_heavy',   label: 'Heavy drinking',     emoji: '🥴', color: '#DC2626', category: 'health', description: 'Multiple drinks, hangover risk',             weight: -13},
  { id: 'cannabis',        label: 'Cannabis',           emoji: '🌿', color: '#6EE7B7', category: 'health', description: 'THC use — context-dependent mood effect',    weight: -3 },
  { id: 'nicotine',        label: 'Nicotine',           emoji: '🚬', color: '#94A3B8', category: 'health', description: 'Smoking or vaping — temporary relief, longer crash', weight: -5 },
  { id: 'medication_taken',label: 'Took medication',    emoji: '💊', color: '#60A5FA', category: 'health', description: 'Prescription medication taken as directed',   weight: 2  },
  { id: 'missed_meds',     label: 'Missed medication',  emoji: '⚠️', color: '#F87171', category: 'health', description: 'Forgot or skipped prescribed medication',    weight: -8 },

  // Physical health
  { id: 'headache',        label: 'Headache / migraine',emoji: '🤕', color: '#FF6B6B', category: 'health', description: 'Head pain impacting mood and focus',         weight: -9 },
  { id: 'illness',         label: 'Feeling unwell',     emoji: '🤒', color: '#FF8C42', category: 'health', description: 'Cold, flu, fatigue, stomach issues',          weight: -10},
  { id: 'chronic_pain',    label: 'Chronic pain flare', emoji: '😣', color: '#DC2626', category: 'health', description: 'Ongoing pain condition acting up',            weight: -11},
  { id: 'injury',          label: 'Injury',             emoji: '🩹', color: '#FB923C', category: 'health', description: 'Recent physical injury or strain',           weight: -7 },
  { id: 'menstrual_pain',  label: 'Period pain / PMS',  emoji: '🌡️', color: '#F472B6', category: 'health', description: 'Cramps, hormonal mood shift',                weight: -7 },
  { id: 'hormonal_good',   label: 'Hormonal energy',    emoji: '💫', color: '#F9A8D4', category: 'health', description: 'Ovulation window, peak energy phase',        weight: 5  },
  { id: 'feeling_strong',  label: 'Feeling strong',     emoji: '💪', color: '#4ADE80', category: 'health', description: 'Physical vitality, robust health feeling',   weight: 7  },

  // Screen & digital
  { id: 'screens',         label: 'Heavy screen time',  emoji: '📱', color: '#8A8EBF', category: 'health', description: '3h+ recreational screens (Twenge 2018: −wellbeing)', weight: -5 },
  { id: 'doomscrolling',   label: 'Doomscrolled',       emoji: '😞', color: '#6366F1', category: 'health', description: 'Negative news feed spiral',                  weight: -7 },
  { id: 'digital_detox',   label: 'Digital detox',      emoji: '🔕', color: '#86EFAC', category: 'health', description: 'Low screen day, phone-free time',            weight: 5  },

  // Anxiety & mood states (self-identified)
  { id: 'anxious',         label: 'Anxious',            emoji: '😬', color: '#F87171', category: 'health', description: 'Worried, on edge, racing thoughts',          weight: -9 },
  { id: 'depressed_feeling',label: 'Low / depressed',   emoji: '🌧️', color: '#6366F1', category: 'health', description: 'Persistent low mood, no motivation',        weight: -12},
  { id: 'angry',           label: 'Anger / frustration',emoji: '😤', color: '#EF4444', category: 'health', description: 'Irritable, short fuse, reactive',            weight: -8 },
  { id: 'overwhelmed',     label: 'Overwhelmed',        emoji: '🌊', color: '#F97316', category: 'health', description: 'Too much to handle, paralysed by demands',   weight: -9 },
  { id: 'calm_content',    label: 'Calm & content',     emoji: '☁️', color: '#A5F3FC', category: 'health', description: 'Low stress, at ease, peaceful feeling',      weight: 8  },
  { id: 'excited_happy',   label: 'Excited / happy',    emoji: '🥳', color: '#FDE68A', category: 'health', description: 'Positive anticipation, genuine joy',         weight: 9  },
  { id: 'grief_loss',      label: 'Grief / loss',       emoji: '💐', color: '#94A3B8', category: 'health', description: 'Mourning, sadness from loss',                weight: -11},
  { id: 'hopeful',         label: 'Hopeful',            emoji: '🌱', color: '#86EFAC', category: 'health', description: 'Optimism, looking forward to the future',    weight: 7  },
];

export function getTagById(id: string): ContextTag | undefined {
  return CONTEXT_TAGS.find(t => t.id === id);
}

/**
 * Returns total weight contribution from a set of selected tags.
 * Primary tag = full weight; additional tags = half weight each.
 */
export function calcTagWeightDelta(tagIds: string[]): number {
  let delta = 0;
  tagIds.forEach((id, i) => {
    const tag = CONTEXT_TAGS.find(t => t.id === id);
    if (!tag) return;
    const multiplier = i === 0 ? 1.0 : 0.5;
    delta += tag.weight * multiplier;
  });
  return Math.round(delta);
}

// ─── Time of Day ─────────────────────────────────────────────────────────────

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function getTimeOfDay(hour?: number): TimeOfDay {
  const h = hour ?? new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

export function getTimeOfDayEmoji(t: TimeOfDay): string {
  return { morning: '🌅', afternoon: '☀️', evening: '🌆', night: '🌙' }[t];
}

// ─── MoodLog Entry ────────────────────────────────────────────────────────────

export interface MoodLogEntry {
  id: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM (for time-of-day analysis)
  timestamp: number;
  timeOfDay: TimeOfDay;

  // The 4 output dimensions
  dimensions: MoodDimensions;

  // Computed score (0–100)
  score: number;

  // Context tag (the primary input)
  primaryTag: string; // ContextTag.id
  additionalTags: string[]; // up to 3 more

  // Optional free text
  note: string;

  // Journal entry (long-form, separate from the quick note)
  journalText?: string;
  audioUri?: string;    // local file:// URI of recorded voice memo
  transcript?: string; // AI-transcribed text from audio

  // Optional photo
  selfieUri?: string;
  emotionAnalysisId?: string;
}

// ─── Pattern Analysis Helpers ─────────────────────────────────────────────────

export interface TagCorrelation {
  tagId: string;
  sampleSize: number;
  avgScore: number;
  avgBody: number;
  avgMind: number;
  avgEnergy: number;
  deltaVsBaseline: number; // how much above/below your personal average
}

export function computeTagCorrelations(entries: MoodLogEntry[]): TagCorrelation[] {
  if (entries.length < 3) return [];

  const baseline = entries.reduce((s, e) => s + e.score, 0) / entries.length;
  const tagMap: Record<string, MoodLogEntry[]> = {};

  entries.forEach(e => {
    const tags = [e.primaryTag, ...e.additionalTags];
    tags.forEach(t => {
      if (!tagMap[t]) tagMap[t] = [];
      tagMap[t].push(e);
    });
  });

  return Object.entries(tagMap)
    .filter(([, es]) => es.length >= 2)
    .map(([tagId, es]) => {
      const observedAvg = es.reduce((s, e) => s + e.score, 0) / es.length;
      const tag = CONTEXT_TAGS.find(t => t.id === tagId);
      const n = es.length;

      // Blend observed correlation with the tag's science-backed weight for low sample sizes.
      // At n=2 use 80% expected, at n=10+ use 100% observed.
      // This prevents small-sample noise from showing e.g. "Ate Poorly" as positive.
      let adjustedAvg: number;
      if (tag && tag.weight !== 0 && n < 10) {
        const expectedAvg = baseline + tag.weight;
        const observedWeight = Math.min(1, (n - 2) / 8); // 0 at n=2, 1 at n=10
        const expectedWeight = 1 - observedWeight;
        adjustedAvg = expectedAvg * expectedWeight + observedAvg * observedWeight;
        // Ensure negative-weight tags never show as positive vs baseline, and vice versa
        if (tag.weight < 0 && adjustedAvg > baseline) adjustedAvg = baseline - 1;
        if (tag.weight > 0 && adjustedAvg < baseline) adjustedAvg = baseline + 1;
      } else {
        adjustedAvg = observedAvg;
      }

      return {
        tagId,
        sampleSize: n,
        avgScore: Math.round(adjustedAvg),
        avgBody: +(es.reduce((s, e) => s + e.dimensions.body, 0) / n).toFixed(2),
        avgMind: +(es.reduce((s, e) => s + e.dimensions.mind, 0) / n).toFixed(2),
        avgEnergy: +(es.reduce((s, e) => s + e.dimensions.energy, 0) / n).toFixed(2),
        deltaVsBaseline: Math.round(adjustedAvg - baseline),
      };
    })
    .sort((a, b) => Math.abs(b.deltaVsBaseline) - Math.abs(a.deltaVsBaseline));
}

export interface TimePattern {
  timeOfDay: TimeOfDay;
  avgScore: number;
  sampleSize: number;
}

export function computeTimePatterns(entries: MoodLogEntry[]): TimePattern[] {
  const grouped: Record<TimeOfDay, MoodLogEntry[]> = { morning: [], afternoon: [], evening: [], night: [] };
  entries.forEach(e => grouped[e.timeOfDay].push(e));
  return (Object.entries(grouped) as [TimeOfDay, MoodLogEntry[]][])
    .filter(([, es]) => es.length >= 2)
    .map(([tod, es]) => ({
      timeOfDay: tod,
      avgScore: Math.round(es.reduce((s, e) => s + e.score, 0) / es.length),
      sampleSize: es.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

// ─── Storage keys ─────────────────────────────────────────────────────────────
export const MOODLOG_STORAGE_KEY = 'moodlog_entries_v2';
