/**
 * VibeButton — Primary action button with Liquid Glass styling.
 * Uses theme-aware colors and glass specular highlight on all variants.
 */
import React, { useMemo } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  View,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Radius, Typography, Spacing, getGlass } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

interface VibeButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function VibeButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: VibeButtonProps) {
  const { colors: C, isDark } = useTheme();
  const G = getGlass(isDark);

  const isGlass = variant === 'ghost' || variant === 'glass';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.base,
        variant === 'primary' && {
          backgroundColor: C.primary,
          shadowColor: C.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.40,
          shadowRadius: 12,
          elevation: 8,
        },
        variant === 'secondary' && {
          backgroundColor: G.cardBg,
          borderWidth: 1.5,
          borderColor: G.cardBorder,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.20,
          shadowRadius: 6,
          elevation: 4,
        },
        isGlass && {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: G.btnBorder,
        },
        (disabled || loading) && s.disabled,
        pressed && s.pressed,
        style,
      ]}
    >
      {/* Glass blur layer for secondary/ghost variants */}
      {(variant === 'secondary' || isGlass) && Platform.OS !== 'web' ? (
        <BlurView
          intensity={G.blurCard}
          tint={isDark ? 'dark' : 'light'}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* Glass tint overlay */}
      {(variant === 'secondary' || isGlass) ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: G.btnBg, borderRadius: Radius.full }]}
        />
      ) : null}

      {/* Specular top-edge highlight on all variants */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1.5,
          backgroundColor: G.specularTop,
          borderTopLeftRadius: Radius.full,
          borderTopRightRadius: Radius.full,
          opacity: variant === 'primary' ? 0.45 : 0.60,
        }}
      />

      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#000' : C.primary}
        />
      ) : (
        <Text
          style={[
            s.label,
            variant === 'primary' && { color: '#08091A' },
            variant === 'secondary' && { color: C.textPrimary },
            isGlass && { color: C.textSecondary },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.975 }],
  },
  label: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.semibold as any,
    includeFontPadding: false,
    position: 'relative',
  },
});
