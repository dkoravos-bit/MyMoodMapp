/**
 * Astrology service
 * Calculates zodiac sign from birthdate, current planetary positions,
 * retrograde status, moon phase, and multi-domain life implications.
 * Uses simplified astronomical approximations — no external API required.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const BIRTHDATE_KEY = 'vibe_birthdate';

// ─── Types ────────────────────────────────────────────────

export interface ZodiacSign {
  id: string;
  name: string;
  symbol: string;
  emoji: string;
  element: 'fire' | 'earth' | 'air' | 'water';
  modality: 'cardinal' | 'fixed' | 'mutable';
  rulingPlanet: string;
  physicalAreas: string[];
  color: string;
  keywords: string[];
  strengths: string[];
  challenges: string[];
  lifeTheme: string; // one-line soul purpose
}

export interface LifeDomainEffect {
  domain: string;         // e.g. 'Relationships', 'Career', 'Health'
  icon: string;           // MaterialIcon name
  color: string;
  direct: string;
  retrograde: string;
  tip: string;            // practical action
}

export interface PlanetPosition {
  planet: string;
  symbol: string;
  sign: string;
  signEmoji: string;
  retrograde: boolean;
  degree: number; // 0–29
  physicalEffect: string;
  energyType: 'activating' | 'harmonizing' | 'challenging' | 'introspective';
  // New: multi-domain effects
  governs: string[];      // domains this planet rules
  lifeDomainEffects: LifeDomainEffect[];
  intensity: 'subtle' | 'moderate' | 'strong'; // how influential today
}

export interface MoonPhase {
  phase: string;
  emoji: string;
  illumination: number; // 0–1
  physicalEffect: string;
  emotionalEffect: string;
  energyLevel: 'low' | 'moderate' | 'high' | 'intense';
  // New: life domain guidance per phase
  bestFor: string[];
  avoidNow: string[];
}

export interface AstrologyReport {
  birthdate: string;
  zodiacSign: ZodiacSign;
  sunSign: string;
  moonPhase: MoonPhase;
  planets: PlanetPosition[];
  dailyPhysicalForecast: string;
  overallEnergy: 'blocked' | 'low' | 'building' | 'high' | 'peak';
  overallEnergyScore: number; // 0–100
  headline: string;
  generatedDate: string;
  // New: aggregated domain summary
  domainSummary: DomainSummary[];
  weeklyTheme: string;
  cosmicAdvice: string;
}

export interface DomainSummary {
  domain: string;
  icon: string;
  color: string;
  score: number; // 0–100 composite
  headline: string;
  details: string;
}

// ─── Zodiac Data ──────────────────────────────────────────

const ZODIAC_SIGNS: ZodiacSign[] = [
  {
    id: 'aries', name: 'Aries', symbol: '♈', emoji: '🐏', element: 'fire', modality: 'cardinal',
    rulingPlanet: 'Mars', physicalAreas: ['head', 'face', 'adrenal glands'],
    color: '#FF6B6B',
    keywords: ['initiative', 'courage', 'action', 'independence'],
    strengths: ['bold decisiveness', 'pioneering energy', 'natural leadership'],
    challenges: ['impulsiveness', 'impatience', 'burnout from over-pushing'],
    lifeTheme: 'To initiate, lead, and forge new paths through courageous action.',
  },
  {
    id: 'taurus', name: 'Taurus', symbol: '♉', emoji: '🐂', element: 'earth', modality: 'fixed',
    rulingPlanet: 'Venus', physicalAreas: ['throat', 'neck', 'thyroid'],
    color: '#95E06C',
    keywords: ['stability', 'beauty', 'patience', 'pleasure'],
    strengths: ['steadfast reliability', 'sensory intelligence', 'material mastery'],
    challenges: ['resistance to change', 'stubbornness', 'over-attachment'],
    lifeTheme: 'To build lasting security and find divinity in beauty and the physical world.',
  },
  {
    id: 'gemini', name: 'Gemini', symbol: '♊', emoji: '👯', element: 'air', modality: 'mutable',
    rulingPlanet: 'Mercury', physicalAreas: ['lungs', 'hands', 'nervous system'],
    color: '#FFD166',
    keywords: ['communication', 'curiosity', 'adaptability', 'duality'],
    strengths: ['quick thinking', 'wit', 'versatility', 'social intelligence'],
    challenges: ['scattered focus', 'inconsistency', 'nervous energy'],
    lifeTheme: 'To gather, connect, and share ideas across the full spectrum of human experience.',
  },
  {
    id: 'cancer', name: 'Cancer', symbol: '♋', emoji: '🦀', element: 'water', modality: 'cardinal',
    rulingPlanet: 'Moon', physicalAreas: ['stomach', 'chest', 'lymphatic system'],
    color: '#4ECDC4',
    keywords: ['nurturing', 'intuition', 'home', 'emotion'],
    strengths: ['deep empathy', 'fierce loyalty', 'intuitive insight'],
    challenges: ['moodiness', 'over-attachment', 'difficulty letting go'],
    lifeTheme: 'To create safety and belonging — for yourself and those you love.',
  },
  {
    id: 'leo', name: 'Leo', symbol: '♌', emoji: '🦁', element: 'fire', modality: 'fixed',
    rulingPlanet: 'Sun', physicalAreas: ['heart', 'spine', 'circulatory system'],
    color: '#F5A623',
    keywords: ['creativity', 'confidence', 'generosity', 'self-expression'],
    strengths: ['magnetic presence', 'creative brilliance', 'warmth'],
    challenges: ['ego fragility', 'need for validation', 'drama'],
    lifeTheme: 'To shine fully, inspire others, and express the authentic self without apology.',
  },
  {
    id: 'virgo', name: 'Virgo', symbol: '♍', emoji: '👩', element: 'earth', modality: 'mutable',
    rulingPlanet: 'Mercury', physicalAreas: ['digestive system', 'intestines', 'nervous system'],
    color: '#95E06C',
    keywords: ['analysis', 'service', 'precision', 'health'],
    strengths: ['analytical depth', 'craft mastery', 'discernment'],
    challenges: ['over-criticism', 'perfectionism', 'worry loops'],
    lifeTheme: 'To perfect craft, serve with precision, and find the sacred in daily detail.',
  },
  {
    id: 'libra', name: 'Libra', symbol: '♎', emoji: '⚖️', element: 'air', modality: 'cardinal',
    rulingPlanet: 'Venus', physicalAreas: ['kidneys', 'lower back', 'skin'],
    color: '#FFD166',
    keywords: ['balance', 'harmony', 'beauty', 'justice'],
    strengths: ['diplomatic grace', 'aesthetic vision', 'fairness'],
    challenges: ['indecisiveness', 'people-pleasing', 'avoiding conflict'],
    lifeTheme: 'To create harmony, champion justice, and build bridges between opposing forces.',
  },
  {
    id: 'scorpio', name: 'Scorpio', symbol: '♏', emoji: '🦂', element: 'water', modality: 'fixed',
    rulingPlanet: 'Pluto/Mars', physicalAreas: ['reproductive system', 'colon', 'bladder'],
    color: '#FF8C42',
    keywords: ['transformation', 'depth', 'intensity', 'rebirth'],
    strengths: ['penetrating insight', 'resilience', 'emotional courage'],
    challenges: ['jealousy', 'secrecy', 'intensity that overwhelms'],
    lifeTheme: 'To dive into the depths, transmute darkness into power, and facilitate transformation.',
  },
  {
    id: 'sagittarius', name: 'Sagittarius', symbol: '♐', emoji: '🏹', element: 'fire', modality: 'mutable',
    rulingPlanet: 'Jupiter', physicalAreas: ['hips', 'thighs', 'liver'],
    color: '#F5A623',
    keywords: ['freedom', 'philosophy', 'adventure', 'optimism'],
    strengths: ['expansive vision', 'joy', 'philosophical wisdom'],
    challenges: ['restlessness', 'over-promising', 'bluntness'],
    lifeTheme: 'To seek truth, expand horizons, and inspire others toward a bigger view of life.',
  },
  {
    id: 'capricorn', name: 'Capricorn', symbol: '♑', emoji: '🐐', element: 'earth', modality: 'cardinal',
    rulingPlanet: 'Saturn', physicalAreas: ['bones', 'knees', 'teeth'],
    color: '#8A8EBF',
    keywords: ['ambition', 'discipline', 'responsibility', 'mastery'],
    strengths: ['strategic thinking', 'endurance', 'integrity under pressure'],
    challenges: ['rigidity', 'workaholism', 'emotional suppression'],
    lifeTheme: 'To master the material world through disciplined effort and leave a lasting legacy.',
  },
  {
    id: 'aquarius', name: 'Aquarius', symbol: '♒', emoji: '🏺', element: 'air', modality: 'fixed',
    rulingPlanet: 'Uranus/Saturn', physicalAreas: ['ankles', 'circulation', 'nervous system'],
    color: '#5B6FFF',
    keywords: ['innovation', 'community', 'rebellion', 'humanity'],
    strengths: ['visionary thinking', 'humanitarian instinct', 'originality'],
    challenges: ['emotional detachment', 'contrarianism', 'inconsistency'],
    lifeTheme: 'To revolutionize, connect humanity, and envision the world as it could be.',
  },
  {
    id: 'pisces', name: 'Pisces', symbol: '♓', emoji: '🐟', element: 'water', modality: 'mutable',
    rulingPlanet: 'Neptune/Jupiter', physicalAreas: ['feet', 'immune system', 'lymphatic system'],
    color: '#4ECDC4',
    keywords: ['compassion', 'intuition', 'spirituality', 'surrender'],
    strengths: ['boundless empathy', 'artistic imagination', 'spiritual depth'],
    challenges: ['escapism', 'martyrdom', 'porous boundaries'],
    lifeTheme: 'To dissolve separation, tap universal compassion, and create from pure imagination.',
  },
];

// ─── Zodiac from birthdate ────────────────────────────────

export function getZodiacSign(birthdate: string): ZodiacSign {
  const [, month, day] = birthdate.split('-').map(Number);
  let id = 'capricorn';
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) id = 'aries';
  else if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) id = 'taurus';
  else if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) id = 'gemini';
  else if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) id = 'cancer';
  else if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) id = 'leo';
  else if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) id = 'virgo';
  else if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) id = 'libra';
  else if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) id = 'scorpio';
  else if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) id = 'sagittarius';
  else if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) id = 'capricorn';
  else if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) id = 'aquarius';
  else if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) id = 'pisces';
  return ZODIAC_SIGNS.find(z => z.id === id)!;
}

// ─── Moon Phase ───────────────────────────────────────────

export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const refNewMoon = new Date('2000-01-06T18:14:00Z').getTime();
  const synodicMs = 29.530588853 * 24 * 3600 * 1000;
  const elapsed = (date.getTime() - refNewMoon) % synodicMs;
  const fraction = elapsed / synodicMs;
  const illumination = 0.5 * (1 - Math.cos(2 * Math.PI * fraction));

  let phase: string;
  let emoji: string;
  let physicalEffect: string;
  let emotionalEffect: string;
  let energyLevel: MoonPhase['energyLevel'];
  let bestFor: string[];
  let avoidNow: string[];

  if (fraction < 0.03 || fraction >= 0.97) {
    phase = 'New Moon'; emoji = '🌑'; energyLevel = 'low';
    physicalEffect = 'Lower physical vitality; good time for deep rest, gut reset, and setting intentions. Heightened sensitivity to headaches.';
    emotionalEffect = 'A natural turning inward. Emotions settle into quiet — this is a seed-planting state, not a harvest.';
    bestFor = ['Setting intentions', 'Starting new projects', 'Journaling', 'Deep rest', 'Fasting or cleansing'];
    avoidNow = ['Launching public-facing events', 'High-intensity workouts', 'Confrontational conversations'];
  } else if (fraction < 0.22) {
    phase = 'Waxing Crescent'; emoji = '🌒'; energyLevel = 'moderate';
    physicalEffect = 'Energy building steadily. Metabolism is more responsive, inflammation decreasing. Good for initiating new physical habits.';
    emotionalEffect = 'Curiosity and hope are rising. A quiet optimism makes it easier to take the first step on things you have been putting off.';
    bestFor = ['Starting habits', 'Learning new skills', 'Light exercise', 'Socialising', 'Creative brainstorming'];
    avoidNow = ['Over-committing', 'Making permanent decisions', 'Skimping on sleep'];
  } else if (fraction < 0.28) {
    phase = 'First Quarter'; emoji = '🌓'; energyLevel = 'high';
    physicalEffect = 'Rising physical tension — muscles may feel tighter. Energy is high but can tip toward restlessness or irritability.';
    emotionalEffect = 'You may hit friction on intentions set at the new moon. Challenges surface — this is the test, not the failure.';
    bestFor = ['Overcoming obstacles', 'Hard workouts', 'Decision making', 'Confronting avoidance'];
    avoidNow = ['Passive waiting', 'Over-analysis paralysis', 'Ignoring conflict'];
  } else if (fraction < 0.47) {
    phase = 'Waxing Gibbous'; emoji = '🌔'; energyLevel = 'high';
    physicalEffect = 'Fluids in the body are increasing. You may notice water retention or heightened sensory and emotional sensitivity.';
    emotionalEffect = 'Refinement energy is strong — a desire to improve, perfect, and adjust. Anxiety about outcomes can creep in.';
    bestFor = ['Refining work', 'Detail-oriented tasks', 'Deep focus', 'Preparation', 'Healing bodywork'];
    avoidNow = ['Procrastination', 'Over-editing creative work', 'Excessive self-criticism'];
  } else if (fraction < 0.53) {
    phase = 'Full Moon'; emoji = '🌕'; energyLevel = 'intense';
    physicalEffect = 'Peak fluid retention and electromagnetic sensitivity. Sleep may be disrupted, emotional body is heightened. Heart rate can be slightly elevated.';
    emotionalEffect = 'Everything is amplified — gratitude feels fuller, frustration feels sharper. Illumination, culmination, and release. Not a time to suppress feelings.';
    bestFor = ['Celebration', 'Completion of projects', 'Releasing what no longer serves', 'Emotional breakthroughs', 'Gratitude practice'];
    avoidNow = ['Starting brand new things', 'Ignoring emotional signals', 'Excessive alcohol or stimulants'];
  } else if (fraction < 0.72) {
    phase = 'Waning Gibbous'; emoji = '🌖'; energyLevel = 'moderate';
    physicalEffect = 'Natural detox phase. Body releasing excess fluids. Good for fasting, lymphatic work, and reducing inflammation.';
    emotionalEffect = 'A natural desire to share wisdom and give back. Gratitude flows easily. A time for teaching, mentoring, and reflection on lessons.';
    bestFor = ['Sharing knowledge', 'Decluttering', 'Forgiveness work', 'Detox protocols', 'Mentoring others'];
    avoidNow = ['Hoarding energy or resources', 'Excessive social media', 'Suppressing emotions'];
  } else if (fraction < 0.78) {
    phase = 'Last Quarter'; emoji = '🌗'; energyLevel = 'moderate';
    physicalEffect = 'Physical energy declining from peak. Immune system is working quietly. Prioritize sleep and recovery.';
    emotionalEffect = 'A crisis of consciousness — old patterns and beliefs surface for review. An ideal time for honest self-reflection.';
    bestFor = ['Breaking old habits', 'Tough self-reflection', 'Ending relationships or projects', 'Nervous system rest'];
    avoidNow = ['Starting major new initiatives', 'Ignoring what the inner critic is saying', 'Over-scheduling'];
  } else {
    phase = 'Waning Crescent'; emoji = '🌘'; energyLevel = 'low';
    physicalEffect = 'Deep cellular repair mode. The body is clearing and completing cycles. Rest is especially restorative now.';
    emotionalEffect = 'Surrender and trust. A liminal, between-worlds feeling is normal. Isolation urges are natural and healthy right now.';
    bestFor = ['Deep rest', 'Meditation', 'Spiritual practice', 'Solitude', 'Dream journaling'];
    avoidNow = ['Forcing productivity', 'Comparing yourself to others', 'Major life decisions'];
  }

  return { phase, emoji, illumination, physicalEffect, emotionalEffect, energyLevel, bestFor, avoidNow };
}

// ─── Planetary Life Domain Effects ───────────────────────

const PLANET_DOMAIN_EFFECTS: Record<string, LifeDomainEffect[]> = {
  Mercury: [
    {
      domain: 'Communication', icon: 'chat', color: '#FFD166',
      direct: 'Ideas flow clearly. Writing, speaking, and negotiating are all supported. Contracts and agreements signed now are solid.',
      retrograde: 'Miscommunications are more likely. Re-read important messages before sending. Avoid signing contracts if possible.',
      tip: 'Schedule important conversations and calls on Mercury direct days.',
    },
    {
      domain: 'Mental clarity', icon: 'psychology', color: '#5B6FFF',
      direct: 'Analytical thinking is sharp. A great time for complex problem-solving, studying, and learning new skills.',
      retrograde: 'Brain fog and forgetfulness are common. Back up data, double-check travel plans, and expect tech glitches.',
      tip: 'Use retrograde periods for reviewing, editing, and completing — not initiating.',
    },
    {
      domain: 'Travel & logistics', icon: 'directions-car', color: '#95E06C',
      direct: 'Transit and scheduling run smoothly. A good window for booking trips and planning logistics.',
      retrograde: 'Delays and detours are likely. Build extra buffer into all travel plans. Reconfirm all bookings.',
      tip: 'Arrive 20 minutes early for any transport during retrograde.',
    },
  ],
  Venus: [
    {
      domain: 'Relationships', icon: 'favorite', color: '#FF8C42',
      direct: 'Romantic and social energy flows easily. An ideal time to deepen bonds, have heart-to-heart conversations, and express appreciation.',
      retrograde: 'Old relationship dynamics resurface. Exes may reappear. Take care before re-engaging with past patterns.',
      tip: 'Express appreciation to the people you love while Venus is direct.',
    },
    {
      domain: 'Creativity & beauty', icon: 'palette', color: '#A78BFA',
      direct: 'Artistic inspiration is at a peak. Your aesthetic sense is refined — a great time for creative work, redecorating, or beauty investments.',
      retrograde: 'Aesthetic judgment may be off. Avoid dramatic style changes, cosmetic procedures, or major art investments.',
      tip: 'Start creative projects during Venus direct for the best flow.',
    },
    {
      domain: 'Finances', icon: 'attach-money', color: '#95E06C',
      direct: 'Financial decisions made now tend to be sound. A good window for negotiating salaries, investments, or luxury purchases.',
      retrograde: 'Overspending or impulsive financial decisions are more likely. Review subscriptions and recurring expenses.',
      tip: 'Audit your spending during Venus retrograde — it reveals hidden indulgences.',
    },
  ],
  Mars: [
    {
      domain: 'Energy & drive', icon: 'local-fire-department', color: '#FF6B6B',
      direct: 'Physical stamina and motivation are elevated. A powerful window for ambitious goals, athletic performance, and decisive action.',
      retrograde: 'Energy feels blocked or misdirected. Frustration and impatience can turn inward as passive aggression or physical fatigue.',
      tip: 'Use Mars direct phases for launching new fitness routines and ambitious projects.',
    },
    {
      domain: 'Career & ambition', icon: 'trending-up', color: '#F5A623',
      direct: 'Initiative and assertiveness are rewarded. Push forward on promotions, negotiations, and competitive situations.',
      retrograde: 'Reassess strategy rather than pushing harder. Projects launched now may lack sustained momentum.',
      tip: 'Submit job applications and make bold asks during Mars direct.',
    },
    {
      domain: 'Conflict & courage', icon: 'shield', color: '#FF8C42',
      direct: 'Courage to address difficult situations is accessible. Conflicts, if handled directly, resolve more cleanly now.',
      retrograde: 'Avoid picking battles — aggression tends to backfire. Inner work on anger and resentment is more productive.',
      tip: 'Have the courageous conversation you have been avoiding while Mars is direct.',
    },
  ],
  Jupiter: [
    {
      domain: 'Growth & opportunity', icon: 'open-in-full', color: '#95E06C',
      direct: 'Expansion is supported. Opportunities come more easily and risks tend to pay off. A fortuitous window for growth.',
      retrograde: 'Inward expansion rather than outward. Philosophical and spiritual development is rewarded over material ambition.',
      tip: 'Launch businesses, pitch big ideas, and take calculated risks during Jupiter direct.',
    },
    {
      domain: 'Abundance & luck', icon: 'star', color: '#FFD166',
      direct: 'Generosity and optimism attract good fortune. The universe feels more responsive to intention and effort.',
      retrograde: 'Review whether you are truly grateful for what you already have. Excess and over-extension may need correcting.',
      tip: 'Practice genuine gratitude — it amplifies Jupiter direct energy.',
    },
    {
      domain: 'Spirituality & meaning', icon: 'self-improvement', color: '#A78BFA',
      direct: 'Philosophical exploration and spiritual growth feel natural and rewarding. Teaching and sharing wisdom is favoured.',
      retrograde: 'A profound time for inner wisdom and reassessing your belief systems. What do you truly believe?',
      tip: 'Read, study, and engage with philosophical or spiritual ideas during retrograde.',
    },
  ],
  Saturn: [
    {
      domain: 'Discipline & structure', icon: 'architecture', color: '#8A8EBF',
      direct: 'Hard work is rewarded. A period of building foundations, strengthening systems, and committing to long-term goals.',
      retrograde: 'Old structures and responsibilities come up for review. Where are you avoiding accountability in your life?',
      tip: 'Use Saturn retrograde to audit commitments — keep only those that truly align with your goals.',
    },
    {
      domain: 'Career & legacy', icon: 'workspace-premium', color: '#5B6FFF',
      direct: 'Professional credibility and long-term reputation are enhanced by consistent effort. A great time to commit to mastery.',
      retrograde: 'Career progress may slow, inviting reflection on whether you are on the right path. Course corrections are well supported.',
      tip: 'Build one new professional skill per Saturn retrograde period.',
    },
    {
      domain: 'Responsibility & karma', icon: 'balance', color: '#4ECDC4',
      direct: 'Taking ownership of your actions generates real respect and opportunity. Integrity is rewarded.',
      retrograde: 'Karmic lessons resurface. Patterns that need to be broken keep showing up until you face them directly.',
      tip: 'Identify one recurring life pattern and commit to breaking it during Saturn retrograde.',
    },
  ],
};

// ─── Planetary Positions ──────────────────────────────────

const PLANET_DATA: Array<{
  planet: string; symbol: string; orbitalDays: number;
  refDegree: number; refDate: number;
  retrogradeFraction: number;
  physicalEffects: { direct: string; retrograde: string };
  energy: PlanetPosition['energyType'];
  governs: string[];
}> = [
  {
    planet: 'Mercury', symbol: '☿', orbitalDays: 87.97, refDegree: 165, refDate: 1704067200000,
    retrogradeFraction: 0.19,
    physicalEffects: {
      direct: 'Mental clarity is sharp — nervous system responsive, communication easy.',
      retrograde: 'Mercury retrograde: nervous system hypersensitivity, anxiety may spike, sleep disrupted by overthinking.',
    },
    energy: 'introspective',
    governs: ['Communication', 'Intellect', 'Travel', 'Technology'],
  },
  {
    planet: 'Venus', symbol: '♀', orbitalDays: 224.7, refDegree: 210, refDate: 1704067200000,
    retrogradeFraction: 0.07,
    physicalEffects: {
      direct: 'Kidney and skin regulation balanced. A harmonizing influence on the body.',
      retrograde: 'Venus retrograde: skin sensitivity, hormonal fluctuations, throat or thyroid sensitivity.',
    },
    energy: 'harmonizing',
    governs: ['Love', 'Beauty', 'Finances', 'Creativity'],
  },
  {
    planet: 'Mars', symbol: '♂', orbitalDays: 686.97, refDegree: 72, refDate: 1704067200000,
    retrogradeFraction: 0.09,
    physicalEffects: {
      direct: 'Physical drive and stamina elevated. Adrenal energy is strong — good for exercise and endurance.',
      retrograde: 'Mars retrograde: fatigue, frustration stored as physical tension, inflammation potential higher.',
    },
    energy: 'activating',
    governs: ['Action', 'Ambition', 'Sexuality', 'Conflict'],
  },
  {
    planet: 'Jupiter', symbol: '♃', orbitalDays: 4332.59, refDegree: 15, refDate: 1704067200000,
    retrogradeFraction: 0.30,
    physicalEffects: {
      direct: 'Liver and metabolic function supported. Expansive energy — body feels more resilient.',
      retrograde: 'Jupiter retrograde: digestive sluggishness, tendency toward over-indulgence, liver needs support.',
    },
    energy: 'harmonizing',
    governs: ['Growth', 'Luck', 'Philosophy', 'Abundance'],
  },
  {
    planet: 'Saturn', symbol: '♄', orbitalDays: 10759.22, refDegree: 330, refDate: 1704067200000,
    retrogradeFraction: 0.36,
    physicalEffects: {
      direct: 'Structural support — bones, teeth, and joints are in a building phase.',
      retrograde: 'Saturn retrograde: chronic tension in joints and spine, fatigue from accumulated pressure.',
    },
    energy: 'challenging',
    governs: ['Discipline', 'Karma', 'Structure', 'Mastery'],
  },
];

function degreesToSign(deg: number): { sign: string; emoji: string } {
  const idx = Math.floor(((deg % 360) + 360) % 360 / 30);
  const signs = [
    { sign: 'Aries', emoji: '♈' }, { sign: 'Taurus', emoji: '♉' },
    { sign: 'Gemini', emoji: '♊' }, { sign: 'Cancer', emoji: '♋' },
    { sign: 'Leo', emoji: '♌' }, { sign: 'Virgo', emoji: '♍' },
    { sign: 'Libra', emoji: '♎' }, { sign: 'Scorpio', emoji: '♏' },
    { sign: 'Sagittarius', emoji: '♐' }, { sign: 'Capricorn', emoji: '♑' },
    { sign: 'Aquarius', emoji: '♒' }, { sign: 'Pisces', emoji: '♓' },
  ];
  return signs[idx];
}

export function getPlanetPositions(date: Date = new Date()): PlanetPosition[] {
  return PLANET_DATA.map(p => {
    const elapsed = (date.getTime() - p.refDate) / 86400000;
    const degreesPerDay = 360 / p.orbitalDays;
    const rawDeg = p.refDegree + elapsed * degreesPerDay;
    const deg = ((rawDeg % 360) + 360) % 360;

    const orbitFraction = (elapsed % p.orbitalDays) / p.orbitalDays;
    const retrogradeZone = orbitFraction > (1 - p.retrogradeFraction);
    const { sign, emoji } = degreesToSign(deg);

    // Intensity: challenging planets or retrograde = 'strong', activating = 'moderate', otherwise 'subtle'
    const intensity: PlanetPosition['intensity'] = retrogradeZone
      ? 'strong'
      : p.energy === 'activating' ? 'moderate' : 'subtle';

    const domainEffects = PLANET_DOMAIN_EFFECTS[p.planet] ?? [];

    return {
      planet: p.planet,
      symbol: p.symbol,
      sign,
      signEmoji: emoji,
      retrograde: retrogradeZone,
      degree: Math.floor(deg % 30),
      physicalEffect: retrogradeZone ? p.physicalEffects.retrograde : p.physicalEffects.direct,
      energyType: p.energy,
      governs: p.governs,
      lifeDomainEffects: domainEffects,
      intensity,
    };
  });
}

// ─── Domain Score Aggregation ─────────────────────────────

function buildDomainSummary(planets: PlanetPosition[], moonPhase: MoonPhase): DomainSummary[] {
  const moonBoost = moonPhase.energyLevel === 'intense' || moonPhase.energyLevel === 'high' ? 8 : moonPhase.energyLevel === 'low' ? -8 : 0;

  const domains: DomainSummary[] = [
    {
      domain: 'Relationships',
      icon: 'favorite',
      color: '#FF8C42',
      score: 0,
      headline: '',
      details: '',
    },
    {
      domain: 'Career & Ambition',
      icon: 'trending-up',
      color: '#F5A623',
      score: 0,
      headline: '',
      details: '',
    },
    {
      domain: 'Health & Vitality',
      icon: 'fitness-center',
      color: '#95E06C',
      score: 0,
      headline: '',
      details: '',
    },
    {
      domain: 'Creativity',
      icon: 'palette',
      color: '#A78BFA',
      score: 0,
      headline: '',
      details: '',
    },
    {
      domain: 'Communication',
      icon: 'chat',
      color: '#FFD166',
      score: 0,
      headline: '',
      details: '',
    },
    {
      domain: 'Finances',
      icon: 'attach-money',
      color: '#4ECDC4',
      score: 0,
      headline: '',
      details: '',
    },
    {
      domain: 'Spirituality',
      icon: 'self-improvement',
      color: '#8A8EBF',
      score: 0,
      headline: '',
      details: '',
    },
  ];

  // Base scores with moon phase influence
  domains.forEach(d => { d.score = 60 + moonBoost; });

  // Mars — health/career
  const mars = planets.find(p => p.planet === 'Mars');
  if (mars) {
    const delta = mars.retrograde ? -18 : 15;
    domains.find(d => d.domain === 'Health & Vitality')!.score += delta;
    domains.find(d => d.domain === 'Career & Ambition')!.score += delta;
  }

  // Venus — relationships/creativity/finances
  const venus = planets.find(p => p.planet === 'Venus');
  if (venus) {
    const delta = venus.retrograde ? -15 : 12;
    domains.find(d => d.domain === 'Relationships')!.score += delta;
    domains.find(d => d.domain === 'Creativity')!.score += delta;
    domains.find(d => d.domain === 'Finances')!.score += Math.round(delta * 0.7);
  }

  // Mercury — communication
  const mercury = planets.find(p => p.planet === 'Mercury');
  if (mercury) {
    const delta = mercury.retrograde ? -20 : 15;
    domains.find(d => d.domain === 'Communication')!.score += delta;
    domains.find(d => d.domain === 'Career & Ambition')!.score += Math.round(delta * 0.5);
  }

  // Jupiter — spirituality/finances
  const jupiter = planets.find(p => p.planet === 'Jupiter');
  if (jupiter) {
    const delta = jupiter.retrograde ? -8 : 10;
    domains.find(d => d.domain === 'Spirituality')!.score += delta;
    domains.find(d => d.domain === 'Finances')!.score += delta;
  }

  // Saturn — career/structure
  const saturn = planets.find(p => p.planet === 'Saturn');
  if (saturn) {
    const delta = saturn.retrograde ? -10 : 8;
    domains.find(d => d.domain === 'Career & Ambition')!.score += delta;
    domains.find(d => d.domain === 'Spirituality')!.score += Math.round(delta * 0.6);
  }

  // Moon phase boosts
  if (moonPhase.phase === 'Full Moon') {
    domains.find(d => d.domain === 'Relationships')!.score += 10;
    domains.find(d => d.domain === 'Creativity')!.score += 8;
  }
  if (moonPhase.phase === 'New Moon') {
    domains.find(d => d.domain === 'Spirituality')!.score += 15;
  }
  if (moonPhase.energyLevel === 'high' || moonPhase.energyLevel === 'intense') {
    domains.find(d => d.domain === 'Health & Vitality')!.score -= 5;
  }

  // Clamp scores
  domains.forEach(d => { d.score = Math.max(20, Math.min(100, d.score)); });

  // Generate headlines and details
  const retroNames = planets.filter(p => p.retrograde).map(p => p.planet);

  const makeHeadline = (domain: string, score: number): string => {
    if (score >= 80) return `Highly favourable — lean in`;
    if (score >= 65) return `Flowing well today`;
    if (score >= 50) return `Moderate — proceed mindfully`;
    if (score >= 35) return `Headwinds present — go slowly`;
    return `Challenging — reflect rather than act`;
  };

  const makeDetails: Record<string, (score: number) => string> = {
    'Relationships': (s) => s >= 65
      ? `Venus is direct and ${moonPhase.phase.includes('Full') ? 'the Full Moon amplifies emotional bonds' : 'the lunar energy supports connection'}. An ideal time to express love, resolve tension, and deepen intimacy.`
      : `${retroNames.includes('Venus') ? 'Venus retrograde stirs old relationship patterns' : 'Planetary headwinds'}  suggest slowing down in love. Avoid ultimatums; opt for curiosity and patience instead.`,
    'Career & Ambition': (s) => s >= 65
      ? `Mars ${retroNames.includes('Mars') ? '' : 'direct'}  and ${retroNames.includes('Saturn') ? '' : 'Saturn direct'} support disciplined effort and initiative. Push for what you want.`
      : `${retroNames.includes('Mars') ? 'Mars retrograde drains drive and can misdirect ambition' : retroNames.includes('Mercury') ? 'Mercury retrograde creates communication challenges at work' : 'Planetary friction'} . Focus on consolidation over expansion.`,
    'Health & Vitality': (s) => s >= 65
      ? `Physical energy is strong. Mars direct supports stamina and exercise. A good window for athletic challenges, new routines, and ambitious health goals.`
      : `${retroNames.includes('Mars') ? 'Mars retrograde channels energy inward — fatigue and tension are common' : 'Lower planetary support for vigour'}. Prioritize recovery, quality sleep, and anti-inflammatory foods.`,
    'Creativity': (s) => s >= 65
      ? `Venus direct opens a channel of beauty and inspiration. Artistic work created now carries genuine aesthetic power. Make things.`
      : `${retroNames.includes('Venus') ? 'Venus retrograde can distort artistic judgment' : 'Creative energy is building below the surface'}. Experiment freely but avoid publishing or presenting until energy shifts.`,
    'Communication': (s) => s >= 65
      ? `Mercury direct makes this an excellent window for negotiations, important emails, presentations, and difficult conversations.`
      : `Mercury retrograde is active — misunderstandings multiply. Re-read everything, confirm all appointments, and expect technology hiccups.`,
    'Finances': (s) => s >= 65
      ? `Jupiter and Venus support sound financial decisions, salary negotiations, and considered investments. Review your growth strategy.`
      : `${retroNames.includes('Venus') ? 'Venus retrograde warns against overspending on aesthetics or luxury' : 'Planetary caution in money matters'}. Audit outgoings and avoid impulsive purchases.`,
    'Spirituality': (s) => s >= 65
      ? `${moonPhase.phase === 'New Moon' ? 'The New Moon is a potent portal for spiritual reset' : moonPhase.phase === 'Full Moon' ? 'The Full Moon illuminates what is ready to be released' : 'Jupiter supports inner growth today'}. Meditation, prayer, and contemplative practices are especially powerful.`
      : `${retroNames.includes('Saturn') ? 'Saturn retrograde surfaces karmic lessons' : 'The cosmos invites deeper inner work'}. Lean into shadow work, journaling, and honest self-reflection.`,
  };

  domains.forEach(d => {
    d.headline = makeHeadline(d.domain, d.score);
    d.details = (makeDetails[d.domain] ?? (() => ''))(d.score);
  });

  return domains;
}

// ─── Full Daily Report ────────────────────────────────────

export function buildAstrologyReport(birthdate: string, date: Date = new Date()): AstrologyReport {
  const zodiacSign = getZodiacSign(birthdate);
  const moonPhase = getMoonPhase(date);
  const planets = getPlanetPositions(date);

  const retrogrades = planets.filter(p => p.retrograde);
  const activating = planets.filter(p => p.energyType === 'activating' && !p.retrograde);

  // Overall energy score
  let score = 60;
  score += activating.length * 8;
  score -= retrogrades.length * 10;
  if (moonPhase.energyLevel === 'high' || moonPhase.energyLevel === 'intense') score += 10;
  if (moonPhase.energyLevel === 'low') score -= 10;
  score = Math.max(15, Math.min(100, score));

  const overallEnergy: AstrologyReport['overallEnergy'] =
    score >= 80 ? 'peak' : score >= 65 ? 'high' : score >= 45 ? 'building' : score >= 30 ? 'low' : 'blocked';

  // Domain summary
  const domainSummary = buildDomainSummary(planets, moonPhase);

  // Headline
  const retroText = retrogrades.length > 0
    ? `${retrogrades.map(p => p.planet).join(' & ')} Rx — ` : '';
  const headline = `${zodiacSign.emoji} ${zodiacSign.name} · ${moonPhase.emoji} ${moonPhase.phase} · ${retroText}Energy: ${overallEnergy}`;

  // Daily physical forecast
  const physicalAreas = zodiacSign.physicalAreas.slice(0, 2).join(' and ');
  const dominantPlanet = retrogrades.length > 0 ? retrogrades[0] : activating[0] ?? planets[0];
  const dailyPhysicalForecast = [
    `As a ${zodiacSign.name}, your ${physicalAreas} are the primary focus today.`,
    moonPhase.physicalEffect,
    dominantPlanet ? `${dominantPlanet.planet} in ${dominantPlanet.sign}: ${dominantPlanet.physicalEffect}` : '',
    retrogrades.length > 1 ? `Note: ${retrogrades.length} planets are retrograde — physical energy may feel scattered or internalized.` : '',
  ].filter(Boolean).join(' ');

  // Weekly theme (moon-phase driven)
  const phaseThemes: Record<string, string> = {
    'New Moon': 'Plant seeds — intentions set now carry powerful lunar momentum.',
    'Waxing Crescent': 'Build momentum — take the first tangible steps on what you envision.',
    'First Quarter': 'Push through resistance — challenges now are tests, not endings.',
    'Waxing Gibbous': 'Refine and prepare — almost at the peak; adjust before the full reveal.',
    'Full Moon': 'Illuminate and release — celebrate wins and let go of what is complete.',
    'Waning Gibbous': 'Share and integrate — pass on what you have learned.',
    'Last Quarter': 'Release and course-correct — honest evaluation is the work this week.',
    'Waning Crescent': 'Rest and renew — deep restoration sets the stage for the next cycle.',
  };
  const weeklyTheme = phaseThemes[moonPhase.phase] ?? 'A transition week — trust the process.';

  // Cosmic advice
  const bestDomains = [...domainSummary].sort((a, b) => b.score - a.score).slice(0, 2);
  const worstDomains = [...domainSummary].sort((a, b) => a.score - b.score).slice(0, 1);
  const cosmicAdvice = `Focus your energy on ${bestDomains.map(d => d.domain.toLowerCase()).join(' and ')} today — these are your most supported areas. ${worstDomains[0] ? `Proceed gently in ${worstDomains[0].domain.toLowerCase()}.` : ''}`;

  return {
    birthdate,
    zodiacSign,
    sunSign: zodiacSign.name,
    moonPhase,
    planets,
    dailyPhysicalForecast,
    overallEnergy,
    overallEnergyScore: score,
    headline,
    generatedDate: date.toISOString().split('T')[0],
    domainSummary,
    weeklyTheme,
    cosmicAdvice,
  };
}

// ─── Persistence ──────────────────────────────────────────

export async function saveBirthdate(birthdate: string): Promise<void> {
  await AsyncStorage.setItem(BIRTHDATE_KEY, birthdate);
}

export async function getBirthdate(): Promise<string | null> {
  return AsyncStorage.getItem(BIRTHDATE_KEY);
}

export function formatBirthdateDisplay(birthdate: string): string {
  const [year, month, day] = birthdate.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${day}, ${year}`;
}

export function getElementColor(element: ZodiacSign['element']): string {
  return { fire: '#FF6B6B', earth: '#95E06C', air: '#5B6FFF', water: '#4ECDC4' }[element];
}

export function getEnergyColor(energy: AstrologyReport['overallEnergy']): string {
  return {
    peak: '#95E06C', high: '#FFD166', building: '#F5A623', low: '#8A8EBF', blocked: '#FF6B6B',
  }[energy];
}

export function getMoonEnergyColor(level: MoonPhase['energyLevel']): string {
  return { low: '#8A8EBF', moderate: '#4ECDC4', high: '#FFD166', intense: '#FF8C42' }[level];
}

export function getDomainScoreColor(score: number): string {
  if (score >= 75) return '#95E06C';
  if (score >= 55) return '#FFD166';
  if (score >= 40) return '#FF8C42';
  return '#FF6B6B';
}
