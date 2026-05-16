/**
 * Weather Service
 * Uses Open-Meteo API (free, no API key required).
 * Location priority: GPS → IP geolocation → Manual city → NYC fallback
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const WEATHER_KEY = 'moodlog_weather_cache';
const MANUAL_CITY_KEY = 'moodlog_manual_city';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

export interface WeatherData {
  timestamp: number;
  city: string;
  temperature: number; // Celsius
  feelsLike: number;
  humidity: number; // 0–100
  uvIndex: number; // 0–11+
  windSpeed: number; // km/h
  weatherCode: number; // WMO code
  condition: string;
  conditionEmoji: string;
  isDay: boolean;
  moodImpact: 'positive' | 'neutral' | 'negative';
  moodImpactReason: string;
  forecast: WeatherForecastDay[];
  pressureHPA: number;
  precipitationMM: number;
  locationSource: 'gps' | 'ip' | 'manual' | 'fallback';
}

export interface WeatherForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  condition: string;
  conditionEmoji: string;
  precipitationSum: number;
  uvIndexMax: number;
  sunrise: string;
  sunset: string;
}

// ─── Timeout-safe fetch ───────────────────────────────────────────────────────
// AbortSignal.timeout is not available in older React Native JS engines
function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Request timed out'));
    }, timeoutMs);
    fetch(url, { signal: controller.signal })
      .then(res => { clearTimeout(timer); resolve(res); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

// ─── Manual City Storage ──────────────────────────────────────────────────────

export async function saveManualCity(city: string): Promise<void> {
  await AsyncStorage.setItem(MANUAL_CITY_KEY, city.trim());
  await AsyncStorage.removeItem(WEATHER_KEY);
}

export async function getManualCity(): Promise<string | null> {
  return AsyncStorage.getItem(MANUAL_CITY_KEY);
}

export async function clearManualCity(): Promise<void> {
  await AsyncStorage.removeItem(MANUAL_CITY_KEY);
  await AsyncStorage.removeItem(WEATHER_KEY);
}

// ─── Open-Meteo Geocoding ─────────────────────────────────────────────────────

interface GeoResult {
  lat: number;
  lon: number;
  city: string;
}

async function geocodeCity(cityName: string): Promise<GeoResult | null> {
  try {
    const encoded = encodeURIComponent(cityName.trim());
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=1&language=en&format=json`;
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return null;
    const json = await res.json();
    const r = json.results?.[0];
    if (!r) return null;
    return { lat: r.latitude, lon: r.longitude, city: r.name ?? cityName };
  } catch (e) {
    console.warn('geocodeCity error:', e);
    return null;
  }
}

// ─── IP-based Geolocation (no permission needed) ──────────────────────────────

async function getLocationByIP(): Promise<GeoResult | null> {
  try {
    // ipapi.co — free tier, 1000 req/day, no API key required
    const res = await fetchWithTimeout('https://ipapi.co/json/', 5000);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.latitude || !json.longitude) return null;
    return {
      lat: json.latitude,
      lon: json.longitude,
      city: json.city ?? json.region ?? json.country_name ?? 'Your location',
    };
  } catch {
    // Fallback: try ip-api.com
    try {
      const res2 = await fetchWithTimeout('http://ip-api.com/json/?fields=lat,lon,city,status', 5000);
      if (!res2.ok) return null;
      const json2 = await res2.json();
      if (json2.status !== 'success') return null;
      return { lat: json2.lat, lon: json2.lon, city: json2.city ?? 'Your location' };
    } catch {
      return null;
    }
  }
}

// ─── Weather Code Helpers ─────────────────────────────────────────────────────

function interpretWeatherCode(code: number, isDay = true): { condition: string; emoji: string } {
  if (code === 0) return { condition: 'Clear sky', emoji: isDay ? '☀️' : '🌙' };
  if (code <= 2) return { condition: 'Partly cloudy', emoji: isDay ? '⛅' : '🌤️' };
  if (code === 3) return { condition: 'Overcast', emoji: '☁️' };
  if (code <= 49) return { condition: 'Foggy', emoji: '🌫️' };
  if (code <= 55) return { condition: 'Drizzle', emoji: '🌦️' };
  if (code <= 67) return { condition: 'Rain', emoji: '🌧️' };
  if (code <= 77) return { condition: 'Snow', emoji: '❄️' };
  if (code <= 82) return { condition: 'Rain showers', emoji: '🌧️' };
  if (code <= 86) return { condition: 'Snow showers', emoji: '🌨️' };
  if (code <= 99) return { condition: 'Thunderstorm', emoji: '⛈️' };
  return { condition: 'Unknown', emoji: '🌡️' };
}

function computeMoodImpact(data: {
  weatherCode: number;
  uvIndex: number;
  humidity: number;
  temperature: number;
  windSpeed: number;
}): { impact: 'positive' | 'neutral' | 'negative'; reason: string } {
  const { weatherCode, temperature, humidity } = data;
  if (weatherCode >= 80) return { impact: 'negative', reason: 'Storms and heavy rain can suppress serotonin and elevate cortisol.' };
  if (weatherCode >= 71 && weatherCode <= 77) return { impact: 'neutral', reason: 'Snow days reduce sunlight, which can mildly affect mood and energy.' };
  if (weatherCode >= 45 && weatherCode <= 48) return { impact: 'negative', reason: 'Fog and overcast skies reduce serotonin production.' };
  if (weatherCode === 3) return { impact: 'neutral', reason: 'Overcast skies — indoor light exposure matters most today.' };
  if (weatherCode <= 2 && temperature >= 18 && temperature <= 26 && humidity < 65) {
    return { impact: 'positive', reason: `Clear skies and ${Math.round(temperature)}°C — optimal conditions for serotonin and Vitamin D.` };
  }
  if (temperature > 34) return { impact: 'negative', reason: `High heat (${Math.round(temperature)}°C) increases fatigue and can lower mood.` };
  if (temperature < 5) return { impact: 'negative', reason: `Cold weather (${Math.round(temperature)}°C) can dampen energy and motivation.` };
  return { impact: 'neutral', reason: `Partly cloudy at ${Math.round(temperature)}°C — mild conditions, moderate UV.` };
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function fetchWeatherForCoords(
  lat: number,
  lon: number,
  city: string,
  locationSource: WeatherData['locationSource'],
): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,uv_index,surface_pressure,precipitation,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max,sunrise,sunset&timezone=auto&forecast_days=7`;

  const response = await fetchWithTimeout(url, 8000);
  if (!response.ok) throw new Error(`Open-Meteo error: ${response.status}`);

  const json = await response.json();
  const cur = json.current;
  const daily = json.daily;

  const isDay = cur.is_day === 1;
  const { condition, emoji } = interpretWeatherCode(cur.weather_code, isDay);
  const { impact, reason } = computeMoodImpact({
    weatherCode: cur.weather_code,
    uvIndex: cur.uv_index ?? 0,
    humidity: cur.relative_humidity_2m ?? 50,
    temperature: cur.temperature_2m ?? 20,
    windSpeed: cur.wind_speed_10m ?? 10,
  });

  const forecast: WeatherForecastDay[] = (daily.time ?? []).map((date: string, i: number) => {
    const fc = interpretWeatherCode(daily.weather_code[i]);
    return {
      date,
      maxTemp: Math.round(daily.temperature_2m_max[i]),
      minTemp: Math.round(daily.temperature_2m_min[i]),
      weatherCode: daily.weather_code[i],
      condition: fc.condition,
      conditionEmoji: fc.emoji,
      precipitationSum: daily.precipitation_sum[i] ?? 0,
      uvIndexMax: daily.uv_index_max?.[i] ?? 0,
      sunrise: daily.sunrise?.[i] ?? '',
      sunset: daily.sunset?.[i] ?? '',
    };
  });

  return {
    timestamp: Date.now(),
    city,
    temperature: Math.round(cur.temperature_2m),
    feelsLike: Math.round(cur.apparent_temperature),
    humidity: Math.round(cur.relative_humidity_2m),
    uvIndex: Math.round(cur.uv_index ?? 0),
    windSpeed: Math.round(cur.wind_speed_10m),
    weatherCode: cur.weather_code,
    condition,
    conditionEmoji: emoji,
    isDay,
    moodImpact: impact,
    moodImpactReason: reason,
    forecast,
    pressureHPA: Math.round(cur.surface_pressure ?? 1013),
    precipitationMM: cur.precipitation ?? 0,
    locationSource,
  };
}

export async function fetchWeather(): Promise<WeatherData | null> {
  try {
    // Check cache first
    const cached = await AsyncStorage.getItem(WEATHER_KEY);
    if (cached) {
      const parsed: WeatherData = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) return parsed;
    }

    // ── 1. Try manual city (user-set preference takes priority) ──────────────
    const manualCity = await getManualCity();
    if (manualCity) {
      try {
        const geo = await geocodeCity(manualCity);
        if (geo) {
          const data = await fetchWeatherForCoords(geo.lat, geo.lon, geo.city, 'manual');
          await AsyncStorage.setItem(WEATHER_KEY, JSON.stringify(data));
          return data;
        }
      } catch (e) {
        console.warn('Manual city fetch failed:', e);
        // Fall through to GPS
      }
    }

    // ── 2. Try GPS location ───────────────────────────────────────────────────
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const lat = loc.coords.latitude;
        const lon = loc.coords.longitude;
        let city = 'Your location';
        try {
          const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (geo.length > 0) {
            city = geo[0].city ?? geo[0].subregion ?? geo[0].region ?? geo[0].country ?? 'Your location';
          }
        } catch {}
        const data = await fetchWeatherForCoords(lat, lon, city, 'gps');
        await AsyncStorage.setItem(WEATHER_KEY, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn('GPS location failed:', e);
    }

    // ── 3. IP-based geolocation (automatic, no permission needed) ────────────
    try {
      const ipGeo = await getLocationByIP();
      if (ipGeo) {
        const data = await fetchWeatherForCoords(ipGeo.lat, ipGeo.lon, ipGeo.city, 'ip');
        await AsyncStorage.setItem(WEATHER_KEY, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn('IP geolocation failed:', e);
    }

    // ── 4. Absolute fallback: Open-Meteo with NYC coords ─────────────────────
    try {
      const data = await fetchWeatherForCoords(40.7128, -74.0060, 'New York (fallback)', 'fallback');
      await AsyncStorage.setItem(WEATHER_KEY, JSON.stringify(data));
      return data;
    } catch {}

    return generateFallbackWeather();
  } catch (e) {
    console.warn('fetchWeather error:', e);
    try {
      const stale = await AsyncStorage.getItem(WEATHER_KEY);
      if (stale) return JSON.parse(stale);
    } catch {}
    return generateFallbackWeather();
  }
}

function generateFallbackWeather(): WeatherData {
  const hour = new Date().getHours();
  const isDay = hour >= 6 && hour < 20;
  const codes = [0, 1, 2, 80, 3, 61, 0];
  const code = codes[new Date().getDay()];
  const { condition, emoji } = interpretWeatherCode(code, isDay);
  const temp = 18 + (new Date().getDate() % 8);
  const { impact, reason } = computeMoodImpact({
    weatherCode: code, uvIndex: isDay ? 4 : 0,
    humidity: 55, temperature: temp, windSpeed: 12,
  });
  return {
    timestamp: Date.now(), city: 'Location unavailable',
    temperature: temp, feelsLike: temp - 2, humidity: 55,
    uvIndex: isDay ? 4 : 0, windSpeed: 12, weatherCode: code,
    condition, conditionEmoji: emoji, isDay,
    moodImpact: impact, moodImpactReason: reason,
    forecast: [], pressureHPA: 1013, precipitationMM: 0,
    locationSource: 'fallback',
  };
}

export async function getCachedWeather(): Promise<WeatherData | null> {
  const raw = await AsyncStorage.getItem(WEATHER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function getUVLabel(uv: number): string {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very High';
  return 'Extreme';
}

export function getUVColor(uv: number): string {
  if (uv <= 2) return '#4ECDC4';
  if (uv <= 5) return '#FFD166';
  if (uv <= 7) return '#FF8C42';
  if (uv <= 10) return '#FF6B6B';
  return '#C0392B';
}

// ─── Temperature conversion helpers ─────────────────────────────────────────
export function celsiusToFahrenheit(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

export function formatTemp(celsius: number, unit: 'C' | 'F'): string {
  return unit === 'F' ? `${celsiusToFahrenheit(celsius)}°F` : `${celsius}°C`;
}

export function getMoodImpactColor(impact: 'positive' | 'neutral' | 'negative'): string {
  if (impact === 'positive') return '#4ECDC4';
  if (impact === 'negative') return '#FF6B6B';
  return '#8A8EBF';
}
