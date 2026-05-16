// Vibe — Design Tokens

// ── Dark palette (default) ───────────────────────────────────────────────────
export const DarkColors = {
  // Base
  background: '#000000',
  surface: '#0D0E22',
  surfaceElevated: '#161840',
  border: '#1E2155',

  // Brand
  primary: '#F5A623',       // Amber gold
  primarySoft: '#F5A62320',
  secondary: '#5B6FFF',     // Indigo accent
  secondarySoft: '#5B6FFF20',

  // Text
  textPrimary: '#F0F0FF',
  textSecondary: '#8A8EBF',
  textMuted: '#4A4E7A',

  // Semantic
  success: '#4ECDC4',
  successSoft: '#4ECDC420',
  warning: '#FFD166',
  error: '#FF6B6B',
  errorSoft: '#FF6B6B20',

  // Moods
  moods: {
    joyful: '#FFD166',
    calm: '#4ECDC4',
    anxious: '#FF6B6B',
    excited: '#F5A623',
    melancholy: '#5B6FFF',
    neutral: '#8A8EBF',
    grateful: '#95E06C',
    frustrated: '#FF8C42',
  },
};

// ── Light palette ─────────────────────────────────────────────────────────────
export const LightColors = {
  // Base
  background: '#FFFFFF',
  surface: '#F5F5FA',
  surfaceElevated: '#EBEBF0',
  border: '#D4D4E8',

  // Brand (same — brand identity doesn't change)
  primary: '#E8920A',
  primarySoft: '#E8920A20',
  secondary: '#4A5FEF',
  secondarySoft: '#4A5FEF20',

  // Text
  textPrimary: '#0A0B1E',
  textSecondary: '#3A3D6A',
  textMuted: '#7A7EA8',

  // Semantic
  success: '#2BA89E',
  successSoft: '#2BA89E20',
  warning: '#C9A020',
  error: '#D94F4F',
  errorSoft: '#D94F4F20',

  // Moods
  moods: {
    joyful: '#C9A020',
    calm: '#2BA89E',
    anxious: '#D94F4F',
    excited: '#E8920A',
    melancholy: '#4A5FEF',
    neutral: '#6A6E9A',
    grateful: '#5EAA28',
    frustrated: '#CC6020',
  },
};

// ── Active Colors export (overridden by ThemeContext at runtime) ──────────────
// This is a STANDALONE mutable object — NOT an alias for DarkColors.
// ThemeContext copies values into it on every toggle so that components
// which import Colors directly always read the current palette after a remount.
export const Colors: typeof DarkColors = { ...DarkColors };

export const Typography = {
  fontSizes: {
    // Apple HIG-aligned scale
    // Minimum: 12pt (Caption), Body: 17pt, Subhead: 15pt, Footnote: 13pt
    xs: 15,   // was 14 → Subhead / secondary labels (min comfortable reading)
    sm: 17,   // was 16 → Body text (Apple recommended body size)
    md: 19,   // was 18 → Callout / card titles
    lg: 21,   // was 20 → Title 3
    xl: 23,   // was 22 → Title 2 variant
    '2xl': 28, // was 26 → Title 1
    '3xl': 34, // was 32 → Large Title
    '4xl': 42, // was 40 → Display
  },
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    tight: 1.3,
    normal: 1.6,
    relaxed: 1.8,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// ── Liquid Glass tokens ──────────────────────────────────────────────────────
// Two palettes: DarkGlass and LightGlass. Use getGlass(isDark) in components
// so the design adapts correctly to both themes.
// The legacy `Glass` export is kept in sync by ThemeContext for backward compat.

// ── Glow shadows — match the "This Week" amber/gold reference card ────────────
export const GlowShadows = {
  amber:  { shadowColor: '#F5A623', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },
  teal:   { shadowColor: '#4ECDC4', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 8  },
  indigo: { shadowColor: '#5B6FFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.30, shadowRadius: 14, elevation: 8  },
  soft:   { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8  },
};

/** Returns a color-tinted glow shadow object for any hex color */
export function getColorGlow(color: string, opacity = 0.35, radius = 16) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: Math.round(radius * 0.6),
  };
}

