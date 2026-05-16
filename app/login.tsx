// @ts-nocheck
/**
 * MyMoodMap — Login / Sign up screen
 * OTP + password hybrid flow (matches built-in auth template).
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius, Shadows, getGlass } from '@/constants/theme';
import { updateUserProfile } from '@/services/sync';

type Mode = 'login' | 'register' | 'otp';
type RoleChoice = 'user' | 'therapist';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ITEM_H = 48;
const VISIBLE = 5; // odd number — centre item is selected

function range(start: number, end: number): number[] {
  const arr: number[] = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = range(CURRENT_YEAR - 100, CURRENT_YEAR - 10).reverse(); // newest first

/** Returns days in a given month (1-based month, full year) */
function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

// ─── Drum-roll column ────────────────────────────────────────────────────────
function DrumColumn<T extends number | string>({
  items,
  selectedIndex,
  onSelect,
  formatItem,
  width,
}: {
  items: T[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatItem?: (v: T) => string;
  width: number;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const PAD = Math.floor(VISIBLE / 2);

  // Scroll to selected on mount + when selectedIndex changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: true });
  }, [selectedIndex]);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    onSelect(clamped);
  };

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: 'hidden' }}>
      {/* Selection highlight bar */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: PAD * ITEM_H,
          left: 0,
          right: 0,
          height: ITEM_H,
          backgroundColor: Colors.primary + '18',
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: Colors.primary + '50',
          borderRadius: Radius.sm,
          zIndex: 1,
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{ paddingVertical: PAD * ITEM_H }}
      >
        {items.map((item, i) => {
          const isSelected = i === selectedIndex;
          return (
            <Pressable
              key={String(item)}
              onPress={() => {
                scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: true });
                onSelect(i);
              }}
              style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text
                style={{
                  fontSize: isSelected ? Typography.fontSizes.lg : Typography.fontSizes.md,
                  fontWeight: isSelected ? '700' : '400',
                  color: isSelected ? Colors.primary : Colors.textMuted,
                  includeFontPadding: false,
                }}
              >
                {formatItem ? formatItem(item) : String(item)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* Top + bottom fade overlay */}
      <View pointerEvents="none" style={[drumFadeStyles.fade, drumFadeStyles.top]} />
      <View pointerEvents="none" style={[drumFadeStyles.fade, drumFadeStyles.bottom]} />
    </View>
  );
}

const drumFadeStyles = StyleSheet.create({
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_H * 2,
    zIndex: 2,
  },
  top: { top: 0, backgroundColor: 'transparent' },
  bottom: { bottom: 0, backgroundColor: 'transparent' },
});

// ─── Birthdate picker modal ──────────────────────────────────────────────────
interface BirthdatePickerProps {
  visible: boolean;
  value: string | null; // YYYY-MM-DD or null
  onConfirm: (date: string | null) => void;
  onClose: () => void;
}

