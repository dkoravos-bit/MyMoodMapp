/**
 * scripts/patch-ajv.js
 *
 * Post-install helper — ensures ajv v8 is the resolved copy used by
 * webpack / expo-webpack-config. The error:
 *
 *   "Cannot find module 'ajv/dist/compile/codegen'"
 *
 * happens when a hoisted ajv@6 is found instead of ajv@8 (which introduced
 * that internal path). This script removes any nested ajv@6 copies so Node
 * module resolution falls back to the top-level ajv@8.
 *
 * Invoked automatically from build.sh after `npm install`.
 * Also safe to run manually: `node scripts/patch-ajv.js`
 */

const fs   = require('fs');
const path = require('path');

const root  = path.resolve(__dirname, '..');
const nm    = path.join(root, 'node_modules');
const ajvV8 = path.join(nm, 'ajv');

// ── Verify top-level ajv is v8 ─────────────────────────────────────────────
let topMajor = 0;
try {
  const topPkg = JSON.parse(fs.readFileSync(path.join(ajvV8, 'package.json'), 'utf8'));
  topMajor = parseInt(topPkg.version.split('.')[0], 10);
  console.log('[patch-ajv] Top-level ajv is v' + topPkg.version + (topMajor >= 8 ? ' ✓' : ' ✗'));
} catch {
  console.warn('[patch-ajv] Could not read top-level ajv package.json — skipping patch.');
  process.exit(0);
}

if (topMajor < 8) {
  console.warn('[patch-ajv] Top-level ajv is v' + topMajor + ' (expected v8). ' +
    'Run: npm install ajv@^8.0.0 --legacy-peer-deps');
  process.exit(1);
}

// ── Packages known to nest their own ajv@6 ────────────────────────────────
// Any nested ajv < 8 under these paths is removed so Node resolution
// falls back to the v8 copy at the top of node_modules.
const suspects = [
  'ajv-keywords/node_modules/ajv',
  'schema-utils/node_modules/ajv',
  '@webpack-cli/node_modules/ajv',
  'webpack/node_modules/ajv',
  'jest-validate/node_modules/ajv',
  'babel-jest/node_modules/ajv',
  'metro-config/node_modules/ajv',
  '@expo/webpack-config/node_modules/ajv',
  'react-scripts/node_modules/ajv',
];

let removed = 0;
for (const rel of suspects) {
  const target = path.join(nm, rel);
  if (!fs.existsSync(target)) continue;
  try {
    const nested = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
    const nestedMajor = parseInt(nested.version.split('.')[0], 10);
    if (nestedMajor < 8) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log('[patch-ajv] Removed nested ajv@' + nested.version + ' at ' + rel);
      removed++;
    } else {
      console.log('[patch-ajv] Nested ajv@' + nested.version + ' at ' + rel + ' is already v8 — OK');
    }
  } catch (e) {
    console.warn('[patch-ajv] Could not process ' + rel + ':', e.message);
  }
}

// ── Also scan for any other deeply-nested ajv@6 copies ────────────────────
// Walks node_modules up to 4 levels deep looking for stray ajv@6 installs.
function scanDeep(dir, depth) {
  if (depth <= 0 || !fs.existsSync(dir)) return;
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return; }
  for (const entry of entries) {
    if (entry === 'ajv') {
      const pkgPath = path.join(dir, entry, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;
      const fullPath = path.join(dir, entry);
      if (fullPath === ajvV8) continue; // never remove top-level
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const major = parseInt(pkg.version.split('.')[0], 10);
        if (major < 8) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          const rel = path.relative(nm, fullPath);
          console.log('[patch-ajv] Deep-scan removed ajv@' + pkg.version + ' at ' + rel);
          removed++;
        }
      } catch {}
      continue;
    }
    const subNm = path.join(dir, entry, 'node_modules');
    if (fs.existsSync(subNm)) scanDeep(subNm, depth - 1);
  }
}

scanDeep(nm, 4);

console.log('[patch-ajv] Done — removed ' + removed + ' nested ajv@6 copies.');
