/**
 * ThemeContext — dark/light mode with AsyncStorage persistence.
 * Provides `isDark`, `toggleTheme`, and a reactive `colors` object.
 * Also keeps the legacy `Colors` export in sync so existing components
 * that import directly from constants/theme.ts still render correctly.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkColors, LightColors, Colors, DarkGlass, LightGlass, Glass } from '@/constants/theme';

export type ColorPalette = typeof DarkColors;

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: ColorPalette;
  /** Increments on every toggle — use as `key` prop to force component remounts. */
  themeKey: number;
}

export const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
  colors: DarkColors,
  themeKey: 0,
});

const THEME_KEY = 'app_theme_preference';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  const [themeKey, setThemeKey] = useState(0);

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'light') {
        setIsDark(false);
        syncColors(false);
      }
    });
  }, []);

  // Keep the legacy mutable `Colors` and `Glass` in sync whenever theme changes
  function syncColors(dark: boolean) {
    const src = dark ? DarkColors : LightColors;
    Object.keys(src).forEach(k => {
      (Colors as any)[k] = (src as any)[k];
    });
    const gsrc = dark ? DarkGlass : LightGlass;
    Object.keys(gsrc).forEach(k => {
      (Glass as any)[k] = (gsrc as any)[k];
    });
  }

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      syncColors(next);
      AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      return next;
    });
    setThemeKey(k => k + 1);
  };

  // Keep Colors in sync on every render cycle as well
  syncColors(isDark);

  const colors: ColorPalette = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors, themeKey }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Convenience hook — returns the current palette (dark or light). */
export function useThemeColors(): ColorPalette {
  return useContext(ThemeContext).colors;
}
