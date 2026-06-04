/**
 * Astrology Detail Screen — Enhanced Edition
 * Full planetary alignment view with multi-domain life effect analysis:
 * relationships, career, creativity, communication, finances, health, spirituality.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  buildAstrologyReport,
  getMoonEnergyColor,
  getElementColor,
  getEnergyColor,
  getDomainScoreColor,
  PlanetPosition,
  AstrologyReport,
  DomainSummary,
} from '@/services/astrology';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function AstrologyDetailScreen() {
  const router = useRouter();
  const { birthdate } = useLocalSearchParams<{ birthdate: string }>();
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  if (!birthdate) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.noBirthdateContainer}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <View style={styles.noBirthdateContent}>
            <Text style={styles.noBirthdateEmoji}>🌌</Text>
            <Text style={styles.noBirthdateTitle}>No birthdate set</Text>
            <Text style={styles.noBirthdateText}>Add your birthdate in the astrology card on the home screen to see your cosmic blueprint.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const report = buildAstrologyReport(birthdate);
  const { zodiacSign, moonPhase, planets, dailyPhysicalForecast, overallEnergy, overallEnergyScore, domainSummary, weeklyTheme, cosmicAdvice } = report;
  const elementColor = getElementColor(zodiacSign.element);
  const energyColor = getEnergyColor(overallEnergy);
  const moonColor = getMoonEnergyColor(moonPhase.energyLevel);

  const retrogrades = planets.filter(p => p.retrograde);
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // Top 2 and bottom 1 domains for quick read
  const sortedDomains = [...domainSummary].sort((a, b) => b.score - a.score);
  const topDomains = sortedDomains.slice(0, 2);
  const challengedDomain = sortedDomains[sortedDomains.length - 1];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Cosmic Blueprint</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </View>
        <View style={[styles.energyPill, { backgroundColor: energyColor + '20', borderColor: energyColor + '50' }]}>
          <Text style={[styles.energyPillText, { color: energyColor }]}>{overallEnergyScore}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={[styles.heroCard, { borderColor: elementColor + '60' }]}>
          <View style={styles.heroTop}>
            <Text style={styles.heroEmoji}>{zodiacSign.emoji}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.heroSign, { color: elementColor }]}>
                {zodiacSign.symbol} {zodiacSign.name}
              </Text>
              <Text style={styles.heroElement}>
                {zodiacSign.element.charAt(0).toUpperCase() + zodiacSign.element.slice(1)} · {zodiacSign.modality} · Ruled by {zodiacSign.rulingPlanet}
              </Text>
              <Text style={styles.heroLifeTheme} numberOfLines={2}>{zodiacSign.lifeTheme}</Text>
            </View>
            <View style={[styles.energyBadge, { backgroundColor: energyColor + '20', borderColor: energyColor + '40' }]}>
              <Text style={[styles.energyBadgeNum, { color: energyColor }]}>{overallEnergyScore}</Text>
              <Text style={[styles.energyBadgeLabel, { color: energyColor }]}>energy</Text>
            </View>
          </View>
          <View style={styles.energyBarRow}>
            <Text style={styles.energyBarLabel}>Cosmic energy today</Text>
            <Text style={[styles.energyBarStatus, { color: energyColor }]}>
              {overallEnergy.charAt(0).toUpperCase() + overallEnergy.slice(1)}
            </Text>
          </View>
          <View style={styles.energyBarTrack}>
            <View style={[styles.energyBarFill, { width: `${overallEnergyScore}%`, backgroundColor: energyColor }]} />
          </View>
          {/* Keywords */}
          <View style={styles.keywordsRow}>
            {zodiacSign.keywords.map((kw, i) => (
              <View key={i} style={[styles.kwChip, { backgroundColor: elementColor + '18', borderColor: elementColor + '40' }]}>
                <Text style={[styles.kwText, { color: elementColor }]}>{kw}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Weekly theme + cosmic advice ─────────────────────────────── */}
        <View style={styles.themeCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="auto-awesome" size={16} color={Colors.secondary} />
            <Text style={styles.sectionTitle}>This cycle's theme</Text>
          </View>
          <Text style={styles.themeText}>{moonPhase.emoji} {weeklyTheme}</Text>
          <View style={[styles.adviceRow, { backgroundColor: energyColor + '12', borderColor: energyColor + '30' }]}>
            <MaterialIcons name="lightbulb" size={14} color={energyColor} />
            <Text style={[styles.adviceText, { color: energyColor }]}>{cosmicAdvice}</Text>
          </View>
        </View>

        {/* ── Retrograde alert ─────────────────────────────────────────── */}
        {retrogrades.length > 0 ? (
          <View style={styles.retrogradeAlert}>
            <MaterialIcons name="warning-amber" size={18} color={Colors.warning} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={styles.retrogradeTitle}>
                {retrogrades.map(p => `${p.symbol} ${p.planet}`).join(' · ')} in Retrograde
              </Text>
              <Text style={styles.retrogradeText}>
                {retrogrades.length === 1
                  ? `${retrogrades[0].planet} retrograde brings a call to review, revise, and reconsider in the areas it governs: ${retrogrades[0].governs.join(', ')}. Not the time to launch — the time to refine.`
                  : `${retrogrades.length} planets are retrograde simultaneously — a rare invitation to turn inward and audit multiple life areas. Energy may feel fragmented; prioritize rest, introspection, and careful review over bold new actions.`}
              </Text>
              <View style={styles.retroDomainRow}>
                {retrogrades.flatMap(p => p.governs.slice(0, 2)).map((g, i) => (
                  <View key={i} style={styles.retroDomainChip}>
                    <Text style={styles.retroDomainText}>⚠ {g}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.directBanner}>
            <MaterialIcons name="check-circle" size={16} color={Colors.success} />
            <Text style={styles.directBannerText}>All key planets direct — forward motion is well-supported across all life areas.</Text>
          </View>
        )}

        {/* ── Life Domain Dashboard ─────────────────────────────────────── */}
        <View style={styles.domainsCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="grid-view" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Life domains today</Text>
          </View>
          <Text style={styles.domainsSub}>Tap any domain for a detailed reading</Text>
          <View style={styles.domainsGrid}>
            {domainSummary.map(domain => (
              <DomainCard
                key={domain.domain}
                domain={domain}
                expanded={expandedDomain === domain.domain}
                onPress={() => setExpandedDomain(expandedDomain === domain.domain ? null : domain.domain)}
              />
            ))}
          </View>

          {/* Quick read strip */}
          <View style={styles.quickReadStrip}>
            <View style={[styles.quickReadItem, { borderColor: Colors.success + '40', backgroundColor: Colors.success + '10' }]}>
              <MaterialIcons name="arrow-upward" size={12} color={Colors.success} />
              <Text style={[styles.quickReadLabel, { color: Colors.success }]}>Lean into:</Text>
              <Text style={[styles.quickReadValue, { color: Colors.success }]}>{topDomains.map(d => d.domain.split(' ')[0]).join(', ')}</Text>
            </View>
            <View style={[styles.quickReadItem, { borderColor: Colors.warning + '40', backgroundColor: Colors.warning + '10' }]}>
              <MaterialIcons name="arrow-downward" size={12} color={Colors.warning} />
              <Text style={[styles.quickReadLabel, { color: Colors.warning }]}>Go gently:</Text>
              <Text style={[styles.quickReadValue, { color: Colors.warning }]}>{challengedDomain?.domain.split(' ')[0]}</Text>
            </View>
          </View>
        </View>

        {/* ── Moon phase ────────────────────────────────────────────────── */}
        <View style={styles.moonCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.moonEmoji}>{moonPhase.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{moonPhase.phase}</Text>
              <Text style={[styles.moonEnergy, { color: moonColor }]}>
                {moonPhase.illumination > 0 ? `${Math.round(moonPhase.illumination * 100)}% illuminated · ` : ''}Energy: {moonPhase.energyLevel}
              </Text>
            </View>
          </View>

          <View style={styles.moonTwoCol}>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={styles.moonEffectHeader}>
                <MaterialIcons name="self-improvement" size={13} color={elementColor} />
                <Text style={styles.moonEffectLabel}>Physical</Text>
              </View>
              <Text style={styles.moonEffectText}>{moonPhase.physicalEffect}</Text>
            </View>
          </View>

          <View style={styles.moonEffectHeader}>
            <MaterialIcons name="mood" size={13} color={moonColor} />
            <Text style={styles.moonEffectLabel}>Emotional</Text>
          </View>
          <Text style={styles.moonEffectText}>{moonPhase.emotionalEffect}</Text>

          {/* Best for / avoid */}
          <View style={styles.moonActionsRow}>
            <View style={[styles.moonActionBox, { borderColor: Colors.success + '40', backgroundColor: Colors.success + '10' }]}>
              <Text style={[styles.moonActionTitle, { color: Colors.success }]}>✓ Best for</Text>
              {moonPhase.bestFor.map((b, i) => (
                <View key={i} style={styles.moonActionItem}>
                  <View style={[styles.moonActionDot, { backgroundColor: Colors.success }]} />
                  <Text style={[styles.moonActionText, { color: Colors.success + 'DD' }]}>{b}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.moonActionBox, { borderColor: Colors.error + '35', backgroundColor: Colors.error + '08' }]}>
              <Text style={[styles.moonActionTitle, { color: Colors.error }]}>✗ Avoid now</Text>
              {moonPhase.avoidNow.map((a, i) => (
                <View key={i} style={styles.moonActionItem}>
                  <View style={[styles.moonActionDot, { backgroundColor: Colors.error }]} />
                  <Text style={[styles.moonActionText, { color: Colors.error + 'CC' }]}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Physical forecast ─────────────────────────────────────────── */}
        <View style={styles.forecastCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="healing" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Physical forecast</Text>
          </View>
          <Text style={styles.forecastText}>{dailyPhysicalForecast}</Text>
          <View style={styles.physicalAreasRow}>
            {zodiacSign.physicalAreas.map((area, i) => (
              <View key={i} style={[styles.physicalAreaChip, { backgroundColor: elementColor + '20', borderColor: elementColor + '40' }]}>
                <Text style={[styles.physicalAreaText, { color: elementColor }]}>{area}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Planets ───────────────────────────────────────────────────── */}
        <View style={styles.planetsCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="stars" size={16} color={Colors.secondary} />
            <Text style={styles.sectionTitle}>Planetary alignments</Text>
          </View>
          <Text style={styles.domainsSub}>Tap a planet to see its life domain effects</Text>
          {planets.map((planet, i) => (
            <PlanetRow
              key={planet.planet}
              planet={planet}
              isLast={i === planets.length - 1}
              expanded={expandedPlanet === planet.planet}
              onPress={() => setExpandedPlanet(expandedPlanet === planet.planet ? null : planet.planet)}
            />
          ))}
        </View>

        {/* ── Sign deep-dive ───────────────────────────────────────────── */}
        <View style={[styles.signCard, { borderColor: elementColor + '50' }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.signSymbol, { color: elementColor }]}>{zodiacSign.symbol}</Text>
            <Text style={styles.sectionTitle}>{zodiacSign.name} — Soul blueprint</Text>
          </View>

          {/* Life theme */}
          <View style={[styles.lifeThemeBox, { backgroundColor: elementColor + '12', borderColor: elementColor + '35' }]}>
            <MaterialIcons name="auto-awesome" size={14} color={elementColor} />
            <Text style={[styles.lifeThemeBoxText, { color: elementColor }]}>{zodiacSign.lifeTheme}</Text>
          </View>

          {/* 3-col stats */}
          <View style={styles.signRow}>
            <View style={styles.signItem}>
              <Text style={styles.signItemLabel}>Element</Text>
              <Text style={[styles.signItemValue, { color: elementColor }]}>
                {zodiacSign.element.charAt(0).toUpperCase() + zodiacSign.element.slice(1)}
              </Text>
            </View>
            <View style={styles.signItem}>
              <Text style={styles.signItemLabel}>Modality</Text>
              <Text style={styles.signItemValue}>
                {zodiacSign.modality.charAt(0).toUpperCase() + zodiacSign.modality.slice(1)}
              </Text>
            </View>
            <View style={styles.signItem}>
              <Text style={styles.signItemLabel}>Ruler</Text>
              <Text style={styles.signItemValue}>{zodiacSign.rulingPlanet}</Text>
            </View>
          </View>

          {/* Strengths */}
          <View>
            <Text style={styles.signSubLabel}>Natural strengths</Text>
            {zodiacSign.strengths.map((s, i) => (
              <View key={i} style={styles.strengthRow}>
                <View style={[styles.strengthDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.strengthText}>{s}</Text>
              </View>
            ))}
          </View>

          {/* Challenges */}
          <View>
            <Text style={styles.signSubLabel}>Growth edges</Text>
            {zodiacSign.challenges.map((c, i) => (
              <View key={i} style={styles.strengthRow}>
                <View style={[styles.strengthDot, { backgroundColor: Colors.warning }]} />
                <Text style={styles.strengthText}>{c}</Text>
              </View>
            ))}
          </View>

          {/* Body areas */}
          <View>
            <Text style={styles.signSubLabel}>Sensitive body areas</Text>
            <View style={styles.physicalAreasRow}>
              {zodiacSign.physicalAreas.map((area, i) => (
                <View key={i} style={[styles.physicalAreaChip, { backgroundColor: elementColor + '18', borderColor: elementColor + '35' }]}>
                  <Text style={[styles.physicalAreaText, { color: elementColor }]}>{area}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── How to use ───────────────────────────────────────────────── */}
        <View style={styles.howToCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="lightbulb" size={16} color={Colors.primary} />
            <Text style={styles.sectionTitle}>How to use this reading</Text>
          </View>
          {[
            { n: 1, tip: 'Check the Life Domains panel each morning to set priorities — focus on the green domains, go easy on the red ones.' },
            { n: 2, tip: 'During retrograde periods, use the slower energy for deep review, journaling, and completing unfinished work rather than new initiatives.' },
            { n: 3, tip: 'Pay extra attention to your sign\'s physical areas when the moon is Full or a planet governing that area is retrograde.' },
            { n: 4, tip: 'Track alignment between your mood check-in scores and today\'s cosmic energy score over 30+ days to discover your personal astrological sensitivity.' },
            { n: 5, tip: 'Use "Best for" windows intentionally — schedule your important conversations and bold moves during the right planetary weather.' },
          ].map((h) => (
            <View key={h.n} style={styles.howToRow}>
              <View style={styles.howToNumCircle}>
                <Text style={styles.howToNum}>{h.n}</Text>
              </View>
              <Text style={styles.howToText}>{h.tip}</Text>
            </View>
          ))}
        </View>

        {/* ── Disclaimer ───────────────────────────────────────────────── */}
        <View style={styles.disclaimer}>
          <MaterialIcons name="info-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.disclaimerText}>
            Planetary positions are calculated using simplified orbital mechanics. Life domain scores are heuristic models intended for self-reflection, not prediction. This feature is for wellness exploration and should not replace professional advice.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Domain Card ──────────────────────────────────────────────────────────────

function DomainCard({ domain, expanded, onPress }: { domain: DomainSummary; expanded: boolean; onPress: () => void }) {
  const color = getDomainScoreColor(domain.score);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [dcStyles.card, expanded && { borderColor: color + '80' }, pressed && { opacity: 0.85 }]}
    >
      {/* Score bar across top */}
      <View style={dcStyles.gaugeWrap}>
        <View style={[dcStyles.gaugeFill, { width: `${domain.score}%`, backgroundColor: color }]} />
      </View>
      {/* Main row: icon+name on left, score on right */}
      <View style={dcStyles.body}>
        <View style={dcStyles.leftCol}>
          <View style={dcStyles.topRow}>
            <View style={[dcStyles.iconWrap, { backgroundColor: color + '20' }]}>
              <MaterialIcons name={domain.icon as any} size={18} color={color} />
            </View>
            <Text style={dcStyles.domainName} numberOfLines={1}>{domain.domain}</Text>
          </View>
          <Text style={dcStyles.headline} numberOfLines={expanded ? undefined : 2}>{domain.headline}</Text>
        </View>
        <View style={dcStyles.rightCol}>
          <Text style={[dcStyles.score, { color }]}>{domain.score}</Text>
          <Text style={dcStyles.scoreDenom}>/100</Text>
          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={16} color={Colors.textMuted} style={{ marginTop: 4 }} />
        </View>
      </View>

      {/* Expanded detail */}
      {expanded ? (
        <View style={[dcStyles.expandedPanel, { borderTopColor: color + '30' }]}>
          <Text style={dcStyles.expandedText}>{domain.details}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
const dcStyles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  gaugeWrap: { height: 4, backgroundColor: Colors.border, width: '100%' },
  gaugeFill: { height: '100%', borderRadius: 0 },
  body: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  leftCol: { flex: 1, gap: 6 },
  rightCol: { alignItems: 'center', gap: 0, flexShrink: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  domainName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false, flex: 1 },
  score: { fontSize: 30, fontWeight: '900', includeFontPadding: false, textAlign: 'center' },
  scoreDenom: { fontSize: 11, color: Colors.textMuted, includeFontPadding: false, textAlign: 'center' },
  headline: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, includeFontPadding: false },
  expandedPanel: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  expandedText: { fontSize: Typography.fontSizes.xs, color: Colors.textSecondary, lineHeight: Typography.fontSizes.xs * 1.65, includeFontPadding: false },
});

// ─── Planet Row ───────────────────────────────────────────────────────────────

function PlanetRow({ planet, isLast, expanded, onPress }: {
  planet: PlanetPosition; isLast: boolean; expanded: boolean; onPress: () => void;
}) {
  const energyColors = {
    activating: '#FF8C42',
    harmonizing: '#95E06C',
    challenging: '#FF6B6B',
    introspective: '#5B6FFF',
  };
  const color = energyColors[planet.energyType];

  return (
    <View style={[prStyles.wrap, !isLast && prStyles.border]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [prStyles.row, pressed && { opacity: 0.85 }]}
      >
        <View style={[prStyles.symbolWrap, { backgroundColor: planet.retrograde ? Colors.warning + '25' : color + '20' }]}>
          <Text style={[prStyles.symbol, { color: planet.retrograde ? Colors.warning : color }]}>{planet.symbol}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={prStyles.topRow}>
            <Text style={prStyles.name}>{planet.planet}</Text>
            <Text style={[prStyles.sign, { color }]}>{planet.signEmoji} {planet.sign} {planet.degree}°</Text>
            {planet.retrograde ? (
              <View style={prStyles.retroBadge}>
                <Text style={prStyles.retroText}>℞ Rx</Text>
              </View>
            ) : (
              <View style={[prStyles.directBadge, { backgroundColor: color + '15' }]}>
                <Text style={[prStyles.directText, { color }]}>Direct</Text>
              </View>
            )}
          </View>
          <Text style={prStyles.effect} numberOfLines={expanded ? undefined : 2}>{planet.physicalEffect}</Text>
          {/* Governs chips */}
          <View style={prStyles.governsRow}>
            {planet.governs.map((g, i) => (
              <View key={i} style={[prStyles.governChip, { backgroundColor: color + '15' }]}>
                <Text style={[prStyles.governText, { color }]}>{g}</Text>
              </View>
            ))}
          </View>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={16} color={Colors.textMuted} />
      </Pressable>

      {/* Expanded: life domain effects for this planet */}
      {expanded && planet.lifeDomainEffects.length > 0 ? (
        <View style={prStyles.expandedWrap}>
          <Text style={prStyles.expandedTitle}>
            {planet.retrograde ? '⚠ Retrograde effects on your life' : '✦ How this planet affects your life today'}
          </Text>
          {planet.lifeDomainEffects.map((effect, i) => (
            <View key={i} style={[prStyles.effectCard, { borderLeftColor: effect.color }]}>
              <View style={prStyles.effectHeader}>
                <View style={[prStyles.effectIconWrap, { backgroundColor: effect.color + '20' }]}>
                  <MaterialIcons name={effect.icon as any} size={13} color={effect.color} />
                </View>
                <Text style={[prStyles.effectDomain, { color: effect.color }]}>{effect.domain}</Text>
              </View>
              <Text style={prStyles.effectDesc}>
                {planet.retrograde ? effect.retrograde : effect.direct}
              </Text>
              <View style={prStyles.tipRow}>
                <MaterialIcons name="lightbulb" size={11} color={Colors.primary} />
                <Text style={prStyles.tipText}>{effect.tip}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
const prStyles = StyleSheet.create({
  wrap: {},
  border: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md },
  symbolWrap: { width: 38, height: 38, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  symbol: { fontSize: Typography.fontSizes.lg, fontWeight: '600', includeFontPadding: false },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  name: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  sign: { fontSize: Typography.fontSizes.xs, fontWeight: '600', includeFontPadding: false },
  retroBadge: { backgroundColor: Colors.warning + '20', borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  retroText: { fontSize: 10, color: Colors.warning, fontWeight: '700', includeFontPadding: false },
  directBadge: { borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  directText: { fontSize: 10, fontWeight: '700', includeFontPadding: false },
  effect: { fontSize: Typography.fontSizes.xs, color: Colors.textSecondary, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
  governsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  governChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full },
  governText: { fontSize: 10, fontWeight: '600', includeFontPadding: false },
  expandedWrap: { paddingBottom: Spacing.md, paddingHorizontal: 2, gap: Spacing.sm },
  expandedTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.textSecondary, paddingLeft: 50, includeFontPadding: false },
  effectCard: { marginLeft: 50, borderLeftWidth: 3, paddingLeft: Spacing.md, gap: 5 },
  effectHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  effectIconWrap: { width: 24, height: 24, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  effectDomain: { fontSize: Typography.fontSizes.sm, fontWeight: '700', includeFontPadding: false },
  effectDesc: { fontSize: Typography.fontSizes.xs, color: Colors.textSecondary, lineHeight: Typography.fontSizes.xs * 1.65, includeFontPadding: false },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, backgroundColor: Colors.primarySoft, borderRadius: Radius.md, padding: Spacing.sm },
  tipText: { flex: 1, fontSize: 10, color: Colors.primary, fontWeight: '600', lineHeight: 14, includeFontPadding: false },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  noBirthdateContainer: { flex: 1, padding: Spacing.lg },
  noBirthdateContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  noBirthdateEmoji: { fontSize: 56 },
  noBirthdateTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  noBirthdateText: { fontSize: Typography.fontSizes.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: Typography.fontSizes.md * 1.6, includeFontPadding: false },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  backBtn: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { fontSize: Typography.fontSizes.lg, fontWeight: '800', color: Colors.textPrimary, includeFontPadding: false },
  headerDate: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  energyPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1 },
  energyPillText: { fontSize: Typography.fontSizes.sm, fontWeight: '900', includeFontPadding: false },

  scroll: { padding: Spacing.lg, paddingBottom: Spacing['3xl'], gap: Spacing.xl },

  // Hero
  heroCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1.5, gap: Spacing.md, ...Shadows.sm },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  heroEmoji: { fontSize: 42 },
  heroSign: { fontSize: Typography.fontSizes.xl, fontWeight: '800', includeFontPadding: false },
  heroElement: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  heroLifeTheme: { fontSize: Typography.fontSizes.xs, color: Colors.textSecondary, lineHeight: Typography.fontSizes.xs * 1.6, fontStyle: 'italic', includeFontPadding: false },
  energyBadge: { alignItems: 'center', borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, flexShrink: 0, minWidth: 52 },
  energyBadgeNum: { fontSize: Typography.fontSizes.xl, fontWeight: '900', includeFontPadding: false },
  energyBadgeLabel: { fontSize: 10, includeFontPadding: false },
  energyBarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  energyBarLabel: { fontSize: 10, color: Colors.textMuted, includeFontPadding: false },
  energyBarStatus: { fontSize: Typography.fontSizes.xs, fontWeight: '700', textTransform: 'capitalize', includeFontPadding: false },
  energyBarTrack: { height: 7, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  energyBarFill: { height: '100%', borderRadius: Radius.full },
  keywordsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  kwChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  kwText: { fontSize: 10, fontWeight: '700', includeFontPadding: false },

  // Theme card
  themeCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  themeText: { fontSize: Typography.fontSizes.md, fontWeight: '600', color: Colors.textPrimary, lineHeight: Typography.fontSizes.md * 1.5, includeFontPadding: false },
  adviceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  adviceText: { flex: 1, fontSize: Typography.fontSizes.sm, fontWeight: '600', lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },

  // Retrograde alert
  retrogradeAlert: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: Colors.warning + '12', borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1.5, borderColor: Colors.warning + '40' },
  retrogradeTitle: { fontSize: Typography.fontSizes.md, fontWeight: '800', color: Colors.warning, includeFontPadding: false },
  retrogradeText: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false },
  retroDomainRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  retroDomainChip: { backgroundColor: Colors.warning + '20', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.warning + '40' },
  retroDomainText: { fontSize: 10, fontWeight: '700', color: Colors.warning, includeFontPadding: false },
  directBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.success + '12', borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.success + '35' },
  directBannerText: { flex: 1, fontSize: Typography.fontSizes.sm, fontWeight: '600', color: Colors.success, lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },

  // Domain grid
  domainsCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  domainsSub: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  domainsGrid: { gap: 8 },
  quickReadStrip: { flexDirection: 'row', gap: Spacing.sm },
  quickReadItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.lg, padding: Spacing.sm, borderWidth: 1, flexWrap: 'wrap' },
  quickReadLabel: { fontSize: 10, fontWeight: '700', includeFontPadding: false },
  quickReadValue: { fontSize: 10, fontWeight: '800', includeFontPadding: false },

  // Moon
  moonCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  moonEmoji: { fontSize: 26 },
  moonEnergy: { fontSize: Typography.fontSizes.xs, includeFontPadding: false },
  moonTwoCol: { flexDirection: 'row', gap: Spacing.lg },
  moonEffectHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  moonEffectLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, includeFontPadding: false },
  moonEffectText: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false },
  moonActionsRow: { flexDirection: 'row', gap: Spacing.md },
  moonActionBox: { flex: 1, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, gap: 6 },
  moonActionTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, includeFontPadding: false, marginBottom: 2 },
  moonActionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  moonActionDot: { width: 5, height: 5, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  moonActionText: { flex: 1, fontSize: 13, lineHeight: 19, includeFontPadding: false },

  // Forecast
  forecastCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  forecastText: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.7, includeFontPadding: false },
  physicalAreasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  physicalAreaChip: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1 },
  physicalAreaText: { fontSize: Typography.fontSizes.xs, fontWeight: '600', includeFontPadding: false },

  // Planets
  planetsCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: 0 },

  // Sign card
  signCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1.5, gap: Spacing.md },
  signSymbol: { fontSize: Typography.fontSizes['2xl'], fontWeight: '700', includeFontPadding: false },
  lifeThemeBox: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  lifeThemeBoxText: { flex: 1, fontSize: Typography.fontSizes.sm, fontWeight: '600', lineHeight: Typography.fontSizes.sm * 1.5, fontStyle: 'italic', includeFontPadding: false },
  signRow: { flexDirection: 'row', gap: Spacing.md },
  signItem: { flex: 1, alignItems: 'center', gap: 3, backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  signItemLabel: { fontSize: 9, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, includeFontPadding: false },
  signItemValue: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', includeFontPadding: false },
  signSubLabel: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, includeFontPadding: false },
  strengthRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 3 },
  strengthDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  strengthText: { flex: 1, fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },

  // How to
  howToCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  howToRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  howToNumCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  howToNum: { fontSize: 11, fontWeight: '800', color: Colors.primary, includeFontPadding: false },
  howToText: { flex: 1, fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, lineHeight: Typography.fontSizes.sm * 1.6, includeFontPadding: false },

  // Disclaimer
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  disclaimerText: { flex: 1, fontSize: 10, color: Colors.textMuted, lineHeight: 14, includeFontPadding: false },

  // Section headers (shared)
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: Colors.textPrimary, flex: 1, includeFontPadding: false },
});
