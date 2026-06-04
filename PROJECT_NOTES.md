# MyMoodMapp — Project Notes & Permanent Rules

This file documents critical architectural decisions and rules that must be preserved across all future development sessions.

---

## 🎨 Mapp Art Generation — CRITICAL RULE

**Rule: ALL art in `app/(tabs)/mapp.tsx` MUST go through the `generate-mood-art` Edge Function. Never call Pollinations directly from the client.**

### Why
Direct client-side Pollinations calls are unreliable:
- CORS blocks the request on web browsers
- CDN URLs are volatile and break on re-render
- No storage = no persistent URLs = art disappears on navigation
- No retry/error handling infrastructure

### Correct Architecture
```
mapp.tsx → invokeArtFunction() → raw fetch() to /functions/v1/generate-mood-art
         → Edge Function calls Pollinations (flux-schnell model, 512px/640px)
         → Edge Function uploads image to Supabase Storage (vibe-cards bucket)
         → Edge Function returns stable public CDN URL
         → mapp.tsx caches the URL (localStorage/nativeCache, 26h TTL)
```

### ⚠️ CRITICAL: Use Raw `fetch()` NOT `supabase.functions.invoke()`
The Supabase JS client (`supabase.functions.invoke`) has a **short default timeout** (~30-40s).
Pollinations image generation takes **15-60s** depending on load.
This mismatch causes **HTTP 499 (client abort)** errors — the client kills the request before the image arrives.

**Always use `invokeArtFunction()` in `mapp.tsx` which uses raw `fetch` with a 120s timeout:**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 120000);
const response = await fetch(`${supabaseUrl}/functions/v1/generate-mood-art`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify(params),
  signal: controller.signal,
});
clearTimeout(timeoutId);
```

### Edge Function Configuration (Confirmed Working)
- **Model**: `flux-schnell` (NOT `turbo` — more reliable)
- **Dimensions**: 512×512 (1:1), 640×360 (16:9) — small = fast
- **Timeout per attempt**: 60s per attempt — fits within Deno 150s execution limit
- **Retries**: 2 attempts (2 × 60s + 1 × 10s backoff = 130s max, Deno-safe) — 5s wait on normal failure, 10s wait on 429
- **CRITICAL**: 429 rate-limit requires **10s backoff** — Pollinations per-IP rate limit; old 20s × 3 attempts was exceeding Deno 150s limit making the 3rd attempt unreachable
- **enhance=false**: reduces Pollinations processing latency
- **seedOverride**: accepted in request body so client-side forced-regen works
- **Client timeout**: 130s raw fetch — applies to BOTH web and native
- **Background prefetch**: ALL 5 layers fire in **parallel** (not sequential) — each layer has its own `fetchRef`+`inflightRef` guard; failures are isolated and don't block other layers
- **Web parity rules (CRITICAL)**:
  - `TODAY_DATE` must be computed via `getTodayDate()` *inside* `invokeArtFunction` (not from a module-level constant) — SSR on web freezes module-level `new Date()` at server render time, causing cache key mismatches that silently skip generation
  - Web gets one automatic 3s-delayed retry on HTTP 5xx errors — browsers occasionally abort long-running fetch connections before Pollinations finishes; the retry matches native resilience
  - Canvas loading shimmer shows the same "Rendering your AI art — 15–60 s…" message on both web and native while `loading === true && artUrl === null`; previously web showed nothing during the 15–60s generation window
  - **Supabase URL resolution (CRITICAL for web)**: `invokeArtFunction` must resolve the URL using a multi-source fallback chain — never rely on `process.env.EXPO_PUBLIC_SUPABASE_URL` alone, because Vercel deployments do not auto-inject `EXPO_PUBLIC_*` env vars. **Always use**: `SUPABASE_URL || (supabase as any)?.supabaseUrl || ''`. The already-initialized Supabase client always carries the correct URL internally via its `.supabaseUrl` property. If the env var is empty on Vercel, the client fallback ensures art generation still works.
  - **Auth token**: Use `supabase.auth.getSession()` only — do NOT add a `getUser()` fallback. On web the session is stored in localStorage and getSession() reads it synchronously. The getUser() fallback adds a network round-trip that can race with art generation and silently return null, blocking all art.
- **Cache version**: v26
- **CRITICAL — Mood Print prompt**: must use "forensic fingerprint macro scan" language with explicit ridge/whorl/valley vocabulary. The old mandala/concentric-rings wording generated circular mandala art instead of actual fingerprint ridges. Key terms required: "extreme macro forensic fingerprint scan under microscope", "ridge and valley pattern", ridgePattern variable must use whorl/arch-loop/fragmented-delta language matched to volatility. **Never revert to mandala/concentric-rings wording for the print art type.**
- **CRITICAL — Native cache persistence**: Native uses a two-layer cache: in-memory hot layer (instant sync) + AsyncStorage persistence layer (survives app restarts). `nGetAsync()` checks both layers. `nSet()` writes both synchronously to memory and fire-and-forget to AsyncStorage. This means art generated today loads **instantly** on app restart rather than regenerating. Web uses `localStorage` (already persistent). Stale cache keys from prior `ART_VER` versions are pruned on startup. **Never revert to in-memory-only native cache.**

### DO NOT
- Add `buildUrl()` or direct `https://image.pollinations.ai/` calls to `mapp.tsx`
- Bypass the Edge Function for any art type
- Use `supabase.functions.invoke()` for art generation (short timeout = 499 aborts)
- Change the model back to `turbo`

