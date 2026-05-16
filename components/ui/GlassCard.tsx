/**
 * GlassCard — iOS 26 Liquid Glass effect for React Native
 *
 * Theme-aware: automatically uses DarkGlass or LightGlass based on the
 * current theme so the frosted-glass aesthetic works in both dark and light mode.
 *
 * Props:
 *   intensity    — blur strength override
 *   style        — container style override
 *   innerStyle   — style applied to the inner content wrapper
 *   specular     — show top-edge specular highlight (default: true)
 *   variant      — 'card' (default) | 'nav' | 'sphere' | 'modal' | 'button'
 *   glowColor    — optional hex color to add an outer glow shadow (e.g. '#F5A623')
 *   glowOpacity  — glow shadow opacity (default: 0.35)
 *   children     — anything
 */

import React from 'react';
import { View, ViewStyle, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Radius, getColorGlow } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { getGlass } from '@/constants/theme';

type GlassVariant = 'card' | 'nav' | 'sphere' | 'modal' | 'button';

interface GlassCardProps {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  innerStyle?: ViewStyle | ViewStyle[];
  intensity?: number;
  specular?: boolean;
  variant?: GlassVariant;
  borderRadius?: number;
  /** Optional hex color for outer glow border shadow (e.g. '#F5A623' for amber/gold) */
  glowColor?: string;
  /** Glow shadow opacity — default 0.35 */
  glowOpacity?: number;
}

function getVariantDefaults(variant: GlassVariant, isDark: boolean) {
  const G = getGlass(isDark);
  const map = {
    card: {
      bg: G.cardBg, border: G.cardBorder,
      borderWidth: 1, borderRadius: Radius.xl, intensity: G.blurCard,
    },
    nav: {
      bg: G.navBg, border: G.navBorder,
      borderWidth: 1, borderRadius: 0, intensity: G.blurNav,
    },
    sphere: {
      bg: G.sphereBg, border: G.sphereBorder,
      borderWidth: 2, borderRadius: 9999, intensity: G.blurSphere,
    },
    modal: {
      bg: G.modalSurface, border: G.modalBorder,
      borderWidth: 1, borderRadius: Radius.xl, intensity: G.blurModal,
    },
    button: {
      bg: G.btnBg, border: G.btnBorder,
      borderWidth: 1.5, borderRadius: Radius.full, intensity: 16,
    },
  };
  return map[variant];
}

export function GlassCard({
  children,
  style,
  innerStyle,
  intensity,
  specular = true,
  variant = 'card',
  borderRadius,
  glowColor,
  glowOpacity = 0.35,
}: GlassCardProps) {
  const { isDark } = useTheme();
  const G = getGlass(isDark);
  const def  = getVariantDefaults(variant, isDark);
  const blur = intensity ?? def.intensity;
  const br   = borderRadius ?? def.borderRadius;

  // If a glow color is provided, attach the glow shadow to the outer wrapper
  const glowStyle: ViewStyle = glowColor
    ? getColorGlow(glowColor, glowOpacity, 16) as ViewStyle
    : {};

  const containerStyle: ViewStyle = {
    borderRadius: br,
    borderWidth: def.borderWidth,
    borderColor: glowColor ? (glowColor + '60') : def.border,
    overflow: 'hidden',
  };

  const specularView = specular ? (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1.5,
        backgroundColor: G.specularTop,
        borderTopLeftRadius: br,
        borderTopRightRadius: br,
        opacity: 0.65,
      }}
    />
  ) : null;

  // Web: BlurView is unsupported — use rgba fallback
  if (Platform.OS === 'web') {
    return (
      <View style={[glowStyle, containerStyle, { backgroundColor: def.bg }, StyleSheet.flatten(style)]}>
        {specularView}
        <View style={innerStyle}>{children}</View>
      </View>
    );
  }

  // Native: real BlurView frosted glass
  return (
    <View style={[glowStyle, containerStyle, StyleSheet.flatten(style)]}>
      <BlurView
        intensity={blur}
        tint={isDark ? 'dark' : 'light'}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      {/* Tint layer on top of blur */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: def.bg }]}
      />
      {specularView}
      <View style={innerStyle}>{children}</View>
    </View>
  );
}

/**
 * GlassButton — pill-shaped glass button with specular highlight.
 */
import { Pressable, PressableProps } from 'react-native';

interface GlassButtonProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  active?: boolean;
  activeColor?: string;
}

export function GlassButton({ children, style, active, activeColor, ...rest }: GlassButtonProps) {
  const { isDark } = useTheme();
  const G = getGlass(isDark);

  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        {
          borderRadius: Radius.full,
          borderWidth: 1.5,
          borderColor: active ? (activeColor ?? (isDark ? '#fff' : '#000')) : G.btnBorder,
          overflow: 'hidden',
          opacity: pressed ? 0.75 : 1,
          // Subtle glow when active
          ...(active && activeColor ? getColorGlow(activeColor, 0.25, 10) : {}),
        },
        StyleSheet.flatten(style),
      ]}
    >
      {Platform.OS !== 'web' ? (
        <BlurView
          intensity={16}
          tint={isDark ? 'dark' : 'light'}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: active ? (activeColor ? activeColor + '25' : G.btnBg) : G.btnBg },
        ]}
      />
      {/* Top-edge specular */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1.5,
          backgroundColor: G.specularTop,
          opacity: 0.5,
        }}
      />
      <View style={{ position: 'relative' }}>{children}</View>
    </Pressable>
  );
}

