/**
 * scripts/load-env.js
 *
 * Vercel build helper: reads the .env file from the repo root and prints
 * a summary of EXPO_PUBLIC_* keys that will be picked up by Metro bundler.
 *
 * Expo's Metro bundler reads .env files automatically at build time, so
 * this script only validates the keys exist — it does NOT override them.
 * The .env file is committed to this repo (managed by OnSpace) and will
 * be present in the Vercel build workspace after `git clone`.
 *
 * If EXPO_PUBLIC_SUPABASE_ANON_KEY is missing or empty, the script fails
 * the build early with a clear message rather than letting the app build
 * with a broken/missing key that causes JWT errors at runtime.
 */

const fs   = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
  console.warn('[load-env] WARNING: .env file not found at', envPath);
  console.warn('[load-env] Metro will use only process.env variables.');
  process.exit(0); // non-fatal — Vercel env vars may supply the values
}

const raw = fs.readFileSync(envPath, 'utf8');
const lines = raw.split('\n');

let url = '';
let key = '';

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const eqIdx = trimmed.indexOf('=');
  const k = trimmed.slice(0, eqIdx).trim();
  const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
  if (k === 'EXPO_PUBLIC_SUPABASE_URL')      url = v;
  if (k === 'EXPO_PUBLIC_SUPABASE_ANON_KEY') key = v;
}

if (!url || !key) {
  console.error('[load-env] ERROR: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing in .env');
  console.error('[load-env] The web build will produce a broken app — aborting.');
  process.exit(1);
}

// Validate it looks like a JWT (3 base64 segments separated by dots)
const parts = key.split('.');
if (parts.length !== 3) {
  console.error('[load-env] ERROR: EXPO_PUBLIC_SUPABASE_ANON_KEY does not look like a valid JWT.');
  console.error('[load-env] Value starts with:', key.slice(0, 40));
  process.exit(1);
}

console.log('[load-env] ✓ EXPO_PUBLIC_SUPABASE_URL =', url);
console.log('[load-env] ✓ EXPO_PUBLIC_SUPABASE_ANON_KEY = [JWT present, ' + key.length + ' chars]');
console.log('[load-env] Metro will bake these values into the web bundle at build time.');
