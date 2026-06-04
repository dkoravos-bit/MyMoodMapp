/**
 * Weather Detail Screen
 * Current conditions, 7-day forecast, UV/humidity/pressure metrics,
 * and detailed explanation of how each weather factor affects mood & cognition.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  fetchWeather,
  WeatherData,
  WeatherForecastDay,
  getUVLabel,
  getUVColor,
  getMoodImpactColor,
  formatTemp,
} from '@/services/weather';
import { getTempUnit, setTempUnit } from '@/services/storage';

export default function WeatherDetailScreen() {
  const router = useRouter();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tempUnit, setTempUnitState] = useState<'C' | 'F'>('F');

  const toggleTempUnit = async () => {
    const next: 'C' | 'F' = tempUnit === 'C' ? 'F' : 'C';
    setTempUnitState(next);
    await setTempUnit(next);
  };

  const load = async () => {
    setLoading(true); setError(null);
    const data = await fetchWeather();
    if (data) { setWeather(data); setLastUpdated(new Date(data.timestamp)); }
    else setError('Could not load weather. Check your connection and try again.');
    setLoading(false);
  };

  useEffect(() => {
    load();
    getTempUnit().then(setTempUnitState);
  }, []);

  const impactColor = weather ? getMoodImpactColor(weather.moodImpact) : Colors.textMuted;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Weather & Mood</Text>
          {lastUpdated ? (
            <Text style={styles.headerSub}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          ) : null}
        </View>
        {/* °C / °F toggle */}
        <Pressable
          onPress={toggleTempUnit}
          hitSlop={8}
          style={({ pressed }) => [wdStyles.unitToggle, pressed && { opacity: 0.7 }]}
        >
          <Text style={[wdStyles.unitOpt, tempUnit === 'C' && wdStyles.unitOptActive]}>°C</Text>
          <Text style={wdStyles.unitSep}>|</Text>
          <Text style={[wdStyles.unitOpt, tempUnit === 'F' && wdStyles.unitOptActive]}>°F</Text>
        </Pressable>
        <Pressable
          onPress={load}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <MaterialIcons name="refresh" size={20} color={Colors.primary} />}
        </Pressable>
      </View>

      {loading && !weather ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Getting your local weather...</Text>
        </View>
      ) : error && !weather ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorEmoji}>🌐</Text>
          <Text style={styles.errorTitle}>Could not load weather</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </Pressable>
        </View>
      ) : weather ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Hero current conditions */}
          <View style={[styles.heroCard, { borderColor: impactColor + '50' }]}>
            <View style={styles.heroTop}>
              <Text style={styles.heroEmoji}>{weather.conditionEmoji}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.heroCity}>{weather.city}</Text>
                <Text style={styles.heroCondition}>{weather.condition}</Text>
                <Text style={[styles.heroTemp, { color: impactColor }]}>{formatTemp(weather.temperature, tempUnit)}</Text>
                <Text style={styles.heroFeels}>Feels like {formatTemp(weather.feelsLike, tempUnit)}</Text>
              </View>
              <View style={[styles.impactBadge, { backgroundColor: impactColor + '20', borderColor: impactColor + '50' }]}>
                <Text style={styles.impactIcon}>
                  {weather.moodImpact === 'positive' ? '😊' : weather.moodImpact === 'negative' ? '😔' : '😐'}
                </Text>
                <Text style={[styles.impactLabel, { color: impactColor }]}>
                  {weather.moodImpact === 'positive' ? 'Mood boost' : weather.moodImpact === 'negative' ? 'Mood drag' : 'Neutral'}
                </Text>
              </View>
            </View>

            {/* Mood impact explanation */}
            <View style={[styles.impactBox, { backgroundColor: impactColor + '12', borderColor: impactColor + '30' }]}>
              <MaterialIcons name="psychology" size={14} color={impactColor} />
              <Text style={[styles.impactReason, { color: impactColor }]}>{weather.moodImpactReason}</Text>
            </View>
          </View>

          {/* Metrics grid — 2×2 so each tile has enough room */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricsRow}>
              <MetricTile icon="wb-sunny" label="UV Index" value={getUVLabel(weather.uvIndex)} sub={`${weather.uvIndex} / 11`} color={getUVColor(weather.uvIndex)} />
              <MetricTile icon="water-drop" label="Humidity" value={`${weather.humidity}%`} sub={weather.humidity > 70 ? 'High' : weather.humidity > 40 ? 'Comfortable' : 'Dry'} color={weather.humidity > 70 ? Colors.error : weather.humidity > 40 ? Colors.success : Colors.warning} />
            </View>
            <View style={styles.metricsRow}>
              <MetricTile icon="air" label="Wind Speed" value={`${weather.windSpeed} km/h`} sub={weather.windSpeed > 40 ? 'Strong' : weather.windSpeed > 20 ? 'Moderate' : 'Calm'} color={weather.windSpeed > 40 ? Colors.error : Colors.secondary} />
              <MetricTile icon="compress" label="Pressure" value={`${weather.pressureHPA} hPa`} sub={weather.pressureHPA < 1000 ? 'Low' : weather.pressureHPA < 1020 ? 'Normal' : 'High'} color={weather.pressureHPA < 1000 ? Colors.warning : Colors.primary} />
            </View>
          </View>

          {/* Science of weather & mood */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How today affects you</Text>
            <View style={styles.scienceCard}>
              <ScienceRow
                emoji="☀️"
                title="Sunlight & Serotonin"
                active={weather.weatherCode <= 2 && weather.isDay}
                positiveText="Sun exposure today boosts serotonin synthesis — improves mood, reduces anxiety, and regulates sleep cycles."
                negativeText="Limited sunlight today. Artificial bright light therapy (10k lux lamp) can partially compensate for reduced natural light."
              />
              <ScienceRow
                emoji="🌡️"
                title="Temperature & Cognition"
                active={weather.temperature >= 16 && weather.temperature <= 28}
                positiveText={`${formatTemp(weather.temperature, tempUnit)} is within the cognitive sweet spot (${tempUnit === 'F' ? '61–82°F' : '16–28°C'}). Ideal for focus and productivity.`}
                negativeText={weather.temperature > 28
                  ? `High heat (${formatTemp(weather.temperature, tempUnit)}) increases cognitive load. Stay hydrated and take cooling breaks.`
                  : `Cold temperatures (${formatTemp(weather.temperature, tempUnit)}) can slow reaction time and lower motivation. Warm up your workspace.`}
              />
              <ScienceRow
                emoji="💧"
                title="Humidity & Energy"
                active={weather.humidity >= 40 && weather.humidity <= 60}
                positiveText="Comfortable humidity supports optimal breathing and energy. No respiratory drag."
                negativeText={weather.humidity > 65
                  ? `High humidity (${weather.humidity}%) increases perceived heat and fatigue. Prioritize hydration and ventilation.`
                  : `Low humidity (${weather.humidity}%) can cause dehydration and dry airways. Drink extra water today.`}
              />
              <ScienceRow
                emoji="🌬️"
                title="Atmospheric Pressure"
                active={weather.pressureHPA >= 1013}
                positiveText="Normal to high pressure. Stable conditions with no pressure-related headache risk."
                negativeText={`Low pressure (${weather.pressureHPA} hPa) is associated with headaches, joint aches, and lower energy in pressure-sensitive people.`}
              />
              <ScienceRow
                emoji="🔆"
                title="UV & Vitamin D"
                active={weather.uvIndex >= 2}
                positiveText={`UV index ${weather.uvIndex} — good opportunity for Vitamin D synthesis. 15–30 mins of sun exposure recommended.`}
                negativeText={`UV index ${weather.uvIndex} — minimal Vitamin D production. Consider supplementation if sun exposure is consistently low.`}
              />
            </View>
          </View>

          {/* 7-day forecast */}
          {weather.forecast.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>7-day forecast</Text>
              <View style={styles.forecastCard}>
                {weather.forecast.map((day, i) => (
                  <ForecastRow key={day.date} day={day} isFirst={i === 0} isLast={i === weather.forecast.length - 1} tempUnit={tempUnit} />
                ))}
              </View>
            </View>
          ) : null}

          {/* Tips */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's weather tips</Text>
            <View style={styles.tipsCard}>
              {buildWeatherTips(weather).map((tip, i, arr) => (
                <View key={i} style={[styles.tipRow, i < arr.length - 1 && styles.tipRowBorder]}>
                  <Text style={styles.tipEmoji}>{tip.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tipTitle}>{tip.title}</Text>
                    <Text style={styles.tipText}>{tip.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Footer note */}
          <View style={styles.footerRow}>
            <MaterialIcons name="info-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.footerText}>Weather via Open-Meteo (open-source, privacy-preserving). Your location is only used to fetch current conditions and never stored.</Text>
          </View>

        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricTile({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string; sub: string; color: string;
}) {
  return (
    <View style={mtStyles.tile}>
      <MaterialIcons name={icon as any} size={18} color={color} />
      <Text style={[mtStyles.value, { color }]}>{value}</Text>
      <Text style={mtStyles.sub}>{sub}</Text>
      <Text style={mtStyles.label}>{label}</Text>
    </View>
  );
}
const mtStyles = StyleSheet.create({
  tile: { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.md, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.border, minHeight: 88 },
  value: { fontSize: Typography.fontSizes.xl, fontWeight: '900', includeFontPadding: false, textAlign: 'center' },
  sub: { fontSize: 11, color: Colors.textMuted, includeFontPadding: false, textAlign: 'center' },
  label: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', fontWeight: '600', includeFontPadding: false },
});

function ScienceRow({ emoji, title, active, positiveText, negativeText }: {
  emoji: string; title: string; active: boolean; positiveText: string; negativeText: string;
}) {
  const color = active ? Colors.success : Colors.warning;
  return (
    <View style={srStyles.row}>
      <View style={[srStyles.iconWrap, { backgroundColor: color + '15' }]}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={srStyles.titleRow}>
          <Text style={srStyles.title}>{title}</Text>
          <View style={[srStyles.statusDot, { backgroundColor: color }]} />
        </View>
        <Text style={srStyles.text}>{active ? positiveText : negativeText}</Text>
      </View>
    </View>
  );
}
const srStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconWrap: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: Colors.textPrimary, flex: 1, includeFontPadding: false },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
});

function ForecastRow({ day, isFirst, isLast, tempUnit }: { day: WeatherForecastDay; isFirst: boolean; isLast: boolean; tempUnit: 'C' | 'F' }) {
  const date = new Date(day.date + 'T12:00:00');
  const dayLabel = isFirst ? 'Today' : date.toLocaleDateString([], { weekday: 'short' });
  const dateLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const uvColor = getUVColor(day.uvIndexMax);

  return (
    <View style={[fcStyles.row, !isLast && fcStyles.rowBorder]}>
      <View style={fcStyles.dayCol}>
        <Text style={[fcStyles.day, isFirst && { color: Colors.primary, fontWeight: '700' }]}>{dayLabel}</Text>
        <Text style={fcStyles.date}>{dateLabel}</Text>
      </View>
      <Text style={fcStyles.emoji}>{day.conditionEmoji}</Text>
      <Text style={fcStyles.condition} numberOfLines={1}>{day.condition}</Text>
      <View style={fcStyles.tempCol}>
        <Text style={[fcStyles.maxTemp]}>{tempUnit === 'F' ? `${Math.round(day.maxTemp * 9/5 + 32)}°` : `${day.maxTemp}°`}</Text>
        <Text style={fcStyles.minTemp}>{tempUnit === 'F' ? `${Math.round(day.minTemp * 9/5 + 32)}°` : `${day.minTemp}°`}</Text>
      </View>
      {day.precipitationSum > 0 ? (
        <View style={fcStyles.precipChip}>
          <Text style={fcStyles.precipText}>💧 {day.precipitationSum.toFixed(1)}mm</Text>
        </View>
      ) : (
        <View style={[fcStyles.uvChip, { backgroundColor: uvColor + '20' }]}>
          <Text style={[fcStyles.uvText, { color: uvColor }]}>UV {day.uvIndexMax}</Text>
        </View>
      )}
    </View>
  );
}
const fcStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  dayCol: { width: 48 },
  day: { fontSize: Typography.fontSizes.xs, fontWeight: '600', color: Colors.textPrimary, includeFontPadding: false },
  date: { fontSize: 9, color: Colors.textMuted, includeFontPadding: false },
  emoji: { fontSize: 20 },
  condition: { flex: 1, fontSize: Typography.fontSizes.xs, color: Colors.textSecondary, includeFontPadding: false },
  tempCol: { alignItems: 'flex-end', gap: 2 },
  maxTemp: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  minTemp: { fontSize: 10, color: Colors.textMuted, includeFontPadding: false },
  precipChip: { backgroundColor: Colors.secondary + '20', borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  precipText: { fontSize: 9, color: Colors.secondary, includeFontPadding: false },
  uvChip: { borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  uvText: { fontSize: 9, fontWeight: '700', includeFontPadding: false },
});

// ─── Tips builder ─────────────────────────────────────────────────────────────

function buildWeatherTips(w: WeatherData): { emoji: string; title: string; text: string }[] {
  const tips: { emoji: string; title: string; text: string }[] = [];

  if (w.uvIndex >= 3 && w.isDay) {
    tips.push({ emoji: '🌞', title: 'Get outside for 15–20 min', text: 'UV is sufficient for Vitamin D synthesis. A short outdoor break elevates mood and resets your circadian rhythm.' });
  }
  if (w.weatherCode >= 80) {
    tips.push({ emoji: '🕯️', title: 'Use bright indoor lighting', text: 'Storms reduce ambient light. A 10k lux desk lamp or sitting near a window can partially compensate for reduced serotonin production.' });
  }
  if (w.humidity > 70) {
    tips.push({ emoji: '💧', title: 'Stay hydrated', text: 'High humidity increases perceived heat and sweat. Drink 2–3 extra glasses of water throughout the day to maintain focus.' });
  }
  if (w.temperature > 28) {
    tips.push({ emoji: '❄️', title: 'Cool your environment', text: 'Cognitive performance drops above 26°C. Fans, shade, and cold water help maintain alertness and mood stability.' });
  }
  if (w.temperature < 8) {
    tips.push({ emoji: '🧣', title: 'Warm up before outdoor activity', text: 'Cold weather can reduce motivation for exercise. Layering up and warming indoors first lowers the activation barrier.' });
  }
  if (w.pressureHPA < 1000) {
    tips.push({ emoji: '🧠', title: 'Monitor for pressure-related symptoms', text: 'Low pressure days correlate with headaches and joint discomfort in sensitive individuals. Stay hydrated and limit screen time.' });
  }
  if (w.weatherCode <= 1 && w.isDay && w.temperature >= 16 && w.temperature <= 26) {
    tips.push({ emoji: '🚶', title: 'Ideal conditions for a walk', text: 'Perfect outdoor weather. Even 20 minutes of walking in good conditions boosts endorphins and serotonin for several hours.' });
  }
  if (tips.length === 0) {
    tips.push({ emoji: '🌡️', title: 'Neutral conditions today', text: 'Weather is not significantly impacting your mood in either direction. Focus on your other wellness inputs like sleep and movement.' });
  }
  return tips.slice(0, 4);
}

// ─── Inline styles for °C/°F toggle ─────────────────────────────────────────
const wdStyles = StyleSheet.create({
  unitToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8, paddingVertical: 5, marginRight: 4 },
  unitOpt: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, paddingHorizontal: 3, includeFontPadding: false },
  unitOptActive: { color: Colors.primary },
  unitSep: { fontSize: 11, color: Colors.border, includeFontPadding: false },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  headerTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  headerSub: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  refreshBtn: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  // Loading / error
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, includeFontPadding: false },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  errorEmoji: { fontSize: 56 },
  errorTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  errorText: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, textAlign: 'center', includeFontPadding: false },
  retryBtn: { backgroundColor: Colors.primarySoft, borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: 12, borderWidth: 1, borderColor: Colors.primary + '40' },
  retryBtnText: { fontSize: Typography.fontSizes.sm, color: Colors.primary, fontWeight: '700', includeFontPadding: false },
  // Hero card
  heroCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1.5, marginBottom: Spacing.lg, gap: Spacing.md, ...Shadows.sm },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.lg },
  heroEmoji: { fontSize: 52 },
  heroCity: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  heroCondition: { fontSize: Typography.fontSizes.sm, color: Colors.textSecondary, includeFontPadding: false },
  heroTemp: { fontSize: 36, fontWeight: '900', includeFontPadding: false },
  heroFeels: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  impactBadge: { alignItems: 'center', gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1 },
  impactIcon: { fontSize: 20 },
  impactLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center', includeFontPadding: false },
  impactBox: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  impactReason: { flex: 1, fontSize: Typography.fontSizes.xs, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
  // Metrics
  metricsGrid: { gap: Spacing.sm, marginBottom: Spacing.xl },
  metricsRow: { flexDirection: 'row', gap: Spacing.sm },
  // Sections
  section: { marginBottom: Spacing.xl, gap: Spacing.md },
  sectionTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
  // Science card
  scienceCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, paddingHorizontal: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  // Forecast card
  forecastCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, paddingHorizontal: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  // Tips
  tipsCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.lg },
  tipRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  tipEmoji: { fontSize: 22, width: 28 },
  tipTitle: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3, includeFontPadding: false },
  tipText: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, lineHeight: Typography.fontSizes.xs * 1.6, includeFontPadding: false },
  // Footer
  footerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  footerText: { flex: 1, fontSize: 10, color: Colors.textMuted, lineHeight: 14, includeFontPadding: false },
});
