import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Typography, Spacing } from '@/constants/theme';

interface MoodPillProps {
  emoji: string;
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export function MoodPill({ emoji, label, color, selected, onPress, style }: MoodPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected && { backgroundColor: color + '30', borderColor: color },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, selected && { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.xs,
    minHeight: 44,
  },
  emoji: {
    fontSize: Typography.fontSizes.lg,
  },
  label: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textSecondary,
    includeFontPadding: false,
  },
  pressed: {
    opacity: 0.75,
  },
});
