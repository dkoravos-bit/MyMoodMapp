export interface Archetype {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  traits: string[];
  color: string;
  secondaryColor: string;
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 'chaotic_creative',
    name: 'Chaotic Creative',
    emoji: '🔥',
    tagline: 'Ideas at 3am, sleep never',
    description: "You live in bursts of inspiration. Your mind connects dots no one else sees, and your energy is contagious — even when it's a lot.",
    traits: ['Imaginative', 'Impulsive', 'Passionate', 'Non-linear'],
    color: '#F5A623',
    secondaryColor: '#FF6B6B',
  },
  {
    id: 'calm_anchor',
    name: 'Calm Anchor',
    emoji: '🌊',
    tagline: 'The steady one everyone leans on',
    description: "You process before you react. People gravitate to your steadiness. You see the long game while others chase the immediate.",
    traits: ['Patient', 'Thoughtful', 'Reliable', 'Empathetic'],
    color: '#4ECDC4',
    secondaryColor: '#5B6FFF',
  },
  {
    id: 'deep_thinker',
    name: 'Deep Thinker',
    emoji: '🌌',
    tagline: 'Questions within questions',
    description: "Surface-level bores you. You want to understand the why behind the why. Conversations with you leave people thinking for days.",
    traits: ['Analytical', 'Introspective', 'Curious', 'Private'],
    color: '#5B6FFF',
    secondaryColor: '#4ECDC4',
  },
  {
    id: 'radiant_connector',
    name: 'Radiant Connector',
    emoji: '✨',
    tagline: 'Lights up every room',
    description: "You remember names, notice when someone is off, and make strangers feel like old friends. Your superpower is making people feel seen.",
    traits: ['Warm', 'Social', 'Intuitive', 'Energetic'],
    color: '#FFD166',
    secondaryColor: '#F5A623',
  },
  {
    id: 'quiet_builder',
    name: 'Quiet Builder',
    emoji: '🏗️',
    tagline: 'Shipping while others talk',
    description: "You let the work speak. While others theorize, you execute. Your calm determination compounds into results that surprise everyone — except you.",
    traits: ['Disciplined', 'Focused', 'Humble', 'Strategic'],
    color: '#95E06C',
    secondaryColor: '#4ECDC4',
  },
  {
    id: 'wild_heart',
    name: 'Wild Heart',
    emoji: '🦋',
    tagline: 'Born to feel everything deeply',
    description: "You experience life in full color and full volume. Your highs are euphoric, your lows are deep, and you wouldn't trade that depth for anything.",
    traits: ['Sensitive', 'Expressive', 'Adventurous', 'Intense'],
    color: '#FF8C42',
    secondaryColor: '#FFD166',
  },
];

// ─── Question Pool ────────────────────────────────────────────────────────────
// Each of the 5 dimensions has 15 question variations.
// getRandomQuizQuestions() picks one from each pool randomly so every
// quiz session presents a fresh, unrepeatable combination.

type QuizOption = {
  text: string;
  weight: Partial<Record<string, number>>;
};

type QuizQuestion = {
  id: string;
  question: string;
  options: QuizOption[];
};

// ─── Dimension 1: Flow & friction — does today feel with or against you? ─────

