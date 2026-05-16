/**
 * NotificationPrePrompt — shown BEFORE the iOS system permission dialog.
 * Apple guidelines require a contextual explanation to appear before the
 * system prompt so users understand why the app needs notification access.
 *
 * Show this once after onboarding is complete (not on cold start).
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { requestNotificationPermissions } from '@/services/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_PROMPT_SHOWN_KEY = 'notif_pre_prompt_shown_v1';

export async function shouldShowNotificationPrePrompt(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const shown = await AsyncStorage.getItem(NOTIF_PROMPT_SHOWN_KEY);
    return !shown;
  } catch {
    return false;
  }
}

export async function markNotificationPrePromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_PROMPT_SHOWN_KEY, '1');
  } catch {}
}

interface Props {
  visible: boolean;
  onAllow: () => void;
  onSkip: () => void;
}

export function NotificationPrePrompt({ visible, onAllow, onSkip }: Props) {
  const handleAllow = async () => {
    await markNotificationPrePromptShown();
    onAllow();
    // Trigger the actual iOS system permission dialog
    if (Platform.OS !== 'web') {
      await requestNotificationPermissions();
    }
  };

  const handleSkip = async () => {
    await markNotificationPrePromptShown();
    onSkip();
  };

  if (Platform.OS === 'web') return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
      statusBarTranslucent
    >
      <View style={s.backdrop}>
        <View style={s.sheet}>
          {/* Icon */}
          <View style={s.iconWrap}>
            <MaterialIcons name="notifications-active" size={36} color={Colors.primary} />
          </View>

          {/* Title */}
          <Text style={s.title}>Stay on track with daily reminders</Text>

          {/* Explanation */}
          <Text style={s.body}>
            MyMoodMapp can send you a gentle daily reminder to log your mood. Consistent logging gives you better pattern insights and keeps your streak alive.
          </Text>

          {/* Features list */}
          <View style={s.featureList}>
            {[
              { icon: 'schedule' as const, text: 'Daily check-in reminders at your chosen times' },
              { icon: 'people' as const,   text: 'Alerts when an accountability buddy misses a log' },
              { icon: 'star' as const,     text: 'Weekly wellness recap every Sunday' },
            ].map((f, i) => (
              <View key={i} style={s.featureRow}>
                <View style={s.featureIcon}>
                  <MaterialIcons name={f.icon} size={16} color={Colors.primary} />
                </View>
                <Text style={s.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {/* Privacy note */}
          <View style={s.privacyRow}>
            <MaterialIcons name="lock-outline" size={13} color={Colors.textMuted} />
            <Text style={s.privacyText}>
              No spam. You can change notification settings any time in the Me tab.
            </Text>
          </View>

          {/* Actions */}
          <Pressable
            onPress={handleAllow}
            style={({ pressed }) => [s.allowBtn, pressed && { opacity: 0.85 }]}
          >
            <MaterialIcons name="notifications-active" size={18} color="#08091A" />
            <Text style={s.allowBtnText}>Enable Reminders</Text>
          </Pressable>

          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [s.skipBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.skipBtnText}>Not now — maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  sheet: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    gap: Spacing.md,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '40',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  body: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.fontSizes.sm * 1.6,
    includeFontPadding: false,
  },
  featureList: {
    width: '100%',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
    fontSize: Typography.fontSizes.xs,
    color: Colors.textPrimary,
    fontWeight: '500',
    includeFontPadding: false,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  privacyText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
    includeFontPadding: false,
  },
  allowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 15,
    width: '100%',
    minHeight: 52,
  },
  allowBtnText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: '800',
    color: '#08091A',
    includeFontPadding: false,
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textMuted,
    fontWeight: '500',
    includeFontPadding: false,
  },
});
