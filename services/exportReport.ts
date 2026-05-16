/**
 * Export service — generates CSV and plain-text wellness reports
 * for sharing with a therapist. PDF export uses a shareable link
 * (in-app generated summary). Actual PDF rendering is handled
 * server-side via the generate-insights edge function output.
 */

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { MoodLogEntry } from '@/constants/moodlog';
import { DailyFitnessEntry, summarizeFitnessData, getDateRangeFitness } from './fitness';
import { WellnessInsights } from './insights';
import { CONTEXT_TAGS } from '@/constants/moodlog';

// ─── CSV Export ───────────────────────────────────────────────────────────────

export async function exportMoodCSV(entries: MoodLogEntry[]): Promise<void> {
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const header = 'Date,Time,Score,Body,Mind,Energy,Focus,Primary Tag,Additional Tags,Journal,Transcript\n';
  const rows = sorted.map(e => {
    const tag = CONTEXT_TAGS.find(t => t.id === e.primaryTag)?.label ?? e.primaryTag;
    const additionalLabels = (e.additionalTags ?? [])
      .map(id => CONTEXT_TAGS.find(t => t.id === id)?.label ?? id)
      .join('; ');
    const body = Math.round(((e.dimensions.body + 1) / 2) * 100);
    const mind = Math.round(((e.dimensions.mind + 1) / 2) * 100);
    const energy = Math.round(e.dimensions.energy * 100);
    const focus = Math.round(e.dimensions.focus * 100);
    const journal = ((e as any).journalText ?? e.note ?? '').replace(/"/g, '""');
    const transcript = ((e as any).transcript ?? '').replace(/"/g, '""');
    return `"${e.date}","${e.time}",${e.score},${body},${mind},${energy},${focus},"${tag}","${additionalLabels}","${journal}","${transcript}"`;
  });

  const csv = header + rows.join('\n');
  const fileName = `moodlog_export_${new Date().toISOString().split('T')[0]}.csv`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Share MoodLog Data',
      UTI: 'public.comma-separated-values-text',
    });
  }
}

// ─── Text/PDF Report ──────────────────────────────────────────────────────────

export async function exportWellnessReport(
  entries: MoodLogEntry[],
  fitnessData: DailyFitnessEntry[],
  insights: WellnessInsights | null,
  userName: string = 'Client',
  period: number = 30,
): Promise<void> {
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const recentEntries = sorted.filter(e => {
    const cutoff = new Date(Date.now() - period * 86400000).toISOString().split('T')[0];
    return e.date >= cutoff;
  });

  const avgScore = recentEntries.length
    ? Math.round(recentEntries.reduce((s, e) => s + e.score, 0) / recentEntries.length)
    : null;

  const fitSummary = summarizeFitnessData(getDateRangeFitness(fitnessData, period));

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  let report = `MOODLOG WELLNESS REPORT
Generated: ${today}
Client: ${userName}
Period: Last ${period} days
${'='.repeat(52)}

OVERVIEW
--------
Total check-ins: ${recentEntries.length}
Average wellness score: ${avgScore !== null ? `${avgScore}/100` : 'Insufficient data'}
Unique days logged: ${new Set(recentEntries.map(e => e.date)).size} of ${period} days

`;

  if (insights) {
    report += `AI WELLNESS SUMMARY
-------------------
${insights.headline}

Mood: ${insights.moodInsight}

Body & Fitness: ${insights.fitnessInsight}

${insights.sleepInsight ? `Sleep: ${insights.sleepInsight}\n\n` : ''}`;

    if (insights.actionableAdvice?.length) {
      report += `CLINICAL ACTION ITEMS\n${'─'.repeat(22)}\n`;
      insights.actionableAdvice.forEach((a, i) => {
        report += `${i + 1}. ${a}\n`;
      });
      report += '\n';
    }

    if (insights.correlations?.length) {
      report += `KEY CORRELATIONS\n${'─'.repeat(16)}\n`;
      insights.correlations.forEach(c => {
        report += `• ${c.finding} [${c.confidence} confidence]\n`;
      });
      report += '\n';
    }
  }

  report += `PHYSICAL DATA\n${'─'.repeat(13)}\n`;
  report += `Avg daily steps: ${fitSummary.avgDailySteps.toLocaleString()}\n`;
  if (fitSummary.avgSleepHours) report += `Avg sleep: ${fitSummary.avgSleepHours}h/night\n`;
  if (fitSummary.avgRestingHR) report += `Avg resting HR: ${fitSummary.avgRestingHR} bpm\n`;
  report += `High activity days: ${fitSummary.highExerciseDays} of ${period}\n\n`;

  report += `DAILY LOG\n${'─'.repeat(9)}\n`;
  recentEntries.slice(-30).forEach(e => {
    const tag = CONTEXT_TAGS.find(t => t.id === e.primaryTag)?.label ?? e.primaryTag;
    const journal = (e as any).journalText ?? e.note ?? '';
    report += `\n${e.date} ${e.time}  Score: ${e.score}  [${tag}]\n`;
    if (journal) report += `  "${journal.slice(0, 200)}${journal.length > 200 ? '...' : ''}"\n`;
  });

  report += `\n${'='.repeat(52)}\nThis report was generated by MoodLog. All data is client-provided and self-reported.\n`;

  const fileName = `moodlog_report_${new Date().toISOString().split('T')[0]}.txt`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, report, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/plain',
      dialogTitle: 'Share Wellness Report',
    });
  }
}
