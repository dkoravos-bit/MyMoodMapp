// @ts-nocheck
/**
 * MyMoodMapp — Web Landing Page
 * Apple App Store–style marketing page for unauthenticated web visitors.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
  Linking,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#000000',
  bgCard: '#111111',
  bgElevated: '#1C1C1E',
  bgGlass: 'rgba(28,28,30,0.85)',
  border: '#2C2C2E',
  borderSubtle: 'rgba(255,255,255,0.08)',
  primary: '#F5A623',
  primaryGlow: 'rgba(245,166,35,0.15)',
  secondary: '#5E5CE6',
  teal: '#32D4C0',
  rose: '#FF375F',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.3)',
  success: '#30D158',
  gradient1: '#5E5CE6',
  gradient2: '#F5A623',
};

const MOODPRINT_ICON = require('@/assets/moodprint-icon.png');
const APP_STORE_URL  = 'https://apps.apple.com/app/mymoodmapp/id000000000';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mymoodmapp';

// ─── Layout hook ──────────────────────────────────────────────────────────────
function useLayout() {
  const [w, setW] = useState(Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setW(window.width));
    return () => sub?.remove();
  }, []);
  return { w, isMobile: w < 600, isTablet: w >= 600 && w < 1024, isDesktop: w >= 1024 };
}

const ALL_FEATURES = [
  { icon: 'mood',              color: C.primary,    title: 'Smart Mood Logging',          desc: 'Log in 10 seconds — body, mind, energy + context tags. Emoji selector, voice notes, and selfie capture.' },
  { icon: 'psychology',        color: C.secondary,  title: 'AI Wellness Reports',         desc: 'Daily, weekly and monthly AI reports powered by your mood, fitness, weather, cycle and cosmic data.' },
  { icon: 'bar-chart',         color: C.teal,       title: 'Pattern Intelligence',        desc: 'Discover which tags, times and events move your score. Tag correlations and time-of-day pattern analysis.' },
  { icon: 'fitness-center',    color: '#7C83FF',    title: 'Health Data Fusion',          desc: 'Steps, sleep, heart rate, calories from Apple Health & Google Fit — synced to the web app.' },
  { icon: 'wb-sunny',          color: '#FFD166',    title: 'Weather Correlation',         desc: 'Automatically correlates your mood with local weather, UV index, pressure and humidity.' },
  { icon: 'water-drop',        color: C.rose,       title: 'Cycle Tracking',              desc: 'Period tracking with phase-aware mood correlation — menstrual, follicular, ovulation and luteal phases.' },
  { icon: 'explore',           color: C.secondary,  title: 'Mapp Visualisation',          desc: 'A living AI canvas — six layers: Today, Week, Month, Drivers, Forecast and Mood Print.' },
  { icon: 'auto-awesome',      color: '#A78BFA',    title: 'Vibe Cards',                  desc: 'AI-generated daily art cards fusing your mood score with personalised visual metaphors via Flux AI.' },
  { icon: 'stars',             color: '#F59E0B',    title: 'Astrology & Schumann',        desc: 'Sun sign, moon phase, planetary retrogrades and live Schumann resonance reading.' },
  { icon: 'music-note',        color: C.teal,       title: '24 Ambient Soundscapes',      desc: '24 real recorded soundscapes — rain, ocean, forest, fire, urban and space. Gapless offline loops.' },
  { icon: 'waves',             color: '#4ADE80',    title: '28+ Healing Frequencies',     desc: '28+ solfeggio tones, binaural beats and brainwave frequencies generated locally.' },
  { icon: 'self-improvement',  color: '#A78BFA',    title: '19 Guided Meditations',       desc: '19 curated sessions — sleep, anxiety, mindfulness, focus from world-class teachers.' },
  { icon: 'games',             color: '#F472B6',    title: '7 Stress Relief Games',       desc: '7 science-backed games: Breathing Bubble, Bubble Wrap, Zen Sand, 2048, Dot Mandala, Pixel Art and MoodBeat.' },
  { icon: 'group',             color: C.primary,    title: 'Accountability Buddies',      desc: 'Connect with friends or your therapist. Get notified when either misses a daily log.' },
  { icon: 'analytics',         color: C.secondary,  title: 'Therapist Dashboard',         desc: 'Client dashboard, 14-day trends, overdue alerts, intake scoring and private notes.' },
  { icon: 'cloud-sync',        color: C.teal,       title: 'Cross-Platform Sync',         desc: 'Seamless sync between iPhone, Android and the web app. Data encrypted end-to-end.' },
  { icon: 'notifications',     color: '#FFD166',    title: 'Smart Reminders',             desc: 'Customisable daily reminders with Apple Watch action buttons, quick-log and snooze.' },
  { icon: 'description',       color: '#F472B6',    title: 'Therapist Export',            desc: 'Export full mood CSV and wellness PDF reports. Includes intake questionnaire scores.' },
];

const PHONE_SCREENSHOTS = [
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/kjNYqYtUwtcH5J3R3Woo2n/light_01_dashboard.jpg', label: 'Dashboard · Light',   sub: '7-day trend + what moves your score' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/HHxDSaffYHRvfAfJX46EsR/light_02_log.jpg',        label: "Today's Log · Light", sub: 'Combined score · body, mind, energy, focus' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/HRbSWKp6zBkKjxh6f6SwnT/light_03_patterns.jpg',   label: 'Patterns · Light',    sub: 'Tag impact · 7-day score trend' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/8KMRbVPw3s25N3YPGK9UNe/light_04_moodlab.jpg',   label: 'Mood Lab · Light',    sub: 'Guided Meditation · Sleep & Anxiety' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/MyQGw2HE8vAYLvnhfsHmCa/light_05_mapp.jpg',       label: 'Mapp · Light',        sub: 'Live AI emotional compass' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/kgVXndHKcmab9bb7uKdVjz/dark_01_dashboard.jpg',  label: 'Dashboard · Dark',    sub: 'Bright theme — same data, dark look' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/QyZi7SHaDtxZMGBKUKJKmG/dark_02_log.jpg',         label: "Today's Log · Dark",  sub: 'Peak performance entries' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/huXmgFBoTW5uxM9bEjH4PW/dark_03_patterns.jpg',    label: 'Patterns · Dark',     sub: 'Tags · Time · AI Report tabs' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/j8V63eSB83yCWuCTxCaoHQ/dark_04_moodlab.jpg',    label: 'Mood Lab · Dark',     sub: 'Guided Meditation with categories' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/DB3YfdGqKwFTxrBSfaGMLH/dark_05_mapp.jpg',        label: 'Mapp · Dark',         sub: 'AI compass in dark mode' },
];

const WEB_SCREENSHOTS = [
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/GqdHxjkJryK7j9dK28yAGw/ipad_01_dashboard.jpg', label: 'Dashboard',      sub: '7-day trend + what moves your score' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/4Xx6iqS7r9Eamk7hMAZKQR/ipad_02_log.jpg',        label: "Today's Log",    sub: 'Timeline of all entries today' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/Ng3Lsg4cwXukAi6uKHTLJr/ipad_03_patterns.jpg',   label: 'Patterns',       sub: 'Tag impact · 7-day score trend · AI Report' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/S3mPeXsUe9HTFMqWnVyaep/ipad_04_moodlab.jpg',   label: 'Mood Lab',       sub: 'Guided Meditation · Sounds · Frequencies' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/Ea6CEp4ULLLRyT4dvY6eQZ/ipad_05_mapp.jpg',       label: 'Mapp · Now',     sub: 'Live AI emotional compass' },
  { uri: 'https://cdn-ai.onspace.ai/onspace/files/BPeocBPVMDVLzkz3vNccyX/ipad_06_me.jpg',         label: 'Me · Dashboard', sub: 'Therapist Dashboard + weekly summary' },
];

const TESTIMONIALS = [
  { quote: "I finally understand why Mondays wreck me — it's not the meetings, it's the weather plus low sleep.",   author: 'Alex M.',   role: 'Pro user',          rating: 5 },
  { quote: 'The AI reports are genuinely insightful. My therapist now uses them to prep for our sessions.',            author: 'Jordan K.', role: 'Therapist Pro user', rating: 5 },
  { quote: 'Cycle phase tracking + mood correlation changed everything for me. This app is a game-changer.',          author: 'Sofia R.',   role: 'Pro user',          rating: 5 },
  { quote: 'The Sound Lab alone is worth it. The breathing bubble exercise replaced my Xanax for mild anxiety.',      author: 'Marcus T.', role: 'Pro user',          rating: 5 },
  { quote: "Having a dashboard of all my clients' check-ins saves me 30 minutes before every session.",              author: 'Dr. Patel',  role: 'Therapist Pro',     rating: 5 },
  { quote: 'The Mapp visualisation is beautiful. I look at it every morning like a weather forecast for my soul.',    author: 'Lily C.',   role: 'Pro user',          rating: 5 },
];

const PRICING = [
  {
    tier: 'Free', price: '$0', period: '', color: 'rgba(255,255,255,0.4)', icon: 'person',
    features: ['Unlimited mood logs', '30-day history', '1 accountability buddy', '15 min soundscape sessions', 'Breathing Bubble + Bubble Wrap games', 'Pattern previews'],
  },
  {
    tier: 'Pro', price: '$3.99', period: '/mo', color: C.primary, icon: 'star', highlight: true, trial: true,
    features: ['Everything in Free', 'AI wellness reports (daily / weekly / monthly)', 'Full mood history & CSV export', 'All 24 soundscapes — unlimited sessions', 'All 28+ healing frequencies', 'All 19 guided meditations', 'All 7 stress relief games', 'Unlimited accountability buddies', 'Tag & time-of-day pattern deep-dives', 'Mapp AI canvas — all 6 layers', 'Full wellness PDF export for therapist'],
  },
  {
    tier: 'Therapist Pro', price: '$9.99', period: '/mo', color: C.secondary, icon: 'psychology', trial: true,
    features: ['Everything in Pro', 'Unlimited client slots', 'Full client dashboard', 'Invite-link client onboarding', '14-day mood trend per client', 'Overdue log alerts', 'Private session notes per client', 'Client intake scores (PHQ-9, GAD-7)', 'Access to client AI wellness reports'],
  },
];

// ═════════════════════════════════════════════════════════════════════════════
export default function LandingScreen() {
  const router = useRouter();
  const { w, isMobile, isDesktop } = useLayout();
  const maxW = Math.min(w, 1200);
  // Mobile uses tighter horizontal padding throughout
  const hPad = isMobile ? 16 : 24;

  const heroFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(heroFade, { toValue: 1, duration: 900, delay: 200, useNativeDriver: true }).start();
  }, []);

  const laptopW = isDesktop ? Math.min(w * 0.50, 680) : Math.min(w - 48, 580);
  const phoneW  = isDesktop ? Math.min(w * 0.14, 210) : isMobile ? Math.min(w * 0.62, 220) : Math.min(w * 0.22, 200);

  // Phone screenshot card width — narrower on mobile for thumb scroll
  const phoneThumbW = isMobile ? 160 : 220;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ alignItems: 'center' }} showsVerticalScrollIndicator={false}>

        {/* ═══ NAV ════════════════════════════════════════════════════════ */}
        <View style={[s.nav, { width: '100%', paddingHorizontal: hPad }]}>
          <View style={[s.navInner, { width: '100%', maxWidth: maxW, alignSelf: 'center' }]}>
            <View style={s.navBrand}>
              <Image source={MOODPRINT_ICON} style={[s.navLogo, isMobile && { width: 30, height: 30 }, { borderRadius: 10, overflow: 'hidden' }]} contentFit="cover" />
              <Text style={[s.navTitle, isMobile && { fontSize: 15 }]}>MyMoodMapp</Text>
            </View>
            <View style={s.navRight}>
              {!isMobile && (
                <View style={s.navLinks}>
                  {['Features', 'Screenshots', 'Pricing'].map(l => (
                    <Text key={l} style={s.navLink}>{l}</Text>
                  ))}
                </View>
              )}
              {!isMobile && (
                <Pressable onPress={() => router.push('/login')} style={({ pressed }) => [s.navSignIn, pressed && { opacity: 0.7 }]}>
                  <Text style={s.navSignInText}>Sign in</Text>
                </Pressable>
              )}
              <Pressable onPress={() => router.push('/login')} style={({ pressed }) => [s.navCta, isMobile && { paddingHorizontal: 14, paddingVertical: 9 }, pressed && { opacity: 0.85 }]}>
                <Text style={[s.navCtaText, isMobile && { fontSize: 13 }]}>Try free</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ═══ TRIAL RIBBON ════════════════════════════════════════════════ */}
        <View style={[s.ribbon, { width: '100%', paddingHorizontal: hPad }]}>
          {isMobile ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={[s.ribbonText, { fontSize: 12 }]}>
                🎉 <Text style={{ fontWeight: '800', color: C.primary }}>30-day free trial</Text> — no card needed
              </Text>
              <Pressable onPress={() => router.push('/login')} style={({ pressed }) => [s.ribbonBtn, pressed && { opacity: 0.8 }]}>
                <Text style={s.ribbonBtnText}>Start →</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={s.ribbonDot} />
              <Text style={s.ribbonText}>
                🎉 <Text style={{ fontWeight: '800', color: C.primary }}>30-day free trial</Text> on Pro & Therapist Pro — no credit card required
              </Text>
              <Pressable onPress={() => router.push('/login')} style={({ pressed }) => [s.ribbonBtn, pressed && { opacity: 0.8 }]}>
                <Text style={s.ribbonBtnText}>Start free →</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* ═══ HERO ════════════════════════════════════════════════════════ */}
        <Animated.View style={[s.hero, {
          width: '100%',
          opacity: heroFade,
          minHeight: isDesktop ? 880 : isMobile ? 560 : 760,
          paddingVertical: isMobile ? 44 : 96,
          paddingHorizontal: hPad,
        }]}>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#020208' }]} />
          <View style={{ position: 'absolute', top: -200, left: '12%', width: 800, height: 800, borderRadius: 400, backgroundColor: 'rgba(94,92,230,0.10)', zIndex: 0 }} />
          <View style={{ position: 'absolute', bottom: -160, right: '5%', width: 640, height: 640, borderRadius: 320, backgroundColor: 'rgba(245,166,35,0.09)', zIndex: 0 }} />
          <View style={{ position: 'absolute', top: '40%', left: '-10%', width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(50,212,192,0.07)', zIndex: 0 }} />

          <View style={[s.heroContent, {
            width: isDesktop ? Math.min(w - 48, 1360) : '100%',
            flexDirection: isDesktop ? 'row' : 'column',
            alignItems: 'center',
            zIndex: 1,
            gap: isDesktop ? 0 : isMobile ? 28 : 48,
          }]}>
            {/* ── Copy ─────────────────────────────────────────────────── */}
            <View style={[s.heroCopy, {
              flex: isDesktop ? 1 : undefined,
              alignItems: isDesktop ? 'flex-start' : 'center',
              paddingRight: isDesktop ? 24 : 0,
              width: isMobile ? '100%' : undefined,
              gap: isMobile ? 14 : 22,
            }]}>
              <View style={[s.heroBadge, { alignSelf: isDesktop ? 'flex-start' : 'center' }]}>
                <MaterialIcons name="auto-awesome" size={12} color={C.primary} />
                <Text style={[s.heroBadgeText, isMobile && { fontSize: 10 }]}>
                  {isMobile ? 'AI-Powered Wellbeing' : 'AI-Powered Wellbeing Intelligence'}
                </Text>
              </View>
              <Text style={[s.heroTitle, {
                textAlign: isDesktop ? 'left' : 'center',
                fontSize: isDesktop ? 66 : isMobile ? 28 : 52,
                lineHeight: isDesktop ? 76 : isMobile ? 36 : 60,
              }]}>
                Know your vibe.{'\n'}<Text style={{ color: C.primary }}>Understand yourself.</Text>
              </Text>
              <Text style={[s.heroSub, {
                textAlign: isDesktop ? 'left' : 'center',
                fontSize: isMobile ? 14 : 17,
                lineHeight: isMobile ? 21 : 26,
              }]}>
                {isMobile
                  ? 'AI mood tracking, health insights, soundscapes and more — in one app.'
                  : 'MyMoodMapp fuses mood logging, AI insights, fitness data, weather, astrology, cycle tracking and healing soundscapes into one intelligent wellbeing picture.'}
              </Text>

              {/* Mobile: stacked full-width buttons */}
              {isMobile ? (
                <View style={{ width: '100%', gap: 10 }}>
                  <Pressable onPress={() => router.push('/login')} style={({ pressed }) => [s.heroMainBtn, { width: '100%', justifyContent: 'center' }, pressed && { opacity: 0.85 }]}>
                    <MaterialIcons name="language" size={18} color="#000" />
                    <Text style={s.heroMainBtnText}>Use Web App — Free</Text>
                  </Pressable>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable onPress={() => Linking.openURL(APP_STORE_URL)} style={({ pressed }) => [s.heroGhostBtn, { flex: 1, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12 }, pressed && { opacity: 0.75 }]}>
                      <MaterialIcons name="apple" size={16} color="#fff" />
                      <Text style={[s.heroGhostBtnText, { fontSize: 13 }]}>App Store</Text>
                    </Pressable>
                    <Pressable onPress={() => Linking.openURL(PLAY_STORE_URL)} style={({ pressed }) => [s.heroGhostBtn, { flex: 1, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12, borderColor: C.teal + '60' }, pressed && { opacity: 0.75 }]}>
                      <MaterialIcons name="android" size={16} color={C.teal} />
                      <Text style={[s.heroGhostBtnText, { color: C.teal, fontSize: 13 }]}>Google Play</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={[s.heroBtns, { justifyContent: isDesktop ? 'flex-start' : 'center' }]}>
                  <Pressable onPress={() => router.push('/login')} style={({ pressed }) => [s.heroMainBtn, pressed && { opacity: 0.85 }]}>
                    <MaterialIcons name="language" size={18} color="#000" />
                    <Text style={s.heroMainBtnText}>Use Web App →</Text>
                  </Pressable>
                  <Pressable onPress={() => Linking.openURL(APP_STORE_URL)} style={({ pressed }) => [s.heroGhostBtn, pressed && { opacity: 0.75 }]}>
                    <MaterialIcons name="apple" size={18} color="#fff" />
                    <Text style={s.heroGhostBtnText}>App Store</Text>
                  </Pressable>
                  <Pressable onPress={() => Linking.openURL(PLAY_STORE_URL)} style={({ pressed }) => [s.heroGhostBtn, { borderColor: C.teal + '60' }, pressed && { opacity: 0.75 }]}>
                    <MaterialIcons name="android" size={18} color={C.teal} />
                    <Text style={[s.heroGhostBtnText, { color: C.teal }]}>Google Play</Text>
                  </Pressable>
                </View>
              )}

              <View style={[s.heroTrust, { justifyContent: isDesktop ? 'flex-start' : 'center' }]}>
                {(isMobile
                  ? ['✓ 30 days free', '✓ No card', '✓ iOS · Android · Web']
                  : ['✓ 30-day free trial', '✓ No credit card', '✓ Web + iOS + Android', '✓ Cancel anytime']
                ).map(t => (
                  <Text key={t} style={[s.heroTrustItem, isMobile && { fontSize: 11 }]}>{t}</Text>
                ))}
              </View>
            </View>

            {/* Desktop hero visuals */}
            {isDesktop && (
              <View style={{ flex: 1.15, position: 'relative', alignItems: 'center', justifyContent: 'center', minHeight: 560 }}>
                <View style={{ position: 'absolute', width: 560, height: 560, borderRadius: 280, backgroundColor: 'rgba(94,92,230,0.16)', zIndex: 0 }} />
                <View style={{
                  position: 'absolute', left: -32, top: '50%', marginTop: -(laptopW / (1390 / 790) / 2),
                  shadowColor: '#5E5CE6', shadowOffset: { width: 0, height: 32 }, shadowOpacity: 0.30, shadowRadius: 56, elevation: 32, zIndex: 1, opacity: 0.85,
                }}>
                  <Image source={{ uri: 'https://cdn-ai.onspace.ai/onspace/files/gEF3rjf4CpB4a7vBeiXpV7/hero_laptop.png' }} style={{ width: laptopW * 0.88, aspectRatio: 1390 / 790, borderRadius: 12 }} contentFit="contain" transition={500} />
                </View>
                <View style={{ zIndex: 2, shadowColor: C.primary, shadowOffset: { width: 0, height: 40 }, shadowOpacity: 0.60, shadowRadius: 72, elevation: 48 }}>
                  <Image source={{ uri: 'https://cdn-ai.onspace.ai/onspace/files/LQJwVdaEfxThXQZCm5pRdU/hero_phone.png' }} style={{ width: Math.min(w * 0.20, 260), aspectRatio: 790 / 1560, borderRadius: 22 }} contentFit="contain" transition={500} />
                </View>
              </View>
            )}

            {/* Tablet hero visuals */}
            {!isDesktop && !isMobile && (
              <View style={{ width: '100%', position: 'relative', alignItems: 'center', justifyContent: 'center', paddingBottom: 56 }}>
                <View style={{ position: 'absolute', width: 480, height: 480, borderRadius: 240, backgroundColor: 'rgba(94,92,230,0.14)', top: -60, alignSelf: 'center', zIndex: 0 }} />
                <View style={{ zIndex: 1, shadowColor: '#5E5CE6', shadowOffset: { width: 0, height: 32 }, shadowOpacity: 0.45, shadowRadius: 64, elevation: 40 }}>
                  <Image source={{ uri: 'https://cdn-ai.onspace.ai/onspace/files/gEF3rjf4CpB4a7vBeiXpV7/hero_laptop.png' }} style={{ width: laptopW, aspectRatio: 1390 / 790, borderRadius: 12 }} contentFit="contain" transition={400} />
                </View>
                <View style={{ position: 'absolute', bottom: 0, right: 16, zIndex: 2, shadowColor: C.primary, shadowOffset: { width: 0, height: 32 }, shadowOpacity: 0.60, shadowRadius: 56, elevation: 40 }}>
                  <Image source={{ uri: 'https://cdn-ai.onspace.ai/onspace/files/LQJwVdaEfxThXQZCm5pRdU/hero_phone.png' }} style={{ width: phoneW, aspectRatio: 790 / 1560, borderRadius: 10 }} contentFit="contain" transition={400} />
                </View>
              </View>
            )}

            {/* Mobile hero — phone image centred */}
            {isMobile && (
              <View style={{ alignItems: 'center', position: 'relative', width: '100%' }}>
                <View style={{ position: 'absolute', width: phoneW * 1.2, height: phoneW * 1.2, borderRadius: phoneW * 0.6, backgroundColor: 'rgba(94,92,230,0.18)', alignSelf: 'center', zIndex: 0 }} />
                <View style={{ zIndex: 1, shadowColor: C.primary, shadowOffset: { width: 0, height: 28 }, shadowOpacity: 0.5, shadowRadius: 56, elevation: 40 }}>
                  <Image source={{ uri: 'https://cdn-ai.onspace.ai/onspace/files/LQJwVdaEfxThXQZCm5pRdU/hero_phone.png' }} style={{ width: phoneW, aspectRatio: 790 / 1560 }} contentFit="contain" transition={400} />
                </View>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ═══ STATS BAR ═══════════════════════════════════════════════════ */}
        <View style={[s.statsBar, { width: '100%' }]}>
          <View style={[s.statsInner, { width: '100%', maxWidth: maxW, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }]}>
            {[
              { val: '10 sec', label: isMobile ? 'Log time'   : 'Average log time'    },
              { val: '6+',     label: isMobile ? 'Data layers': 'Data layers fused'   },
              { val: '24',     label: isMobile ? 'Soundscapes': 'Ambient soundscapes' },
              { val: '7',      label: isMobile ? 'Games'      : 'Stress relief games' },
              { val: '30-day', label: isMobile ? 'Free trial' : 'Free trial included' },
              { val: 'E2E',    label: isMobile ? 'Encrypted'  : 'Encrypted data'      },
            ].map((stat, i) => (
              <View key={i} style={[s.statItem, isMobile && { width: '33.33%', paddingHorizontal: 6 }]}>
                <Text style={[s.statVal, isMobile && { fontSize: 18 }]}>{stat.val}</Text>
                <Text style={[s.statLabel, isMobile && { fontSize: 10 }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ═══ SCREENSHOT GALLERY ══════════════════════════════════════════ */}
        <View style={[s.section, { width: '100%', backgroundColor: '#050505', paddingHorizontal: 0, paddingVertical: isMobile ? 44 : 80 }]}>
          <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center', paddingHorizontal: hPad }}>
            <SectionLabel badge="Screenshots" color={C.primary} />
            <SectionTitle title="Every screen. Your actual app." sub="Real screenshots — dark and light themes, iPhone and web browser." isMobile={isMobile} />
          </View>
          <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center', marginBottom: 10, paddingHorizontal: hPad }}>
            <Text style={s.screenshotGroupLabel}>Web App</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hPad, gap: isMobile ? 12 : 20, paddingBottom: 12 }}>
            {WEB_SCREENSHOTS.map((sc, i) => (
              <View key={i} style={[s.webThumbWrap, isMobile && { width: Math.min(w * 0.78, 320) }]}>
                <View style={s.browserChrome}>
                  <View style={s.browserBarLeft}>
                    {[C.rose, '#FFD166', C.success].map((c, j) => (
                      <View key={j} style={[s.browserDot, { backgroundColor: c }]} />
                    ))}
                  </View>
                  <View style={s.browserUrl}>
                    <MaterialIcons name="lock" size={9} color={C.teal} />
                    <Text style={s.browserUrlText}>mymoodmapp.com</Text>
                  </View>
                </View>
                <Image source={{ uri: sc.uri }} style={s.webThumbImg} contentFit="cover" transition={300} />
                <View style={s.phoneThumbFooter}>
                  <Text style={[s.phoneThumbLabel, isMobile && { fontSize: 12 }]}>{sc.label}</Text>
                  <Text style={s.phoneThumbSub}>{sc.sub}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center', marginTop: 36, marginBottom: 10, paddingHorizontal: hPad }}>
            <Text style={s.screenshotGroupLabel}>iPhone & Android App — Dark &amp; Light Theme</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hPad, gap: isMobile ? 12 : 20, paddingBottom: 12 }}>
            {PHONE_SCREENSHOTS.map((sc, i) => (
              <View key={i} style={[s.phoneThumb, { width: phoneThumbW, borderRadius: isMobile ? 18 : 26 }]}>
                <Image source={{ uri: sc.uri }} style={s.phoneThumbImg} contentFit="cover" contentPosition="top" transition={200} />
                <View style={[s.phoneThumbFooter, isMobile && { paddingHorizontal: 10, paddingVertical: 10 }]}>
                  <Text style={[s.phoneThumbLabel, isMobile && { fontSize: 11 }]}>{sc.label}</Text>
                  <Text style={[s.phoneThumbSub, isMobile && { fontSize: 10 }]}>{sc.sub}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ═══ PLATFORM SHOWCASE ═══════════════════════════════════════════ */}
        <View style={[s.platformSection, { width: '100%', paddingHorizontal: hPad, paddingVertical: isMobile ? 44 : 80 }]}>
          <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center', gap: isMobile ? 28 : 48 }}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <SectionLabel badge="Available Everywhere" color={C.secondary} />
              <SectionTitle title="One app. All platforms." sub="Seamless across iPhone, Android and any web browser. Your data syncs instantly." isMobile={isMobile} />
            </View>
            <View style={[s.platformGrid, { flexDirection: isDesktop ? 'row' : 'column' }]}>
              {[
                { icon: 'apple',    color: '#fff',      label: 'iPhone & iPad', sub: 'Native iOS app with Apple Health integration, lockscreen audio controls and Apple Watch quick-log actions.', badge: 'iOS 15+' },
                { icon: 'android',  color: C.teal,      label: 'Android Phone', sub: 'Full Android experience with Google Fit sync, background audio and Material-style navigation.', badge: 'Android 9+' },
                { icon: 'language', color: C.secondary, label: 'Web Browser',   sub: 'Use MyMoodMapp in Chrome, Safari, Firefox or Edge. No install — same data, same AI, same everything.', badge: 'Any Browser' },
              ].map((p, i) => (
                <Pressable key={i} onPress={() => i === 2 ? router.push('/login') : Linking.openURL(i === 0 ? APP_STORE_URL : PLAY_STORE_URL)} style={({ pressed }) => [s.platformCard, pressed && { opacity: 0.85 }]}>
                  <View style={[s.platformIconWrap, { backgroundColor: p.color + '15' }]}>
                    <MaterialIcons name={p.icon as any} size={32} color={p.color} />
                  </View>
                  <View style={[s.platformBadge, { backgroundColor: p.color + '20', borderColor: p.color + '40' }]}>
                    <Text style={[s.platformBadgeText, { color: p.color }]}>{p.badge}</Text>
                  </View>
                  <Text style={s.platformLabel}>{p.label}</Text>
                  <Text style={s.platformSub}>{p.sub}</Text>
                  <View style={s.platformArrow}>
                    <MaterialIcons name="arrow-forward" size={16} color={p.color} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* ═══ FULL FEATURE GRID ══════════════════════════════════════════ */}
        <View style={[s.section, { width: '100%', paddingHorizontal: hPad, paddingVertical: isMobile ? 44 : 80 }]}>
          <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center' }}>
            <SectionLabel badge="Features" color={C.teal} />
            <SectionTitle title="Everything you need." sub="18 features across mood intelligence, health fusion, sound therapy and social accountability." isMobile={isMobile} />
            <View style={[s.featGrid, { flexDirection: 'row', flexWrap: 'wrap' }]}>
              {ALL_FEATURES.map((f, i) => (
                <View key={i} style={[s.featCard, { width: isDesktop ? '30%' : isMobile ? '100%' : '46%' }]}>
                  <View style={[s.featIcon, { backgroundColor: f.color + '15' }]}>
                    <MaterialIcons name={f.icon as any} size={20} color={f.color} />
                  </View>
                  <Text style={s.featTitle}>{f.title}</Text>
                  <Text style={s.featDesc}>{f.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ═══ SOUND LAB SPOTLIGHT ════════════════════════════════════════ */}
        <View style={[s.spotlightSection, { width: '100%', backgroundColor: '#050F0D', paddingHorizontal: hPad, paddingVertical: isMobile ? 44 : 80 }]}>
          <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center', flexDirection: isDesktop ? 'row' : 'column', gap: isMobile ? 28 : 48, alignItems: 'center' }}>
            <View style={{ flex: isDesktop ? 1 : undefined, gap: 16, width: isMobile ? '100%' : undefined }}>
              <View style={[s.heroBadge, { backgroundColor: C.teal + '15', borderColor: C.teal + '30', alignSelf: isDesktop ? 'flex-start' : 'center' }]}>
                <MaterialIcons name="waves" size={12} color={C.teal} />
                <Text style={[s.heroBadgeText, { color: C.teal }]}>Mood Lab</Text>
              </View>
              <Text style={[s.sectionTitle2, { textAlign: isDesktop ? 'left' : 'center', fontSize: isDesktop ? 38 : isMobile ? 22 : 28 }]}>
                Your personal sound sanctuary.
              </Text>
              <Text style={[s.sectionSub2, { textAlign: isDesktop ? 'left' : 'center', fontSize: isMobile ? 14 : 16 }]}>
                24 ambient soundscapes. 28+ healing frequencies. 19 guided meditations. 7 stress relief games.
              </Text>
              <View style={{ gap: 10 }}>
                {[
                  { icon: 'music-note',       color: C.teal,    label: '24 Ambient Soundscapes',   sub: 'Rain, ocean, forest, fire, urban and space' },
                  { icon: 'waves',            color: '#4ADE80', label: '28+ Healing Frequencies',   sub: 'Solfeggio, binaural, brainwave — on-device' },
                  { icon: 'self-improvement', color: '#A78BFA', label: '19 Guided Meditations',     sub: 'Sleep, anxiety, mindfulness, focus' },
                  { icon: 'games',            color: '#F472B6', label: '7 Stress Relief Games',     sub: 'Breathing, tactile, puzzle, pixel art and MoodBeat' },
                ].map((item, i) => (
                  <View key={i} style={s.soundFeatureRow}>
                    <View style={[s.soundFeatureIcon, { backgroundColor: item.color + '18' }]}>
                      <MaterialIcons name={item.icon as any} size={18} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.soundFeatureLabel, isMobile && { fontSize: 13 }]}>{item.label}</Text>
                      <Text style={s.soundFeatureSub}>{item.sub}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ alignItems: 'center' }}>
              <View style={[s.phoneFrame, isMobile && { width: Math.min(w - hPad * 2, 220) }]}>
                <Image source={{ uri: 'https://cdn-ai.onspace.ai/onspace/files/j8V63eSB83yCWuCTxCaoHQ/dark_04_moodlab.jpg' }} style={s.phoneFrameImg} contentFit="cover" contentPosition="top" transition={300} />
              </View>
            </View>
          </View>
        </View>

        {/* ═══ MAPP SPOTLIGHT ══════════════════════════════════════════════ */}
        <View style={[s.spotlightSection, { width: '100%', backgroundColor: '#06060F', paddingHorizontal: hPad, paddingVertical: isMobile ? 44 : 80 }]}>
          <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center', flexDirection: isDesktop ? 'row-reverse' : 'column', gap: isMobile ? 28 : 48, alignItems: 'center' }}>
            <View style={{ flex: isDesktop ? 1 : undefined, gap: 16, width: isMobile ? '100%' : undefined }}>
              <View style={[s.heroBadge, { backgroundColor: C.secondary + '15', borderColor: C.secondary + '30', alignSelf: isDesktop ? 'flex-start' : 'center' }]}>
                <MaterialIcons name="explore" size={12} color={C.secondary} />
                <Text style={[s.heroBadgeText, { color: C.secondary }]}>Mapp</Text>
              </View>
              <Text style={[s.sectionTitle2, { textAlign: isDesktop ? 'left' : 'center', fontSize: isDesktop ? 38 : isMobile ? 22 : 28 }]}>
                Your emotions, visualised as art.
              </Text>
              <Text style={[s.sectionSub2, { textAlign: isDesktop ? 'left' : 'center', fontSize: isMobile ? 14 : 16 }]}>
                A living AI canvas that transforms your mood data into beautiful generative artwork. Six layers reveal different dimensions of your emotional landscape.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: isDesktop ? 'flex-start' : 'center' }}>
                {['Today', 'Week', 'Month', 'Drivers', 'Forecast', 'Mood Print'].map(layer => (
                  <View key={layer} style={[s.layerChip, { borderColor: C.secondary + '40', backgroundColor: C.secondary + '10' }]}>
                    <Text style={[s.layerChipText, { color: C.secondary }]}>{layer}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ alignItems: 'center' }}>
              <View style={[s.phoneFrame, isMobile && { width: Math.min(w - hPad * 2, 220) }]}>
                <Image source={{ uri: 'https://cdn-ai.onspace.ai/onspace/files/DB3YfdGqKwFTxrBSfaGMLH/dark_05_mapp.jpg' }} style={s.phoneFrameImg} contentFit="cover" contentPosition="top" transition={300} />
              </View>
            </View>
          </View>
        </View>

        {/* ═══ THERAPIST SECTION ═══════════════════════════════════════════ */}
        <View style={[s.section, { width: '100%', backgroundColor: '#08080F', paddingHorizontal: hPad, paddingVertical: isMobile ? 44 : 80 }]}>
          <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center' }}>
            <SectionLabel badge="For Therapists" color={C.secondary} />
            <SectionTitle title="Built for mental health professionals." sub="MyMoodMapp Therapist Pro gives you a real-time window into your clients' daily wellbeing." isMobile={isMobile} />
            <View style={[s.therapistGrid, { flexDirection: isDesktop ? 'row' : 'column' }]}>
              {[
                { icon: 'group',         color: C.secondary, title: 'Unlimited Clients',       desc: 'Invite clients via a link. They join and their data flows to your dashboard automatically.' },
                { icon: 'bar-chart',     color: C.primary,   title: '14-Day Mood Trends',      desc: "See each client's mood trajectory, score, body, mind and energy dimensions at a glance." },
                { icon: 'notifications', color: C.teal,      title: 'Overdue Log Alerts',      desc: 'Get notified when a client misses their daily check-in so you can follow up.' },
                { icon: 'note',          color: '#F472B6',   title: 'Private Notes',           desc: 'Keep private session notes per client — never visible to them.' },
                { icon: 'description',   color: '#FFD166',   title: 'Wellness Reports',        desc: 'Access full AI-generated wellness reports for every client before sessions.' },
                { icon: 'psychology',    color: '#A78BFA',   title: 'Clinical Questionnaires', desc: 'PHQ-9, GAD-7, AUDIT-C and sleep scoring shared by clients during onboarding.' },
              ].map((f, i) => (
                <View key={i} style={[s.therapistCard, { flex: isDesktop ? 1 : undefined, minWidth: isDesktop ? 0 : '100%' }]}>
                  <View style={[s.featIcon, { backgroundColor: f.color + '15' }]}>
                    <MaterialIcons name={f.icon as any} size={20} color={f.color} />
                  </View>
                  <Text style={s.featTitle}>{f.title}</Text>
                  <Text style={s.featDesc}>{f.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ═══ TESTIMONIALS ════════════════════════════════════════════════ */}
        <View style={[s.section, { width: '100%', paddingHorizontal: 0, paddingVertical: isMobile ? 44 : 80 }]}>
          <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center', paddingHorizontal: hPad }}>
            <SectionLabel badge="Reviews" color={C.primary} />
            <SectionTitle title="Loved by users worldwide." sub="" isMobile={isMobile} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: hPad, gap: 12, paddingBottom: 8 }}>
            {TESTIMONIALS.map((t, i) => (
              <View key={i} style={[s.testimonialCard, isMobile && { width: Math.min(w * 0.78, 260), padding: 18 }]}>
                <View style={s.starsRow}>
                  {Array.from({ length: t.rating }, (_, j) => (
                    <MaterialIcons key={j} name="star" size={13} color={C.primary} />
                  ))}
                </View>
                <Text style={[s.testimonialQuote, isMobile && { fontSize: 13 }]}>&ldquo;{t.quote}&rdquo;</Text>
                <View style={s.testimonialAuthor}>
                  <View style={s.testimonialAvatar}>
                    <Text style={s.testimonialAvatarText}>{t.author[0]}</Text>
                  </View>
                  <View>
                    <Text style={s.testimonialName}>{t.author}</Text>
                    <Text style={s.testimonialRole}>{t.role}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ═══ PRICING ═════════════════════════════════════════════════════ */}
        <View style={[s.section, { width: '100%', backgroundColor: '#050505', paddingHorizontal: hPad, paddingVertical: isMobile ? 44 : 80 }]}>
          <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center' }}>
            <SectionLabel badge="Pricing" color={C.primary} />
            <SectionTitle title="30 days free. Then simple." sub="No credit card required to start. Billing begins on day 31 if you don't cancel." isMobile={isMobile} />

            <View style={s.trialExplainer}>
              {[
                { icon: 'login',       step: 'Day 1',     desc: 'Sign up, choose Pro or Therapist Pro' },
                { icon: 'star',        step: 'Days 1–30', desc: 'Full access at zero cost' },
                { icon: 'credit-card', step: 'Day 31+',   desc: 'Auto-billed monthly · cancel any time' },
              ].map((step, i) => (
                <View key={i} style={s.trialStep}>
                  {i > 0 && <View style={s.trialStepLine} />}
                  <View style={s.trialStepDot}>
                    <MaterialIcons name={step.icon as any} size={14} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.trialStepLabel}>{step.step}</Text>
                    <Text style={s.trialStepDesc}>{step.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={[s.pricingGrid, { flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start' }]}>
              {PRICING.map((plan: any, i: number) => (
                <View key={i} style={[s.pricingCard, { flex: isMobile ? undefined : 1 }, plan.highlight && s.pricingCardHL]}>
                  {plan.highlight && (
                    <View style={s.popularPill}>
                      <Text style={s.popularPillText}>Most Popular</Text>
                    </View>
                  )}
                  <View style={[s.pricingIconWrap, { backgroundColor: plan.color + '15' }]}>
                    <MaterialIcons name={plan.icon as any} size={22} color={plan.color} />
                  </View>
                  <Text style={[s.pricingTier, { color: plan.color }]}>{plan.tier}</Text>
                  {plan.trial && (
                    <View style={s.trialPill}>
                      <Text style={s.trialPillText}>30-day free trial</Text>
                    </View>
                  )}
                  <View style={s.pricingPriceRow}>
                    <Text style={s.pricingPrice}>{plan.price}</Text>
                    {plan.period ? <Text style={s.pricingPeriod}>{plan.period}</Text> : null}
                  </View>
                  {plan.trial && (
                    <Text style={s.trialAfterNote}>Free for 30 days, then {plan.price}{plan.period}</Text>
                  )}
                  <View style={s.pricingDivider} />
                  {plan.features.map((f: string, j: number) => (
                    <View key={j} style={s.pricingFeatureRow}>
                      <MaterialIcons name="check" size={13} color={plan.color} />
                      <Text style={s.pricingFeatureText}>{f}</Text>
                    </View>
                  ))}
                  <Pressable
                    onPress={() => router.push('/login')}
                    style={({ pressed }) => [s.pricingCta, { backgroundColor: plan.highlight ? plan.color : 'transparent', borderColor: plan.color }, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={[s.pricingCtaText, { color: plan.highlight ? '#000' : plan.color }]}>
                      {plan.tier === 'Free' ? 'Get started free' : 'Start 30-day trial'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
            <Text style={s.pricingNote}>
              No credit card required to start your trial. Cancel any time before day 31 — you will never be charged.
            </Text>
          </View>
        </View>

        {/* ═══ FINAL CTA ═══════════════════════════════════════════════════ */}
        <View style={[s.finalSection, { width: '100%', paddingHorizontal: hPad, paddingVertical: isMobile ? 56 : 100 }]}>
          <View style={[s.finalGlow]} />
          <View style={{ width: '100%', maxWidth: maxW, alignSelf: 'center', alignItems: 'center', gap: isMobile ? 16 : 24, position: 'relative' }}>
            <Image source={MOODPRINT_ICON} style={[s.finalIcon, isMobile && { width: 96, height: 96 }, { borderRadius: 24, overflow: 'hidden' }]} contentFit="cover" />
            <Text style={[s.finalTitle, { fontSize: isDesktop ? 48 : isMobile ? 24 : 38, textAlign: 'center' }]}>
              Try Pro free for 30 days
            </Text>
            <Text style={[s.finalSub, { textAlign: 'center', maxWidth: 520, fontSize: isMobile ? 14 : 16, lineHeight: isMobile ? 22 : 26 }]}>
              No credit card. Full access from day one. Available on web, iOS and Android.
            </Text>
            {isMobile ? (
              <View style={{ width: '100%', gap: 10 }}>
                <Pressable onPress={() => router.push('/login')} style={({ pressed }) => [s.heroMainBtn, { width: '100%', justifyContent: 'center' }, pressed && { opacity: 0.85 }]}>
                  <MaterialIcons name="language" size={18} color="#000" />
                  <Text style={s.heroMainBtnText}>Open Web App — Free</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={() => Linking.openURL(APP_STORE_URL)} style={({ pressed }) => [s.heroGhostBtn, { flex: 1, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12 }, pressed && { opacity: 0.75 }]}>
                    <MaterialIcons name="apple" size={16} color="#fff" />
                    <Text style={[s.heroGhostBtnText, { fontSize: 13 }]}>App Store</Text>
                  </Pressable>
                  <Pressable onPress={() => Linking.openURL(PLAY_STORE_URL)} style={({ pressed }) => [s.heroGhostBtn, { flex: 1, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12, borderColor: C.teal + '60' }, pressed && { opacity: 0.75 }]}>
                    <MaterialIcons name="android" size={16} color={C.teal} />
                    <Text style={[s.heroGhostBtnText, { color: C.teal, fontSize: 13 }]}>Google Play</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={[s.heroBtns, { justifyContent: 'center', flexWrap: 'wrap' }]}>
                <Pressable onPress={() => router.push('/login')} style={({ pressed }) => [s.heroMainBtn, { minWidth: 200 }, pressed && { opacity: 0.85 }]}>
                  <MaterialIcons name="language" size={18} color="#000" />
                  <Text style={s.heroMainBtnText}>Open Web App — Free</Text>
                </Pressable>
                <Pressable onPress={() => Linking.openURL(APP_STORE_URL)} style={({ pressed }) => [s.heroGhostBtn, pressed && { opacity: 0.75 }]}>
                  <MaterialIcons name="apple" size={18} color="#fff" />
                  <Text style={s.heroGhostBtnText}>App Store</Text>
                </Pressable>
                <Pressable onPress={() => Linking.openURL(PLAY_STORE_URL)} style={({ pressed }) => [s.heroGhostBtn, { borderColor: C.teal + '60' }, pressed && { opacity: 0.75 }]}>
                  <MaterialIcons name="android" size={18} color={C.teal} />
                  <Text style={[s.heroGhostBtnText, { color: C.teal }]}>Google Play</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* ═══ FOOTER ══════════════════════════════════════════════════════ */}
        <View style={[s.footer, { width: '100%', paddingHorizontal: hPad }]}>
          <View style={[s.footerInner, { width: '100%', maxWidth: maxW, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center' }]}>
            <View style={s.footerBrand}>
              <Image source={MOODPRINT_ICON} style={[s.navLogo, { borderRadius: 10, overflow: 'hidden' }]} contentFit="cover" />
              <Text style={s.navTitle}>MyMoodMapp</Text>
            </View>
            <Text style={s.footerTagline}>Track what moves you.</Text>
            <View style={[s.footerLinks, { marginLeft: isMobile ? 0 : 'auto' as any }]}>
              <Pressable onPress={() => router.push('/privacy' as any)} style={({ pressed }) => pressed && { opacity: 0.7 }}>
                <Text style={s.footerLink}>Privacy Policy</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/support' as any)} style={({ pressed }) => pressed && { opacity: 0.7 }}>
                <Text style={s.footerLink}>Terms of Service</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/support' as any)} style={({ pressed }) => pressed && { opacity: 0.7 }}>
                <Text style={s.footerLink}>Contact</Text>
              </Pressable>
            </View>
          </View>
          <View style={[s.footerBottom, { width: '100%', maxWidth: maxW }]}>
            <Text style={s.footerCopy}>© {new Date().getFullYear()} MyMoodMapp. All rights reserved.</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Reusable Section components ─────────────────────────────────────────────
function SectionLabel({ badge, color }: { badge: string; color: string }) {
  return (
    <View style={[sl.badge, { backgroundColor: color + '15', borderColor: color + '30', alignSelf: 'center', marginBottom: 12 }]}>
      <Text style={[sl.badgeText, { color }]}>{badge}</Text>
    </View>
  );
}
function SectionTitle({ title, sub, isMobile }: { title: string; sub: string; isMobile?: boolean }) {
  return (
    <View style={[sl.titleBlock, isMobile && { marginBottom: 24, gap: 8 }]}>
      <Text style={[sl.title, isMobile && { fontSize: 22, lineHeight: 28 }]}>{title}</Text>
      {sub ? <Text style={[sl.sub, isMobile && { fontSize: 13, lineHeight: 20 }]}>{sub}</Text> : null}
    </View>
  );
}
const sl = StyleSheet.create({
  badge:      { flexDirection: 'row', alignItems: 'center', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1 },
  badgeText:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, includeFontPadding: false },
  titleBlock: { alignItems: 'center', gap: 12, marginBottom: 40, paddingHorizontal: 8 },
  title:      { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 36, includeFontPadding: false },
  sub:        { fontSize: 15, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22, maxWidth: 600, includeFontPadding: false },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  nav:           { backgroundColor: 'rgba(0,0,0,0.92)', borderBottomWidth: 1, borderBottomColor: C.borderSubtle, paddingVertical: 12, alignItems: 'center', zIndex: 100 },
  navInner:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBrand:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navLogo:       { width: 36, height: 36, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.primary + '30' },
  navTitle:      { fontSize: 17, fontWeight: '800', color: '#fff', includeFontPadding: false },
  navRight:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navLinks:      { flexDirection: 'row', gap: 24, marginRight: 16 },
  navLink:       { fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: '500', includeFontPadding: false },
  navSignIn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  navSignInText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600', includeFontPadding: false },
  navCta:        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: C.primary },
  navCtaText:    { fontSize: 14, fontWeight: '700', color: '#000', includeFontPadding: false },
  ribbon:        { backgroundColor: C.primaryGlow, borderBottomWidth: 1, borderBottomColor: C.primary + '30', paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' },
  ribbonDot:     { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.primary },
  ribbonText:    { fontSize: 13, color: 'rgba(255,255,255,0.85)', includeFontPadding: false },
  ribbonBtn:     { backgroundColor: C.primary, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 5 },
  ribbonBtnText: { fontSize: 12, fontWeight: '800', color: '#000', includeFontPadding: false },
  hero:          { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroContent:   { gap: 56, alignItems: 'center', justifyContent: 'center' },
  heroCopy:      { gap: 22, maxWidth: 580 },
  heroBadge:     { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.primaryGlow, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: C.primary + '30' },
  heroBadgeText: { fontSize: 11, fontWeight: '700', color: C.primary, includeFontPadding: false },
  heroTitle:     { fontWeight: '900', color: '#fff', includeFontPadding: false },
  heroSub:       { fontSize: 17, color: 'rgba(255,255,255,0.6)', lineHeight: 26, includeFontPadding: false },
  heroBtns:      { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  heroMainBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, minHeight: 50 },
  heroMainBtnText: { fontSize: 15, fontWeight: '800', color: '#000', includeFontPadding: false },
  heroGhostBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', minHeight: 50 },
  heroGhostBtnText: { fontSize: 15, fontWeight: '700', color: '#fff', includeFontPadding: false },
  heroTrust:     { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  heroTrustItem: { fontSize: 12, color: C.teal, fontWeight: '600', includeFontPadding: false },
  heroImgWrap:   { alignItems: 'center', justifyContent: 'center', minWidth: 420, flexDirection: 'row' },
  heroPhone:     { width: 200, backgroundColor: '#000', borderRadius: 26, overflow: 'hidden' },
  heroPhoneImg:  { width: '100%', aspectRatio: 9 / 16 },
  statsBar:   { backgroundColor: '#0A0A0A', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.borderSubtle, paddingVertical: 20, alignItems: 'center' },
  statsInner: { gap: 0, alignSelf: 'center' },
  statItem:   { alignItems: 'center', gap: 4, paddingHorizontal: 20, paddingVertical: 10 },
  statVal:    { fontSize: 24, fontWeight: '900', color: C.primary, includeFontPadding: false },
  statLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', includeFontPadding: false },
  section:       { paddingVertical: 80, paddingHorizontal: 24 },
  sectionTitle2: { fontWeight: '800', color: '#fff', lineHeight: 1.15 * 38, includeFontPadding: false },
  sectionSub2:   { fontSize: 16, color: 'rgba(255,255,255,0.55)', lineHeight: 26, includeFontPadding: false },
  screenshotGroupLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: 4, includeFontPadding: false },
  webThumbWrap:  { width: 540, borderRadius: 12, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.7, shadowRadius: 32, elevation: 20 },
  webThumbImg:   { width: '100%', aspectRatio: 16 / 9 },
  browserChrome:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161618', paddingHorizontal: 12, paddingVertical: 7, gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  browserBarLeft: { flexDirection: 'row', gap: 5 },
  browserDot:     { width: 9, height: 9, borderRadius: 4.5 },
  browserUrl:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 220, alignSelf: 'center' },
  browserUrlText: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600', includeFontPadding: false },
  phoneThumb:       { width: 220, borderRadius: 26, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  phoneThumbImg:    { width: '100%', aspectRatio: 9 / 16 },
  phoneThumbFooter: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 3, backgroundColor: '#0A0A0A', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  phoneThumbLabel:  { fontSize: 13, fontWeight: '700', color: '#fff', includeFontPadding: false },
  phoneThumbSub:    { fontSize: 10, color: 'rgba(255,255,255,0.4)', includeFontPadding: false },
  platformSection:  { paddingVertical: 80, paddingHorizontal: 24, backgroundColor: '#080808' },
  platformGrid:     { gap: 14 },
  platformCard:     { flex: 1, backgroundColor: C.bgCard, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: C.borderSubtle, gap: 10 },
  platformIconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  platformBadge:    { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1 },
  platformBadgeText: { fontSize: 10, fontWeight: '700', includeFontPadding: false },
  platformLabel:    { fontSize: 17, fontWeight: '800', color: '#fff', includeFontPadding: false },
  platformSub:      { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 19, includeFontPadding: false },
  platformArrow:    { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  featGrid:  { gap: 12, justifyContent: 'center' },
  featCard:  { backgroundColor: C.bgCard, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.borderSubtle, gap: 8, margin: 3 },
  featIcon:  { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  featTitle: { fontSize: 15, fontWeight: '700', color: '#fff', includeFontPadding: false },
  featDesc:  { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18, includeFontPadding: false },
  spotlightSection:  { paddingVertical: 80, paddingHorizontal: 24 },
  soundFeatureRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  soundFeatureIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  soundFeatureLabel: { fontSize: 14, fontWeight: '700', color: '#fff', includeFontPadding: false },
  soundFeatureSub:   { fontSize: 11, color: 'rgba(255,255,255,0.45)', includeFontPadding: false, marginTop: 2 },
  phoneFrame:        { width: 240, backgroundColor: '#000', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.8, shadowRadius: 48, elevation: 24 },
  phoneFrameImg:     { width: '100%', aspectRatio: 9 / 16 },
  layerChip:     { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  layerChipText: { fontSize: 12, fontWeight: '700', includeFontPadding: false },
  therapistGrid: { flexWrap: 'wrap', gap: 14 },
  therapistCard: { backgroundColor: C.bgCard, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.borderSubtle, gap: 8, minWidth: '45%' },
  testimonialCard:       { width: 280, backgroundColor: C.bgCard, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.borderSubtle, gap: 12 },
  starsRow:              { flexDirection: 'row', gap: 3 },
  testimonialQuote:      { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 20, fontStyle: 'italic', includeFontPadding: false },
  testimonialAuthor:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  testimonialAvatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primaryGlow, borderWidth: 1, borderColor: C.primary + '40', alignItems: 'center', justifyContent: 'center' },
  testimonialAvatarText: { fontSize: 13, fontWeight: '800', color: C.primary, includeFontPadding: false },
  testimonialName:       { fontSize: 12, fontWeight: '700', color: '#fff', includeFontPadding: false },
  testimonialRole:       { fontSize: 10, color: 'rgba(255,255,255,0.4)', includeFontPadding: false },
  trialExplainer:  { backgroundColor: C.bgCard, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.primary + '30', gap: 0, marginBottom: 32 },
  trialStep:       { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 10 },
  trialStepLine:   { position: 'absolute', left: 15, top: -8, width: 2, height: 18, backgroundColor: C.primary + '30' },
  trialStepDot:    { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primaryGlow, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.primary + '40', flexShrink: 0 },
  trialStepLabel:  { fontSize: 13, fontWeight: '800', color: C.primary, includeFontPadding: false },
  trialStepDesc:   { fontSize: 13, color: 'rgba(255,255,255,0.55)', includeFontPadding: false },
  pricingGrid:     { gap: 14, marginBottom: 18 },
  pricingCard:     { backgroundColor: C.bgCard, borderRadius: 18, padding: 22, borderWidth: 1, borderColor: C.borderSubtle, gap: 10, position: 'relative' },
  pricingCardHL:   { backgroundColor: C.bgElevated, borderColor: C.primary + '60' },
  popularPill:     { position: 'absolute', top: -12, alignSelf: 'center', backgroundColor: C.primary, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 5 },
  popularPillText: { fontSize: 10, fontWeight: '800', color: '#000', includeFontPadding: false },
  pricingIconWrap: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  pricingTier:     { fontSize: 16, fontWeight: '800', includeFontPadding: false },
  trialPill:       { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: C.primaryGlow, borderWidth: 1, borderColor: C.primary + '40' },
  trialPillText:   { fontSize: 11, fontWeight: '700', color: C.primary, includeFontPadding: false },
  trialAfterNote:  { fontSize: 11, color: 'rgba(255,255,255,0.35)', includeFontPadding: false, marginTop: -4 },
  pricingPriceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  pricingPrice:    { fontSize: 32, fontWeight: '900', color: '#fff', includeFontPadding: false },
  pricingPeriod:   { fontSize: 13, color: 'rgba(255,255,255,0.4)', paddingBottom: 4, includeFontPadding: false },
  pricingDivider:  { height: 1, backgroundColor: C.borderSubtle, marginVertical: 4 },
  pricingFeatureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pricingFeatureText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', flex: 1, lineHeight: 19, includeFontPadding: false },
  pricingCta:      { marginTop: 8, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5 },
  pricingCtaText:  { fontSize: 14, fontWeight: '800', includeFontPadding: false },
  pricingNote:     { fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', includeFontPadding: false },
  finalSection: { paddingHorizontal: 24, backgroundColor: '#050505', alignItems: 'center', overflow: 'hidden', position: 'relative' },
  finalGlow:    { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: C.primaryGlow, alignSelf: 'center', top: -100, zIndex: 0 },
  finalIcon:    { width: 120, height: 120, borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: C.primary + '40' },
  finalTitle:   { fontWeight: '900', color: '#fff', includeFontPadding: false },
  finalSub:     { color: 'rgba(255,255,255,0.55)', includeFontPadding: false },
  footer:        { backgroundColor: '#000', borderTopWidth: 1, borderTopColor: C.borderSubtle, paddingTop: 32, paddingBottom: 24, alignItems: 'center', gap: 14 },
  footerInner:   { gap: 14, width: '100%' },
  footerBrand:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerTagline: { fontSize: 13, color: 'rgba(255,255,255,0.3)', includeFontPadding: false },
  footerLinks:   { flexDirection: 'row', gap: 18, flexWrap: 'wrap' },
  footerLink:    { fontSize: 13, color: 'rgba(255,255,255,0.4)', includeFontPadding: false },
  footerBottom:  { borderTopWidth: 1, borderTopColor: C.borderSubtle, paddingTop: 14, width: '100%' },
  footerCopy:    { fontSize: 12, color: 'rgba(255,255,255,0.2)', includeFontPadding: false },
});
