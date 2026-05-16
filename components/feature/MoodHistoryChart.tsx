import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MoodEntry } from '@/services/storage';
import { MOODS } from '@/constants/archetypes';
import { Colors, Typography, Radius, Spacing } from '@/constants/theme';

interface MoodHistoryChartProps {
  log: MoodEntry[];
  limit?: number;
}

export function MoodHistoryChart({ log, limit = 14 }: MoodHistoryChartProps) {
  const recent = log.slice(0, limit).reverse();

  if (recent.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No check-ins yet. Start today.</Text>
      </View>
    );
  }

  const getMoodColor = (moodId: string) => {
    return MOODS.find(m => m.id === moodId)?.color || Colors.textMuted;
  };

  const getMoodEmoji = (moodId: string) => {
    return MOODS.find(m => m.id === moodId)?.emoji || '😐';
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {recent.map((entry) => (
        <View key={entry.id} style={styles.dayCol}>
          <Text style={styles.emoji}>{getMoodEmoji(entry.mood)}</Text>
          <View style={[styles.dot, { backgroundColor: getMoodColor(entry.mood) }]} />
          <Text style={styles.date}>{entry.date.slice(5)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    alignItems: 'center',
  },
  dayCol: {
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 36,
  },
  emoji: {
    fontSize: Typography.fontSizes.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  date: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    includeFontPadding: false,
  },
  empty: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textMuted,
    includeFontPadding: false,
  },
});