export const DarkGlass = {
  // Card background: semi-transparent surface with frosted inner
  cardBg:          'rgba(255,255,255,0.07)',
  cardBgLight:     'rgba(255,255,255,0.04)',
  cardBorder:      'rgba(255,255,255,0.15)',
  cardBorderLight: 'rgba(255,255,255,0.08)',
  // Glow borders — amber/teal/indigo accents matching reference card
  cardBorderGlow:   'rgba(245,166,35,0.40)',
  cardBorderTeal:   'rgba(78,205,196,0.38)',
  cardBorderIndigo: 'rgba(91,111,255,0.38)',

  // Navigation bar: subtle dark tint so content shows through
  navBg:           'rgba(14,15,32,0.72)',
  navBorder:       'rgba(255,255,255,0.14)',

  // Button / pill: translucent tinted
  btnBg:           'rgba(255,255,255,0.10)',
  btnBorder:       'rgba(255,255,255,0.22)',

  // Specular: top-edge white highlight that gives the "glass" look
  specularTop:     'rgba(255,255,255,0.30)',
  specularBottom:  'rgba(255,255,255,0.00)',

  // Score sphere
  sphereBg:        'rgba(255,255,255,0.09)',
  sphereBorder:    'rgba(255,255,255,0.25)',
  sphereSpecular:  'rgba(255,255,255,0.45)',

  // Modal / sheet overlay
  modalBg:         'rgba(6,7,20,0.70)',
  modalSurface:    'rgba(255,255,255,0.06)',
  modalBorder:     'rgba(255,255,255,0.14)',

  // Blur intensities — used as tint/intensity on expo-blur BlurView
  blurCard:        18,
  blurNav:         32,
  blurModal:       28,
  blurSphere:      20,
};

export const LightGlass = {
  // Card background: very subtle dark-on-light translucent panels
  cardBg:          'rgba(0,0,0,0.04)',
  cardBgLight:     'rgba(0,0,0,0.025)',
  cardBorder:      'rgba(0,0,0,0.10)',
  cardBorderLight: 'rgba(0,0,0,0.06)',
  // Glow borders for light mode
  cardBorderGlow:   'rgba(232,146,10,0.45)',
  cardBorderTeal:   'rgba(43,168,158,0.40)',
  cardBorderIndigo: 'rgba(74,95,239,0.40)',

  // Navigation bar: white-tinted frosted panel
  navBg:           'rgba(245,245,250,0.80)',
  navBorder:       'rgba(0,0,0,0.08)',

  // Button / pill
  btnBg:           'rgba(0,0,0,0.05)',
  btnBorder:       'rgba(0,0,0,0.12)',

  // Specular: bright top-edge highlight still works on light glass
  specularTop:     'rgba(255,255,255,0.85)',
  specularBottom:  'rgba(255,255,255,0.00)',

  // Score sphere
  sphereBg:        'rgba(0,0,0,0.04)',
  sphereBorder:    'rgba(0,0,0,0.12)',
  sphereSpecular:  'rgba(255,255,255,0.75)',

  // Modal / sheet overlay
  modalBg:         'rgba(0,0,0,0.35)',
  modalSurface:    'rgba(255,255,255,0.85)',
  modalBorder:     'rgba(0,0,0,0.10)',

  // Blur intensities (slightly higher for light mode clarity)
  blurCard:        20,
  blurNav:         36,
  blurModal:       30,
  blurSphere:      22,
};

/** Returns the correct Glass palette for the current theme. */
export function getGlass(isDark: boolean): typeof DarkGlass {
  return isDark ? DarkGlass : LightGlass;
}

/**
 * Legacy mutable Glass export — kept in sync by ThemeContext.
 * Prefer getGlass(isDark) wherever useTheme() is available.
 */
export const Glass: typeof DarkGlass = { ...DarkGlass };

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  glow: {
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
};
