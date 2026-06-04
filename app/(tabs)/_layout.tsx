import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { WebSidebar, useIsDesktopWeb } from '@/components/layout/WebLayout';
import { BlurView } from 'expo-blur';
import { getGlass } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors: C, isDark } = useTheme();
  const isDesktop = useIsDesktopWeb();

  const G = getGlass(isDark);

  const tabBarStyle = isDesktop ? { display: 'none' as const } : {
    height: Platform.select({
      ios: insets.bottom + 60,
      android: insets.bottom + 60,
      default: 70,
    }),
    paddingTop: 8,
    paddingBottom: Platform.select({
      ios: insets.bottom + 8,
      android: insets.bottom + 8,
      default: 8,
    }),
    paddingHorizontal: 16,
    // Glass nav bar: transparent background — blur rendered via tabBarBackground
    backgroundColor: Platform.OS === 'web' ? G.navBg : 'transparent',
    borderTopWidth: 1,
    borderTopColor: G.navBorder,
    // Remove any default shadow so glass effect shines through
    elevation: 0,
  };

  return (
    <WebSidebar>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle,
          tabBarActiveTintColor: C.primary,
          // On web dark mode textMuted (#4A4E7A) is too dark against the nav background.
          // Use a lighter value so labels and icons are readable on all platforms.
          tabBarInactiveTintColor: Platform.OS === 'web'
            ? (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)')
            : C.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
          },
          // Liquid Glass nav bar background — BlurView on native, css on web
          tabBarBackground: Platform.OS !== 'web' ? () => (
            <View style={{ flex: 1, overflow: 'hidden' }}>
              <BlurView
                intensity={G.blurNav}
                tint={isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
                experimentalBlurMethod="dimezisBlurView"
                style={{ flex: 1 }}
              />
              {/* Tint overlay — lighter touch so blur shows through */}
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: G.navBg, opacity: isDark ? 0.55 : 0.7 },
                ]}
              />
              {/* Top-edge specular line */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: 1,
                  backgroundColor: G.specularTop,
                  opacity: isDark ? 0.55 : 0.8,
                }}
              />
            </View>
          ) : undefined,
        }}
      >
        {/* 1 — Dashboard */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="home" size={size} color={color} />
            ),
          }}
        />

        {/* 2 — Log */}
        <Tabs.Screen
          name="checkin"
          options={{
            title: 'Log',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="add-circle" size={size} color={color} />
            ),
          }}
        />

        {/* 3 — Patterns */}
        <Tabs.Screen
          name="insights"
          options={{
            title: 'Patterns',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="bar-chart" size={size} color={color} />
            ),
          }}
        />

        {/* 4 — Mood Lab */}
        <Tabs.Screen
          name="sound-lab"
          options={{
            title: 'Mood Lab',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="self-improvement" size={size} color={color} />
            ),
          }}
        />

        {/* 5 — Mapp */}
        <Tabs.Screen
          name="mapp"
          options={{
            title: 'Mapp',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="explore" size={size} color={color} />
            ),
          }}
        />

        {/* 6 — Me */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Me',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="person-outline" size={size} color={color} />
            ),
          }}
        />

        {/* Hidden — cycle tab redirects to home; widget lives on Dashboard */}
        <Tabs.Screen
          name="cycle"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </WebSidebar>
  );
}
