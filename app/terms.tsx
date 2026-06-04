// @ts-nocheck
/**
 * Terms of Service — /terms
 * Full legal Terms of Service for MyMoodMapp.
 * Effective Date: May 9, 2026
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const C = {
  bg:           '#000000',
  bgCard:       '#111111',
  bgElevated:   '#1A1A1E',
  border:       '#2C2C2E',
  borderSubtle: 'rgba(255,255,255,0.08)',
  primary:      '#F5A623',
  primaryGlow:  'rgba(245,166,35,0.12)',
  secondary:    '#5E5CE6',
  teal:         '#32D4C0',
  text:         '#FFFFFF',
  textSecondary:'rgba(255,255,255,0.65)',
  textMuted:    'rgba(255,255,255,0.35)',
  success:      '#30D158',
  error:        '#FF453A',
};

const SUPPORT_EMAIL = 'support@mymoodmapp.com';
const EFFECTIVE_DATE = 'May 9, 2026';

function useWidth() {
  const [w, setW] = React.useState(Dimensions.get('window').width);
  React.useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setW(window.width));
    return () => sub?.remove();
  }, []);
  return w;
}

export default function TermsScreen() {
  const router = useRouter();
  const w = useWidth();
  const isMobile = w < 600;
  const maxW = Math.min(w, 900);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={[s.headerInner, { width: Math.min(w, 1200) }]}>
          <Pressable
            onPress={() => { try { router.back(); } catch { router.push('/landing' as any); } }}
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.65 }]}
            hitSlop={10}
          >
            <MaterialIcons name="arrow-back" size={20} color={C.text} />
            <Text style={s.backText}>Back</Text>
          </Pressable>
          <View style={s.headerBrand}>
            <View style={s.headerLogo}><Text style={{ fontSize: 16 }}>😌</Text></View>
            <Text style={s.headerTitle}>MyMoodMapp</Text>
          </View>
          <Pressable
            onPress={() => router.push('/login' as any)}
            style={({ pressed }) => [s.headerCta, pressed && { opacity: 0.8 }]}
          >
            <Text style={s.headerCtaText}>Sign in</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { alignItems: 'center' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[s.heroBanner, { width: '100%' }]}>
          <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 24 }}>
            <View style={s.heroBadge}>
              <MaterialIcons name="description" size={13} color={C.primary} />
              <Text style={s.heroBadgeText}>Terms of Service</Text>
            </View>
            <Text style={[s.heroTitle, { fontSize: isMobile ? 28 : 38 }]}>Terms of Service</Text>
            <Text style={s.heroSub}>
              Please read these terms carefully before using MyMoodMapp. By creating an account or using the app, you agree to these terms.
            </Text>
            <View style={s.heroMeta}>
              <View style={s.heroMetaPill}>
                <MaterialIcons name="calendar-today" size={11} color={C.teal} />
                <Text style={[s.heroMetaText, { color: C.teal }]}>Effective: {EFFECTIVE_DATE}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[s.content, { width: maxW }]}>

          <Section num="1" title="Acceptance of Terms">
            <Body>By downloading, installing, or using MyMoodMapp ("the App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the App.</Body>
            <Body>These Terms constitute a legally binding agreement between you and MyMoodMapp. We may update these Terms from time to time. Continued use after changes constitutes acceptance of the updated Terms.</Body>
          </Section>

          <Section num="2" title="Description of Service">
            <Body>MyMoodMapp is a personal wellness tracking application that helps users log and understand their moods, correlate them with lifestyle factors, and access guided wellness content. The App includes:</Body>
            <Bullets items={[
              'Mood logging with body, mind, energy, and focus dimensions',
              'AI-powered pattern analysis and wellness reports',
              'Ambient soundscapes, healing frequencies, and guided meditation (Mood Lab)',
              'Accountability Buddy and Therapist Pro features',
              'Health data correlation (steps, sleep, heart rate) via Apple Health / Google Fit',
              'Astrology and environmental context features',
            ]} />
          </Section>

          <Section num="3" title="Not Medical Advice — Important Disclaimer">
            <Alert color={C.error} icon="warning">
              MyMoodMapp is a wellness and self-tracking tool. It is NOT a medical device, medical application, or mental health treatment service. Nothing in the App constitutes medical advice, clinical diagnosis, or professional mental health treatment.
            </Alert>
            <Body>Specifically:</Body>
            <Bullets items={[
              'The PHQ-9 (Patient Health Questionnaire) and GAD-7 (Generalized Anxiety Disorder scale) questionnaires are screening tools only — they do not constitute a clinical diagnosis',
              'AI-generated wellness reports and insights are interpretive tools for self-awareness, not professional assessments',
              'Mood scores, patterns, and correlations are informational only',
              'The Guided Meditation content is for general wellness purposes',
              'Nothing in the App replaces consultation with a qualified mental health professional, physician, or other licensed healthcare provider',
            ]} />
            <Body>If you are experiencing a mental health crisis or emergency, please contact emergency services (911 in the US) or a crisis helpline such as the 988 Suicide &amp; Crisis Lifeline (call or text 988 in the US).</Body>
            <Body>The Therapist Pro features are tools to assist licensed professionals — they do not make MyMoodMapp a HIPAA-covered entity. Therapist Pro subscribers are solely responsible for compliance with applicable professional regulations (HIPAA, GDPR, applicable state/country licensing laws).</Body>
          </Section>

          <Section num="4" title="Account Registration">
            <Body>You must create an account to use the App. You agree to:</Body>
            <Bullets items={[
              'Provide accurate and complete registration information',
              'Maintain the security of your account credentials',
              'Notify us immediately of any unauthorized access to your account',
              'Accept responsibility for all activity under your account',
              'Not create accounts for others without their permission',
            ]} />
            <Body>You must be at least 13 years old (16 in the EU) to create an account. By registering, you confirm you meet the minimum age requirement.</Body>
          </Section>

          <Section num="5" title="Subscriptions and Payments">
            <Body>MyMoodMapp offers a free tier and paid subscription plans (Pro and Therapist Pro).</Body>
            <Sub>5.1 Free Trial</Sub>
            <Body>New subscribers may be eligible for a 30-day free trial. At the end of the trial period, your payment method will be charged the applicable subscription fee unless you cancel before the trial ends.</Body>
            <Sub>5.2 Billing</Sub>
            <Body>Subscriptions are billed on a monthly basis. On iOS and Android, payments are processed by Apple App Store and Google Play respectively. On the web, payments are processed by Stripe. You agree to the payment terms of the applicable payment processor.</Body>
            <Sub>5.3 Cancellation</Sub>
            <Body>You may cancel your subscription at any time. On iOS: Settings → Apple ID → Subscriptions. On Android: Google Play → Subscriptions. On web: Me tab → Manage subscription. Cancellation takes effect at the end of the current billing period. No partial refunds are provided.</Body>
            <Sub>5.4 Refunds</Sub>
            <Body>Refund requests for iOS purchases are handled by Apple. For Android purchases, by Google. For web purchases, contact us at {SUPPORT_EMAIL}. We will consider refunds on a case-by-case basis in accordance with applicable consumer protection laws.</Body>
            <Sub>5.5 Price Changes</Sub>
            <Body>We reserve the right to change subscription prices. We will provide at least 30 days notice before price increases take effect. Continued use after the effective date constitutes acceptance of the new price.</Body>
          </Section>

          <Section num="6" title="Acceptable Use">
            <Body>You agree not to:</Body>
            <Bullets items={[
              'Use the App for any unlawful purpose or in violation of these Terms',
              'Attempt to reverse engineer, decompile, or disassemble the App',
              'Access or use the App to build a competing product',
              'Harass, abuse, or harm other users through Accountability Buddy or Therapist features',
              'Upload or transmit any malicious code, spam, or unauthorized content',
              'Circumvent any security or access control measures',
              'Use automated tools to access the App without our written permission',
              'Impersonate any person or entity',
            ]} />
          </Section>

          <Section num="7" title="Intellectual Property">
            <Body>All content, features, and functionality of the App — including text, graphics, logos, icons, AI models, and software code — are owned by MyMoodMapp or its licensors and are protected by copyright, trademark, and other intellectual property laws.</Body>
            <Body>You are granted a limited, non-exclusive, non-transferable license to use the App for personal, non-commercial purposes. This license does not include the right to sublicense, sell, resell, transfer, or exploit any portion of the App.</Body>
            <Body>You retain ownership of all content you submit to the App (mood logs, journal entries, etc.). By submitting content, you grant us a limited license to store, process, and display that content solely to provide the App's features to you.</Body>
          </Section>

          <Section num="8" title="Privacy">
            <Body>Your use of the App is governed by our Privacy Policy, which is incorporated into these Terms by reference. Our Privacy Policy explains how we collect, use, and protect your information.</Body>
            <Body>You can access our Privacy Policy at any time from the App (Me tab → Support → Privacy Policy) or at mymoodmapp.com/privacy.</Body>
          </Section>

          <Section num="9" title="Third-Party Services">
            <Body>The App integrates with third-party services including Apple Health, Google Fit, YouTube (for meditation videos), weather providers, and Anthropic's Claude AI. Your use of those services is governed by their respective terms and privacy policies. We are not responsible for third-party services or their content.</Body>
            <Body>YouTube videos embedded in the Guided Meditation section are subject to YouTube's Terms of Service (youtube.com/t/terms) and Google's Privacy Policy.</Body>
            <Sub>9.1 AI Services (Anthropic Claude)</Sub>
            <Body>The AI Wellness Reports feature sends your anonymized mood data (scores, tags, and journal text — never your name or email) to Anthropic's Claude API for processing. Before this feature is enabled, the app will request your explicit consent. You may opt out at any time in Settings without losing access to other features. Anthropic does not use your mood data to train AI models. Their privacy policy is available at anthropic.com/privacy.</Body>
          </Section>

          <Section num="10" title="Data and Account Deletion">
            <Body>You may delete your account at any time from within the App (Me tab → Account → Delete account). Upon deletion, your personal data will be permanently removed from our systems within 30 days, subject to legal retention requirements.</Body>
            <Body>You may also request deletion by contacting us at {SUPPORT_EMAIL} with the subject "Delete my account".</Body>
          </Section>

          <Section num="11" title="Disclaimer of Warranties">
            <Body>THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</Body>
            <Body>We do not warrant that the App will be uninterrupted, error-free, or completely secure. We do not warrant the accuracy or completeness of any AI-generated content.</Body>
          </Section>

          <Section num="12" title="Limitation of Liability">
            <Body>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL MYMOODMAPP, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, LOSS OF PROFITS, OR OTHER INTANGIBLE LOSSES, ARISING FROM YOUR USE OF OR INABILITY TO USE THE APP.</Body>
            <Body>OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM THESE TERMS OR YOUR USE OF THE APP SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.</Body>
          </Section>

          <Section num="13" title="Governing Law and Dispute Resolution">
            <Body>These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which MyMoodMapp is registered, without regard to its conflict of law provisions.</Body>
            <Body>Any dispute arising from these Terms will first be attempted to be resolved through good-faith negotiation. If negotiation fails, disputes will be submitted to binding arbitration in accordance with applicable arbitration rules.</Body>
          </Section>

          <Section num="14" title="Termination">
            <Body>We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.</Body>
            <Body>Upon termination, your license to use the App immediately ceases. Sections 3, 7, 11, 12, and 13 survive termination.</Body>
          </Section>

          <Section num="15" title="Contact Us">
            <Body>If you have questions about these Terms, please contact us:</Body>
            <View style={s.contactCard}>
              <Text style={s.contactOrg}>MyMoodMapp</Text>
              <Pressable
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Terms of Service inquiry`)}
                style={({ pressed }) => [s.contactRow, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="email" size={16} color={C.primary} />
                <Text style={s.contactLink}>{SUPPORT_EMAIL}</Text>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL('https://www.mymoodmapp.com/terms')}
                style={({ pressed }) => [s.contactRow, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="language" size={16} color={C.secondary} />
                <Text style={[s.contactLink, { color: C.secondary }]}>www.mymoodmapp.com/terms</Text>
              </Pressable>
            </View>
          </Section>

        </View>

        {/* Footer */}
        <View style={[s.footer, { width: '100%' }]}>
          <Text style={s.footerCopy}>© {new Date().getFullYear()} MyMoodMapp. All rights reserved.</Text>
          <Text style={s.footerCopy}>Terms of Service · Effective {EFFECTIVE_DATE}</Text>
          <Pressable
            onPress={() => router.push('/privacy' as any)}
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Text style={s.footerLink}>View Privacy Policy →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <View style={ts.section}>
      <View style={ts.titleRow}>
        <View style={ts.numBadge}><Text style={ts.numText}>{num}</Text></View>
        <Text style={ts.title}>{title}</Text>
      </View>
      <View style={ts.body}>{children}</View>
    </View>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return <Text style={ts.sub}>{children}</Text>;
}

