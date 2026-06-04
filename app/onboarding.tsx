import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { VibeButton } from '@/components/ui/VibeButton';
import { markOnboardingDone, saveBirthdateStorage } from '@/services/storage';
import { updateUserProfile } from '@/services/sync';
import { getSupabaseClient } from '@/template';
import { useApp } from '@/hooks/useApp';

const { width } = Dimensions.get('window');

// ─── Drum-roll date picker ──────────────────────────────────────────────────
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ITEM_H = 48;
const VISIBLE = 5;

function range(start: number, end: number): number[] {
  const arr: number[] = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = range(CURRENT_YEAR - 100, CURRENT_YEAR - 10).reverse();

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function DrumColumn<T extends number | string>({
  items, selectedIndex, onSelect, formatItem, colWidth,
}: {
  items: T[]; selectedIndex: number; onSelect: (i: number) => void;
  formatItem?: (v: T) => string; colWidth: number;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const PAD = Math.floor(VISIBLE / 2);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: true });
  }, [selectedIndex]);
  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    onSelect(Math.max(0, Math.min(index, items.length - 1)));
  };
  return (
    <View style={{ width: colWidth, height: ITEM_H * VISIBLE, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: PAD * ITEM_H, left: 0, right: 0, height: ITEM_H, backgroundColor: Colors.primary + '18', borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.primary + '50', borderRadius: 6, zIndex: 1 }} />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} snapToInterval={ITEM_H} decelerationRate="fast" onMomentumScrollEnd={handleMomentumEnd} contentContainerStyle={{ paddingVertical: PAD * ITEM_H }}>
        {items.map((item, i) => {
          const sel = i === selectedIndex;
          return (
            <Pressable key={String(item)} onPress={() => { scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: true }); onSelect(i); }} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: sel ? 18 : 16, fontWeight: sel ? '700' : '400', color: sel ? Colors.primary : Colors.textMuted, includeFontPadding: false }}>{formatItem ? formatItem(item) : String(item)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface BirthdatePickerProps {
  visible: boolean;
  value: string | null;
  onConfirm: (date: string | null) => void;
  onClose: () => void;
}

function BirthdatePicker({ visible, value, onConfirm, onClose }: BirthdatePickerProps) {
  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [dayIdx, setDayIdx] = useState(parsed ? parsed.getDate() - 1 : 0);
  const [monthIdx, setMonthIdx] = useState(parsed ? parsed.getMonth() : 0);
  const [yearIdx, setYearIdx] = useState(() => {
    if (!parsed) return 20;
    const idx = YEARS.indexOf(parsed.getFullYear());
    return idx >= 0 ? idx : 20;
  });
  const selectedYear = YEARS[yearIdx] ?? YEARS[0];
  const maxDays = daysInMonth(monthIdx + 1, selectedYear);
  const days = range(1, maxDays);
  useEffect(() => { if (dayIdx >= maxDays) setDayIdx(maxDays - 1); }, [maxDays]);
  const handleConfirm = () => {
    const d = Math.min(dayIdx + 1, maxDays);
    const mm = String(monthIdx + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    onConfirm(`${selectedYear}-${mm}-${dd}`);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable style={{ backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28, borderTopWidth: 1, borderColor: Colors.border, gap: 20 }} onPress={() => {}}>
          <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: 'center' }} />
          <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', includeFontPadding: false }}>Date of birth</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            <DrumColumn items={MONTHS_SHORT} selectedIndex={monthIdx} onSelect={setMonthIdx} colWidth={80} />
            <DrumColumn items={days} selectedIndex={Math.min(dayIdx, days.length - 1)} onSelect={setDayIdx} formatItem={(v) => String(v).padStart(2, '0')} colWidth={64} />
            <DrumColumn items={YEARS} selectedIndex={yearIdx} onSelect={setYearIdx} colWidth={80} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable onPress={() => onConfirm(null)} style={({ pressed }) => [{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, minHeight: 52 }, pressed && { opacity: 0.7 }]}>
              <Text style={{ fontSize: 16, color: Colors.textSecondary, fontWeight: '500', includeFontPadding: false }}>Skip</Text>
            </Pressable>
            <Pressable onPress={handleConfirm} style={({ pressed }) => [{ flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.primary, minHeight: 52 }, pressed && { opacity: 0.85 }]}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#08091A', includeFontPadding: false }}>Confirm</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type Sex = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';

const SEX_OPTIONS: { id: Sex; label: string; emoji: string }[] = [
  { id: 'female', label: 'Female', emoji: '♀️' },
  { id: 'male', label: 'Male', emoji: '♂️' },
  { id: 'non_binary', label: 'Non-binary', emoji: '⚧️' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say', emoji: '🔒' },
];

const INTRO_SLIDES = [
  {
    title: 'Log your mood in 8 seconds',
    subtitle: 'Track Body, Mind, Energy, and Focus. Discover patterns and what drives your best days over time.',
    icon: null,
  },
  {
    title: 'AI-powered mood intelligence',
    subtitle: 'MyMoodMapp uses AI to analyse your mood patterns and generate personalised wellness reports. This requires sending your mood data to Anthropic\'s Claude AI service. Your name and email are never shared, and your data is never used to train AI models. You can opt out at any time in Settings.',
    icon: 'psychology' as const,
  },
  {
    title: 'Your data, your choice',
    subtitle: 'Everything stays on your device and account. We never sell your data.',
    icon: 'lock' as const,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { setOnboardingDone, setBirthdate } = useApp();
  const scrollRef = useRef<ScrollView>(null);

  // Step: 'slides' → 'profile'
  const [step, setStep] = useState<'slides' | 'profile'>('slides');
  const [slideIndex, setSlideIndex] = useState(0);

  // Profile form
  const [name, setName] = useState('');
  const [birthdate, setLocalBirthdate] = useState<string | null>(null);
  const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);
  const [sex, setSex] = useState<Sex>('prefer_not_to_say');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const goNextSlide = () => {
    if (slideIndex < INTRO_SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (slideIndex + 1), animated: true });
      setSlideIndex(s => s + 1);
    } else {
      setStep('profile');
    }
  };

  const validateAndSave = async () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Please enter your name';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      const bd = birthdate;

      // Persist birthdate locally
      if (bd) {
        await saveBirthdateStorage(bd);
        setBirthdate(bd);
      }

      // Save to cloud profile
      if (user) {
        await updateUserProfile(user.id, {
          onboarding_done: true,
          display_name: name.trim(),
          birthdate: bd ?? undefined,
          sex: sex,
        } as any);
      }

      await markOnboardingDone();
      setOnboardingDone(true);
      router.replace('/(tabs)');
    } catch {
      // Still complete onboarding even if cloud sync fails
      await markOnboardingDone();
      setOnboardingDone(true);
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    await markOnboardingDone();
    setOnboardingDone(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await updateUserProfile(user.id, { onboarding_done: true });
    } catch {}
    router.replace('/(tabs)');
  };

  const formatBirthdateDisplay = (iso: string | null) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-');
    return `${MONTHS_SHORT[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
  };

  if (step === 'profile') {
    return (
      <SafeAreaView style={styles.safe}>
        <Image
          source={{ uri: 'https://cdn-ai.onspace.ai/onspace/files/34Gq4RAVBYknhhDqNrUJGm/4RC8N.jpg' }}
          style={styles.hero}
          contentFit="cover"
          transition={400}
        />
        <View style={styles.overlay} />

        <BirthdatePicker
          visible={showBirthdatePicker}
          value={birthdate}
          onConfirm={(d) => { setLocalBirthdate(d); setShowBirthdatePicker(false); }}
          onClose={() => setShowBirthdatePicker(false)}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.profileScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.profileCard}>

              <Text style={styles.profileTitle}>Tell us about yourself</Text>
              <Text style={styles.profileSub}>
                This helps personalise your experience — your astrological sign, health features, and insights.
              </Text>

              {/* Name */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>Your name <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.textInput, errors.name ? styles.inputError : null]}
                  placeholder="e.g. Alex"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: undefined })); }}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
                {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
              </View>

              {/* Birthdate */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  Birthdate
                  <Text style={styles.optional}> (for astrological sign)</Text>
                </Text>
                <Pressable
                  onPress={() => setShowBirthdatePicker(true)}
                  style={({ pressed }) => [styles.textInput, styles.pickerTrigger, pressed && { opacity: 0.75 }]}
                >
                  <MaterialIcons name="cake" size={16} color={Colors.textMuted} />
                  <Text style={[styles.pickerTriggerText, !birthdate && { color: Colors.textMuted }]}>
                    {birthdate ? formatBirthdateDisplay(birthdate) : 'Tap to select your birthday'}
                  </Text>
                  {birthdate ? (
                    <Pressable onPress={(e) => { e.stopPropagation?.(); setLocalBirthdate(null); }} hitSlop={10}>
                      <MaterialIcons name="close" size={16} color={Colors.textMuted} />
                    </Pressable>
                  ) : (
                    <MaterialIcons name="chevron-right" size={16} color={Colors.textMuted} />
                  )}
                </Pressable>
                <Text style={styles.fieldHint}>Unlocks cosmic alignment and daily forecasts</Text>
              </View>

              {/* Sex */}
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>
                  Biological sex
                  <Text style={styles.optional}> (for cycle tracking)</Text>
                </Text>
                <View style={styles.sexGrid}>
                  {SEX_OPTIONS.map(opt => (
                    <Pressable
                      key={opt.id}
                      onPress={() => setSex(opt.id)}
                      style={[styles.sexChip, sex === opt.id && styles.sexChipActive]}
                    >
                      <Text style={styles.sexEmoji}>{opt.emoji}</Text>
                      <Text style={[styles.sexLabel, sex === opt.id && styles.sexLabelActive]}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {sex === 'female' ? (
                  <View style={styles.cycleHintRow}>
                    <MaterialIcons name="water-drop" size={13} color={Colors.error} />
                    <Text style={styles.cycleHint}>Menstrual cycle tracking will be enabled for you</Text>
                  </View>
                ) : null}
              </View>

              {/* Privacy note */}
              <View style={styles.privacyRow}>
                <MaterialIcons name="lock" size={13} color={Colors.success} />
                <Text style={styles.privacyText}>This information is stored securely in your account and never shared.</Text>
              </View>

              {/* Actions */}
              <View style={styles.profileActions}>
                <Pressable
                  onPress={handleSkip}
                  style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.skipBtnText}>Skip for now</Text>
                </Pressable>
                <Pressable
                  onPress={validateAndSave}
                  disabled={saving}
                  style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }, saving && { opacity: 0.6 }]}
                >
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : "Let's go →"}</Text>
                </Pressable>
              </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Intro slides ──────────────────────────────────────────────────────────
  const isLastSlide = slideIndex === INTRO_SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <Image
        source={{ uri: 'https://cdn-ai.onspace.ai/onspace/files/34Gq4RAVBYknhhDqNrUJGm/4RC8N.jpg' }}
        style={styles.hero}
        contentFit="cover"
        transition={400}
      />
      <View style={styles.overlay} />

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.slideScroll}
      >
        {INTRO_SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            {slide.icon ? (
              <View style={styles.iconBadge}>
                <MaterialIcons name={slide.icon} size={20} color={Colors.success} />
                <Text style={styles.iconBadgeText}>Privacy first</Text>
              </View>
            ) : null}
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {INTRO_SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === slideIndex && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.navRow}>
          <Pressable onPress={handleSkip} style={styles.skip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <VibeButton
            label={isLastSlide ? "Next →" : "Next"}
            onPress={goNextSlide}
            style={styles.nextBtn}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  hero: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,9,26,0.6)' },
  slideScroll: { flex: 1 },
  slide: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  iconBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.successSoft, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, alignSelf: 'flex-start', marginBottom: Spacing.md },
  iconBadgeText: { fontSize: Typography.fontSizes.sm, fontWeight: Typography.fontWeights.medium, color: Colors.success, includeFontPadding: false },
  title: { fontSize: Typography.fontSizes['4xl'], fontWeight: Typography.fontWeights.bold, color: Colors.textPrimary, marginBottom: Spacing.md, lineHeight: Typography.fontSizes['4xl'] * 1.15, includeFontPadding: false },
  subtitle: { fontSize: Typography.fontSizes.lg, color: Colors.textSecondary, lineHeight: Typography.fontSizes.lg * 1.5, includeFontPadding: false },
  bottom: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.lg },
  dots: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: Radius.full, backgroundColor: Colors.textMuted },
  dotActive: { width: 20, backgroundColor: Colors.primary },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { padding: Spacing.md, minHeight: 44, justifyContent: 'center' },
  skipText: { fontSize: Typography.fontSizes.md, color: Colors.textMuted, includeFontPadding: false },
  nextBtn: { flex: 1, marginLeft: Spacing.md },
  // Profile step
  profileScroll: { flexGrow: 1, justifyContent: 'flex-end', padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  profileCard: { backgroundColor: 'rgba(8,9,26,0.92)', borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, gap: Spacing.xl },
  profileTitle: { fontSize: Typography.fontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary, includeFontPadding: false },
  profileSub: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, marginTop: -Spacing.md, includeFontPadding: false },
  formGroup: { gap: Spacing.sm },
  fieldLabel: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  required: { color: Colors.error },
  optional: { color: Colors.textMuted, fontWeight: '400' },
  fieldHint: { fontSize: 10, color: Colors.textMuted, includeFontPadding: false },
  textInput: { backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, color: Colors.textPrimary, fontSize: Typography.fontSizes.sm, borderWidth: 1, borderColor: Colors.border, minHeight: 48 },
  inputError: { borderColor: Colors.error + '80' },
  errorText: { fontSize: Typography.fontSizes.xs, color: Colors.error, includeFontPadding: false },
  pickerTrigger: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickerTriggerText: { flex: 1, color: Colors.textPrimary, fontSize: Typography.fontSizes.sm, includeFontPadding: false },
  // Sex selector
  sexGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  sexChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, minWidth: '47%' },
  sexChipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  sexEmoji: { fontSize: 16 },
  sexLabel: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, fontWeight: '500', includeFontPadding: false },
  sexLabelActive: { color: Colors.primary, fontWeight: '700' },
  cycleHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.error + '15', borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.error + '30' },
  cycleHint: { fontSize: Typography.fontSizes.xs, color: Colors.error, flex: 1, includeFontPadding: false },
  privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.successSoft, borderRadius: Radius.md, padding: Spacing.md },
  privacyText: { flex: 1, fontSize: Typography.fontSizes.xs, color: Colors.success, lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
  profileActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  skipBtn: { paddingHorizontal: Spacing.lg, paddingVertical: 14, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  skipBtnText: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, fontWeight: '600', includeFontPadding: false },
  saveBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: Typography.fontSizes.md, fontWeight: '800', color: '#08091A', includeFontPadding: false },
});
