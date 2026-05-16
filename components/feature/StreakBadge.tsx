import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Radius, Spacing } from '@/constants/theme';

interface StreakBadgeProps {
  current: number;
  longest: number;
}

export function StreakBadge({ current, longest }: StreakBadgeProps) {
  return (
    <View style={styles.container}>
      <View style={styles.item}>
        <MaterialIcons name="local-fire-department" size={20} color={Colors.primary} />
        <Text style={styles.count}>{current}</Text>
        <Text style={styles.label}>day streak</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.item}>
        <MaterialIcons name="emoji-events" size={20} color={Colors.warning} />
        <Text style={styles.count}>{longest}</Text>
        <Text style={styles.label}>best</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  count: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    includeFontPadding: false,
  },
  label: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    includeFontPadding: false,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
});