const POOL_Q1: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'Think about your day so far. Does it feel like it has been moving with you — or against you?',
    options: [
      { text: 'With me — things are clicking, I feel in flow', weight: { chaotic_creative: 2, radiant_connector: 2 } },
      { text: 'Steady — no drama, just moving through it', weight: { calm_anchor: 3, quiet_builder: 1 } },
      { text: 'A lot to process — it has given me a lot to think about', weight: { deep_thinker: 3, wild_heart: 1 } },
      { text: 'Against me — friction, resistance, or just off', weight: { wild_heart: 2, chaotic_creative: 1 } },
    ],
  },
  {
    id: 'q1',
    question: 'If today had a weather forecast, what would it be right now?',
    options: [
      { text: 'Sunny — open, bright, easy', weight: { radiant_connector: 2, calm_anchor: 2 } },
      { text: 'Overcast — not bad, just a bit grey and muted', weight: { quiet_builder: 2, calm_anchor: 1 } },
      { text: 'Stormy — intense, electrical, a lot moving', weight: { wild_heart: 3, chaotic_creative: 1 } },
      { text: 'Foggy — unclear, hard to get a read on things', weight: { deep_thinker: 2, wild_heart: 1 } },
    ],
  },
  {
    id: 'q1',
    question: 'How would you describe the pace of today compared to what you wanted?',
    options: [
      { text: 'Faster than ideal — I have been in full sprint mode', weight: { chaotic_creative: 3, wild_heart: 1 } },
      { text: 'Right on pace — it has matched my energy', weight: { quiet_builder: 2, radiant_connector: 1 } },
      { text: 'Slower — a lot of waiting or sitting with things', weight: { deep_thinker: 2, calm_anchor: 1 } },
      { text: 'Uneven — bursts and stops, no real rhythm', weight: { chaotic_creative: 2, wild_heart: 2 } },
    ],
  },
  {
    id: 'q1',
    question: 'If someone asked "how is your day going?" right now, what would be the honest answer?',
    options: [
      { text: 'Really good — I would mean it', weight: { radiant_connector: 3, calm_anchor: 1 } },
      { text: 'Fine, honestly — no complaints', weight: { quiet_builder: 2, calm_anchor: 2 } },
      { text: 'It is a lot — something big is taking up space', weight: { wild_heart: 2, chaotic_creative: 1 } },
      { text: 'Still figuring that out', weight: { deep_thinker: 3 } },
    ],
  },
  {
    id: 'q1',
    question: 'Think back to when you woke up. Has today delivered what the morning seemed to promise?',
    options: [
      { text: 'Yes — it has followed through', weight: { quiet_builder: 2, calm_anchor: 2 } },
      { text: 'Better — it surprised me in a good way', weight: { radiant_connector: 2, chaotic_creative: 2 } },
      { text: 'Not really — it has gone sideways', weight: { wild_heart: 2, deep_thinker: 1 } },
      { text: 'I woke up with no expectations either way', weight: { calm_anchor: 3 } },
    ],
  },
  {
    id: 'q1',
    question: 'What is the dominant texture of today — smooth, rough, or somewhere in between?',
    options: [
      { text: 'Smooth — things are gliding along', weight: { calm_anchor: 3, radiant_connector: 1 } },
      { text: 'Rough — friction and resistance at every turn', weight: { wild_heart: 2, chaotic_creative: 2 } },
      { text: 'Layered — complex underneath a surface calm', weight: { deep_thinker: 3 } },
      { text: 'Unpredictable — switching between both', weight: { chaotic_creative: 2, wild_heart: 1 } },
    ],
  },
  {
    id: 'q1',
    question: 'If today were a road, what kind would it be?',
    options: [
      { text: 'Highway — clear, fast, destination obvious', weight: { quiet_builder: 3, calm_anchor: 1 } },
      { text: 'Winding country road — scenic but taking longer than expected', weight: { deep_thinker: 2, wild_heart: 1 } },
      { text: 'City traffic — stop-and-go, a bit stressful', weight: { wild_heart: 2, chaotic_creative: 1 } },
      { text: 'A trail I am making as I go', weight: { chaotic_creative: 3 } },
    ],
  },
  {
    id: 'q1',
    question: 'On a dial between "everything is fine" and "I am at capacity" — where is today sitting?',
    options: [
      { text: 'Comfortably below capacity', weight: { calm_anchor: 3, quiet_builder: 1 } },
      { text: 'About mid-dial — managing well enough', weight: { quiet_builder: 2, radiant_connector: 1 } },
      { text: 'Nudging toward the top', weight: { wild_heart: 2, chaotic_creative: 1 } },
      { text: 'Pinned near the top', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q1',
    question: 'Has today given you energy or taken it from you — or been neutral?',
    options: [
      { text: 'Given me energy — I feel more alive than this morning', weight: { radiant_connector: 2, chaotic_creative: 2 } },
      { text: 'Taken it — I am running at a deficit now', weight: { wild_heart: 3 } },
      { text: 'Neutral — about even', weight: { calm_anchor: 2, quiet_builder: 2 } },
      { text: 'Given it in some ways, taken it in others', weight: { deep_thinker: 2, wild_heart: 1 } },
    ],
  },
  {
    id: 'q1',
    question: 'What is the most accurate word for the background tone of today?',
    options: [
      { text: 'Alive', weight: { chaotic_creative: 2, radiant_connector: 2 } },
      { text: 'Steady', weight: { calm_anchor: 3, quiet_builder: 1 } },
      { text: 'Tense', weight: { wild_heart: 2, deep_thinker: 1 } },
      { text: 'Quiet', weight: { deep_thinker: 2, calm_anchor: 1 } },
    ],
  },
  {
    id: 'q1',
    question: 'Has today felt mostly predictable, or has it thrown things at you?',
    options: [
      { text: 'Predictable — I have been in control of the script', weight: { quiet_builder: 3, calm_anchor: 1 } },
      { text: 'A few surprises, but I handled them', weight: { calm_anchor: 2, radiant_connector: 1 } },
      { text: 'Unpredictable in interesting ways', weight: { chaotic_creative: 3 } },
      { text: 'Unpredictable in ways that stressed me out', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q1',
    question: 'Think of today like a song. What genre does it feel like so far?',
    options: [
      { text: 'Upbeat pop — energetic and moving forward', weight: { radiant_connector: 2, chaotic_creative: 2 } },
      { text: 'Ambient or lo-fi — calm, background, unhurried', weight: { calm_anchor: 3 } },
      { text: 'Cinematic score — big, emotional, layered', weight: { wild_heart: 3 } },
      { text: 'Jazz — improvised, smart, a little unpredictable', weight: { deep_thinker: 2, chaotic_creative: 1 } },
    ],
  },
  {
    id: 'q1',
    question: 'When you picture today as a colour, what comes to mind?',
    options: [
      { text: 'A warm bright colour — yellow, orange, coral', weight: { radiant_connector: 2, chaotic_creative: 2 } },
      { text: 'A cool clear colour — blue, teal, white', weight: { calm_anchor: 3, deep_thinker: 1 } },
      { text: 'A deep or dark colour — navy, forest, charcoal', weight: { deep_thinker: 2, quiet_builder: 1 } },
      { text: 'Something murky or mixed — hard to name', weight: { wild_heart: 2, deep_thinker: 1 } },
    ],
  },
  {
    id: 'q1',
    question: 'Does today feel like a chapter you are writing, or one that is being written for you?',
    options: [
      { text: 'I am writing it — clear sense of agency', weight: { quiet_builder: 3, radiant_connector: 1 } },
      { text: 'Being written for me — events are driving things', weight: { wild_heart: 2, calm_anchor: 1 } },
      { text: 'Collaborating — a mix of both', weight: { chaotic_creative: 2, deep_thinker: 1 } },
      { text: 'I have not decided which yet', weight: { deep_thinker: 2, wild_heart: 1 } },
    ],
  },
  {
    id: 'q1',
    question: 'If you could close the day right now, would you?',
    options: [
      { text: 'No — I want more of this', weight: { chaotic_creative: 2, radiant_connector: 2 } },
      { text: 'Happy to let it continue naturally', weight: { calm_anchor: 2, quiet_builder: 2 } },
      { text: 'Kind of yes — I could use the reset', weight: { wild_heart: 2, deep_thinker: 1 } },
      { text: 'Definitely — it has been enough', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q1',
    question: 'How does today compare to the day you were hoping for when you planned it?',
    options: [
      { text: 'Better than planned', weight: { radiant_connector: 2, chaotic_creative: 2 } },
      { text: 'About what I expected', weight: { quiet_builder: 2, calm_anchor: 2 } },
      { text: 'Different in ways I am still adjusting to', weight: { deep_thinker: 2, wild_heart: 1 } },
      { text: 'Harder than I was prepared for', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q1',
    question: 'Right now, does the world feel more open or more closed?',
    options: [
      { text: 'Open — spacious, possible, inviting', weight: { radiant_connector: 2, chaotic_creative: 2 } },
      { text: 'Neutral — neither pulling me in nor pushing me out', weight: { calm_anchor: 3 } },
      { text: 'Slightly closed — a bit contracted', weight: { deep_thinker: 2, quiet_builder: 1 } },
      { text: 'Closed — I feel hemmed in or resistant', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q1',
    question: 'Has the majority of today felt purposeful or coincidental?',
    options: [
      { text: 'Purposeful — I knew why I was doing what I was doing', weight: { quiet_builder: 3 } },
      { text: 'Mostly purposeful with some drift', weight: { calm_anchor: 2, radiant_connector: 1 } },
      { text: 'Coincidental — things just happened and I responded', weight: { chaotic_creative: 2, wild_heart: 1 } },
      { text: 'I am questioning the purpose of most of it', weight: { deep_thinker: 3 } },
    ],
  },
];

// ─── Dimension 2: Body & tension — where is the day held physically? ──────────

const POOL_Q2: QuizQuestion[] = [
  {
    id: 'q2',
    question: 'What has your body been doing today? Where is it holding the day?',
    options: [
      { text: 'Chest feels full — a lot of emotion moving through', weight: { wild_heart: 3, radiant_connector: 1 } },
      { text: 'Head is busy — ideas, noise, mental chatter', weight: { chaotic_creative: 2, deep_thinker: 2 } },
      { text: 'Shoulders are up — carrying weight or pressure', weight: { quiet_builder: 2, calm_anchor: 1 } },
      { text: 'Pretty settled — no strong physical tension', weight: { calm_anchor: 3 } },
    ],
  },
  {
    id: 'q2',
    question: 'Right now, where in your body do you feel today the most?',
    options: [
      { text: 'Jaw or neck — tight, held', weight: { quiet_builder: 2, wild_heart: 1 } },
      { text: 'Heart or chest — something warm or heavy there', weight: { wild_heart: 3, radiant_connector: 1 } },
      { text: 'Behind my eyes — mental fatigue', weight: { deep_thinker: 3 } },
      { text: 'Everywhere equally — generally relaxed', weight: { calm_anchor: 3 } },
    ],
  },
  {
    id: 'q2',
    question: 'Does your body feel like it has been carrying extra weight today?',
    options: [
      { text: 'No — I feel light and free in it', weight: { radiant_connector: 2, calm_anchor: 2 } },
      { text: 'A little — something is sitting on my chest', weight: { wild_heart: 2, quiet_builder: 1 } },
      { text: 'Yes — there is real physical tension I am aware of', weight: { wild_heart: 3, chaotic_creative: 1 } },
      { text: 'It is more mental weight than physical', weight: { deep_thinker: 3 } },
    ],
  },
  {
    id: 'q2',
    question: 'Take a breath right now. What happens to your body when you do?',
    options: [
      { text: 'It relaxes — I needed that', weight: { calm_anchor: 3 } },
      { text: 'I notice tightness or restriction releasing', weight: { wild_heart: 2, quiet_builder: 1 } },
      { text: 'Not much — I am pretty settled already', weight: { calm_anchor: 2, quiet_builder: 2 } },
      { text: 'My mind kept going — hard to be in my body', weight: { deep_thinker: 3, chaotic_creative: 1 } },
    ],
  },
  {
    id: 'q2',
    question: 'What is the loudest physical signal your body is giving you right now?',
    options: [
      { text: 'Restlessness — I need to move', weight: { chaotic_creative: 3, wild_heart: 1 } },
      { text: 'Tiredness — a deep need to slow down', weight: { wild_heart: 2, calm_anchor: 1 } },
      { text: 'Focus and stillness — tuned in and present', weight: { quiet_builder: 3 } },
      { text: 'My body is mostly quiet — no major signal', weight: { calm_anchor: 3 } },
    ],
  },
  {
    id: 'q2',
    question: 'If you put a hand on your chest right now, what would you feel?',
    options: [
      { text: 'A steady, even rhythm — calm and grounded', weight: { calm_anchor: 3 } },
      { text: 'Something faster — elevated, alert, activated', weight: { chaotic_creative: 2, wild_heart: 1 } },
      { text: 'A heaviness or fullness — emotion sitting there', weight: { wild_heart: 3 } },
      { text: 'Warmth or openness — connected and alive', weight: { radiant_connector: 3 } },
    ],
  },
  {
    id: 'q2',
    question: 'Has your body been cooperating with you today, or resisting you?',
    options: [
      { text: 'Cooperating completely — I feel good in it', weight: { radiant_connector: 2, quiet_builder: 2 } },
      { text: 'Mostly cooperating with small signs of strain', weight: { calm_anchor: 2, quiet_builder: 1 } },
      { text: 'Resisting a little — pulling toward rest', weight: { wild_heart: 2, calm_anchor: 1 } },
      { text: 'Resisting clearly — pain, fatigue, or tension present', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q2',
    question: 'Where is the tension in your body right now — if any?',
    options: [
      { text: 'Upper body — neck, shoulders, chest', weight: { wild_heart: 2, quiet_builder: 1 } },
      { text: 'Head — thoughts, pressure, mental fatigue', weight: { deep_thinker: 3 } },
      { text: 'No real tension — I feel physically at ease', weight: { calm_anchor: 3 } },
      { text: 'Low body — gut, legs, restlessness', weight: { chaotic_creative: 2, wild_heart: 1 } },
    ],
  },
  {
    id: 'q2',
    question: 'On a scale from "my body feels like a heavy sack" to "I feel completely alive in it" — where are you?',
    options: [
      { text: 'Completely alive — present, light, energized', weight: { chaotic_creative: 2, radiant_connector: 2 } },
      { text: 'Pretty comfortable — not remarkable either way', weight: { calm_anchor: 2, quiet_builder: 2 } },
      { text: 'A bit heavy — running below optimal', weight: { wild_heart: 2, deep_thinker: 1 } },
      { text: 'Quite heavy — fatigue or tension is significant', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q2',
    question: 'Think about your posture right now. What is it telling you?',
    options: [
      { text: 'Open and upright — I am engaged with the world', weight: { radiant_connector: 2, quiet_builder: 2 } },
      { text: 'A bit hunched or inward — protecting something', weight: { wild_heart: 2, deep_thinker: 2 } },
      { text: 'Comfortable and relaxed — nothing to defend', weight: { calm_anchor: 3 } },
      { text: 'Alert and forward — locked in on something', weight: { chaotic_creative: 2, quiet_builder: 1 } },
    ],
  },
  {
    id: 'q2',
    question: 'If your body could send you one message about today, what would it say?',
    options: [
      { text: '"Keep going — you have more in the tank"', weight: { chaotic_creative: 2, radiant_connector: 2 } },
      { text: '"Slow down and breathe"', weight: { calm_anchor: 3 } },
      { text: '"Something needs to be processed here"', weight: { wild_heart: 3 } },
      { text: '"Stay focused — you are almost there"', weight: { quiet_builder: 3 } },
    ],
  },
  {
    id: 'q2',
    question: 'What does the skin on your face feel like right now?',
    options: [
      { text: 'Relaxed — no tension I can feel', weight: { calm_anchor: 3, radiant_connector: 1 } },
      { text: 'Furrowed — I have been thinking hard or worried', weight: { deep_thinker: 2, wild_heart: 1 } },
      { text: 'Lit up — I have been smiling or animated', weight: { chaotic_creative: 2, radiant_connector: 2 } },
      { text: 'Neutral — I have been managing how I present', weight: { quiet_builder: 2, deep_thinker: 1 } },
    ],
  },
  {
    id: 'q2',
    question: 'Does your gut feel settled or unsettled right now?',
    options: [
      { text: 'Settled — no underlying unease', weight: { calm_anchor: 3, quiet_builder: 1 } },
      { text: 'Mildly unsettled — something has been nagging', weight: { deep_thinker: 2, wild_heart: 1 } },
      { text: 'Clearly unsettled — anxiety or stress is present', weight: { wild_heart: 3 } },
      { text: 'Buzzing with energy — in a good way', weight: { chaotic_creative: 2, radiant_connector: 1 } },
    ],
  },
  {
    id: 'q2',
    question: 'Is your body asking you to sit still or to move right now?',
    options: [
      { text: 'Sit still — I need quiet and restoration', weight: { calm_anchor: 2, deep_thinker: 2 } },
      { text: 'Move — there is restless energy that needs release', weight: { chaotic_creative: 3, wild_heart: 1 } },
      { text: 'Already feels good — neither push is strong', weight: { quiet_builder: 2, calm_anchor: 1 } },
      { text: 'Move, but slowly — a gentle pace not a sprint', weight: { calm_anchor: 2, wild_heart: 1 } },
    ],
  },
  {
    id: 'q2',
    question: 'Are there knots in your body from today — physical signs of stress or emotion?',
    options: [
      { text: 'None that I am aware of', weight: { calm_anchor: 3 } },
      { text: 'A few small ones — background hum of tension', weight: { quiet_builder: 2, deep_thinker: 1 } },
      { text: 'Yes, clear and specific', weight: { wild_heart: 3 } },
      { text: 'It is more like buzzing than knots — activated energy', weight: { chaotic_creative: 3 } },
    ],
  },
  {
    id: 'q2',
    question: 'How much have you been breathing today — really breathing, not just surviving?',
    options: [
      { text: 'I have been breathing well — calm and regulated', weight: { calm_anchor: 3 } },
      { text: 'Mostly fine with moments of shallow breath', weight: { quiet_builder: 2, deep_thinker: 1 } },
      { text: 'I catch myself holding my breath sometimes', weight: { wild_heart: 2, chaotic_creative: 1 } },
      { text: 'I have barely noticed my breath — fully in my head', weight: { deep_thinker: 3 } },
    ],
  },
  {
    id: 'q2',
    question: 'How much space does your body feel like it needs right now?',
    options: [
      { text: 'Plenty — I feel open and expansive', weight: { chaotic_creative: 2, radiant_connector: 2 } },
      { text: 'Just enough — comfortable where I am', weight: { calm_anchor: 3 } },
      { text: 'A little more — slightly compressed or crowded', weight: { deep_thinker: 2, wild_heart: 1 } },
      { text: 'A lot more — I feel hemmed in or contracted', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q2',
    question: 'Where in your body has today\'s biggest emotion been living?',
    options: [
      { text: 'In my chest — a warmth, ache, or fullness', weight: { wild_heart: 3, radiant_connector: 1 } },
      { text: 'In my head — thoughts carrying the emotional weight', weight: { deep_thinker: 3 } },
      { text: 'Everywhere and nowhere — diffused and hard to locate', weight: { calm_anchor: 2, chaotic_creative: 1 } },
      { text: 'I have not noticed it in my body — mostly mental', weight: { quiet_builder: 2, deep_thinker: 1 } },
    ],
  },
];

// ─── Dimension 3: Energy vs baseline — how much has today cost? ───────────────

const POOL_Q3: QuizQuestion[] = [
  {
    id: 'q3',
    question: 'Compared to a typical day, how much energy has today asked of you?',
    options: [
      { text: 'More than usual — I have been switched on', weight: { chaotic_creative: 3, radiant_connector: 1 } },
      { text: 'About average — a normal burn rate', weight: { quiet_builder: 2, calm_anchor: 2 } },
      { text: 'Mostly mental — quiet but intensely focused', weight: { deep_thinker: 3 } },
      { text: 'Draining — I have been running on less than I had', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q3',
    question: 'If you started today with a full battery, what percentage are you at now?',
    options: [
      { text: 'Still high — 75% or more', weight: { radiant_connector: 2, quiet_builder: 2 } },
      { text: 'Mid-range — 40 to 75%', weight: { calm_anchor: 2, chaotic_creative: 1 } },
      { text: 'Getting low — 20 to 40%', weight: { wild_heart: 2, deep_thinker: 1 } },
      { text: 'Nearly empty — under 20%', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q3',
    question: 'Have you been energizing or depleting others around you today?',
    options: [
      { text: 'Energizing — I have brought something positive to the room', weight: { radiant_connector: 3, chaotic_creative: 1 } },
      { text: 'Neutral — mostly minding my own', weight: { quiet_builder: 2, deep_thinker: 2 } },
      { text: 'Probably depleting — I have had less to give', weight: { wild_heart: 2, calm_anchor: 1 } },
      { text: 'Both — depending on the moment', weight: { chaotic_creative: 2, wild_heart: 1 } },
    ],
  },
  {
    id: 'q3',
    question: 'Think about the difference between how you felt at 9am versus right now. What has changed?',
    options: [
      { text: 'More energized now — the day picked up', weight: { chaotic_creative: 2, radiant_connector: 2 } },
      { text: 'About the same — consistent through the day', weight: { quiet_builder: 3, calm_anchor: 1 } },
      { text: 'More settled but less sharp', weight: { calm_anchor: 2, deep_thinker: 1 } },
      { text: 'More tired or heavier', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q3',
    question: 'What kind of tired, if any, are you feeling right now?',
    options: [
      { text: 'Not tired — I have more to give', weight: { chaotic_creative: 2, radiant_connector: 2 } },
      { text: 'A pleasant tiredness — like I earned it', weight: { quiet_builder: 3 } },
      { text: 'Emotionally tired — drained by feeling or thinking', weight: { wild_heart: 2, deep_thinker: 2 } },
      { text: 'Physically tired — body wants to stop', weight: { calm_anchor: 2 } },
    ],
  },
  {
    id: 'q3',
    question: 'If you had one more big task right now, could you do it?',
    options: [
      { text: 'Yes, easily — I still have drive and focus', weight: { quiet_builder: 3, chaotic_creative: 1 } },
      { text: 'Yes, but it would cost me something', weight: { calm_anchor: 2, radiant_connector: 1 } },
      { text: 'I could push but would regret it', weight: { wild_heart: 2, deep_thinker: 1 } },
      { text: 'No — I am genuinely done for today', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q3',
    question: 'How has your motivation arc looked today — climbing, declining, or flat?',
    options: [
      { text: 'Climbing — I have built momentum through the day', weight: { quiet_builder: 3, chaotic_creative: 1 } },
      { text: 'Flat — steady and consistent', weight: { calm_anchor: 3 } },
      { text: 'Peaked early and declined', weight: { chaotic_creative: 2, deep_thinker: 1 } },
      { text: 'Spiky — high bursts and crashes', weight: { wild_heart: 2, chaotic_creative: 2 } },
    ],
  },
  {
    id: 'q3',
    question: 'Have you been in your head today or in the world?',
    options: [
      { text: 'Fully in the world — present and outward-facing', weight: { radiant_connector: 3 } },
      { text: 'Mostly in my head — processing, thinking, planning', weight: { deep_thinker: 3 } },
      { text: 'Switching between both', weight: { chaotic_creative: 2, quiet_builder: 1 } },
      { text: 'Trying to be present but mind keeps wandering', weight: { wild_heart: 2, deep_thinker: 1 } },
    ],
  },
  {
    id: 'q3',
    question: 'How would you describe today\'s cost-to-output ratio?',
    options: [
      { text: 'High output, manageable cost — efficient day', weight: { quiet_builder: 3 } },
      { text: 'High output, high cost — pushed hard both ways', weight: { chaotic_creative: 2, wild_heart: 1 } },
      { text: 'Low output, low cost — a recovery day', weight: { calm_anchor: 3 } },
      { text: 'High cost, unclear output — spent more than gained', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q3',
    question: 'Would you say today has been more invigorating or more exhausting?',
    options: [
      { text: 'Invigorating — I feel charged from it', weight: { radiant_connector: 2, chaotic_creative: 2 } },
      { text: 'Exhausting — it has taken from me', weight: { wild_heart: 3 } },
      { text: 'Even — not particularly either', weight: { calm_anchor: 2, quiet_builder: 2 } },
      { text: 'Invigorating intellectually, exhausting emotionally', weight: { deep_thinker: 2, wild_heart: 1 } },
    ],
  },
  {
    id: 'q3',
    question: 'Does your brain feel sharp or foggy right now?',
    options: [
      { text: 'Sharp — I am thinking clearly and fast', weight: { quiet_builder: 2, deep_thinker: 2 } },
      { text: 'Sharp in bursts, foggy in others', weight: { chaotic_creative: 3 } },
      { text: 'Pleasantly soft — not sharp but not foggy', weight: { calm_anchor: 3 } },
      { text: 'Genuinely foggy — hard to focus', weight: { wild_heart: 2, deep_thinker: 1 } },
    ],
  },
  {
    id: 'q3',
    question: 'What kind of fuel has been running you today — excitement, duty, habit, or something else?',
    options: [
      { text: 'Excitement — genuine enthusiasm for what I was doing', weight: { chaotic_creative: 2, radiant_connector: 2 } },
      { text: 'Duty — doing what needed to be done', weight: { quiet_builder: 3 } },
      { text: 'Habit — autopilot through familiar territory', weight: { calm_anchor: 2, quiet_builder: 1 } },
      { text: 'Emotional fuel — intensity driving me', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q3',
    question: 'Has today required you to be "on" for other people more or less than usual?',
    options: [
      { text: 'Much more — I have been performing, presenting, or supporting', weight: { radiant_connector: 2, wild_heart: 1 } },
      { text: 'About the same as usual', weight: { calm_anchor: 2, quiet_builder: 1 } },
      { text: 'Less — I have had more solo time today', weight: { deep_thinker: 2, quiet_builder: 2 } },
      { text: 'I have been hiding from being "on" when I usually am', weight: { wild_heart: 2, deep_thinker: 1 } },
    ],
  },
  {
    id: 'q3',
    question: 'How has your attention span been today?',
    options: [
      { text: 'Locked in — I could focus for long stretches', weight: { quiet_builder: 3 } },
      { text: 'Fragmented — lots of micro-switching between things', weight: { chaotic_creative: 3 } },
      { text: 'Deep but narrow — one thing consumed me', weight: { deep_thinker: 3 } },
      { text: 'Scattered and hard to manage', weight: { wild_heart: 2, chaotic_creative: 1 } },
    ],
  },
  {
    id: 'q3',
    question: 'Would today feel like a recovery day or a momentum day?',
    options: [
      { text: 'Momentum — I built something or pushed forward', weight: { quiet_builder: 3, chaotic_creative: 1 } },
      { text: 'Recovery — I needed to restore, not build', weight: { calm_anchor: 2, wild_heart: 1 } },
      { text: 'Both — some building, some healing', weight: { deep_thinker: 2, radiant_connector: 1 } },
      { text: 'Neither — I treaded water today', weight: { wild_heart: 2 } },
    ],
  },
  {
    id: 'q3',
    question: 'How much of your energy today was voluntary versus forced?',
    options: [
      { text: 'Mostly voluntary — I chose my effort level', weight: { quiet_builder: 3, chaotic_creative: 1 } },
      { text: 'A mix — some chosen, some demanded', weight: { calm_anchor: 2, radiant_connector: 1 } },
      { text: 'Mostly forced — circumstances drove me', weight: { wild_heart: 2, deep_thinker: 1 } },
      { text: 'Largely reactive — I had no real agency over it', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q3',
    question: 'What would you most want to do with the next 30 minutes if you had them completely free?',
    options: [
      { text: 'Create or work on something I care about', weight: { chaotic_creative: 3, quiet_builder: 1 } },
      { text: 'Be around people — talk, laugh, connect', weight: { radiant_connector: 3 } },
      { text: 'Think or write — process what has happened today', weight: { deep_thinker: 3 } },
      { text: 'Do absolutely nothing — stare at the ceiling', weight: { wild_heart: 2, calm_anchor: 2 } },
    ],
  },
];

// ─── Dimension 4: Attention & focus — what has had your attention? ────────────

const POOL_Q4: QuizQuestion[] = [
  {
    id: 'q4',
    question: 'Who or what has had most of your attention today?',
    options: [
      { text: 'Other people — I have been tuned into everyone around me', weight: { radiant_connector: 3, chaotic_creative: 1 } },
      { text: 'My own inner world — thoughts, feelings, or memories', weight: { deep_thinker: 2, wild_heart: 2 } },
      { text: 'A task or goal — I have been locked in on getting something done', weight: { quiet_builder: 3 } },
      { text: 'Everything a little — my focus has been scattered', weight: { calm_anchor: 2, chaotic_creative: 1 } },
    ],
  },
  {
    id: 'q4',
    question: 'What has been pulling your thoughts most today — past, present, or future?',
    options: [
      { text: 'Future — planning, anticipating, imagining ahead', weight: { chaotic_creative: 2, quiet_builder: 2 } },
      { text: 'Present — fully in what is happening right now', weight: { radiant_connector: 2, calm_anchor: 2 } },
      { text: 'Past — replaying, processing, remembering', weight: { deep_thinker: 2, wild_heart: 2 } },
      { text: 'Jumping between all three', weight: { chaotic_creative: 2, deep_thinker: 1 } },
    ],
  },
  {
    id: 'q4',
    question: 'If you had to name the one thing that has had your attention today, what category would it fall in?',
    options: [
      { text: 'A person or relationship', weight: { radiant_connector: 3, wild_heart: 1 } },
      { text: 'A problem I am trying to solve', weight: { deep_thinker: 2, quiet_builder: 2 } },
      { text: 'A creative idea or project', weight: { chaotic_creative: 3 } },
      { text: 'Myself — my own state, needs, or wellbeing', weight: { wild_heart: 2, deep_thinker: 1 } },
    ],
  },
  {
    id: 'q4',
    question: 'Where has your curiosity been pointing today?',
    options: [
      { text: 'Outward — toward people, events, the world', weight: { radiant_connector: 3 } },
      { text: 'Inward — toward my own motives, feelings, patterns', weight: { deep_thinker: 3 } },
      { text: 'Toward a specific thing I want to understand or build', weight: { quiet_builder: 2, chaotic_creative: 2 } },
      { text: 'My curiosity has been quiet today', weight: { calm_anchor: 3 } },
    ],
  },
  {
    id: 'q4',
    question: 'Have you been more a listener or a talker today?',
    options: [
      { text: 'Listener — taking in more than I am putting out', weight: { calm_anchor: 2, deep_thinker: 2 } },
      { text: 'Talker — I have had a lot to express or share', weight: { radiant_connector: 3, chaotic_creative: 1 } },
      { text: 'Balanced — a good dialogue energy', weight: { radiant_connector: 2, calm_anchor: 1 } },
      { text: 'Neither — mostly in my own head today', weight: { deep_thinker: 2, wild_heart: 1 } },
    ],
  },
  {
    id: 'q4',
    question: 'Have you been producing today or processing today?',
    options: [
      { text: 'Producing — making, doing, outputting things', weight: { quiet_builder: 3, chaotic_creative: 1 } },
      { text: 'Processing — sitting with, making sense of, digesting', weight: { deep_thinker: 3 } },
      { text: 'A mixture of both', weight: { calm_anchor: 2, radiant_connector: 1 } },
      { text: 'Honestly, neither — a bit lost today', weight: { wild_heart: 2 } },
    ],
  },
  {
    id: 'q4',
    question: 'What has your inner critic been up to today?',
    options: [
      { text: 'Quiet — I have not been bothered by self-judgment', weight: { calm_anchor: 3 } },
      { text: 'Mildly present — a few critical thoughts but manageable', weight: { quiet_builder: 2, deep_thinker: 1 } },
      { text: 'Quite active — comparing, critiquing, questioning myself', weight: { deep_thinker: 2, wild_heart: 2 } },
      { text: 'I redirected it into fuel for creativity or work', weight: { chaotic_creative: 2, quiet_builder: 1 } },
    ],
  },
  {
    id: 'q4',
    question: 'Which best describes what your mind has been doing most today?',
    options: [
      { text: 'Problem-solving — working things out methodically', weight: { quiet_builder: 2, deep_thinker: 2 } },
      { text: 'People-reading — thinking about others and dynamics', weight: { radiant_connector: 3 } },
      { text: 'Daydreaming or free-associating — ideas loosely connected', weight: { chaotic_creative: 3 } },
      { text: 'Self-monitoring — checking in with how I am doing', weight: { wild_heart: 2, deep_thinker: 1 } },
    ],
  },
  {
    id: 'q4',
    question: 'Have you been more aware of your external environment or your internal one today?',
    options: [
      { text: 'External — noticing sounds, people, atmosphere, the room', weight: { radiant_connector: 2, chaotic_creative: 2 } },
      { text: 'Internal — noticing my thoughts, moods, sensations', weight: { deep_thinker: 2, wild_heart: 2 } },
      { text: 'About equally both', weight: { calm_anchor: 3 } },
      { text: 'I have been trying to ignore both', weight: { quiet_builder: 2 } },
    ],
  },
  {
    id: 'q4',
    question: 'If someone watched you today, where would they have seen your focus most?',
    options: [
      { text: 'On other people — talking, listening, being with them', weight: { radiant_connector: 3 } },
      { text: 'On work or a specific task', weight: { quiet_builder: 3 } },
      { text: 'In my own inner world — reading, thinking, being still', weight: { deep_thinker: 2, wild_heart: 1 } },
      { text: 'Scattered across multiple things at once', weight: { chaotic_creative: 2, wild_heart: 1 } },
    ],
  },
  {
    id: 'q4',
    question: 'What kind of thinking has dominated today — convergent or divergent?',
    options: [
      { text: 'Convergent — focused, narrowing in, decisions and conclusions', weight: { quiet_builder: 3 } },
      { text: 'Divergent — expanding, generating, exploring possibilities', weight: { chaotic_creative: 3 } },
      { text: 'Emotional thinking — feeling my way through', weight: { wild_heart: 3 } },
      { text: 'Reflective — re-examining and turning things over', weight: { deep_thinker: 3 } },
    ],
  },
  {
    id: 'q4',
    question: 'What has felt most alive in you today — your head, heart, or hands?',
    options: [
      { text: 'Head — thinking, analysis, ideas', weight: { deep_thinker: 2, chaotic_creative: 2 } },
      { text: 'Heart — emotion, connection, feeling things deeply', weight: { wild_heart: 3, radiant_connector: 1 } },
      { text: 'Hands — doing, making, building, executing', weight: { quiet_builder: 3 } },
      { text: 'All three in roughly equal measure', weight: { calm_anchor: 2, radiant_connector: 1 } },
    ],
  },
  {
    id: 'q4',
    question: 'Has today been about input — taking things in — or output — sending things out?',
    options: [
      { text: 'Input — learning, listening, absorbing', weight: { deep_thinker: 2, calm_anchor: 2 } },
      { text: 'Output — sharing, creating, doing', weight: { chaotic_creative: 2, quiet_builder: 2 } },
      { text: 'Heavy on output to the point of depletion', weight: { radiant_connector: 2, wild_heart: 1 } },
      { text: 'Balanced or neither', weight: { calm_anchor: 2 } },
    ],
  },
  {
    id: 'q4',
    question: 'What moment today would you most want to replay?',
    options: [
      { text: 'A genuine connection with another person', weight: { radiant_connector: 3 } },
      { text: 'A moment of pure focus and flow in something I was building', weight: { quiet_builder: 3 } },
      { text: 'An idea clicking into place — that a-ha moment', weight: { deep_thinker: 2, chaotic_creative: 2 } },
      { text: 'A moment of peace or stillness I found', weight: { calm_anchor: 3 } },
    ],
  },
  {
    id: 'q4',
    question: 'What noise has been loudest in your mind today?',
    options: [
      { text: 'Urgency — I need to do this now', weight: { chaotic_creative: 2, quiet_builder: 1 } },
      { text: 'Questions — I am trying to figure something out', weight: { deep_thinker: 3 } },
      { text: 'Concern — I am worried about someone or something', weight: { wild_heart: 2, radiant_connector: 2 } },
      { text: 'Relative quiet — my mind has been clear', weight: { calm_anchor: 3 } },
    ],
  },
  {
    id: 'q4',
    question: 'If you could have spent today doing one different thing, what would it have been?',
    options: [
      { text: 'Creating — writing, building, making art', weight: { chaotic_creative: 3 } },
      { text: 'Being with the people I care about most', weight: { radiant_connector: 3 } },
      { text: 'Thinking or learning without interruption', weight: { deep_thinker: 3 } },
      { text: 'Nothing — today was close to what I wanted', weight: { calm_anchor: 2, quiet_builder: 2 } },
    ],
  },
  {
    id: 'q4',
    question: 'Which kind of conversation have you been craving today?',
    options: [
      { text: 'A deep one — something real below the surface', weight: { deep_thinker: 3, wild_heart: 1 } },
      { text: 'A fun, light one — laughter and warmth', weight: { radiant_connector: 3 } },
      { text: 'A useful one — solving something together', weight: { quiet_builder: 2, chaotic_creative: 1 } },
      { text: 'No conversation — I have wanted quiet', weight: { calm_anchor: 2, deep_thinker: 2 } },
    ],
  },
];

// ─── Dimension 5: Emotional resolution — how does today sit looking back? ─────

const POOL_Q5: QuizQuestion[] = [
  {
    id: 'q5',
    question: 'When you look back at today honestly — how does it sit with you?',
    options: [
      { text: 'Good — it has felt light, open, or genuinely positive', weight: { radiant_connector: 2, calm_anchor: 2 } },
      { text: 'Fine — nothing remarkable, and that is okay', weight: { quiet_builder: 3 } },
      { text: 'Complicated — a mix I am still working through', weight: { deep_thinker: 2, chaotic_creative: 1 } },
      { text: 'Heavy — I am sitting with something that is not easy', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q5',
    question: 'If today were a sentence, what punctuation would it end with?',
    options: [
      { text: 'An exclamation mark — intense, alive, something happened', weight: { chaotic_creative: 2, radiant_connector: 2 } },
      { text: 'A period — a complete, contained day', weight: { quiet_builder: 3, calm_anchor: 1 } },
      { text: 'An ellipsis — unfinished, something trailing', weight: { deep_thinker: 2, wild_heart: 2 } },
      { text: 'A question mark — today raised more than it answered', weight: { deep_thinker: 3 } },
    ],
  },
  {
    id: 'q5',
    question: 'What feeling would you like to take from today into tomorrow?',
    options: [
      { text: 'Momentum — the feeling of forward motion', weight: { quiet_builder: 3, chaotic_creative: 1 } },
      { text: 'Connection — the warmth of being genuinely seen', weight: { radiant_connector: 3 } },
      { text: 'Calm — the feeling of having been still and present', weight: { calm_anchor: 3 } },
      { text: 'Depth — the feeling of having really felt something', weight: { wild_heart: 2, deep_thinker: 2 } },
    ],
  },
  {
    id: 'q5',
    question: 'Is there something today you wish had gone differently?',
    options: [
      { text: 'Not really — I made peace with how it went', weight: { calm_anchor: 3 } },
      { text: 'A small thing, but nothing major', weight: { quiet_builder: 2, radiant_connector: 1 } },
      { text: 'Yes — something specific is sitting with me', weight: { deep_thinker: 2, wild_heart: 2 } },
      { text: 'A lot — I am carrying real disappointment or frustration', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q5',
    question: 'How resolved do you feel about today right now?',
    options: [
      { text: 'Fully resolved — it feels complete', weight: { calm_anchor: 3, quiet_builder: 1 } },
      { text: 'Mostly resolved — a few loose threads', weight: { quiet_builder: 2, radiant_connector: 1 } },
      { text: 'Partially — something is still open or unfinished', weight: { deep_thinker: 2, chaotic_creative: 1 } },
      { text: 'Unresolved — there is a lot still moving through me', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q5',
    question: 'What emotion, if any, do you feel you have not fully expressed or processed today?',
    options: [
      { text: 'Nothing — I feel current with myself', weight: { calm_anchor: 3 } },
      { text: 'Pride or satisfaction I have not let myself feel yet', weight: { quiet_builder: 2, radiant_connector: 1 } },
      { text: 'Frustration or irritation — something got under my skin', weight: { chaotic_creative: 2, wild_heart: 1 } },
      { text: 'Something deeper — sadness, longing, grief, or joy', weight: { wild_heart: 3, deep_thinker: 1 } },
    ],
  },
  {
    id: 'q5',
    question: 'Has today added to your sense of meaning — or subtracted from it?',
    options: [
      { text: 'Added — I feel like today mattered', weight: { radiant_connector: 2, quiet_builder: 2 } },
      { text: 'Neutral — it was functional, not particularly meaningful', weight: { calm_anchor: 2, quiet_builder: 1 } },
      { text: 'I am not sure — I am still making sense of it', weight: { deep_thinker: 3 } },
      { text: 'Subtracted — something felt empty or pointless', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q5',
    question: 'If you could give today a review out of five stars, what would you give it?',
    options: [
      { text: '5 stars — it delivered something real', weight: { radiant_connector: 2, chaotic_creative: 2 } },
      { text: '3 to 4 stars — solid, not spectacular', weight: { quiet_builder: 2, calm_anchor: 2 } },
      { text: '2 to 3 stars — some good, some frustrating', weight: { deep_thinker: 2, wild_heart: 1 } },
      { text: '1 to 2 stars — it was genuinely hard', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q5',
    question: 'Is today the kind of day you would want to talk about with someone, or keep private?',
    options: [
      { text: 'Talk about — I want to share how it felt', weight: { radiant_connector: 3, wild_heart: 1 } },
      { text: 'Keep private — it is mine to sit with', weight: { deep_thinker: 3 } },
      { text: 'It was ordinary enough it does not need either', weight: { quiet_builder: 2, calm_anchor: 2 } },
      { text: 'I do not know yet — still processing', weight: { deep_thinker: 2, wild_heart: 1 } },
    ],
  },
  {
    id: 'q5',
    question: 'What has today taught you, even if you do not have words for it yet?',
    options: [
      { text: 'Something about what I am capable of', weight: { quiet_builder: 3, chaotic_creative: 1 } },
      { text: 'Something about how I relate to or affect other people', weight: { radiant_connector: 3 } },
      { text: 'Something about a feeling I need to pay attention to', weight: { wild_heart: 3 } },
      { text: 'A question that does not have an answer yet', weight: { deep_thinker: 3 } },
    ],
  },
  {
    id: 'q5',
    question: 'What is the last emotion to pass through you before sleep tonight will feel like?',
    options: [
      { text: 'Contentment — a quiet, settled kind of good', weight: { calm_anchor: 3 } },
      { text: 'Satisfaction — I got something done or gave something real', weight: { quiet_builder: 2, radiant_connector: 1 } },
      { text: 'Relief — glad this day is ending', weight: { wild_heart: 2, deep_thinker: 1 } },
      { text: 'Aliveness — still buzzing, mind still going', weight: { chaotic_creative: 3 } },
    ],
  },
  {
    id: 'q5',
    question: 'Did today make you feel more or less like yourself?',
    options: [
      { text: 'More — I was fully myself today', weight: { radiant_connector: 2, quiet_builder: 2 } },
      { text: 'About the same — consistent sense of self', weight: { calm_anchor: 3 } },
      { text: 'Less — I was performing or managing how I appeared', weight: { deep_thinker: 2, wild_heart: 1 } },
      { text: 'I am not sure — the question itself feels interesting', weight: { deep_thinker: 3 } },
    ],
  },
  {
    id: 'q5',
    question: 'Has today confirmed something you believed about yourself or challenged it?',
    options: [
      { text: 'Confirmed — I showed up as who I think I am', weight: { quiet_builder: 2, calm_anchor: 2 } },
      { text: 'Challenged — something surprised me about how I responded', weight: { deep_thinker: 2, wild_heart: 2 } },
      { text: 'Revealed something new — I learned something unexpected', weight: { chaotic_creative: 2, deep_thinker: 2 } },
      { text: 'Neither — it was too ordinary to test anything', weight: { calm_anchor: 2 } },
    ],
  },
  {
    id: 'q5',
    question: 'If you had to summarize today in one gesture, what would it be?',
    options: [
      { text: 'A fist pump — yes, I did something today', weight: { quiet_builder: 3, chaotic_creative: 1 } },
      { text: 'An open hand — generous, available, present for others', weight: { radiant_connector: 3 } },
      { text: 'A hand on the heart — something tender was here', weight: { wild_heart: 3 } },
      { text: 'A slow exhale — it is okay to let today go now', weight: { calm_anchor: 3 } },
    ],
  },
  {
    id: 'q5',
    question: 'Does today leave a mark you will remember, or will it blur into the background?',
    options: [
      { text: 'Memorable — something specific will stick', weight: { radiant_connector: 2, wild_heart: 2 } },
      { text: 'Probably blur — but blurring is fine, it was still good', weight: { quiet_builder: 2, calm_anchor: 2 } },
      { text: 'It will blur but should not — I want to remember this', weight: { deep_thinker: 2, chaotic_creative: 1 } },
      { text: 'I hope it blurs — it was not a day I want to carry', weight: { wild_heart: 3 } },
    ],
  },
  {
    id: 'q5',
    question: 'What is the single most honest thing you could say about today?',
    options: [
      { text: 'It was a good day — genuinely', weight: { radiant_connector: 2, calm_anchor: 2 } },
      { text: 'I got through it, and that is enough', weight: { quiet_builder: 2, calm_anchor: 1 } },
      { text: 'Something happened that I am still carrying', weight: { wild_heart: 3 } },
      { text: 'I am not done making sense of it yet', weight: { deep_thinker: 3 } },
    ],
  },
  {
    id: 'q5',
    question: 'Looking back at today, are you proud of how you showed up?',
    options: [
      { text: 'Yes — I showed up well', weight: { quiet_builder: 2, radiant_connector: 2 } },
      { text: 'Mostly — with a few moments I would do differently', weight: { calm_anchor: 2, deep_thinker: 1 } },
      { text: 'I am harder on myself than that question allows for', weight: { deep_thinker: 2, wild_heart: 1 } },
      { text: 'I did not have a lot of choice in how I showed up today', weight: { wild_heart: 3 } },
    ],
  },
];

/**
 * Returns a freshly randomized set of 5 quiz questions — one from each
 * dimensional pool — so every quiz session feels unique and unrepeatable.
 *
 * With 18 × 18 × 17 × 17 × 17 = 177,606 possible combinations,
 * users are very unlikely to see the same quiz twice.
 */
export function getRandomQuizQuestions(): QuizQuestion[] {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  return [
    pick(POOL_Q1),
    pick(POOL_Q2),
    pick(POOL_Q3),
    pick(POOL_Q4),
    pick(POOL_Q5),
  ];
}

// Legacy static export kept for any backward-compat references
export const QUIZ_QUESTIONS = [
  POOL_Q1[0],
  POOL_Q2[0],
  POOL_Q3[0],
  POOL_Q4[0],
  POOL_Q5[0],
];

export const MOODS = [
  { id: 'joyful', label: 'Joyful', emoji: '😄', color: '#FFD166' },
  { id: 'calm', label: 'Calm', emoji: '😌', color: '#4ECDC4' },
  { id: 'excited', label: 'Excited', emoji: '🤩', color: '#F5A623' },
  { id: 'grateful', label: 'Grateful', emoji: '🙏', color: '#95E06C' },
  { id: 'melancholy', label: 'Melancholy', emoji: '🌧️', color: '#5B6FFF' },
  { id: 'anxious', label: 'Anxious', emoji: '😰', color: '#FF6B6B' },
  { id: 'frustrated', label: 'Frustrated', emoji: '😤', color: '#FF8C42' },
  { id: 'neutral', label: 'Neutral', emoji: '😐', color: '#8A8EBF' },
];
