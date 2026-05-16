/**
 * populate-demo-data
 * Auto-inserts today's realistic demo data for testaccount@mymoodmapp.com
 * so the demo account always has fresh data without manual logging.
 *
 * Called on app load when the demo user is signed in (throttled to once/day).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const DEMO_EMAIL = 'testaccount@mymoodmapp.com';
const DEMO_UID   = '33a3eb06-8f14-4d62-af1f-da8182dc793e';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── Verify the caller is the demo user ────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user || user.email?.toLowerCase() !== DEMO_EMAIL) {
        return new Response(JSON.stringify({ skipped: true, reason: 'not demo user' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const dow     = today.getDay(); // 0=Sun, 1=Mon, …, 6=Sat

    // ── Check if today already has data ───────────────────────────────────
    const { data: existing } = await supabase
      .from('mood_entries')
      .select('id')
      .eq('user_id', DEMO_UID)
      .eq('date', dateStr)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'already populated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ── Generate realistic scores with day-of-week patterns ───────────────
    const dowBonus   = [5, -6, 2, 3, 4, 8, 10][dow] ?? 0;
    const rand       = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const clamp      = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    const baseScore  = clamp(58 + dowBonus + rand(-10, 10), 35, 92);

    // Morning entry
    const mScore  = clamp(baseScore - 5 + rand(-5, 5), 28, 90);
    const mBody   = clamp(mScore + rand(-8, 8), 25, 95);
    const mMind   = clamp(mScore + rand(-8, 8), 25, 95);
    const mEnergy = clamp(mScore + rand(-9, 9), 25, 95);
    const mFocus  = clamp(mScore + rand(-7, 7), 25, 95);

    const morningTags = mScore >= 75
      ? [['Good sleep', 'Early rise'], ['Work flowed', 'Morning run'], ['Exercised', 'Got outside'], ['Deep sleep', 'Gratitude practice']][rand(0, 3)]
      : mScore <= 50
      ? [['Poor sleep'], ['Anxious'], ['Stressed', 'Late night'], ['Tired']][rand(0, 3)]
      : [['Work flowed'], ['Quiet day'], ['Productive'], ['Deep sleep']][rand(0, 3)];

    const morningJournals = [
      'Woke up feeling refreshed, ready for the day.',
      'Slow morning but coffee helped.',
      'Meditated before checking phone — big difference.',
      'Slept well, mood feels clear and steady.',
      'Quick log via Apple Watch — feeling good',
      'Morning run done. Energy is high.',
      'Grateful for a calm start to the day.',
      'Mind busy with work stuff already.',
      'Feeling a bit foggy but optimistic.',
      'Journalled for 10 mins — clarity arrived.',
    ];

    // Evening entry
    const eScore  = clamp(baseScore + 3 + rand(-5, 8), 30, 97);
    const eBody   = clamp(eScore + rand(-8, 8), 25, 97);
    const eMind   = clamp(eScore + rand(-8, 8), 25, 97);
    const eEnergy = clamp(eScore + rand(-9, 9), 25, 97);
    const eFocus  = clamp(eScore + rand(-7, 7), 25, 97);

    const eveningTags = eScore >= 75
      ? [['Productive', 'Gratitude practice'], ['Social time', 'Good food'], ['Nature walk', 'Meditation'], ['Family time', 'Cooking']][rand(0, 3)]
      : eScore <= 50
      ? [['Heavy screen time'], ['Conflict'], ['Stayed in', 'Processed food'], ['Tired']  ][rand(0, 3)]
      : [['Good food'], ['Got outside'], ['Read a book'], ['Cooking']][rand(0, 3)];

    const eveningJournals = [
      'Productive day overall. Glad I tracked.',
      'Harder than expected but I got through it.',
      'Evening walk helped reset my mood.',
      'Good conversations today, felt connected.',
      'Wound down with a meditation. Peaceful.',
      'Grateful for small wins.',
      'Managed stress better than yesterday.',
      'Long day but meaningful work done.',
      'Nature walk in the evening changed everything.',
      'Ending the day with gratitude.',
    ];

    const nowEpoch  = Date.now();
    const morningTs = new Date(`${dateStr}T09:${String(rand(0, 59)).padStart(2, '0')}:00`).getTime();
    const eveningTs = new Date(`${dateStr}T20:${String(rand(0, 59)).padStart(2, '0')}:00`).getTime();

    // ── Insert mood entries ────────────────────────────────────────────────
    const moodInserts = [
      {
        user_id: DEMO_UID,
        local_id: `demo_morning_${dateStr.replace(/-/g, '')}`,
        date: dateStr,
        timestamp: morningTs,
        score: mScore,
        dimensions: { body: mBody, mind: mMind, energy: mEnergy, focus: mFocus },
        primary_tag: morningTags[0],
        additional_tags: morningTags.slice(1),
        journal_text: morningJournals[rand(0, morningJournals.length - 1)],
        time_of_day: 'morning',
        time: `09:${String(rand(0, 59)).padStart(2, '0')}`,
      },
      {
        user_id: DEMO_UID,
        local_id: `demo_evening_${dateStr.replace(/-/g, '')}`,
        date: dateStr,
        timestamp: eveningTs,
        score: eScore,
        dimensions: { body: eBody, mind: eMind, energy: eEnergy, focus: eFocus },
        primary_tag: eveningTags[0],
        additional_tags: eveningTags.slice(1),
        journal_text: eveningJournals[rand(0, eveningJournals.length - 1)],
        time_of_day: 'evening',
        time: `20:${String(rand(0, 59)).padStart(2, '0')}`,
      },
    ];

    await supabase.from('mood_entries').upsert(moodInserts, { onConflict: 'user_id,local_id' });

    // ── Insert fitness data ────────────────────────────────────────────────
    const dowSteps = [9500, 6200, 7800, 8100, 7500, 8800, 11200][dow] ?? 7000;
    const steps    = clamp(dowSteps + rand(-1500, 1500), 1500, 22000);

    await supabase.from('fitness_data').upsert({
      user_id: DEMO_UID,
      date: dateStr,
      steps,
      active_minutes: clamp(Math.floor(steps / 100) + rand(0, 20), 10, 120),
      resting_heart_rate: rand(54, 72),
      avg_heart_rate: rand(62, 98),
      calories_burned: clamp(2000 + Math.floor(steps * 0.12) + rand(0, 400), 1600, 4000),
      workout_minutes: [0, 3, 6].includes(dow) ? rand(20, 55) : rand(0, 15),
      sleep_hours: parseFloat((7.2 + (Math.random() * 1.8) - 0.9).toFixed(1)),
    }, { onConflict: 'user_id,date' });

    // ── Insert sound session (~65% chance) ────────────────────────────────
    if (Math.random() > 0.35) {
      const sounds = [
        { id: 'rain_forest', name: 'Forest Rain', category: 'Nature' },
        { id: 'ocean_waves', name: 'Ocean Waves', category: 'Nature' },
        { id: 'campfire', name: 'Crackling Fire', category: 'Nature' },
        { id: '528hz', name: '528 Hz Love Frequency', category: 'Frequency' },
        { id: 'binaural_alpha', name: 'Alpha Waves 10Hz', category: 'Binaural' },
        { id: 'deep_sleep', name: 'Deep Sleep', category: 'Nature' },
        { id: '432hz', name: '432 Hz Tuning', category: 'Frequency' },
        { id: 'night_crickets', name: 'Night Crickets', category: 'Nature' },
      ];
      const s  = sounds[rand(0, sounds.length - 1)];
      const mb = clamp(mScore + rand(-10, 5), 30, 80);
      const ma = clamp(mb + rand(3, 18), 40, 90);

      await supabase.from('sound_sessions').insert({
        user_id: DEMO_UID,
        sound_id: s.id,
        sound_name: s.name,
        sound_category: s.category,
        duration_seconds: rand(300, 2400),
        timer_minutes: Math.random() > 0.5 ? (rand(1, 4) * 15) : null,
        mood_before: mb,
        mood_after: ma,
      });
    }

    return new Response(JSON.stringify({ success: true, date: dateStr, morningScore: mScore, eveningScore: eScore }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[populate-demo-data]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