/**
 * GlassSphere — frosted score bubble with subtle inner glow.
 * Used on dashboard PeriodScorePanel and in check-in screens.
 */
import { Text } from 'react-native';

interface GlassSphereProps {
  size: number;
  color: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function GlassSphere({ size, color, children, style }: GlassSphereProps) {
  const { isDark } = useTheme();
  const br = size / 2;

  return (
    <View
      style={[
        {
          width: size, height: size,
          borderRadius: br,
          borderWidth: 2.5,
          borderColor: color + '60',
          backgroundColor: color + (isDark ? '14' : '10'),
          alignItems: 'center',
          justifyContent: 'center',
          // Colored glow matching the sphere's accent
          ...getColorGlow(color, isDark ? 0.30 : 0.18, 14),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type ScoreBubbleSize = 'small' | 'medium' | 'large';

const SCORE_AMBER = '#F59E0B';

const BUBBLE_DIMS: Record<ScoreBubbleSize, {
  size: number; borderWidth: number; emoji: number; num: number; label: number;
}> = {
  small:  { size: 68,  borderWidth: 0.6, emoji: 18, num: 18, label: 9  },
  medium: { size: 76,  borderWidth: 0.6, emoji: 21, num: 22, label: 9  },
  large:  { size: 88,  borderWidth: 0.8, emoji: 26, num: 28, label: 11 },
};

interface ScoreBubbleProps {
  score: number;
  emoji: string;
  label: string;
  size?: ScoreBubbleSize;
  color?: string;
  style?: ViewStyle;
}

/**
 * ScoreBubble — canonical glowing amber/gold orb.
 *
 * CRITICAL FIX: iOS only renders shadows on Views that have a non-transparent
 * backgroundColor. Ghost rings (transparent bg) never showed a shadow on iOS,
 * which is why the glow was missing.
 *
 * The correct approach: put ALL shadow directly on the orb View which has
 * backgroundColor:'rgba(12,8,1,0.96)' — iOS can cast a shadow from this.
 * Three shadow passes are applied to the same view via a trick of wrapping
 * in a parent that also carries shadows, giving us multi-layer depth.
 *
 * Web uses CSS box-shadow with multiple stops.
 */
export function ScoreBubble({ score, emoji, label, size = 'medium', style }: ScoreBubbleProps) {
  const { isDark } = useTheme();
  const d = BUBBLE_DIMS[size];
  const br = d.size / 2;

  // Interior bg: dark mode = semi-transparent dark indigo (matches dark card surface)
  //              light mode = semi-transparent white/cream (matches light card surface)
  const orbBg = isDark ? 'rgba(14,12,28,0.82)' : 'rgba(255,255,255,0.78)';

  // Web: thin border + tight contained amber glow matching Photo 1
  const webShadow: any = Platform.OS === 'web' ? {
    boxShadow: [
      `0 0 0 ${d.borderWidth}px ${SCORE_AMBER}`,
      `0 0 4px  2px  rgba(245,158,11,0.70)`,
      `0 0 10px 4px  rgba(245,158,11,0.30)`,
      `0 0 18px 6px  rgba(245,158,11,0.10)`,
    ].join(', '),
  } : {};

  return (
    // Wrapper = exact orb size for layout; overflow:visible lets glow bleed out
    // without pushing sibling elements
    <View
      style={[
        {
          width: d.size,
          height: d.size,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          // Outer halo wrapper — very subtle, just a faint ambient bleed
          ...(Platform.OS !== 'web' ? {
            shadowColor: SCORE_AMBER,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.18,
            shadowRadius: 6,
          } : {}),
        },
        style,
      ]}
    >
      {/* The orb — solid bg so iOS shadow renders correctly */}
      <View
        style={[
          {
            width: d.size,
            height: d.size,
            borderRadius: br,
            borderWidth: d.borderWidth,
            borderColor: SCORE_AMBER,
            backgroundColor: orbBg,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
            // Edge glow on the border — tight, matches Photo 1
            ...(Platform.OS !== 'web' ? {
              shadowColor: SCORE_AMBER,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.40,
              shadowRadius: 3,
              elevation: 4,
            } : {}),
          },
          webShadow,
        ]}
      >
        {/* Inner clipping layer — only clips the glass reflection, not the shadow */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: d.size,
            height: d.size,
            borderRadius: br,
            overflow: 'hidden',
          }}
        >
          {/* Glass lens reflection — rounded oval upper-left for 3D depth */}
          <View
            style={{
              position: 'absolute',
              top: d.size * 0.10,
              left: d.size * 0.07,
              width: d.size * 0.44,
              height: d.size * 0.20,
              borderRadius: d.size * 0.11,
              backgroundColor: isDark ? 'rgba(210,210,210,0.22)' : 'rgba(255,255,255,0.55)',
              transform: [{ rotate: '-15deg' }],
            }}
          />
        </View>

        {/* Score content */}
        <Text style={{ fontSize: d.emoji, lineHeight: d.emoji * 1.1 } as any}>{emoji}</Text>
        <Text
          style={{
            fontSize: d.num,
            fontWeight: '900',
            color: SCORE_AMBER,
            includeFontPadding: false,
            marginTop: -2,
          } as any}
        >
          {score}
        </Text>
        <Text
          style={{
            fontSize: d.label,
            fontWeight: '700',
            color: 'rgba(255, 228, 140, 0.85)',
            includeFontPadding: false,
          } as any}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
