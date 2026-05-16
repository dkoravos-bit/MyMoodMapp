import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Archetype } from '@/constants/archetypes';
import { Colors, Typography, Radius, Spacing, Shadows } from '@/constants/theme';

interface ArchetypeCardProps {
  archetype: Archetype;
  compact?: boolean;
}

export function ArchetypeCard({ archetype, compact = false }: ArchetypeCardProps) {
  return (
    <View style={[styles.card, compact && styles.compact, Shadows.md]}>
      <Image
        source={require('@/assets/images/archetype-card-bg.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.overlay} />
      <View style={styles.content}>
        <Text style={[styles.emoji, compact && styles.emojiCompact]}>{archetype.emoji}</Text>
        <Text style={[styles.name, compact && styles.nameCompact]}>{archetype.name}</Text>
        <Text style={[styles.tagline, compact && styles.taglineCompact]}>{archetype.tagline}</Text>
        {!compact ? (
          <>
            <Text style={styles.description}>{archetype.description}</Text>
            <View style={styles.traits}>
              {archetype.traits.map(t => (
                <View key={t} style={[styles.traitPill, { borderColor: archetype.color }]}>
                  <Text style={[styles.traitText, { color: archetype.color }]}>{t}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    minHeight: 240,
  },
  compact: {
    minHeight: 120,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,9,26,0.65)',
  },
  content: {
    padding: Spacing.lg,
    flex: 1,
    justifyContent: 'flex-end',
  },
  emoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emojiCompact: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  name: {
    fontSize: Typography.fontSizes['2xl'],
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    includeFontPadding: false,
  },
  nameCompact: {
    fontSize: Typography.fontSizes.lg,
  },
  tagline: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    includeFontPadding: false,
  },
  taglineCompact: {
    fontSize: Typography.fontSizes.sm,
    marginBottom: 0,
  },
  description: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSizes.md * Typography.lineHeights.relaxed,
    marginBottom: Spacing.lg,
    includeFontPadding: false,
  },
  traits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  traitPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  traitText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    includeFontPadding: false,
  },
});