---

## 🧠 AI Reports — Architecture & Rules

### Free Model Cascade
The `generate-insights` Edge Function tries models in this order, using the first successful response:
1. `google/gemini-2.5-flash-lite` — best quality, fastest
2. `google/gemini-2.0-flash-lite-001` — solid fallback
3. `meta-llama/llama-3.3-70b-instruct:free` — strong open-source
4. `mistralai/mistral-7b-instruct:free` — lightweight fallback
5. `qwen/qwen3-8b:free` — additional fallback

All are free-tier on OpenRouter. **Never hard-code a single model** — the cascade ensures uptime.

### Journal Integration (CRITICAL RULE)
Journal text (`journalText`, `transcript`, `note`) from `MoodLogEntry` MUST be passed to the Edge Function for AI analysis. The edge function:
- Extracts all entries with ≥20 chars of written/spoken text (up to 20 entries)
- Builds a dedicated **JOURNAL ENTRIES** section in the prompt with the user's exact words, score, date, and tags
- Instructs the AI to **quote specific phrases** from journal entries in at least 2 of 5 recommendations
- Surfaces cross-entry patterns (recurring themes, contradictions between language and scores, lag effects)
- The `journalInsight` field (new) contains a direct-quote journal analysis for display

**When changing `generate-insights/index.ts` or `services/insights.ts`, never remove:**
- Journal entry extraction block (filters entries with text ≥20 chars)
- `journalSection` prompt injection
- `journalRecInstruction` in the behaviorRecommendations critical rules
- `journalText` and `transcript` field mapping in `filteredMood` in `services/insights.ts`

### Report Structure (WellnessInsights type)
All reports include:
- `quickSummary` — spoken-English paragraph for at-a-glance/TTS reading
- `journalInsight` — direct-quote analysis of journal patterns (shown in purple card)
- `behaviorRecommendations[5]` — priority-ordered, science-backed recs with:
  - `priority` 1–5 (1 = most urgent)
  - `notObviousInsight` — non-obvious pattern (may reference journal themes)
  - `predictedOutcome` — what happens if they do/don't act
  - `why` — evidence-based mechanism
  - `category`, `effort`, `timeframe`

### Quick Summary / Read Aloud
- `QuickSummaryCard` component in `app/(tabs)/insights.tsx`
- Uses `expo-speech` for cross-platform TTS
- `quickSummary` field is plain text optimised for TTS
- Stop/start toggle with visual speaking indicator

### Behaviour Recommendations Display
- `BehaviorRecommendations` component in `app/(tabs)/insights.tsx`
- Expandable cards sorted by priority 1→5
- Color-coded by priority urgency (red → purple)
- Each card: summary → detail → non-obvious insight (highlighted) → why it works + predicted outcome
- Also shown (condensed) in saved reports in `app/(tabs)/profile.tsx`

### Journal Insight Display
- Shown as a purple `menu-book` card in `InsightReport` (insights.tsx) — appears after the celebration note
- Also shown (condensed, italic) in expanded saved reports in `profile.tsx`

### Science Frameworks Used
CBT, behavioural activation, chronobiology, sleep science, exercise psychology (BDNF),
polyvagal theory, ACT, social psychology, mindfulness, expressive writing (Pennebaker 1997).

---

## 🔔 Notifications

- No selfie references anywhere in notification copy
- All messages reference "MyMoodMapp" and "logging your score"
- All messages include a long-press hint for instant-log
- See `services/notifications.ts` `WATCH_REMINDER_MESSAGES` array

---

## 📱 iOS Info.plist

`app.json` ios.infoPlist must include:
- `NSHealthShareUsageDescription` — HealthKit read permission
- `NSHealthUpdateUsageDescription` — HealthKit write permission
- `NSMicrophoneUsageDescription` — Voice mood logging

---

## 👤 Demo & Test Accounts

| Email | Password | Role |
|-------|----------|------|
| testaccount@mymoodmapp.com | TestAccount! | therapist_pro |
| tiffanyscottrn@gmail.com | Jesus909! | therapist_pro |
| emptyaccount@mymoodmapp.com | EmptyAccount! | therapist_pro |
| dial_christ@yahoo.com | moodyB!80 | pro |

`testaccount@mymoodmapp.com` has 1 year of auto-populated demo data. The `populate-demo-data` Edge Function runs once per calendar day on login to keep it current.

---

## 💳 Subscription Tiers

- **Free**: basic mood logging
- **Pro** ($3.99/mo): AI art, Mapp layers, Vibe Cards, insights, soundscapes
- **Therapist Pro** ($9.99/mo): all Pro features + therapist dashboard, unlimited clients, export

RevenueCat handles native IAP (iOS/Android). Stripe handles web billing. Both sync to `subscriptions` and `user_profiles` tables.

---

## 🏗️ Architecture Rules

- Services layer: pure functions, no React
- Hooks layer: state + business logic, no JSX
- Components layer: UI only, no direct data calls
- All Context Providers must be in `app/_layout.tsx`
- `AlertProvider` must be the outermost wrapper in `_layout.tsx`
