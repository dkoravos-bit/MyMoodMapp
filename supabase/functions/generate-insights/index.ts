import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// ── Free model cascade (OpenRouter) ─────────────────────────────────────────
// Tried in order. First successful response wins.
// All are 0-cost on OpenRouter free tier as of 2025.
const FREE_MODELS = [
  'google/gemini-2.5-flash-lite',            // best quality, fastest
  'google/gemini-2.0-flash-lite-001',        // solid fallback
  'meta-llama/llama-3.3-70b-instruct:free',  // strong open-source
  'mistralai/mistral-7b-instruct:free',      // lightweight fallback
  'qwen/qwen3-8b:free',                      // additional fallback
];

async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mymoodmapp.app',
        'X-Title': 'MyMoodMapp',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4096,
        temperature: 0.35,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const text = d?.choices?.[0]?.message?.content ?? '';
    return text.trim() || null;
  } catch {
    return null;
  }
}

/** Try each model in cascade order, return first non-null JSON parse result */
async function callWithFallback(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<Record<string, unknown> | null> {
  for (const model of FREE_MODELS) {
    const raw = await callOpenRouter(apiKey, model, systemPrompt, userPrompt);
    if (!raw) continue;
    try {
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      // Some models add extra commentary — try extracting JSON block
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch {}
      }
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      period, moodLog, emotionLog, fitnessData, dailyFitnessRaw,
      intakeSummary, tagCorrelations, timePatterns,
      astrologyContext, schumannContext,
      weatherContext, cycleContext,
    } = await req.json();

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Build mood summary — include note, journalText, and transcript ──────
    const moodSummary = (moodLog as Record<string, unknown>[]).slice(0, 40).map(e => {
      const parts: string[] = [`${e.date}: score=${e.score}`];
      if (e.timeOfDay) parts.push(`time=${e.timeOfDay}`);
      if (e.primaryTag) parts.push(`tag=${e.primaryTag}`);
      const noteText = (e.note as string | undefined)?.trim() ?? '';
      const journalText = (e.journalText as string | undefined)?.trim() ?? '';
      const transcript = (e.transcript as string | undefined)?.trim() ?? '';
      // Prefer journalText (richest), fallback to transcript, then note
      const userText = journalText || transcript || noteText;
      if (userText) parts.push(`journal="${userText.slice(0, 280)}"`);
      return parts.join(', ');
    }).join('\n');

    // ── Extract journal entries with meaningful text ─────────────────────────
    const journalEntries = (moodLog as Record<string, unknown>[])
      .filter(e => {
        const j = (e.journalText as string | undefined)?.trim() ?? '';
        const t = (e.transcript as string | undefined)?.trim() ?? '';
        const n = (e.note as string | undefined)?.trim() ?? '';
        return (j + t + n).length >= 20;
      })
      .slice(0, 20)
      .map(e => {
        const journalText = (e.journalText as string | undefined)?.trim() ?? '';
        const transcript = (e.transcript as string | undefined)?.trim() ?? '';
        const noteText = (e.note as string | undefined)?.trim() ?? '';
        const text = journalText || transcript || noteText;
        const tags = [e.primaryTag, ...((e.additionalTags as string[] | undefined) ?? [])].filter(Boolean).join(', ');
        return `[${e.date} score=${e.score}${tags ? ` tags=${tags}` : ''}]: "${text.slice(0, 400)}"`;
      });

    const hasJournalData = journalEntries.length >= 1;

    // ── Journal context section for the prompt ───────────────────────────────
    const journalSection = hasJournalData
      ? `\n\nJOURNAL ENTRIES — USER'S OWN WORDS (${journalEntries.length} entries with written/spoken text):\n${journalEntries.join('\n')}\n\nJOURNAL ANALYSIS INSTRUCTIONS:\n- You MUST quote specific phrases from the user's journal in at least 2 of your 5 behaviorRecommendations\n- Look for: recurring themes (rumination topics, named stressors, coping strategies mentioned), recurring people or situations, emotional language patterns (catastrophic thinking, self-criticism, positive reframing, avoidance language)\n- Identify contradictions: upbeat language on low-score days may indicate masking; dark language on high-score days may reveal suppressed stress\n- Surface cross-entry patterns the user has not connected: e.g. "You mention [X] on your lowest-score days", "Every time you write about [Y], your score drops the next day"\n- If voice transcripts are present, note when spoken language reveals emotion that written notes don't capture\n- Treat journal text as the highest-fidelity signal in this dataset — number scores can be rationalised, but written words reveal true felt experience`
      : '';

    // ── Journal-aware recommendation instruction ──────────────────────────────
    const journalRecInstruction = hasJournalData
      ? `JOURNAL GROUNDING (MANDATORY): You have ${journalEntries.length} journal entries from this user. At least 2 of your 5 behaviorRecommendations MUST reference their actual journal content using direct quotes (wrapped in quotation marks). The "notObviousInsight" field is especially important — surface a journal-derived pattern they have not articulated themselves.`
      : '';

    // ── Fitness context ──────────────────────────────────────────────────────
    const fitnessSummary = fitnessData ? `
Steps (avg/day): ${fitnessData.avgDailySteps ?? 'N/A'}
Active minutes (avg/day): ${fitnessData.avgActiveMinutes ?? 'N/A'}
Resting heart rate (avg): ${fitnessData.avgRestingHR ?? 'N/A'} bpm
Workouts: ${fitnessData.workoutCount ?? 'N/A'}
Sleep (avg hrs/night): ${fitnessData.avgSleepHours ?? 'N/A'}
Sleep quality: ${fitnessData.avgSleepHours == null ? 'no data' : fitnessData.avgSleepHours >= 7.5 ? 'well-rested' : fitnessData.avgSleepHours >= 6 ? 'moderate' : 'sleep-deprived'}
High-exercise days: ${fitnessData.highExerciseDays ?? 'N/A'}
Low-exercise days: ${fitnessData.lowExerciseDays ?? 'N/A'}`.trim() : 'No fitness data.';

    const sleepDetail = (dailyFitnessRaw && Array.isArray(dailyFitnessRaw) && dailyFitnessRaw.length > 0)
      ? dailyFitnessRaw.filter((d: Record<string, unknown>) => d.sleepHours != null).slice(0, 14)
          .map((d: Record<string, unknown>) => `${d.date}: ${Number(d.sleepHours).toFixed(1)}h sleep, ${d.steps ?? 0} steps`).join('\n')
      : null;

    const scoreDriversSection = (tagCorrelations && tagCorrelations.length >= 2) ? `
SCORE DRIVERS (tag correlations):
${tagCorrelations.slice(0, 10).map((c: Record<string, any>) => {
  const dir = c.deltaVsBaseline > 0 ? `+${c.deltaVsBaseline}` : String(c.deltaVsBaseline);
  return `  ${c.tagLabel}: avg ${c.avgScore}/100 (${dir} vs baseline) — ${c.sampleSize}x logged`;
}).join('\n')}
Top boosts: ${tagCorrelations.filter((c: Record<string, any>) => c.deltaVsBaseline > 0).slice(0, 3).map((c: Record<string, any>) => `${c.tagLabel} (+${c.deltaVsBaseline})`).join(', ') || 'none'}
Top drags:  ${tagCorrelations.filter((c: Record<string, any>) => c.deltaVsBaseline < 0).slice(0, 3).map((c: Record<string, any>) => `${c.tagLabel} (${c.deltaVsBaseline})`).join(', ') || 'none'}` : '';

    const timePatternsSection = (timePatterns && timePatterns.length >= 2) ? `
TIME PATTERNS:
${timePatterns.map((t: Record<string, any>) => `  ${t.timeOfDay}: avg ${t.avgScore}/100 (${t.sampleSize} logs)`).join('\n')}
Peak: ${timePatterns[0].timeOfDay} (avg ${timePatterns[0].avgScore}) / Low: ${timePatterns[timePatterns.length-1].timeOfDay} (avg ${timePatterns[timePatterns.length-1].avgScore})
Day swing: ${timePatterns[0].avgScore - timePatterns[timePatterns.length-1].avgScore} pts` : '';

    const astrologySection = astrologyContext ? `
ASTROLOGY: Sun ${astrologyContext.sunSign}, ${astrologyContext.element} element, Moon phase ${astrologyContext.moonPhase} (${astrologyContext.moonEnergyLevel}), Retrogrades: ${astrologyContext.retrogrades?.join(', ') || 'none'}, Cosmic score ${astrologyContext.energyScore}/100` : '';

    const schumannSection = schumannContext ? `
SCHUMANN: ${schumannContext.frequency}Hz (baseline 7.83Hz), status ${schumannContext.status}, K-index ${schumannContext.kIndex}` : '';

    const weatherSection = weatherContext ? `
WEATHER: ${weatherContext.condition}, ${weatherContext.temperature}°C, humidity ${weatherContext.humidity}%, UV ${weatherContext.uvIndex}, pressure ${weatherContext.pressureHPA}hPa, mood impact: ${weatherContext.moodImpact}` : '';

    const cycleSection = cycleContext ? `
CYCLE: Current phase ${cycleContext.currentPhase}${cycleContext.dayOfCycle ? ` (day ${cycleContext.dayOfCycle})` : ''}, next period in ${cycleContext.daysUntilNextPeriod ?? '?'} days
Phase moods: ${cycleContext.phaseMoodCorrelations.map((p: Record<string, unknown>) => `${p.phase}=${p.avgScore}`).join(', ')}` : '';

    const intakeSection = intakeSummary ? `
INTAKE PROFILE:
Concern: ${intakeSummary.presenting_concern || 'N/A'}
PHQ-9: ${intakeSummary.phq9_total ?? '?'}/27 (${intakeSummary.phq9_severity ?? '?'})
GAD-7: ${intakeSummary.gad7_total ?? '?'}/21 (${intakeSummary.gad7_severity ?? '?'})
Goal: ${intakeSummary.goal_feel || 'feeling better'}
Strengths: ${intakeSummary.self_knowledge || 'N/A'}
What helps: ${intakeSummary.whats_working || 'N/A'}
Trauma flag: ${intakeSummary.trauma_flag ? 'YES' : 'no'}` : '';

    // ── SYSTEM PROMPT ────────────────────────────────────────────────────────
    const systemPrompt = `You are a compassionate, evidence-based wellness intelligence engine trained in cognitive-behavioural therapy (CBT), behavioural activation, sleep hygiene science, exercise psychology, and chronobiology. ${hasJournalData ? 'You have access to this user\'s actual journal entries and MUST use their own words to personalise your analysis — quote specific phrases from their entries when surfacing patterns they may not have noticed themselves.' : ''} Return ONLY valid JSON — no markdown, no commentary outside the JSON.`;

    // ── BEHAVIOUR RECOMMENDATIONS science context ─────────────────────────────
    const behaviorContext = `
EVIDENCE-BASED BEHAVIOUR FRAMEWORKS TO DRAW FROM:
- CBT: thought-behaviour-emotion triangle, behavioural activation
- Chronobiology: circadian alignment, sleep pressure, social zeitgeber theory
- Exercise psychology: dose-response curve, BDNF release, mood latency
- Sleep science: sleep debt, sleep consistency > duration, pre-sleep window rules
- Nutrition-mood: tryptophan pathways, blood sugar stability, gut-brain axis
- ACT: psychological flexibility, values-based action
- Polyvagal theory: nervous system regulation, vagal tone
- Social psychology: belonging, isolation as stressor, mirroring effects
- Mindfulness: interoceptive awareness, rumination interruption
- Journaling research: expressive writing (Pennebaker 1997) reduces cortisol, improves immune function, increases self-awareness`;

    // ── MAIN PROMPT ──────────────────────────────────────────────────────────
    const userPrompt = `Analyze this ${period} wellness data and return a comprehensive JSON report.${hasJournalData ? ' This user has written journal entries — their actual words are the richest signal in this dataset. Reference them directly.' : ''}

${intakeSection}${journalSection}

MOOD LOG (includes journal text inline where available):
${moodSummary || 'No mood data.'}

FITNESS:
${fitnessSummary}
${sleepDetail ? `\nDAILY SLEEP × STEPS:\n${sleepDetail}` : ''}${scoreDriversSection}${timePatternsSection}${astrologySection}${schumannSection}${weatherSection}${cycleSection}

${behaviorContext}

Return ONLY a valid JSON object with EXACTLY this structure:
{
  "headline": "1-sentence compelling summary of their ${period}",
  "overallScore": 0-100,
  "overallTrend": "improving" | "stable" | "declining",
  "moodInsight": "2-3 sentences on mood patterns${cycleContext ? ', weaving in cycle/hormonal context' : ''}${intakeSummary ? ', connecting to their presenting concern and goals' : ''}${hasJournalData ? '. Weave in journal themes or a direct quote if it illuminates the pattern' : ''}",
  "journalInsight": ${hasJournalData ? '"2-3 sentences analyzing patterns across their journal entries. Identify recurring themes, emotional language, contradictions between what they write and their scores, or cross-entry patterns they haven\'t connected. Include at least one direct quote from their journal wrapped in quotation marks. Surface something non-obvious — a pattern they likely haven\'t articulated to themselves."' : 'null'},
  "emotionInsight": "2-3 sentences on emotional patterns${hasJournalData ? '. Ground observations in journal language where available' : ''}",
  "fitnessInsight": "2-3 sentences connecting exercise/heart-rate to emotional state with specific numbers from the data",
  "sleepInsight": "2-3 sentences on sleep quality and next-day mood impact. If no sleep data say so honestly.",
  "scoreDriversInsight": ${(tagCorrelations && tagCorrelations.length >= 2) ? '"2-3 sentences naming the EXACT activities/contexts that most strongly boost or lower their score. Use real tag names and delta numbers from the data. Be specific and actionable."' : 'null'},
  "timePatternInsight": ${(timePatterns && timePatterns.length >= 2) ? '"2 sentences on when they feel best/worst and what that means practically — what to schedule when."' : 'null'},
  "weatherInsight": ${weatherContext ? '"1-2 sentences on how current weather conditions may be affecting mood and energy right now."' : 'null'},
  "schumannInsight": ${schumannContext ? '"1-2 sentences on current Schumann resonance and how it may influence nervous system and sleep."' : 'null'},
  "astrologyInsight": ${astrologyContext ? '"2 sentences on current cosmic context connecting to their reported mood."' : 'null'},
  "cycleInsight": ${cycleContext ? '"2-3 sentences on their current cycle phase hormonal effects AND what their personal phase data reveals."' : 'null'},
  "correlations": [
    { "finding": "specific correlation", "impact": "positive" | "negative" | "neutral", "confidence": "high" | "medium" | "low" }
  ],
  "topPatterns": ["3-4 specific behavioral patterns observed this period"],
  "actionableAdvice": ["3 specific actionable recommendations tied to their actual data and goals"],
  "celebrationNote": "1 sentence genuinely celebrating something positive from their data",
  "watchOut": "1 sentence about one thing to be mindful of",

  "quickSummary": "3 to 5 spoken sentences that function as a warm, at-a-glance audio briefing — written as if a calm and caring therapist friend is speaking directly to the person. Structure it as follows: (1) Open with a grounding overview of how their ${period} has been, mentioning their overall score or mood trend in plain language. (2) Briefly name their single biggest score driver or most notable pattern. (3) Weave in the top 3 behavior recommendations as natural, conversational guidance — each in one short sentence, framed as gentle encouragement rather than instructions (e.g. 'You tend to feel best when you move your body in the mornings' or 'Your data shows that social time reliably lifts your score'). Keep each recommendation brief — this is audio, not a list. (4) For the remaining 2 recommendations, say something like 'There are a couple more insights in your full report worth reading when you have a moment' — only if there are 4 or 5 recommendations total. (5) Close with one warm forward-looking sentence. STRICT RULES: No emojis, no symbols, no markdown, no bullet points, no numbered lists. Write continuous flowing prose suitable for text-to-speech. Total length: 5 to 8 sentences maximum — do not make this long. Prioritise warmth and actionability over completeness.",

  "behaviorRecommendations": [
    {
      "priority": 1,
      "title": "Short action title (max 8 words)",
      "summary": "1 sentence plain-language summary of the recommendation",
      "detail": "2-3 sentences of specific, science-backed guidance. Reference the user's ACTUAL data patterns (e.g. their exact score drops, specific times, real tags). Name the mechanism (e.g. BDNF release, cortisol rhythm, sleep pressure).",
      "why": "1 sentence explaining the evidence base — cite the mechanism or framework (CBT, sleep science, exercise psychology, chronobiology, polyvagal theory, etc.)",
      "predictedOutcome": "1 sentence predicting what will likely happen if they do/don't act on this, based on their pattern trajectory",
      "notObviousInsight": "1 sentence revealing a non-obvious pattern or connection in their data the user may not have noticed (e.g. a 2-day lag effect, a counterintuitive correlation, a hidden compounding pattern${hasJournalData ? ', or a recurring phrase/theme in their journal that predicts score changes' : ''})",
      "category": "sleep" | "exercise" | "social" | "mindfulness" | "schedule" | "nutrition" | "recovery" | "cognitive",
      "effort": "low" | "medium" | "high",
      "timeframe": "immediate" | "this-week" | "this-month"
    }
  ]
}

CRITICAL RULES FOR behaviorRecommendations:
${journalRecInstruction}
- Generate EXACTLY 5 recommendations, numbered 1–5 in priority order (1 = most urgent/impactful)
- Priority 1–2: must address the MOST impactful pattern found in the data (not generic advice)
- Each recommendation MUST reference specific numbers or patterns from this user's actual data
- The "notObviousInsight" field is the most important — surface something non-trivial the user hasn't noticed
- DO NOT suggest seeing a therapist or doctor — this is a self-improvement wellness app
- DO NOT be generic — every field must be specific to this user's actual data
- Predictions must be honest: if trend is negative, say what will likely worsen without action
- If intake profile present: tie at least 2 recommendations directly to stated goals and strengths
${cycleContext ? '- Include at least 1 recommendation that is cycle-phase aware' : ''}
${intakeSummary ? `- Align recommendations with their stated goal: "${intakeSummary.goal_feel || 'feeling better'}" and strength: "${intakeSummary.self_knowledge || 'resilience'}"` : ''}`;

    // ── Call AI with free model cascade ──────────────────────────────────────
    const insights = await callWithFallback(apiKey, systemPrompt, userPrompt);

    if (!insights) {
      return new Response(
        JSON.stringify({ error: 'All AI models failed or returned invalid JSON' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure behaviorRecommendations is always an array
    if (!Array.isArray(insights.behaviorRecommendations) || insights.behaviorRecommendations.length === 0) {
      insights.behaviorRecommendations = [];
    }

    return new Response(
      JSON.stringify({ insights }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('generate-insights error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
