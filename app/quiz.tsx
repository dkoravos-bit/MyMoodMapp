// @ts-nocheck
/**
 * MyMoodMapp — My Wellbeing Profile
 *
 * Two modes:
 *   base     — default for all users; no therapy assumptions
 *   therapist — extended with therapy-prep questions; shown only when user
 *               has a connected therapist as an accountability buddy (Pro)
 *
 * Validated instruments embedded: PHQ-9, GAD-7, AUDIT-C, ISI brief sleep
 * PHQ-9 and GAD-7 are in the public domain.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ─────────────────────────────────────────────────────────────────────

type ScaleOption = { label: string; value: number; emoji?: string };
type QuestionType = 'scale' | 'multiselect';

interface Question {
  id: string;
  section: string;
  sectionColor: string;
  sectionEmoji: string;
  normalizeText?: string;
  text: string;
  type: QuestionType;
  options: ScaleOption[];
  required?: boolean;
  safetyTrigger?: boolean;
  therapistOnly?: boolean; // only shown in therapist mode
}

// ── Option sets ───────────────────────────────────────────────────────────────

const FREQ4: ScaleOption[] = [
  { label: 'Not at all', value: 0, emoji: '😶' },
  { label: 'Several days', value: 1, emoji: '🤔' },
  { label: 'More than half the days', value: 2, emoji: '😟' },
  { label: 'Nearly every day', value: 3, emoji: '😔' },
];

const YES_NO_UNSURE: ScaleOption[] = [
  { label: 'Yes', value: 1, emoji: '✓' },
  { label: 'Not sure', value: 2, emoji: '?' },
  { label: 'No', value: 0, emoji: '✗' },
];

// ── Full question bank ────────────────────────────────────────────────────────

const ALL_QUESTIONS: Question[] = [

  // ── Orientation ───────────────────────────────────────────────────────────
  {
    id: 'presenting',
    section: 'Getting started',
    sectionColor: Colors.primary,
    sectionEmoji: '👋',
    normalizeText: 'Your answers create a personal wellness persona that makes your AI reports much more insightful and personalised. There are no right or wrong answers.',
    text: "What is the main thing on your mind right now?",
    type: 'multiselect',
    required: true,
    options: [
      { label: 'Anxiety or constant worry', value: 1, emoji: '😰' },
      { label: 'Low mood or feeling flat', value: 2, emoji: '😞' },
      { label: 'Relationship difficulties', value: 3, emoji: '💔' },
      { label: 'Work or life balance stress', value: 4, emoji: '⚖️' },
      { label: 'Difficult past experiences', value: 5, emoji: '🌀' },
      { label: 'Identity or self-worth struggles', value: 6, emoji: '🪞' },
      { label: 'Grief or loss', value: 7, emoji: '🕊️' },
      { label: 'I just want to understand myself better', value: 8, emoji: '💬' },
    ],
  },

  // ── PHQ-9 Depression ─────────────────────────────────────────────────────
  {
    id: 'phq_1',
    section: 'How you have been feeling',
    sectionColor: '#7C83FF',
    sectionEmoji: '🧠',
    normalizeText: "Over the past two weeks, how often have you been bothered by the following? These questions help calibrate your AI insights to your actual mental state.",
    text: 'Little interest or pleasure in doing things you usually enjoy.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'phq_2',
    section: 'How you have been feeling',
    sectionColor: '#7C83FF',
    sectionEmoji: '🧠',
    text: 'Feeling down, depressed, or hopeless.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'phq_3',
    section: 'How you have been feeling',
    sectionColor: '#7C83FF',
    sectionEmoji: '🧠',
    text: 'Trouble falling asleep, staying asleep, or sleeping too much.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'phq_4',
    section: 'How you have been feeling',
    sectionColor: '#7C83FF',
    sectionEmoji: '🧠',
    text: 'Feeling tired or having little energy.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'phq_5',
    section: 'How you have been feeling',
    sectionColor: '#7C83FF',
    sectionEmoji: '🧠',
    text: 'Poor appetite or overeating.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'phq_6',
    section: 'How you have been feeling',
    sectionColor: '#7C83FF',
    sectionEmoji: '🧠',
    text: 'Feeling bad about yourself — or that you have let yourself or others down.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'phq_7',
    section: 'How you have been feeling',
    sectionColor: '#7C83FF',
    sectionEmoji: '🧠',
    text: 'Trouble concentrating on things, such as reading or watching TV.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'phq_8',
    section: 'How you have been feeling',
    sectionColor: '#7C83FF',
    sectionEmoji: '🧠',
    text: 'Moving or speaking slowly — or feeling so fidgety and restless that others could have noticed.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'phq_9',
    section: 'How you have been feeling',
    sectionColor: '#7C83FF',
    sectionEmoji: '🧠',
    normalizeText: 'The next question asks about something many people experience. Please answer honestly.',
    text: 'Thoughts that you would be better off dead, or of hurting yourself.',
    type: 'scale',
    options: FREQ4,
    safetyTrigger: true,
    required: true,
  },

  // ── GAD-7 Anxiety ─────────────────────────────────────────────────────────
  {
    id: 'gad_1',
    section: 'Anxiety and worry',
    sectionColor: '#FFD166',
    sectionEmoji: '💭',
    normalizeText: "Over the past two weeks, how often have you been bothered by the following?",
    text: 'Feeling nervous, anxious, or on edge.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'gad_2',
    section: 'Anxiety and worry',
    sectionColor: '#FFD166',
    sectionEmoji: '💭',
    text: 'Not being able to stop or control worrying.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'gad_3',
    section: 'Anxiety and worry',
    sectionColor: '#FFD166',
    sectionEmoji: '💭',
    text: 'Worrying too much about different things.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'gad_4',
    section: 'Anxiety and worry',
    sectionColor: '#FFD166',
    sectionEmoji: '💭',
    text: 'Trouble relaxing.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'gad_5',
    section: 'Anxiety and worry',
    sectionColor: '#FFD166',
    sectionEmoji: '💭',
    text: 'Being so restless that it is hard to sit still.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'gad_6',
    section: 'Anxiety and worry',
    sectionColor: '#FFD166',
    sectionEmoji: '💭',
    text: 'Becoming easily annoyed or irritable.',
    type: 'scale',
    options: FREQ4,
  },
  {
    id: 'gad_7',
    section: 'Anxiety and worry',
    sectionColor: '#FFD166',
    sectionEmoji: '💭',
    text: 'Feeling afraid, as if something awful might happen.',
    type: 'scale',
    options: FREQ4,
  },

  // ── Sleep ─────────────────────────────────────────────────────────────────
  {
    id: 'sleep_1',
    section: 'Sleep',
    sectionColor: '#95E06C',
    sectionEmoji: '😴',
    normalizeText: 'Sleep and mood are closely linked. A couple of quick questions:',
    text: 'How would you describe the quality of your sleep right now?',
    type: 'scale',
    options: [
      { label: 'Very good — I sleep well', value: 0, emoji: '😴' },
      { label: 'OK — some nights are rough', value: 1, emoji: '🛌' },
      { label: 'Poor — I often struggle', value: 2, emoji: '😩' },
      { label: 'Very poor — sleep is a real problem', value: 3, emoji: '😵' },
    ],
  },
  {
    id: 'sleep_2',
    section: 'Sleep',
    sectionColor: '#95E06C',
    sectionEmoji: '😴',
    text: 'How often do you have difficulty falling or staying asleep?',
    type: 'scale',
    options: [
      { label: 'Never or rarely', value: 0, emoji: '✨' },
      { label: 'Sometimes — 1 or 2 nights per week', value: 1, emoji: '🌙' },
      { label: 'Often — 3 or 4 nights per week', value: 2, emoji: '😟' },
      { label: 'Almost every night', value: 3, emoji: '😫' },
    ],
  },

  // ── AUDIT-C ───────────────────────────────────────────────────────────────
  {
    id: 'audit_1',
    section: 'Lifestyle',
    sectionColor: Colors.secondary,
    sectionEmoji: '🌿',
    normalizeText: 'These questions help build a complete picture of factors that affect your mood and energy.',
    text: 'How often did you have an alcoholic drink in the past year?',
    type: 'scale',
    options: [
      { label: 'Never', value: 0, emoji: '🚫' },
      { label: 'Monthly or less', value: 1, emoji: '📅' },
      { label: '2–4 times a month', value: 2, emoji: '🗓️' },
      { label: '2–3 times a week', value: 3, emoji: '🍷' },
      { label: '4 or more times a week', value: 4, emoji: '⚠️' },
    ],
  },
  {
    id: 'audit_2',
    section: 'Lifestyle',
    sectionColor: Colors.secondary,
    sectionEmoji: '🌿',
    text: 'On a typical day when you drink, how many drinks do you have?',
    type: 'scale',
    options: [
      { label: '1 or 2', value: 0, emoji: '1️⃣' },
      { label: '3 or 4', value: 1, emoji: '3️⃣' },
      { label: '5 or 6', value: 2, emoji: '5️⃣' },
      { label: '7 to 9', value: 3, emoji: '7️⃣' },
      { label: '10 or more', value: 4, emoji: '🔟' },
    ],
  },
  {
    id: 'audit_3',
    section: 'Lifestyle',
    sectionColor: Colors.secondary,
    sectionEmoji: '🌿',
    text: 'How often did you have 6 or more drinks on one occasion in the past year?',
    type: 'scale',
    options: [
      { label: 'Never', value: 0, emoji: '✅' },
      { label: 'Less than monthly', value: 1, emoji: '📆' },
      { label: 'Monthly', value: 2, emoji: '🗓️' },
      { label: 'Weekly', value: 3, emoji: '📊' },
      { label: 'Daily or almost daily', value: 4, emoji: '⚠️' },
    ],
  },

  // ── History ───────────────────────────────────────────────────────────────
  {
    id: 'trauma',
    section: 'Your history',
    sectionColor: '#FF8C42',
    sectionEmoji: '🕰️',
    normalizeText: 'Many people have past experiences that still affect how they feel today. This is very common.',
    text: 'Have you had experiences in the past — such as difficult events or periods — that still affect how you feel today?',
    type: 'scale',
    options: YES_NO_UNSURE,
  },
  {
    id: 'duration',
    section: 'Your history',
    sectionColor: '#FF8C42',
    sectionEmoji: '🕰️',
    text: 'How long have you been feeling this way?',
    type: 'scale',
    options: [
      { label: 'Just recently — days or a week', value: 0, emoji: '📍' },
      { label: 'A few weeks', value: 1, emoji: '📅' },
      { label: 'Several months', value: 2, emoji: '🗓️' },
      { label: 'A year or more', value: 3, emoji: '⏳' },
      { label: 'This is a lifelong pattern for me', value: 4, emoji: '🔁' },
    ],
  },

  // ── Daily life ────────────────────────────────────────────────────────────
  {
    id: 'hard_first',
    section: 'Daily life',
    sectionColor: Colors.primary,
    sectionEmoji: '☀️',
    normalizeText: 'These questions help calibrate your AI reports to how this is actually affecting your day-to-day life.',
    text: 'On a typical day, what is the first thing that feels hard?',
    type: 'multiselect',
    options: [
      { label: 'Getting out of bed or starting the day', value: 1, emoji: '🛏️' },
      { label: 'Facing work or responsibilities', value: 2, emoji: '💼' },
      { label: 'Being around other people', value: 3, emoji: '👥' },
      { label: 'Managing my thoughts or emotions', value: 4, emoji: '🌀' },
      { label: 'Taking care of myself (eating, hygiene)', value: 5, emoji: '🪥' },
      { label: 'Everything feels equally hard', value: 6, emoji: '😔' },
    ],
  },
  {
    id: 'life_areas',
    section: 'Daily life',
    sectionColor: Colors.primary,
    sectionEmoji: '☀️',
    text: 'Which areas of your life feel most affected right now?',
    type: 'multiselect',
    options: [
      { label: '💼 Work or study', value: 1 },
      { label: '💑 Relationships', value: 2 },
      { label: '🏃 Physical health', value: 3 },
      { label: '🛒 Daily tasks', value: 4 },
      { label: '🧠 Sense of self', value: 5 },
      { label: '💰 Finances', value: 6 },
      { label: '😴 Sleep or energy', value: 7 },
      { label: '🎉 Social life', value: 8 },
    ],
  },

  // ── Support system ─────────────────────────────────────────────────────────
  {
    id: 'support',
    section: 'Your support',
    sectionColor: Colors.success,
    sectionEmoji: '🤝',
    normalizeText: 'Understanding your support network helps personalise advice in your AI reports.',
    text: 'Who in your life knows you are going through a hard time right now?',
    type: 'scale',
    options: [
      { label: 'Close people know and are supportive', value: 0, emoji: '❤️' },
      { label: 'A few people know, but not many', value: 1, emoji: '🤝' },
      { label: 'Almost no one knows', value: 2, emoji: '🤫' },
      { label: 'I am managing this completely alone', value: 3, emoji: '🚶' },
    ],
  },
  {
    id: 'talk_openly',
    section: 'Your support',
    sectionColor: Colors.success,
    sectionEmoji: '🤝',
    text: 'When things are hard, do you have people you can talk to openly?',
    type: 'scale',
    options: [
      { label: 'Yes — people I can be fully honest with', value: 0, emoji: '💬' },
      { label: 'Sometimes — a bit, but not everything', value: 1, emoji: '🗣️' },
      { label: 'Rarely — I hold most of it in', value: 2, emoji: '🤐' },
      { label: 'No — I manage completely alone', value: 3, emoji: '🏝️' },
    ],
  },

  // ── Strengths ─────────────────────────────────────────────────────────────
  {
    id: 'whats_working',
    section: 'Your strengths',
    sectionColor: '#95E06C',
    sectionEmoji: '💪',
    normalizeText: 'Knowing your strengths is just as important as knowing your challenges — your AI reports will highlight these.',
    text: "What is working in your life right now, even if it is small?",
    type: 'multiselect',
    options: [
      { label: 'My social connections or friendships', value: 1, emoji: '👯' },
      { label: 'Exercise or physical activity', value: 2, emoji: '🏃' },
      { label: 'My routine or structure', value: 3, emoji: '📋' },
      { label: 'Work or creative pursuits', value: 4, emoji: '✨' },
      { label: 'Small daily moments of joy', value: 5, emoji: '☕' },
      { label: 'Honestly, nothing feels like it is working', value: 6, emoji: '💔' },
    ],
  },
  {
    id: 'tried_helps',
    section: 'Your strengths',
    sectionColor: '#95E06C',
    sectionEmoji: '💪',
    text: 'What has helped you get through hard times before?',
    type: 'multiselect',
    options: [
      { label: 'Talking to friends or family', value: 1, emoji: '💬' },
      { label: 'Exercise or movement', value: 2, emoji: '🏃' },
      { label: 'Journaling or self-reflection', value: 3, emoji: '📓' },
      { label: 'Keeping busy or distraction', value: 4, emoji: '🎯' },
      { label: 'Mindfulness or meditation', value: 5, emoji: '🧘' },
      { label: 'Nothing has helped yet', value: 6, emoji: '❓' },
    ],
  },
  {
    id: 'self_knowledge',
    section: 'Your strengths',
    sectionColor: '#95E06C',
    sectionEmoji: '💪',
    text: 'What do you know about yourself that helps you through hard times?',
    type: 'multiselect',
    options: [
      { label: 'I am resilient — I have been here before', value: 1, emoji: '🦾' },
      { label: 'I am good at my work or creative pursuits', value: 2, emoji: '⭐' },
      { label: 'People care about me', value: 3, emoji: '❤️' },
      { label: 'I can be honest with myself', value: 4, emoji: '🪞' },
      { label: 'I push through even when it is hard', value: 5, emoji: '💪' },
      { label: 'I am not sure right now', value: 6, emoji: '🤷' },
    ],
  },

  // ── Goals ─────────────────────────────────────────────────────────────────
  {
    id: 'goal_feel',
    section: 'Your goals',
    sectionColor: Colors.primary,
    sectionEmoji: '🎯',
    normalizeText: 'Almost done. These questions tell your AI what "better" actually means to you, making recommendations concrete and relevant.',
    text: 'What would feel different in your life if things were improving?',
    type: 'multiselect',
    options: [
      { label: 'I would feel less anxious or stressed', value: 1, emoji: '😌' },
      { label: 'I would enjoy things again', value: 2, emoji: '😊' },
      { label: 'My relationships would improve', value: 3, emoji: '💑' },
      { label: 'I would have more confidence', value: 4, emoji: '🦁' },
      { label: 'I would feel more in control', value: 5, emoji: '🎮' },
      { label: 'I would just feel like myself again', value: 6, emoji: '🌟' },
    ],
  },
  {
    id: 'goal_better',
    section: 'Your goals',
    sectionColor: Colors.primary,
    sectionEmoji: '🎯',
    text: "What does \"better\" look like to you?",
    type: 'multiselect',
    options: [
      { label: 'Waking up without dread', value: 1, emoji: '🌅' },
      { label: 'Being able to focus and get things done', value: 2, emoji: '🎯' },
      { label: 'Feeling connected to the people I love', value: 3, emoji: '🤗' },
      { label: 'Having more energy and motivation', value: 4, emoji: '⚡' },
      { label: 'Finding joy in small things', value: 5, emoji: '🌸' },
      { label: 'I am not sure yet — it feels far away', value: 6, emoji: '🌫️' },
    ],
  },

  // ── Working with support (therapist mode only) ────────────────────────────
  {
    id: 'prior_therapy',
    section: 'Working with a therapist',
    sectionColor: Colors.secondary,
    sectionEmoji: '🤲',
    normalizeText: 'Your therapist has connected with you on MyMoodMapp. These questions help them understand you before your first session.',
    text: 'Have you worked with a therapist or counsellor before?',
    type: 'scale',
    therapistOnly: true,
    options: [
      { label: 'No, this is my first time', value: 0, emoji: '🌱' },
      { label: 'Yes — and it was helpful', value: 1, emoji: '✅' },
      { label: 'Yes — but it was not very helpful', value: 2, emoji: '😕' },
      { label: 'Yes — mixed experience', value: 3, emoji: '↔️' },
    ],
  },
  {
    id: 'prior_therapy_helpful',
    section: 'Working with a therapist',
    sectionColor: Colors.secondary,
    sectionEmoji: '🤲',
    text: 'If you have worked with a therapist before, what was most helpful?',
    type: 'multiselect',
    therapistOnly: true,
    options: [
      { label: 'Talking through my feelings', value: 1, emoji: '💬' },
      { label: 'Practical tools and strategies', value: 2, emoji: '🛠️' },
      { label: 'Just being listened to', value: 3, emoji: '👂' },
      { label: 'I have not worked with a therapist before', value: 0, emoji: '—' },
    ],
  },
  {
    id: 'pref_style',
    section: 'Working with a therapist',
    sectionColor: Colors.secondary,
    sectionEmoji: '🤲',
    text: 'What do you prefer when working through problems with someone?',
    type: 'multiselect',
    therapistOnly: true,
    options: [
      { label: 'Talking through feelings and emotions', value: 0, emoji: '💬' },
      { label: 'Practical strategies and tools', value: 1, emoji: '🛠️' },
      { label: 'A mix of both', value: 2, emoji: '⚖️' },
      { label: 'I am not sure yet', value: 3, emoji: '🤷' },
    ],
  },
  {
    id: 'pref_pace',
    section: 'Working with a therapist',
    sectionColor: Colors.secondary,
    sectionEmoji: '🤲',
    text: 'Are there topics you would want to approach slowly or avoid at first?',
    type: 'multiselect',
    therapistOnly: true,
    options: [
      { label: 'My childhood or family', value: 1, emoji: '🏡' },
      { label: 'Romantic relationships', value: 2, emoji: '💔' },
      { label: 'Work or career', value: 3, emoji: '💼' },
      { label: 'Past trauma or difficult events', value: 4, emoji: '🌀' },
      { label: 'My body or health', value: 5, emoji: '🫀' },
      { label: 'No specific topics to avoid', value: 0, emoji: '✅' },
    ],
  },
  {
    id: 'pref_therapist',
    section: 'Working with a therapist',
    sectionColor: Colors.secondary,
    sectionEmoji: '🤲',
    text: 'What kind of style works best for you in a support relationship?',
    type: 'multiselect',
    therapistOnly: true,
    options: [
      { label: 'Direct and honest feedback', value: 1, emoji: '🎯' },
      { label: 'Warm and supportive', value: 2, emoji: '🤗' },
      { label: 'Evidence-based and practical', value: 3, emoji: '📊' },
      { label: 'Someone with lived experience', value: 4, emoji: '🫂' },
      { label: 'No strong preference', value: 0, emoji: '✅' },
    ],
  },
  {
    id: 'support_why',
    section: 'Working with a therapist',
    sectionColor: Colors.secondary,
    sectionEmoji: '🤲',
    text: 'What are you hoping to get from working with a therapist?',
    type: 'multiselect',
    therapistOnly: true,
    options: [
      { label: 'To feel heard and understood', value: 1, emoji: '👂' },
      { label: 'To understand why I feel this way', value: 2, emoji: '🔍' },
      { label: 'Practical tools to cope better', value: 3, emoji: '🛠️' },
      { label: 'Help processing the past', value: 4, emoji: '🔄' },
      { label: 'Accountability and structure', value: 5, emoji: '📋' },
      { label: 'I am not sure yet', value: 6, emoji: '🤷' },
    ],
  },
];

// ── Score helpers ─────────────────────────────────────────────────────────────

function getPHQ9Severity(score: number): string {
  if (score <= 4) return 'Minimal (0-4)';
  if (score <= 9) return 'Mild (5-9)';
  if (score <= 14) return 'Moderate (10-14)';
  if (score <= 19) return 'Moderately severe (15-19)';
  return 'Severe (20-27)';
}

function getGAD7Severity(score: number): string {
  if (score <= 4) return 'Minimal (0-4)';
  if (score <= 9) return 'Mild (5-9)';
  if (score <= 14) return 'Moderate (10-14)';
  return 'Severe (15-21)';
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  // mode=therapist      → full quiz including therapist-only questions
  // mode=therapist-only → ONLY the therapist-only questions (user already has base intake)
  // (default)           → base questions only
  const isTherapistMode = params.mode === 'therapist';
  const isTherapistOnly = params.mode === 'therapist-only';

  // Filter questions based on mode
  const QUESTIONS = isTherapistMode
    ? ALL_QUESTIONS
    : isTherapistOnly
    ? ALL_QUESTIONS.filter(q => q.therapistOnly)
    : ALL_QUESTIONS.filter(q => !q.therapistOnly);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [multiSelectDraft, setMultiSelectDraft] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const question = QUESTIONS[currentIndex];
  const progress = (currentIndex / QUESTIONS.length) * 100;
  const isLast = currentIndex === QUESTIONS.length - 1;
  const currentAnswer = answers[question.id];

  const populateDraft = (q: Question, saved: Record<string, any>) => {
    if (q.type === 'multiselect') setMultiSelectDraft(saved[q.id] ?? []);
    else setMultiSelectDraft([]);
  };

  const hasAnswer = (): boolean => {
    if (question.type === 'multiselect') return multiSelectDraft.length > 0;
    return currentAnswer !== undefined && currentAnswer !== null;
  };

  const commitAnswer = (): Record<string, any> => {
    const next = { ...answers };
    if (question.type === 'multiselect') next[question.id] = multiSelectDraft;
    return next;
  };

  const handleSelect = (value: number) => {
    setAnswers(prev => ({ ...prev, [question.id]: value }));
  };

  const handleToggleMulti = (value: number) => {
    setMultiSelectDraft(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleNext = () => {
    const newAnswers = commitAnswer();
    setAnswers(newAnswers);

    if (question.id === 'phq_9' && (newAnswers['phq_9'] ?? 0) > 0) {
      setShowSafety(true);
      return;
    }

    if (isLast) {
      handleSubmit(newAnswers);
      return;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    populateDraft(QUESTIONS[nextIndex], newAnswers);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleBack = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) { router.back(); return; }
    setCurrentIndex(prevIndex);
    populateDraft(QUESTIONS[prevIndex], answers);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleSubmit = async (finalAnswers: Record<string, any>) => {
    setSaving(true);

    // ── Therapist-only mode: patch existing intake with therapist section only ──
    if (isTherapistOnly) {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Load existing clinical_summary so we can merge
          const { data: existingIntake } = await supabase
            .from('intake_questionnaires')
            .select('clinical_summary, contextual')
            .eq('user_id', user.id)
            .maybeSingle();

          const styleMap: Record<number, string> = { 0: 'Feelings-focused', 1: 'Practical/strategies', 2: 'Mix of both', 3: 'Not sure yet' };
          const priorMap: Record<number, string> = { 0: 'First time', 1: 'Previously helpful', 2: 'Previously unhelpful', 3: 'Previously mixed' };
          const prefPaceMap: Record<number, string> = { 0: 'No specific topics to avoid', 1: 'Childhood/family', 2: 'Romantic relationships', 3: 'Work/career', 4: 'Past trauma', 5: 'Body/health' };
          const prefTherapistMap: Record<number, string> = { 0: 'No strong preference', 1: 'Direct/honest', 2: 'Warm/supportive', 3: 'Evidence-based', 4: 'Lived experience' };
          const priorHelpfulMap: Record<number, string> = { 0: 'No prior therapy', 1: 'Talking through feelings', 2: 'Practical tools', 3: 'Being listened to' };
          const supportWhyMap: Record<number, string> = { 1: 'To feel heard', 2: 'Understand why I feel this way', 3: 'Practical coping tools', 4: 'Processing the past', 5: 'Accountability/structure', 6: 'Not sure yet' };

          function resolveMulti(ans: Record<string, any>, key: string, map: Record<number, string>): string {
            const val = ans[key];
            if (Array.isArray(val)) return val.map((v: number) => map[v]).filter(Boolean).join('; ');
            if (val != null) return map[val] ?? 'Not answered';
            return 'Not answered';
          }

          const therapistPatch = {
            prior_therapy: priorMap[finalAnswers['prior_therapy']] ?? 'Not answered',
            pref_style: resolveMulti(finalAnswers, 'pref_style', styleMap),
            pref_pace: resolveMulti(finalAnswers, 'pref_pace', prefPaceMap),
            pref_therapist: resolveMulti(finalAnswers, 'pref_therapist', prefTherapistMap),
            prior_therapy_notes: resolveMulti(finalAnswers, 'prior_therapy_helpful', priorHelpfulMap),
            support_why: resolveMulti(finalAnswers, 'support_why', supportWhyMap),
            therapist_mode: true,
          };

          const mergedClinical = { ...(existingIntake?.clinical_summary ?? {}), ...therapistPatch };
          const contextualPatch = {
            prior_therapy: finalAnswers['prior_therapy'],
            prior_therapy_helpful: finalAnswers['prior_therapy_helpful'],
            pref_style: finalAnswers['pref_style'],
            pref_pace: finalAnswers['pref_pace'],
            pref_therapist: finalAnswers['pref_therapist'],
            support_why: finalAnswers['support_why'],
          };
          const mergedContextual = { ...(existingIntake?.contextual ?? {}), ...contextualPatch };

          await supabase.from('intake_questionnaires').update({
            clinical_summary: mergedClinical,
            contextual: mergedContextual,
            updated_at: new Date().toISOString(),
          }).eq('user_id', user.id);
        }
      } catch (e) {
        console.warn('Therapist-only patch error:', e);
      }
      setSaving(false);
      router.replace('/result');
      return;
    }

    const phq9Keys = ['phq_1','phq_2','phq_3','phq_4','phq_5','phq_6','phq_7','phq_8','phq_9'];
    const phq9Scores = phq9Keys.map(k => finalAnswers[k] ?? 0);
    const phq9Total = phq9Scores.reduce((s, v) => s + v, 0);

    const gad7Keys = ['gad_1','gad_2','gad_3','gad_4','gad_5','gad_6','gad_7'];
    const gad7Scores = gad7Keys.map(k => finalAnswers[k] ?? 0);
    const gad7Total = gad7Scores.reduce((s, v) => s + v, 0);

    const sleepScores = [finalAnswers['sleep_1'] ?? 0, finalAnswers['sleep_2'] ?? 0];
    const auditScores = [finalAnswers['audit_1'] ?? 0, finalAnswers['audit_2'] ?? 0, finalAnswers['audit_3'] ?? 0];
    const auditTotal = auditScores.reduce((s, v) => s + v, 0);

    const traumaFlag = finalAnswers['trauma'] === 1 || finalAnswers['trauma'] === 2;
    const safetyFlag = (finalAnswers['phq_9'] ?? 0) > 0;

    const lifeAreaLabels = ['Work/study','Relationships','Physical health','Daily tasks','Sense of self','Finances','Sleep/energy','Social life'];
    const selectedAreas = (finalAnswers['life_areas'] ?? []).map((v: number) => lifeAreaLabels[v - 1]).filter(Boolean);

    function resolveMulti(ans: Record<string, any>, key: string, map: Record<number, string>): string {
      const val = ans[key];
      if (Array.isArray(val)) return val.map((v: number) => map[v]).filter(Boolean).join('; ');
      if (val != null) return map[val] ?? 'Not answered';
      return 'Not answered';
    }

    const durationMap: Record<number, string> = { 0: 'Days/week', 1: 'A few weeks', 2: 'Months', 3: 'A year or more', 4: 'Lifelong pattern' };
    const priorMap: Record<number, string> = { 0: 'First time', 1: 'Previously helpful', 2: 'Previously unhelpful', 3: 'Previously mixed' };
    const supportMap: Record<number, string> = { 0: 'Well supported', 1: 'Partially supported', 2: 'Mostly private', 3: 'Managing alone' };
    const styleMap: Record<number, string> = { 0: 'Feelings-focused', 1: 'Practical/strategies', 2: 'Mix of both', 3: 'Not sure yet' };

    const presentingMap: Record<number, string> = {
      1: 'Anxiety / constant worry', 2: 'Low mood / feeling flat',
      3: 'Relationship difficulties', 4: 'Work / life balance stress',
      5: 'Difficult past experiences', 6: 'Identity / self-worth struggles',
      7: 'Grief or loss', 8: 'Understanding myself better',
    };
    const hardFirstMap: Record<number, string> = {
      1: 'Getting out of bed', 2: 'Facing work', 3: 'Being around people',
      4: 'Managing emotions/thoughts', 5: 'Self-care', 6: 'Everything equally hard',
    };
    const whatsWorkingMap: Record<number, string> = {
      1: 'Social connections', 2: 'Exercise', 3: 'Routine/structure',
      4: 'Work/creative pursuits', 5: 'Daily joy moments', 6: 'Nothing working',
    };
    const triedHelpsMap: Record<number, string> = {
      1: 'Talking to friends/family', 2: 'Exercise', 3: 'Journaling',
      4: 'Keeping busy', 5: 'Mindfulness', 6: 'Nothing helped',
    };
    const selfKnowledgeMap: Record<number, string> = {
      1: 'Resilient', 2: 'Good at work/creativity', 3: 'People care about me',
      4: 'Self-honest', 5: 'Pushes through', 6: 'Not sure',
    };
    const goalFeelMap: Record<number, string> = {
      1: 'Less anxious', 2: 'Enjoy things again', 3: 'Better relationships',
      4: 'More confidence', 5: 'More in control', 6: 'Feel like myself again',
    };
    const goalBetterMap: Record<number, string> = {
      1: 'Wake without dread', 2: 'Focus/get things done', 3: 'Feel connected',
      4: 'More energy', 5: 'Find joy', 6: 'Not sure yet',
    };
    const prefPaceMap: Record<number, string> = {
      0: 'No specific topics to avoid', 1: 'Childhood/family',
      2: 'Romantic relationships', 3: 'Work/career', 4: 'Past trauma', 5: 'Body/health',
    };
    const prefTherapistMap: Record<number, string> = {
      0: 'No strong preference', 1: 'Direct/honest', 2: 'Warm/supportive',
      3: 'Evidence-based', 4: 'Lived experience',
    };
    const priorHelpfulMap: Record<number, string> = {
      0: 'No prior therapy', 1: 'Talking through feelings', 2: 'Practical tools', 3: 'Being listened to',
    };
    const supportWhyMap: Record<number, string> = {
      1: 'To feel heard', 2: 'Understand why I feel this way', 3: 'Practical coping tools',
      4: 'Processing the past', 5: 'Accountability/structure', 6: 'Not sure yet',
    };

    const clinical_summary = {
      phq9_total: phq9Total,
      phq9_severity: getPHQ9Severity(phq9Total),
      gad7_total: gad7Total,
      gad7_severity: getGAD7Severity(gad7Total),
      audit_total: auditTotal,
      sleep_score: sleepScores.reduce((s, v) => s + v, 0),
      trauma_flag: traumaFlag,
      safety_flag: safetyFlag,
      duration: durationMap[finalAnswers['duration']] ?? 'Not answered',
      prior_therapy: priorMap[finalAnswers['prior_therapy']] ?? 'Not answered',
      support_level: supportMap[finalAnswers['support']] ?? 'Not answered',
      life_areas_affected: selectedAreas,
      pref_style: resolveMulti(finalAnswers, 'pref_style', styleMap),
      presenting_concern: resolveMulti(finalAnswers, 'presenting', presentingMap),
      whats_working: resolveMulti(finalAnswers, 'whats_working', whatsWorkingMap),
      tried_helps: resolveMulti(finalAnswers, 'tried_helps', triedHelpsMap),
      self_knowledge: resolveMulti(finalAnswers, 'self_knowledge', selfKnowledgeMap),
      goal_feel: resolveMulti(finalAnswers, 'goal_feel', goalFeelMap),
      goal_better: resolveMulti(finalAnswers, 'goal_better', goalBetterMap),
      pref_pace: resolveMulti(finalAnswers, 'pref_pace', prefPaceMap),
      pref_therapist: resolveMulti(finalAnswers, 'pref_therapist', prefTherapistMap),
      prior_therapy_notes: resolveMulti(finalAnswers, 'prior_therapy_helpful', priorHelpfulMap),
      hard_first: resolveMulti(finalAnswers, 'hard_first', hardFirstMap),
      support_why: resolveMulti(finalAnswers, 'support_why', supportWhyMap),
      therapist_mode: isTherapistMode,
    };

    const contextual = {
      duration: finalAnswers['duration'],
      prior_therapy: finalAnswers['prior_therapy'],
      prior_therapy_helpful: finalAnswers['prior_therapy_helpful'],
      hard_first: finalAnswers['hard_first'],
      life_areas: finalAnswers['life_areas'],
      support: finalAnswers['support'],
      talk_openly: finalAnswers['talk_openly'],
      whats_working: finalAnswers['whats_working'],
      tried_helps: finalAnswers['tried_helps'],
      self_knowledge: finalAnswers['self_knowledge'],
      goal_feel: finalAnswers['goal_feel'],
      goal_better: finalAnswers['goal_better'],
      pref_style: finalAnswers['pref_style'],
      pref_pace: finalAnswers['pref_pace'],
      pref_therapist: finalAnswers['pref_therapist'],
      support_why: finalAnswers['support_why'],
      presenting_resolved: clinical_summary.presenting_concern,
    };

    // Always save to AsyncStorage first so the result page loads instantly
    await AsyncStorage.setItem('intake_summary', JSON.stringify(clinical_summary));

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: upsertError } = await supabase.from('intake_questionnaires').upsert({
          user_id: user.id,
          presenting_concern: resolveMulti(finalAnswers, 'presenting', presentingMap),
          phq9_scores: phq9Scores,
          phq9_total: phq9Total,
          gad7_scores: gad7Scores,
          gad7_total: gad7Total,
          sleep_scores: sleepScores,
          auditc_scores: auditScores,
          auditc_total: auditTotal,
          trauma_flag: traumaFlag,
          safety_flag: safetyFlag,
          contextual,
          clinical_summary,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (upsertError) {
          console.warn('Intake upsert error:', upsertError.message);
        }
      }
    } catch (e) {
      console.warn('Intake save error:', e);
    }

    setSaving(false);
    router.replace('/result');
  };

  // ── Safety screen ─────────────────────────────────────────────────────────
  if (showSafety) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.safetyScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.safetyCard}>
            <View style={styles.safetyIconRow}>
              <View style={styles.safetyIconCircle}>
                <MaterialIcons name="favorite" size={28} color={Colors.primary} />
              </View>
            </View>
            <Text style={styles.safetyTitle}>Thank you for being honest</Text>
            <Text style={styles.safetyBody}>
              Your response has been noted. You do not need to go through this alone.
            </Text>
            <Text style={[styles.safetyBody, { fontWeight: '600', color: Colors.textPrimary }]}>
              If you are in immediate distress, please reach out now:
            </Text>
            {[
              { flag: '🇺🇸', label: 'US', text: '988 Suicide & Crisis Lifeline — call or text 988' },
              { flag: '🇬🇧', label: 'UK', text: 'Samaritans — 116 123' },
              { flag: '💬', label: 'Text', text: 'Crisis Text Line — text HOME to 741741' },
              { flag: '🌍', label: 'Intl', text: 'findahelpline.com' },
            ].map((c, i) => (
              <View key={i} style={styles.crisisRow}>
                <Text style={styles.crisisFlag}>{c.flag}</Text>
                <Text style={styles.crisisLine}><Text style={styles.crisisLabel}>{c.label}: </Text>{c.text}</Text>
              </View>
            ))}
            <Pressable
              onPress={() => {
                setShowSafety(false);
                const nextIndex = currentIndex + 1;
                if (nextIndex < QUESTIONS.length) {
                  setCurrentIndex(nextIndex);
                  populateDraft(QUESTIONS[nextIndex], answers);
                } else {
                  handleSubmit(answers);
                }
              }}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: Colors.primary }, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Saving screen ─────────────────────────────────────────────────────────
  if (saving) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.savingContainer}>
          <View style={styles.savingIcon}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
          <Text style={styles.savingTitle}>Building your profile...</Text>
          <Text style={styles.savingSubtitle}>Creating your personal wellness persona for AI reports</Text>
        </View>
      </SafeAreaView>
    );
  }

  const showSectionHeader = currentIndex === 0 ||
    QUESTIONS[currentIndex].section !== QUESTIONS[currentIndex - 1].section;
  const completedPct = Math.round(progress);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.navBtn}>
          <MaterialIcons name="arrow-back" size={20} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.surveyName}>My Wellbeing Profile</Text>
          <Text style={styles.headerCounter}>{currentIndex + 1} / {QUESTIONS.length}</Text>
        </View>
        <Pressable onPress={() => router.replace('/(tabs)')} hitSlop={12} style={styles.navBtn}>
          <MaterialIcons name="close" size={20} color={Colors.textMuted} />
        </Pressable>
      </View>

      {/* Therapist mode banner */}
      {(isTherapistMode || isTherapistOnly) && (showSectionHeader || isTherapistOnly) && (question.therapistOnly || isTherapistOnly) ? (
        <View style={styles.therapistBanner}>
          <MaterialIcons name="psychology" size={14} color={Colors.secondary} />
          <Text style={styles.therapistBannerText}>
            {isTherapistOnly
              ? 'These answers are shared with your connected therapist'
              : 'These questions are shared with your connected therapist'}
          </Text>
        </View>
      ) : null}

      {/* Therapist-only mode intro banner */}
      {isTherapistOnly && currentIndex === 0 ? (
        <View style={[styles.therapistBanner, { backgroundColor: '#32D4C015', borderColor: '#32D4C040', marginHorizontal: 20, borderRadius: 12, borderWidth: 1, marginBottom: 0 }]}>
          <MaterialIcons name="assignment-turned-in" size={14} color="#32D4C0" />
          <Text style={[styles.therapistBannerText, { color: '#32D4C0' }]}>
            Your Wellbeing Profile is complete — these are the additional questions your therapist needs before your first session.
          </Text>
        </View>
      ) : null}

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${completedPct}%`, backgroundColor: question.sectionColor }]} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section badge */}
        {showSectionHeader ? (
          <View style={[styles.sectionBadge, { backgroundColor: question.sectionColor + '20', borderColor: question.sectionColor + '40' }]}>
            <Text style={styles.sectionEmoji}>{question.sectionEmoji}</Text>
            <Text style={[styles.sectionBadgeText, { color: question.sectionColor }]}>{question.section}</Text>
          </View>
        ) : null}

        {/* Normalize / context note */}
        {question.normalizeText ? (
          <View style={styles.noteBox}>
            <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.noteText}>{question.normalizeText}</Text>
          </View>
        ) : null}

        {/* Question */}
        <Text style={styles.questionText}>{question.text}</Text>

        {/* Single-select options */}
        {question.type === 'scale' ? (
          <View style={styles.optionsList}>
            {question.options.map((opt, i) => {
              const isSelected = currentAnswer === opt.value;
              return (
                <Pressable
                  key={i}
                  onPress={() => handleSelect(opt.value)}
                  style={({ pressed }) => [
                    styles.optionCard,
                    isSelected && [styles.optionCardSelected, {
                      borderColor: question.sectionColor,
                      backgroundColor: question.sectionColor + '15',
                    }],
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  {opt.emoji ? <Text style={styles.optionEmoji}>{opt.emoji}</Text> : null}
                  <Text style={[styles.optionLabel, isSelected && { color: Colors.textPrimary, fontWeight: '600' }]}>
                    {opt.label}
                  </Text>
                  {isSelected ? (
                    <View style={[styles.selectedCheck, { backgroundColor: question.sectionColor }]}>
                      <MaterialIcons name="check" size={12} color="#08091A" />
                    </View>
                  ) : (
                    <View style={styles.unselectedCircle} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Multi-select options */}
        {question.type === 'multiselect' ? (
          <View style={styles.optionsList}>
            <Text style={styles.multiHint}>Select all that apply</Text>
            {question.options.map((opt, i) => {
              const isSelected = multiSelectDraft.includes(opt.value);
              return (
                <Pressable
                  key={i}
                  onPress={() => handleToggleMulti(opt.value)}
                  style={({ pressed }) => [
                    styles.optionCard,
                    isSelected && [styles.optionCardSelected, { borderColor: question.sectionColor, backgroundColor: question.sectionColor + '15' }],
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  {opt.emoji ? <Text style={styles.optionEmoji}>{opt.emoji}</Text> : null}
                  <Text style={[styles.optionLabel, isSelected && { color: Colors.textPrimary, fontWeight: '600' }]}>
                    {opt.label}
                  </Text>
                  {isSelected ? (
                    <View style={[styles.checkBox, { backgroundColor: question.sectionColor, borderColor: question.sectionColor }]}>
                      <MaterialIcons name="check" size={12} color="#08091A" />
                    </View>
                  ) : (
                    <View style={styles.checkBox} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Privacy note */}
        <View style={styles.privacyRow}>
          <MaterialIcons name="lock" size={11} color={Colors.textMuted} />
          <Text style={styles.privacyText}>
            {isTherapistMode
              ? 'Base answers are private to you. Therapist section is shared with your connected therapist.'
              : 'Your answers are private and used only to personalise your AI reports.'}
          </Text>
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleNext}
          disabled={!hasAnswer()}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: question.sectionColor },
            !hasAnswer() && styles.primaryBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {isLast ? (isTherapistOnly ? 'Submit to therapist' : 'Complete my profile') : 'Next'}
          </Text>
          {!isLast ? <MaterialIcons name="arrow-forward" size={16} color="#08091A" style={{ marginLeft: 4 }} /> : null}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  navBtn: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  surveyName: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  headerCounter: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  therapistBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.secondary + '15', borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.secondary + '40', paddingHorizontal: Spacing.lg, paddingVertical: 8 },
  therapistBannerText: { flex: 1, fontSize: Typography.fontSizes.xs, color: Colors.secondary, fontWeight: '600', includeFontPadding: false },
  progressTrack: { height: 4, backgroundColor: Colors.border, marginHorizontal: Spacing.lg, borderRadius: Radius.full, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: Radius.full },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: 120, gap: Spacing.lg },
  sectionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1 },
  sectionEmoji: { fontSize: 14 },
  sectionBadgeText: { fontSize: Typography.fontSizes.xs, fontWeight: '700', includeFontPadding: false },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  noteText: { flex: 1, fontSize: Typography.fontSizes.xs, color: Colors.textSecondary, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
  questionText: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, lineHeight: 20 * 1.35, includeFontPadding: false },
  optionsList: { gap: Spacing.sm },
  multiHint: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, fontWeight: '600', includeFontPadding: false },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, paddingVertical: 14, paddingHorizontal: Spacing.lg, minHeight: 56 },
  optionCardSelected: { borderWidth: 2 },
  optionEmoji: { fontSize: 18, width: 24, textAlign: 'center' },
  optionLabel: { flex: 1, fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.4, includeFontPadding: false },
  selectedCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  unselectedCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.border, flexShrink: 0 },
  checkBox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: Spacing.sm },
  privacyText: { flex: 1, fontSize: 10, color: Colors.textMuted, includeFontPadding: false },
  footer: { padding: Spacing.lg, paddingBottom: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.lg, paddingVertical: 16, gap: 4 },
  primaryBtnDisabled: { opacity: 0.3 },
  primaryBtnText: { fontSize: Typography.fontSizes.md, fontWeight: '800', color: '#08091A', includeFontPadding: false },
  safetyScroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  safetyCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.lg, borderWidth: 1, borderColor: Colors.primary + '40' },
  safetyIconRow: { alignItems: 'center' },
  safetyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.primary + '40' },
  safetyTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', includeFontPadding: false },
  safetyBody: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.7, includeFontPadding: false },
  crisisRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: Colors.primarySoft, borderRadius: Radius.lg, padding: Spacing.md },
  crisisFlag: { fontSize: 16 },
  crisisLine: { flex: 1, fontSize: Typography.fontSizes.sm, color: Colors.textPrimary, lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
  crisisLabel: { fontWeight: '700', color: Colors.primary },
  savingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg, padding: Spacing.xl },
  savingIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.primary + '40' },
  savingTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', includeFontPadding: false },
  savingSubtitle: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false },
});
