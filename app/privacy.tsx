// @ts-nocheck
/**
 * Privacy Policy — /privacy
 * Full legal privacy policy for MyMoodMapp.
 * Effective Date: May 9, 2026
 */

import React, { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// ─── Brand tokens (standalone, no theme dependency for web landing) ───────────
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
};

const SUPPORT_EMAIL = 'support@mymoodmapp.com';
const EFFECTIVE_DATE = 'May 9, 2026';

// Table of contents sections
const SECTIONS = [
  { id: 1,  label: 'Introduction' },
  { id: 2,  label: 'Information We Collect' },
  { id: 3,  label: 'How We Use Your Information' },
  { id: 4,  label: 'AI and Automated Processing' },
  { id: 5,  label: 'Data Storage and Security' },
  { id: 6,  label: 'Data Sharing and Disclosure' },
  { id: 7,  label: 'Data Retention' },
  { id: 8,  label: 'Your Rights and Choices' },
  { id: 9,  label: "Children's Privacy" },
  { id: 10, label: 'Sensitive Health Data' },
  { id: 11, label: 'Notifications and Communications' },
  { id: 12, label: 'Third-Party Links and Services' },
  { id: 13, label: 'Changes to This Privacy Policy' },
  { id: 14, label: 'Contact Us' },
];

function useWidth() {
  const [w, setW] = React.useState(Dimensions.get('window').width);
  React.useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setW(window.width));
    return () => sub?.remove();
  }, []);
  return w;
}