function BirthdatePicker({ visible, value, onConfirm, onClose }: BirthdatePickerProps) {
  const parsed = value ? new Date(value) : null;

  const [dayIdx, setDayIdx] = useState(() => {
    const d = parsed ? parsed.getUTCDate() : 1;
    return d - 1;
  });
  const [monthIdx, setMonthIdx] = useState(() => {
    return parsed ? parsed.getUTCMonth() : 0;
  });
  const [yearIdx, setYearIdx] = useState(() => {
    if (!parsed) return 20; // ~30 years ago
    return YEARS.indexOf(parsed.getUTCFullYear());
  });

  const selectedYear = YEARS[yearIdx] ?? YEARS[0];
  const selectedMonth = monthIdx + 1; // 1-based
  const maxDays = daysInMonth(selectedMonth, selectedYear);
  const days = range(1, maxDays);

  // Clamp day if month/year changes shrinks maxDays
  useEffect(() => {
    if (dayIdx >= maxDays) setDayIdx(maxDays - 1);
  }, [maxDays]);

  const handleConfirm = () => {
    const d = Math.min(dayIdx + 1, maxDays);
    const mm = String(selectedMonth).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    onConfirm(`${selectedYear}-${mm}-${dd}`);
  };

  const handleSkip = () => onConfirm(null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pickerStyles.backdrop} onPress={onClose}>
        <Pressable style={pickerStyles.sheet} onPress={() => {}}>
          <View style={pickerStyles.handle} />
          <Text style={pickerStyles.title}>Date of birth</Text>
          <Text style={pickerStyles.subtitle}>Used for astrological sign and cosmic forecasts</Text>

          <View style={pickerStyles.drumRow}>
            {/* Month */}
            <DrumColumn
              items={MONTHS}
              selectedIndex={monthIdx}
              onSelect={setMonthIdx}
              width={80}
            />
            {/* Day */}
            <DrumColumn
              items={days}
              selectedIndex={Math.min(dayIdx, days.length - 1)}
              onSelect={setDayIdx}
              formatItem={(v) => String(v).padStart(2, '0')}
              width={64}
            />
            {/* Year */}
            <DrumColumn
              items={YEARS}
              selectedIndex={yearIdx}
              onSelect={setYearIdx}
              width={80}
            />
          </View>

          <View style={pickerStyles.actions}>
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [pickerStyles.skipBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={pickerStyles.skipBtnText}>Skip</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [pickerStyles.confirmBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={pickerStyles.confirmBtnText}>Confirm</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xl,
    borderTopWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: -Spacing.sm,
    includeFontPadding: false,
  },
  drumRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  skipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 52,
  },
  skipBtnText: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textSecondary,
    fontWeight: '500',
    includeFontPadding: false,
  },
  confirmBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    minHeight: 52,
  },
  confirmBtnText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: '700',
    color: '#08091A',
    includeFontPadding: false,
  },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const { sendOTP, verifyOTPAndLogin, signInWithPassword, signUpWithPassword, operationLoading, user } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<RoleChoice>('user');
  const [justRegistered, setJustRegistered] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otp, setOtp] = useState('');

  // Birthdate
  const [birthdate, setBirthdate] = useState<string | null>(null);
  const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);

  const formatBirthdate = (iso: string | null) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-');
    return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showAlert('Missing fields', 'Please enter your email and password.');
      return;
    }
    const { error } = await signInWithPassword(email.trim(), password);
    if (error) showAlert('Login failed', error);
  };

  const handleRegisterSendOTP = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      showAlert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      showAlert('Password too short', 'Password must be at least 6 characters.');
      return;
    }
    const { error } = await sendOTP(email.trim());
    if (error) {
      showAlert('Could not send code', error);
      return;
    }
    setMode('otp');
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 4) {
      showAlert('Enter code', 'Please enter the 4-digit code from your email.');
      return;
    }
    const { error, user: newUser } = await verifyOTPAndLogin(email.trim(), otp, {
      password,
      data: { display_name: displayName.trim() || email.split('@')[0], role },
    });
    if (error) {
      showAlert('Verification failed', error);
      return;
    }
    if (newUser?.id) {
      await updateUserProfile(newUser.id, {
        display_name: displayName.trim() || email.split('@')[0],
        role,
        birthdate: birthdate ?? undefined,
      } as any);
    }
    setJustRegistered(true);
  };

  useEffect(() => {
    if (justRegistered && user && role === 'therapist') {
      setJustRegistered(false);
      setTimeout(() => { router.push('/(tabs)/profile' as any); }, 800);
    }
  }, [justRegistered, user, role]);

  return (
    <SafeAreaView style={styles.safe}>
      <BirthdatePicker
        visible={showBirthdatePicker}
        value={birthdate}
        onConfirm={(d) => { setBirthdate(d); setShowBirthdatePicker(false); }}
        onClose={() => setShowBirthdatePicker(false)}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.heroSection}>
            <View style={styles.logoWrap}>
              <MaterialIcons name="mood" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.appName}>MyMoodMap</Text>
            <Text style={styles.tagline}>Track what moves you</Text>
          </View>

          {/* Mode tabs */}
          {mode !== 'otp' ? (
            <View style={styles.modeTabs}>
              <Pressable onPress={() => setMode('login')} style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}>
                <Text style={[styles.modeTabText, mode === 'login' && styles.modeTabTextActive]}>Sign in</Text>
              </Pressable>
              <Pressable onPress={() => setMode('register')} style={[styles.modeTab, mode === 'register' && styles.modeTabActive]}>
                <Text style={[styles.modeTabText, mode === 'register' && styles.modeTabTextActive]}>Create account</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.card}>
            {mode === 'login' ? (
              <>
                <Text style={styles.cardTitle}>Welcome back</Text>
                <View style={styles.fieldGroup}>
                  <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" icon="email" />
                  <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" icon="lock" />
                </View>
                <Pressable onPress={handleLogin} disabled={operationLoading} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }, operationLoading && { opacity: 0.6 }]}>
                  {operationLoading ? <ActivityIndicator color="#08091A" size="small" /> : <><MaterialIcons name="login" size={18} color="#08091A" /><Text style={styles.primaryBtnText}>Sign in</Text></>}
                </Pressable>
              </>
            ) : mode === 'register' ? (
              <>
                <Text style={styles.cardTitle}>Create your account</Text>

                {/* Role chooser */}
                <View style={styles.roleSection}>
                  <Text style={styles.roleLabel}>I am a…</Text>
                  <View style={styles.roleRow}>
                    <RoleChip icon="person" label="User" desc="Log my mood daily" active={role === 'user'} onPress={() => setRole('user')} />
                    <RoleChip icon="psychology" label="Therapist" desc="Monitor my clients" active={role === 'therapist'} onPress={() => setRole('therapist')} />
                  </View>
                  {role === 'therapist' ? (
                    <View style={styles.therapistBanner}>
                      <MaterialIcons name="info-outline" size={14} color={Colors.secondary} />
                      <Text style={styles.therapistBannerText}>
                        Therapist accounts come with a free trial of{' '}
                        <Text style={{ fontWeight: '800' }}>Therapist Pro ($9.99/mo)</Text> — giving you unlimited client slots, a full client dashboard, and accountability buddy features.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.userBanner}>
                      <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.userBannerText}>
                        Start free — unlimited daily logs and 30-day history included. Upgrade to{' '}
                        <Text style={{ fontWeight: '700' }}>Pro ($3.99/mo)</Text> for AI insights and therapist export.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Field label="Display name (optional)" value={displayName} onChangeText={setDisplayName} placeholder="How should we call you?" icon="badge" />
                  <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" icon="email" />
                  <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" icon="lock" />
                  <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Repeat password" icon="lock-outline" />

                  {/* Birthdate picker field */}
                  <View style={fStyles.wrapper}>
                    <Text style={fStyles.label}>Date of birth <Text style={{ color: Colors.textMuted, fontWeight: '400' }}>(optional · for astrology)</Text></Text>
                    <Pressable
                      onPress={() => setShowBirthdatePicker(true)}
                      style={({ pressed }) => [fStyles.inputRow, fStyles.pickerRow, pressed && { opacity: 0.8 }]}
                    >
                      <MaterialIcons name="cake" size={16} color={Colors.textMuted} style={fStyles.icon} />
                      <Text style={[fStyles.pickerText, !birthdate && { color: Colors.textMuted }]}>
                        {birthdate ? formatBirthdate(birthdate) : 'Tap to select your birthday'}
                      </Text>
                      {birthdate ? (
                        <Pressable
                          onPress={(e) => { e.stopPropagation(); setBirthdate(null); }}
                          hitSlop={10}
                        >
                          <MaterialIcons name="close" size={16} color={Colors.textMuted} />
                        </Pressable>
                      ) : (
                        <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
                      )}
                    </Pressable>
                  </View>
                </View>

                <Pressable onPress={handleRegisterSendOTP} disabled={operationLoading} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }, operationLoading && { opacity: 0.6 }]}>
                  {operationLoading ? <ActivityIndicator color="#08091A" size="small" /> : <><MaterialIcons name="mark-email-read" size={18} color="#08091A" /><Text style={styles.primaryBtnText}>Send verification code</Text></>}
                </Pressable>
              </>
            ) : (
              // OTP step
              <>
                <View style={styles.otpHeader}>
                  <View style={styles.otpIconWrap}>
                    <MaterialIcons name="mark-email-read" size={28} color={Colors.primary} />
                  </View>
                  <Text style={styles.cardTitle}>Check your email</Text>
                  <Text style={styles.otpSub}>
                    We sent a 4-digit code to{'\n'}
                    <Text style={styles.otpEmail}>{email}</Text>
                  </Text>
                </View>
                <View style={styles.otpInputWrap}>
                  <TextInput
                    style={styles.otpInput}
                    value={otp}
                    onChangeText={t => setOtp(t.replace(/[^0-9]/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholder="• • • •"
                    placeholderTextColor={Colors.textMuted}
                    textAlign="center"
                  />
                </View>
                <Pressable onPress={handleVerifyOTP} disabled={operationLoading} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }, operationLoading && { opacity: 0.6 }]}>
                  {operationLoading ? <ActivityIndicator color="#08091A" size="small" /> : <><MaterialIcons name="check-circle" size={18} color="#08091A" /><Text style={styles.primaryBtnText}>Verify & create account</Text></>}
                </Pressable>
                <Pressable onPress={() => { setMode('register'); setOtp(''); }} style={styles.backLink}>
                  <MaterialIcons name="arrow-back" size={14} color={Colors.textMuted} />
                  <Text style={styles.backLinkText}>Back to registration</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* Privacy note */}
          <View style={styles.privacyNote}>
            <MaterialIcons name="lock-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.privacyNoteText}>Your data is encrypted and never sold. You can delete your account any time.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChangeText, placeholder, icon,
  keyboardType, autoCapitalize, secureTextEntry,
}: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; icon: string; keyboardType?: any;
  autoCapitalize?: any; secureTextEntry?: boolean;
}) {
  return (
    <View style={fStyles.wrapper}>
      <Text style={fStyles.label}>{label}</Text>
      <View style={fStyles.inputRow}>
        <MaterialIcons name={icon as any} size={16} color={Colors.textMuted} style={fStyles.icon} />
        <TextInput
          style={fStyles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          secureTextEntry={secureTextEntry}
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

const fStyles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: Typography.fontSizes.xs, fontWeight: '600', color: Colors.textSecondary, includeFontPadding: false },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, minHeight: 48 },
  icon: { marginRight: Spacing.sm },
  input: { flex: 1, color: Colors.textPrimary, fontSize: Typography.fontSizes.md, includeFontPadding: false },
  pickerRow: { justifyContent: 'flex-start' },
  pickerText: { flex: 1, color: Colors.textPrimary, fontSize: Typography.fontSizes.md, includeFontPadding: false },
});

