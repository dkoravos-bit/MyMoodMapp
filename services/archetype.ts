// @ts-nocheck
import { ARCHETYPES, QUIZ_QUESTIONS, Archetype } from '@/constants/archetypes';

export interface QuizAnswer {
  questionId: string;
  optionIndex: number;
}

export function calculateArchetype(answers: QuizAnswer[]): Archetype {
  const scores: Record<string, number> = {};

  for (const answer of answers) {
    const question = QUIZ_QUESTIONS.find(q => q.id === answer.questionId);
    if (!question) continue;
    const option = question.options[answer.optionIndex];
    if (!option) continue;
    for (const [archetypeId, weight] of Object.entries(option.weight)) {
      scores[archetypeId] = (scores[archetypeId] || 0) + weight;
    }
  }

  let topId = 'calm_anchor';
  let topScore = 0;
  for (const [id, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topId = id;
    }
  }

  return ARCHETYPES.find(a => a.id === topId) || ARCHETYPES[0];
}

export function getArchetypeById(id: string): Archetype | undefined {
  return ARCHETYPES.find(a => a.id === id);
}

export function getMoodInsight(moodId: string, archetypeId: string): string {
  const insights: Record<string, Record<string, string>> = {
    joyful: {
      chaotic_creative: 'Your joy today is fuel — ride this creative wave.',
      calm_anchor: 'Savor this. Your steadiness makes good days feel lasting.',
      deep_thinker: 'Joy opens your mind. Notice what feels clear right now.',
      radiant_connector: 'This energy is magnetic. Reach out to someone today.',
      quiet_builder: 'Good days compound. Use this momentum.',
      wild_heart: 'This is your natural state — embrace every second.',
    },
    calm: {
      chaotic_creative: 'Calm is rare for you. Protect this space.',
      calm_anchor: 'You\'re in your element. Others sense your steadiness today.',
      deep_thinker: 'Stillness is where your best thinking happens.',
      radiant_connector: 'Your quiet today recharges you for others tomorrow.',
      quiet_builder: 'This is your operating mode. Keep building.',
      wild_heart: 'Cherish this peace. You\'ve earned it.',
    },
    anxious: {
      chaotic_creative: 'Anxiety and creativity share the same energy. Channel it.',
      calm_anchor: 'Even anchors feel the current. This will pass.',
      deep_thinker: 'Name the specific worry. Naming shrinks it.',
      radiant_connector: 'Call someone you trust. Your network is your resource.',
      quiet_builder: 'One small task. Just one. Motion helps.',
      wild_heart: 'Feel it fully, but don\'t let it become your story.',
    },
    excited: {
      chaotic_creative: 'You\'re in your zone. Don\'t overthink — act.',
      calm_anchor: 'Excitement is information. What is it pointing to?',
      deep_thinker: 'What made today exciting? Worth reflecting on.',
      radiant_connector: 'Share this with someone — excitement is contagious.',
      quiet_builder: 'Let this energy fuel the next focused session.',
      wild_heart: 'This is you at full signal. Capture it.',
    },
    melancholy: {
      chaotic_creative: 'Some of your best work comes from here. Be gentle with it.',
      calm_anchor: 'You hold space for others. Hold some for yourself today.',
      deep_thinker: 'Melancholy is depth. What is it telling you?',
      radiant_connector: 'It\'s okay to not perform today. Real connection doesn\'t require it.',
      quiet_builder: 'Rest is building too. You don\'t have to produce today.',
      wild_heart: 'You feel deeply. That\'s not a flaw — it\'s your whole thing.',
    },
    grateful: {
      chaotic_creative: 'Gratitude grounds your creativity in what matters.',
      calm_anchor: 'This is your natural frequency. Note what you\'re grateful for.',
      deep_thinker: 'What specifically are you grateful for? Go three layers deep.',
      radiant_connector: 'Tell someone what you appreciate about them today.',
      quiet_builder: 'Gratitude compounds like good work. Keep noticing.',
      wild_heart: 'Your gratitude is felt by everyone around you.',
    },
    frustrated: {
      chaotic_creative: 'Frustration means you care. What\'s underneath it?',
      calm_anchor: 'Even you hit walls. Pause, breathe, reassess.',
      deep_thinker: 'What expectation is unmet? That\'s the real question.',
      radiant_connector: 'Frustration isn\'t permanent. Talk it through with someone safe.',
      quiet_builder: 'Blocked? Change the task, not the goal.',
      wild_heart: 'Your intensity shows up as frustration too. Let it move through.',
    },
    neutral: {
      chaotic_creative: 'Neutral days are seeds. Plant something small.',
      calm_anchor: 'Middle ground is where you do your clearest thinking.',
      deep_thinker: 'Neutral is a good day to observe rather than react.',
      radiant_connector: 'Low-key days are perfect for one meaningful check-in.',
      quiet_builder: 'No peaks, no valleys. Perfect for consistent output.',
      wild_heart: 'Even your neutral has more in it than most. Dig a little.',
    },
  };

  return insights[moodId]?.[archetypeId] || 'You showed up today. That counts.';
}