export default function PrivacyScreen() {
  const router = useRouter();
  const w = useWidth();
  const isDesktop = w >= 1024;
  const isMobile  = w < 600;
  const maxW = Math.min(w, 900);

  const isWebStandalone = Platform.OS === 'web';

  return (
    <View style={s.root}>
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={[s.headerInner, { width: Math.min(w, 1200) }]}>
          <Pressable
            onPress={() => {
              try { router.back(); } catch { router.push('/landing' as any); }
            }}
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
        {/* ─── Hero banner ─────────────────────────────────────────────── */}
        <View style={[s.heroBanner, { width: '100%' }]}>
          <View style={s.heroBannerGlow} />
          <View style={{ alignItems: 'center', gap: 12, position: 'relative', zIndex: 1, paddingHorizontal: 24 }}>
            <View style={s.heroBadge}>
              <MaterialIcons name="security" size={13} color={C.primary} />
              <Text style={s.heroBadgeText}>Privacy Policy</Text>
            </View>
            <Text style={[s.heroTitle, { fontSize: isMobile ? 28 : 38 }]}>Your data belongs to you.</Text>
            <Text style={s.heroSub}>
              We built MyMoodMapp on a simple principle: your mental health data is deeply personal. We will never sell it, advertise with it, or share it without your explicit consent.
            </Text>
            <View style={s.heroMeta}>
              <View style={s.heroMetaPill}>
                <MaterialIcons name="calendar-today" size={11} color={C.teal} />
                <Text style={[s.heroMetaText, { color: C.teal }]}>Effective: {EFFECTIVE_DATE}</Text>
              </View>
              <View style={s.heroMetaPill}>
                <MaterialIcons name="update" size={11} color={C.textMuted} />
                <Text style={[s.heroMetaText, { color: C.textMuted }]}>Last Updated: {EFFECTIVE_DATE}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ─── Commitment highlights ───────────────────────────────────── */}
        <View style={[s.commitGrid, { width: maxW, flexDirection: isMobile ? 'column' : 'row' }]}>
          {[
            { icon: 'block',           color: C.primary,   title: 'Never Sold',        desc: 'Your data is never sold to advertisers, data brokers, or third parties.' },
            { icon: 'lock',            color: C.teal,      title: 'End-to-End Encrypted', desc: 'All data encrypted in transit (TLS) and at rest in our secure database.' },
            { icon: 'person',          color: C.secondary, title: 'You\'re in Control', desc: 'Export, correct, or permanently delete your data at any time.' },
            { icon: 'medical-services',color: '#F472B6',   title: 'Health Data Protected', desc: 'Health data never leaves your device to third parties or advertisers.' },
          ].map((item, i) => (
            <View key={i} style={[s.commitCard, { flex: isMobile ? undefined : 1 }]}>
              <View style={[s.commitIcon, { backgroundColor: item.color + '15' }]}>
                <MaterialIcons name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={s.commitTitle}>{item.title}</Text>
              <Text style={s.commitDesc}>{item.desc}</Text>
            </View>
          ))}
        </View>

        {/* ─── Table of Contents ───────────────────────────────────────── */}
        <View style={[s.tocCard, { width: maxW }]}>
          <View style={s.tocHeader}>
            <MaterialIcons name="list" size={16} color={C.primary} />
            <Text style={s.tocHeaderText}>Table of Contents</Text>
          </View>
          <View style={[s.tocGrid, { flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap' }]}>
            {SECTIONS.map(sec => (
              <Text key={sec.id} style={[s.tocItem, { width: isMobile ? '100%' : '48%' }]}>
                <Text style={{ color: C.primary, fontWeight: '700' }}>{sec.id}. </Text>
                {sec.label}
              </Text>
            ))}
          </View>
        </View>

        {/* ─── Policy content ──────────────────────────────────────────── */}
        <View style={[s.content, { width: maxW }]}>

          <PolicySection num={1} title="Introduction">
            <BodyText>
              MyMoodMapp ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the MyMoodMapp mobile application, web application, and related services (collectively, the "App").
            </BodyText>
            <BodyText>
              We built MyMoodMapp on a simple principle: your mental health data is deeply personal and belongs to you. We will never sell it, advertise with it, or share it without your explicit consent.
            </BodyText>
            <BodyText>
              Please read this Privacy Policy carefully. By using the App you agree to the practices described in this document. If you do not agree, please discontinue use of the App.
            </BodyText>
          </PolicySection>

          <PolicySection num={2} title="Information We Collect">
            <SubHeading>2.1 Information You Provide Directly</SubHeading>
            <BulletList items={[
              'Account information: your name, email address, and password when you create an account',
              'Mood log entries: Body, Mind, Energy, and Focus scores logged through the App',
              'Context tags: activity, sleep, food, social, and other context tags you attach to logs',
              'Journal entries: free-text notes you choose to add to mood logs',
              'Birthdate: optionally provided for cosmic alignment and physical cycle forecasting features',
              'Therapist notes: if you are a Therapist Pro subscriber, clinical notes you enter about clients',
            ]} />

            <SubHeading>2.2 Information Collected Automatically</SubHeading>
            <BulletList items={[
              'Device information: device type, operating system version, and app version',
              'Usage data: features accessed, session duration, and interaction patterns used to improve the App',
              'Crash reports and diagnostic data: technical information to identify and fix errors',
            ]} />

            <SubHeading>2.3 Information From Third-Party Services</SubHeading>
            <BulletList items={[
              'Apple Health / Google Fit: steps, sleep duration, and heart rate data — only if you explicitly grant permission. This data is pulled directly from your device and never routed through our servers.',
              'Weather data: coarse location (city level) is used to fetch local weather conditions and correlate them with your mood. We do not store your precise GPS coordinates.',
              'YouTube: the Guided Meditation feature embeds YouTube videos. YouTube\'s own privacy policy applies to those interactions.',
            ]} />

            <SubHeading>2.4 Information We Do NOT Collect</SubHeading>
            <BulletList items={[
              'We do not collect precise GPS location',
              'We do not access your contacts, camera, or microphone without explicit permission',
              'We do not collect payment card details (all payments are processed by Apple App Store or Google Play)',
              'We do not build advertising profiles or share data with ad networks',
            ]} color={C.success} />
          </PolicySection>

          <PolicySection num={3} title="How We Use Your Information">
            <BodyText>We use your information solely to provide and improve the MyMoodMapp experience:</BodyText>
            <BulletList items={[
              'To operate and deliver core App functionality including mood logging, pattern analysis, AI insights, and Mood Lab features',
              'To generate AI-powered mood reports, correlations, and forecasts personalized to your data',
              'To sync your data securely across your devices',
              'To send you optional notifications such as daily log reminders and Accountability Buddy alerts — only if you enable them',
              'To provide Therapist Pro features including client management and session reporting',
              'To analyze aggregate, anonymized usage patterns to improve App performance and features',
              'To respond to your support requests and communications',
              'To comply with legal obligations',
            ]} />
            <AlertBox icon="block" color={C.primary} text="We do NOT use your data for targeted advertising, third-party marketing, or any purpose unrelated to operating the App." />
          </PolicySection>

          <PolicySection num={4} title="AI and Automated Processing">
            <BodyText>
              MyMoodMapp uses artificial intelligence to analyze your mood logs and generate personalized insights, pattern reports, and forecasts. This processing occurs on Anthropic's Claude API infrastructure.
            </BodyText>
            <SubHeading>What data is sent to AI</SubHeading>
            <BulletList items={[
              'Mood scores (numeric values only, no identity)',
              'Context tags you select (e.g. exercise, sleep, social)',
              'Journal text entries you choose to write',
              'Aggregate fitness metrics (step counts, sleep hours — no device identifiers)',
              'Environmental context (weather conditions, time of day)',
            ]} />
            <SubHeading>What is NEVER sent to AI</SubHeading>
            <BulletList items={[
              'Your name, email address, or any personally identifiable information',
              'Your device ID or account ID',
              'Payment information',
              'Photos or audio recordings',
            ]} color={C.success} />
            <SubHeading>Who processes your data</SubHeading>
            <BodyText>
              AI analysis is performed by Anthropic, Inc. via the Claude API. Anthropic processes this data solely to generate your requested report and does not retain, share, or use your mood data to train AI models. Anthropic's data handling is governed by their Privacy Policy at{' '}
              <Text style={{ color: C.primary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://www.anthropic.com/privacy')}>anthropic.com/privacy</Text>.
            </BodyText>
            <SubHeading>Your consent and control</SubHeading>
            <BodyText>
              Before your first AI wellness report is generated, the app will ask for your explicit consent to send data to Anthropic's Claude AI. You can decline and still use all other app features. You can change your preference at any time in Me {'>'} Settings {'>'} AI Reports.
            </BodyText>
            <AlertBox icon="info" color={C.secondary} text="AI-generated insights are interpretive tools to support self-awareness. They are not medical diagnoses, clinical assessments, or professional mental health advice." />
          </PolicySection>

          <PolicySection num={5} title="Data Storage and Security">
            <BodyText>Your data is stored securely using industry-standard encryption:</BodyText>
            <BulletList items={[
              'All data in transit is encrypted using TLS 1.2 or higher',
              'Data at rest is encrypted in our secure cloud database (Supabase / PostgreSQL)',
              'Audio files in the Mood Lab Sounds feature are stored on your device and never uploaded to our servers',
              'Healing frequencies are generated locally on your device via the Web Audio API — no audio data is transmitted',
              'Passwords are hashed using bcrypt and are never stored in plain text',
              'We implement access controls to ensure only authorized personnel can access system infrastructure',
            ]} color={C.teal} />
            <BodyText>
              Despite these measures, no method of transmission or storage is 100% secure. We cannot guarantee absolute security but commit to notifying you promptly in the event of a data breach affecting your personal information.
            </BodyText>
          </PolicySection>

          <PolicySection num={6} title="Data Sharing and Disclosure">
            <AlertBox icon="block" color={C.success} text="We do not sell your personal data." />

            <SubHeading>6.1 Service Providers</SubHeading>
            <BodyText>We work with trusted third-party providers who process data on our behalf under strict confidentiality agreements:</BodyText>
            <BulletList items={[
              'Supabase: secure database hosting and authentication',
              'Anthropic (Claude API): AI insight generation using anonymized mood data',
              'Vercel: web application hosting',
              'Apple App Store / Google Play: payment processing for subscriptions',
              'RevenueCat: subscription management and entitlement validation',
            ]} />

            <SubHeading>6.2 Therapist Sharing (Optional)</SubHeading>
            <BodyText>
              If you are a Pro subscriber and choose to share data with a therapist, you explicitly control what is shared and with whom. Therapist access is granted only through your direct invitation. Therapists see only the data you choose to share and cannot access your full account.
            </BodyText>

            <SubHeading>6.3 Legal Requirements</SubHeading>
            <BodyText>
              We may disclose your information if required to do so by law, court order, or governmental authority, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
            </BodyText>

            <SubHeading>6.4 Business Transfers</SubHeading>
            <BodyText>
              If MyMoodMapp is acquired, merged, or its assets are sold, user data may be transferred to the acquiring entity. We will notify you via email or prominent in-app notice before your data becomes subject to a different privacy policy.
            </BodyText>
          </PolicySection>

          <PolicySection num={7} title="Data Retention">
            <BulletList items={[
              'Active account data: retained for the lifetime of your account',
              'Deleted account data: permanently deleted within 30 days of account deletion request',
              'Anonymized aggregate data: may be retained indefinitely for product improvement',
              'Therapist Pro client data: deleted within 30 days of account closure or upon explicit client data deletion request',
            ]} />
            <BodyText>
              You may request deletion of your data at any time by contacting us at{' '}
              <Text
                style={{ color: C.primary, textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              >
                {SUPPORT_EMAIL}
              </Text>
              {' '}or using the Delete Account option in the App under Me {'>'} Settings.
            </BodyText>
          </PolicySection>

          <PolicySection num={8} title="Your Rights and Choices">
            <BodyText>Depending on your location, you may have the following rights regarding your personal data:</BodyText>
            <BulletList items={[
              'Access: request a copy of all personal data we hold about you',
              'Correction: request correction of inaccurate or incomplete data',
              'Deletion: request permanent deletion of your account and all associated data',
              'Portability: request an export of your mood data in a machine-readable format (CSV or JSON)',
              'Restriction: request that we limit processing of your data in certain circumstances',
              'Objection: object to processing of your data based on legitimate interests',
              'Withdraw consent: withdraw consent for optional data processing at any time',
            ]} color={C.secondary} />
            <BodyText>
              To exercise any of these rights, contact us at{' '}
              <Text
                style={{ color: C.primary, textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Privacy request`)}
              >
                {SUPPORT_EMAIL}
              </Text>
              . We will respond within 30 days. We do not charge a fee for reasonable requests.
            </BodyText>

            <SubHeading>California Residents (CCPA)</SubHeading>
            <BodyText>
              California residents have the right to know what personal information we collect, the right to delete personal information, the right to opt-out of the sale of personal information (we do not sell personal information), and the right to non-discrimination for exercising privacy rights.
            </BodyText>

            <SubHeading>European Residents (GDPR)</SubHeading>
            <BodyText>
              If you are located in the European Economic Area, our legal bases for processing your personal data are: performance of a contract (providing the App), legitimate interests (improving the App), and consent (optional features such as location-based weather). You have the right to lodge a complaint with your local data protection authority.
            </BodyText>
          </PolicySection>

          <PolicySection num={9} title="Children's Privacy">
            <BodyText>
              MyMoodMapp is not directed to children under the age of 13 (or 16 in the European Economic Area). We do not knowingly collect personal information from children under these ages. If we become aware that a child has provided us with personal data, we will delete it immediately.
            </BodyText>
            <BodyText>
              If you believe a child has provided us with personal information, please contact us at{' '}
              <Text
                style={{ color: C.primary, textDecorationLine: 'underline' }}
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              >
                {SUPPORT_EMAIL}
              </Text>.
            </BodyText>
          </PolicySection>

          <PolicySection num={10} title="Sensitive Health Data">
            <BodyText>MyMoodMapp collects mood and wellness data which may be considered sensitive health information. We treat this data with the highest level of care:</BodyText>
            <BulletList items={[
              'Mood data is encrypted at rest and in transit at all times',
              'Mood data is never used for advertising, insurance, employment, or any purpose that could harm you',
              'We do not share mood data with employers, insurers, government agencies, or data brokers',
              'Apple Health and Google Fit data is read locally from your device and is not uploaded to our servers',
              'The App is not a HIPAA-covered entity; however, Therapist Pro users are reminded to comply with applicable professional regulations when handling client data',
            ]} color={'#F472B6'} />
          </PolicySection>

          <PolicySection num={11} title="Notifications and Communications">
            <BodyText>
              With your permission, we may send push notifications for daily mood log reminders, Accountability Buddy alerts, and streak milestones. You can disable notifications at any time in your device Settings or within the App under Me {'>'} Notifications.
            </BodyText>
            <BodyText>
              We may send transactional emails related to your account (password resets, subscription confirmations). You cannot opt out of transactional emails while your account is active.
            </BodyText>
          </PolicySection>

          <PolicySection num={12} title="Third-Party Links and Services">
            <BodyText>
              The Guided Meditation section embeds YouTube videos. When you play a meditation video, you are interacting with YouTube's platform and YouTube's Privacy Policy (policies.google.com/privacy) applies to that interaction. We recommend reviewing YouTube's privacy settings.
            </BodyText>
            <BodyText>
              The App may contain links to third-party websites or services. We are not responsible for the privacy practices of those third parties and encourage you to review their privacy policies.
            </BodyText>
          </PolicySection>

          <PolicySection num={13} title="Changes to This Privacy Policy">
            <BodyText>
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make material changes we will:
            </BodyText>
            <BulletList items={[
              'Post the updated policy at mymoodmapp.com/privacy',
              'Update the Effective Date at the top of this document',
              'Notify you via in-app notification or email at least 14 days before material changes take effect',
            ]} />
            <BodyText>
              Your continued use of the App after the effective date of any changes constitutes your acceptance of the updated policy.
            </BodyText>
          </PolicySection>

          <PolicySection num={14} title="Contact Us">
            <BodyText>
              If you have questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us:
            </BodyText>
            <View style={s.contactCard}>
              <Text style={s.contactOrgName}>MyMoodMapp Privacy Team</Text>
              <Pressable
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Privacy inquiry`)}
                style={({ pressed }) => [s.contactRow, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="email" size={16} color={C.primary} />
                <Text style={s.contactLink}>{SUPPORT_EMAIL}</Text>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL('https://www.mymoodmapp.com/privacy')}
                style={({ pressed }) => [s.contactRow, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="language" size={16} color={C.secondary} />
                <Text style={[s.contactLink, { color: C.secondary }]}>www.mymoodmapp.com/privacy</Text>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL('https://www.mymoodmapp.com/support')}
                style={({ pressed }) => [s.contactRow, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="help" size={16} color={C.teal} />
                <Text style={[s.contactLink, { color: C.teal }]}>www.mymoodmapp.com/support</Text>
              </Pressable>
              <Text style={s.contactNote}>We will respond to all privacy-related inquiries within 30 days.</Text>
            </View>
          </PolicySection>

        </View>

        {/* ─── Footer ──────────────────────────────────────────────────── */}
        <View style={[s.footer, { width: '100%' }]}>
          <View style={[s.footerInner, { width: Math.min(w, 900), flexDirection: isMobile ? 'column' : 'row' }]}>
            <View style={s.footerBrand}>
              <View style={s.footerLogo}><Text style={{ fontSize: 14 }}>😌</Text></View>
              <Text style={s.footerBrandText}>MyMoodMapp</Text>
            </View>
            <Text style={s.footerCopy}>Privacy Policy · Effective {EFFECTIVE_DATE}</Text>
            <Pressable
              onPress={() => router.push('/landing' as any)}
              style={({ pressed }) => pressed && { opacity: 0.7 }}
            >
              <Text style={s.footerLink}>← Back to home</Text>
            </Pressable>
          </View>
          <Text style={[s.footerLegal, { width: Math.min(w, 900) }]}>
            © {new Date().getFullYear()} MyMoodMapp. All rights reserved.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Reusable sub-components ─────────────────────────────────────────────────

function PolicySection({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <View style={ps.section}>
      <View style={ps.titleRow}>
        <View style={ps.numBadge}>
          <Text style={ps.numText}>{num}</Text>
        </View>
        <Text style={ps.title}>{title}</Text>
      </View>
      <View style={ps.body}>{children}</View>
    </View>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <Text style={ps.subHeading}>{children}</Text>;
}

function BodyText({ children }: { children: React.ReactNode }) {
  return <Text style={ps.bodyText}>{children}</Text>;
}

function BulletList({ items, color = C.primary }: { items: string[]; color?: string }) {
  return (
    <View style={ps.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={ps.bulletRow}>
          <View style={[ps.bullet, { backgroundColor: color }]} />
          <Text style={ps.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function AlertBox({ icon, color, text }: { icon: string; color: string; text: string }) {
  return (
    <View style={[ps.alertBox, { backgroundColor: color + '10', borderColor: color + '30' }]}>
      <MaterialIcons name={icon as any} size={16} color={color} style={{ marginTop: 1 }} />
      <Text style={[ps.alertText, { color: color + 'DD' }]}>{text}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ps = StyleSheet.create({
  section:    { gap: 16, paddingBottom: 40, borderBottomWidth: 1, borderBottomColor: C.borderSubtle },
  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  numBadge:   { width: 36, height: 36, borderRadius: 10, backgroundColor: C.primaryGlow, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.primary + '30', flexShrink: 0 },
  numText:    { fontSize: 14, fontWeight: '800', color: C.primary, includeFontPadding: false },
  title:      { fontSize: 22, fontWeight: '800', color: C.text, flex: 1, includeFontPadding: false },
  subHeading: { fontSize: 15, fontWeight: '700', color: C.text, marginTop: 4, includeFontPadding: false },
  bodyText:   { fontSize: 15, color: C.textSecondary, lineHeight: 26, includeFontPadding: false },
  bulletList: { gap: 10 },
  bulletRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet:     { width: 6, height: 6, borderRadius: 3, marginTop: 10, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 15, color: C.textSecondary, lineHeight: 24, includeFontPadding: false },
  alertBox:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: 14, borderWidth: 1 },
  alertText:  { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 22, includeFontPadding: false },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header:       { backgroundColor: 'rgba(0,0,0,0.94)', borderBottomWidth: 1, borderBottomColor: C.borderSubtle, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', zIndex: 100 },
  headerInner:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'center' },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 4 },
  backText:     { fontSize: 14, color: C.textSecondary, fontWeight: '600', includeFontPadding: false },
  headerBrand:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo:   { width: 32, height: 32, borderRadius: 9, backgroundColor: C.primaryGlow, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.primary + '30' },
  headerTitle:  { fontSize: 16, fontWeight: '800', color: C.text, includeFontPadding: false },
  headerCta:    { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  headerCtaText:{ fontSize: 13, fontWeight: '800', color: '#000', includeFontPadding: false },

  // Scroll
  scroll: { paddingBottom: 0 },

  // Hero banner
  heroBanner:     { backgroundColor: '#050510', paddingVertical: 64, paddingHorizontal: 24, alignItems: 'center', overflow: 'hidden', position: 'relative', borderBottomWidth: 1, borderBottomColor: C.borderSubtle },
  heroBannerGlow: { position: 'absolute', width: 500, height: 500, borderRadius: 250, backgroundColor: 'rgba(94,92,230,0.08)', top: -200, alignSelf: 'center', zIndex: 0 },
  heroBadge:      { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.primaryGlow, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: C.primary + '30' },
  heroBadgeText:  { fontSize: 12, fontWeight: '700', color: C.primary, includeFontPadding: false },
  heroTitle:      { fontWeight: '900', color: C.text, textAlign: 'center', includeFontPadding: false },
  heroSub:        { fontSize: 16, color: C.textSecondary, textAlign: 'center', lineHeight: 26, maxWidth: 560, includeFontPadding: false },
  heroMeta:       { flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  heroMetaPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.borderSubtle },
  heroMetaText:   { fontSize: 11, fontWeight: '600', includeFontPadding: false },

  // Commitment grid
  commitGrid:     { gap: 12, padding: 24, alignSelf: 'center' },
  commitCard:     { backgroundColor: C.bgCard, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.borderSubtle, gap: 8 },
  commitIcon:     { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  commitTitle:    { fontSize: 15, fontWeight: '800', color: C.text, includeFontPadding: false },
  commitDesc:     { fontSize: 13, color: C.textSecondary, lineHeight: 20, includeFontPadding: false },

  // Table of contents
  tocCard:        { backgroundColor: C.bgCard, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: C.borderSubtle, marginHorizontal: 24, marginBottom: 8, alignSelf: 'center' },
  tocHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  tocHeaderText:  { fontSize: 14, fontWeight: '800', color: C.primary, includeFontPadding: false },
  tocGrid:        { gap: 8 },
  tocItem:        { fontSize: 13, color: C.textSecondary, lineHeight: 22, includeFontPadding: false },

  // Content
  content: { gap: 0, padding: 24, paddingTop: 32, alignSelf: 'center' },

  // Contact card
  contactCard:    { backgroundColor: C.bgElevated, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: C.borderSubtle, gap: 14 },
  contactOrgName: { fontSize: 16, fontWeight: '800', color: C.text, includeFontPadding: false },
  contactRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactLink:    { fontSize: 14, color: C.primary, textDecorationLine: 'underline', fontWeight: '600', includeFontPadding: false },
  contactNote:    { fontSize: 13, color: C.textMuted, lineHeight: 20, includeFontPadding: false, marginTop: 4, borderTopWidth: 1, borderTopColor: C.borderSubtle, paddingTop: 14 },

  // Footer
  footer:       { backgroundColor: '#000', borderTopWidth: 1, borderTopColor: C.borderSubtle, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', gap: 12, marginTop: 0 },
  footerInner:  { alignItems: 'center', gap: 12, justifyContent: 'space-between', width: '100%' },
  footerBrand:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLogo:   { width: 28, height: 28, borderRadius: 8, backgroundColor: C.primaryGlow, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.primary + '30' },
  footerBrandText: { fontSize: 14, fontWeight: '800', color: C.text, includeFontPadding: false },
  footerCopy:   { fontSize: 12, color: C.textMuted, includeFontPadding: false },
  footerLink:   { fontSize: 13, color: C.primary, fontWeight: '600', textDecorationLine: 'underline', includeFontPadding: false },
  footerLegal:  { fontSize: 11, color: C.textMuted, textAlign: 'center', includeFontPadding: false, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.borderSubtle, width: '100%' },
});