function Body({ children }: { children: React.ReactNode }) {
  return <Text style={ts.body2}>{children}</Text>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={ts.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={ts.bulletRow}>
          <View style={ts.bullet} />
          <Text style={ts.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Alert({ color, icon, children }: { color: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={[ts.alert, { backgroundColor: color + '10', borderColor: color + '30' }]}>
      <MaterialIcons name={icon as any} size={16} color={color} />
      <Text style={[ts.alertText, { color: color + 'DD' }]}>{children}</Text>
    </View>
  );
}

const ts = StyleSheet.create({
  section:    { gap: 14, paddingBottom: 36, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  numBadge:   { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(245,166,35,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,166,35,0.3)', flexShrink: 0 },
  numText:    { fontSize: 13, fontWeight: '800', color: '#F5A623', includeFontPadding: false },
  title:      { fontSize: 20, fontWeight: '800', color: '#FFFFFF', flex: 1, includeFontPadding: false },
  sub:        { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginTop: 4, includeFontPadding: false },
  body:       { gap: 12 },
  body2:      { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 24, includeFontPadding: false },
  bulletList: { gap: 8 },
  bulletRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet:     { width: 5, height: 5, borderRadius: 3, backgroundColor: '#F5A623', marginTop: 10, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 22, includeFontPadding: false },
  alert:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: 14, borderWidth: 1 },
  alertText:  { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 21, includeFontPadding: false },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: { backgroundColor: 'rgba(0,0,0,0.94)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', zIndex: 100 },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 4 },
  backText: { fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: '600', includeFontPadding: false },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: { width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(245,166,35,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(245,166,35,0.3)' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', includeFontPadding: false },
  headerCta: { backgroundColor: '#F5A623', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  headerCtaText: { fontSize: 13, fontWeight: '800', color: '#000', includeFontPadding: false },
  scroll: { paddingBottom: 0 },
  heroBanner: { backgroundColor: '#050510', paddingVertical: 56, paddingHorizontal: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(245,166,35,0.12)', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(245,166,35,0.3)' },
  heroBadgeText: { fontSize: 12, fontWeight: '700', color: '#F5A623', includeFontPadding: false },
  heroTitle: { fontWeight: '900', color: '#FFFFFF', textAlign: 'center', includeFontPadding: false },
  heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 24, maxWidth: 560, includeFontPadding: false },
  heroMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  heroMetaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroMetaText: { fontSize: 11, fontWeight: '600', includeFontPadding: false },
  content: { gap: 0, padding: 24, paddingTop: 32, alignSelf: 'center' },
  contactCard: { backgroundColor: '#1A1A1E', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12 },
  contactOrg: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', includeFontPadding: false },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactLink: { fontSize: 14, color: '#F5A623', textDecorationLine: 'underline', fontWeight: '600', includeFontPadding: false },
  footer: { backgroundColor: '#000', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingVertical: 24, paddingHorizontal: 24, alignItems: 'center', gap: 8, marginTop: 0 },
  footerCopy: { fontSize: 12, color: 'rgba(255,255,255,0.35)', includeFontPadding: false },
  footerLink: { fontSize: 13, color: '#F5A623', fontWeight: '600', textDecorationLine: 'underline', includeFontPadding: false },
});