function RoleChip({ icon, label, desc, active, onPress }: {
  icon: string; label: string; desc: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [rcStyles.chip, active && rcStyles.chipActive, pressed && { opacity: 0.8 }]}>
      <MaterialIcons name={icon as any} size={22} color={active ? Colors.primary : Colors.textMuted} />
      <Text style={[rcStyles.label, active && { color: Colors.primary }]}>{label}</Text>
      <Text style={rcStyles.desc}>{desc}</Text>
    </Pressable>
  );
}

const rcStyles = StyleSheet.create({
  chip: { flex: 1, alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  label: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: Colors.textSecondary, includeFontPadding: false },
  desc: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', includeFontPadding: false },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  heroSection: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  logoWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.primary + '40' },
  appName: { fontSize: Typography.fontSizes['2xl'], fontWeight: '900', color: Colors.textPrimary, includeFontPadding: false },
  tagline: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, includeFontPadding: false },
  modeTabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.lg, padding: 4, marginBottom: Spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  modeTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.md },
  modeTabActive: { backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOpacity: 0.30, shadowRadius: 8, elevation: 4 },
  modeTabText: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: Colors.textMuted, includeFontPadding: false },
  modeTabTextActive: { color: '#08091A' },
  card: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', gap: Spacing.lg, shadowColor: '#F5A623', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 8 },
  cardTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  roleSection: { gap: Spacing.sm },
  roleLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, includeFontPadding: false },
  roleRow: { flexDirection: 'row', gap: Spacing.md },
  therapistBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.secondary + '12', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.secondary + '30' },
  therapistBannerText: { flex: 1, fontSize: 11, color: Colors.secondary, lineHeight: 16, includeFontPadding: false },
  userBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  userBannerText: { flex: 1, fontSize: 11, color: Colors.textMuted, lineHeight: 16, includeFontPadding: false },
  fieldGroup: { gap: Spacing.md },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 14, minHeight: 52 },
  primaryBtnText: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: '#08091A', includeFontPadding: false },
  otpHeader: { alignItems: 'center', gap: Spacing.sm },
  otpIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.primary + '40' },
  otpSub: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false },
  otpEmail: { color: Colors.primary, fontWeight: '700' },
  otpInputWrap: { alignItems: 'center' },
  otpInput: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.primary + '60', paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, fontSize: 32, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 12, minWidth: 180, textAlign: 'center' },
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: Spacing.sm },
  backLinkText: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.xl, paddingHorizontal: Spacing.md },
  privacyNoteText: { flex: 1, fontSize: 10, color: Colors.textMuted, lineHeight: 14, includeFontPadding: false },
});
