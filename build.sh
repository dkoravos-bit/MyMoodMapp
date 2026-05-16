#!/bin/bash
set -e

# Remove stale lockfile so npm install regenerates it cleanly.
# This prevents the "specifiers in lockfile don't match package.json" error
# that causes Cloudflare Pages builds to fail when OnSpace updates packages.
echo "→ Removing stale package-lock.json..."
rm -f package-lock.json

echo "→ Installing dependencies..."
npm install --legacy-peer-deps

echo "→ Patching ajv to v8..."
node scripts/patch-ajv.js

echo "→ Building Expo web export..."
npx expo export --platform web --clear

echo "✓ Build complete. Output in ./dist"
