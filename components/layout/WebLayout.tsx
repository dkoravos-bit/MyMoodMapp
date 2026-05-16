/**
 * WebLayout — responsive desktop layout for web
 *
 * On desktop (≥1024px): renders a fixed left sidebar + main content area
 * On mobile/tablet: transparent pass-through (bottom tabs handle nav)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { DarkColors, Typography, Spacing, Radius } from '@/constants/theme';
import { useAuth } from '@/template';

export const WEB_SIDEBAR_WIDTH = 220;
export const WEB_MAX_CONTENT_WIDTH = 960;
export const WEB_DESKTOP_BREAKPOINT = 1024;

function useDimensions() {
  const [w, setW] = useState(() => Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setW(window.width));
    return () => sub?.remove();
  }, []);
  return w;
}

export function useIsDesktopWeb() {
  const w = useDimensions();
  return Platform.OS === 'web' && w >= WEB_DESKTOP_BREAKPOINT;
}

const NAV_ITEMS = [
  { route: '/(tabs)', label: 'Dashboard', icon: 'home' },
  { route: '/(tabs)/checkin', label: 'Log', icon: 'add-circle' },
  { route: '/(tabs)/insights', label: 'Patterns', icon: 'bar-chart' },
  { route: '/(tabs)/sound-lab', label: 'Mood Lab', icon: 'waves' },
  { route: '/(tabs)/mapp', label: 'Mapp', icon: 'explore' },
  { route: '/(tabs)/profile', label: 'Me', icon: 'person-outline' },
  // Cycle tracker is a dashboard widget — accessible via home screen
] as const;

function makeStyles(C: typeof DarkColors) {
  return StyleSheet.create({
    sidebar: {
      position: 'fixed' as any,
      top: 0,
      left: 0,
      bottom: 0,
      width: WEB_SIDEBAR_WIDTH,
      backgroundColor: C.surface,
      borderRightWidth: 1,
      borderRightColor: C.border,
      flexDirection: 'column',
      zIndex: 100,
    },
    sidebarBrand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    brandLogo: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: C.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.primary + '40',
    },
    brandName: {
      fontSize: Typography.fontSizes.md,
      fontWeight: '800',
      color: C.textPrimary,
      includeFontPadding: false,
    },
    navList: {
      flex: 1,
      paddingTop: Spacing.md,
      paddingHorizontal: Spacing.sm,
      gap: 4,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      borderRadius: Radius.lg,
      minHeight: 44,
    },
    navItemActive: {
      backgroundColor: C.primarySoft,
    },
    navLabel: {
      fontSize: Typography.fontSizes.sm,
      fontWeight: '500',
      color: C.textMuted,
      includeFontPadding: false,
    },
    navLabelActive: {
      color: C.primary,
      fontWeight: '700',
    },
    sidebarFooter: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
      borderTopWidth: 1,
      borderTopColor: C.border,
      gap: Spacing.sm,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    userAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: C.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.primary + '40',
    },
    userAvatarText: {
      fontSize: 13,
      fontWeight: '800',
      color: C.primary,
      includeFontPadding: false,
    },
    userName: {
      flex: 1,
      fontSize: Typography.fontSizes.xs,
      fontWeight: '600',
      color: C.textSecondary,
      includeFontPadding: false,
    },
    mainContent: {
      marginLeft: WEB_SIDEBAR_WIDTH,
      flex: 1,
      minHeight: '100vh' as any,
    },
  });
}

interface WebSidebarProps {
  children: React.ReactNode;
}

export function WebSidebar({ children }: WebSidebarProps) {
  const { colors: C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const isDesktop = useIsDesktopWeb();

  if (!isDesktop) return <>{children}</>;

  const isActive = (route: string) => {
    if (route === '/(tabs)') return pathname === '/' || pathname === '/index' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
    return pathname.includes(route.replace('/(tabs)', ''));
  };

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {/* Fixed sidebar */}
      <View style={styles.sidebar}>
        {/* Brand */}
        <View style={styles.sidebarBrand}>
          <View style={styles.brandLogo}>
            <MaterialIcons name="mood" size={18} color={C.primary} />
          </View>
          <Text style={styles.brandName}>MyMoodMapp</Text>
        </View>

        {/* Navigation */}
        <ScrollView contentContainerStyle={styles.navList} showsVerticalScrollIndicator={false}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.route);
            return (
              <Pressable
                key={item.route}
                onPress={() => router.push(item.route as any)}
                style={({ pressed }) => [
                  styles.navItem,
                  active && styles.navItemActive,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <MaterialIcons
                  name={item.icon as any}
                  size={20}
                  color={active ? C.primary : C.textMuted}
                />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {item.label}
                </Text>
                {active ? (
                  <View style={{ marginLeft: 'auto' as any, width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary }} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* User footer */}
        {user ? (
          <View style={styles.sidebarFooter}>
            <Pressable
              onPress={() => router.push('/(tabs)/profile' as any)}
              style={({ pressed }) => [styles.userRow, pressed && { opacity: 0.75 }]}
            >
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {(user.username ?? user.email ?? 'U')[0].toUpperCase()}
                </Text>
              </View>
              <Text style={styles.userName} numberOfLines={1}>
                {user.username ?? user.email?.split('@')[0] ?? 'User'}
              </Text>
              <MaterialIcons name="settings" size={16} color={C.textMuted} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Main content area (offset by sidebar) */}
      <View style={styles.mainContent}>{children}</View>
    </View>
  );
}

/**
 * Wraps screen content with a max-width container on desktop web.
 * Use inside SafeAreaView's scroll content.
 */
export function WebMaxWidth({ children, style }: { children: React.ReactNode; style?: any }) {
  const isDesktop = useIsDesktopWeb();
  if (!isDesktop) return <>{children}</>;
  return (
    <View style={[{ width: '100%', alignSelf: 'center', maxWidth: WEB_MAX_CONTENT_WIDTH }, style]}>
      {children}
    </View>
  );
}
