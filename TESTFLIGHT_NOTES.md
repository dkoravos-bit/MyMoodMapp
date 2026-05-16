# MyMoodMapp — TestFlight & App Store Review Notes

## Test Account Credentials

**Email:** testaccount@mymoodmapp.com  
**Password:** TestReview2024!

This account is pre-seeded with 30 days of realistic mood data, fitness entries, soundscape sessions, and wellness reports so reviewers can evaluate all features immediately without needing to manually create data.

---

## App Overview

MyMoodMapp is an AI-powered wellbeing intelligence platform combining:
- Mood logging (10-second daily check-ins)
- AI wellness reports (daily/weekly/monthly)
- Health data correlation (Apple Health / Google Fit sync)
- Weather & mood correlation
- 24 ambient soundscapes + 28+ healing frequencies
- 19 guided meditation sessions
- 7 stress relief games
- Astrology & Schumann resonance insights
- Cycle tracking (menstrual phase correlation)
- Therapist dashboard (Pro tier)
- Accountability buddy system

---

## Feature Navigation Guide

### Dashboard (Tab 1 — Home icon)
- Shows today's mood score, 7-day trend, tag correlations, weather widget
- Swipe between Today / This Week / This Month panels
- All data is pre-loaded for the test account

### Log / Check-in (Tab 2 — Plus icon)
- Tap to log a new mood entry
- Rate overall score (slider), body/mind/energy (sliders)
- Select context tags (e.g., "Exercise", "Work", "Good Sleep")
- Optional: voice note, selfie capture
- Takes approx 10–15 seconds to complete

### Patterns (Tab 3 — Bar chart icon)
- Tag correlations: which activities move your score
- Time-of-day patterns: when you feel best/worst
- AI Insights report (tap "AI Report" tab) — powered by OpenRouter AI
- Weekly/monthly/all-time views

### Mood Lab (Tab 4 — Waves icon)
**Sounds tab:** 24 ambient soundscapes — tap any to play. Volume slider at bottom.  
**Frequency tab:** 28+ solfeggio/binaural tones — all generated locally.  
**Meditate tab:** 19 YouTube-hosted guided meditations.  
**Games tab:** 7 stress relief games:
  1. Breathing Bubble — 4-7-8 breathing exercise
  2. Bubble Wrap — tap to pop crystal grid
  3. Zen Sand — draw patterns in sand
  4. 2048 — swipe tile puzzle
  5. Dot Mandala — symmetrical dot art
  6. Pixel Art — freeform 24×N pixel painting
  7. MoodBeat — drum sequencer with 4-pad live mode

### Mapp (Tab 5 — Compass icon)
- AI-generated emotional compass visualization
- Switch layers: Today / Week / Month / Drivers / Forecast / Mood Print
- Tap "Generate" to create fresh AI art from current mood data

### Me / Profile (Tab 6 — Person icon)
- View subscription status
- Manage account settings
- Toggle dark/light theme
- Accountability buddies section
- Therapist dashboard access (for Therapist Pro accounts)

---

## Subscription Tiers

| Tier | Monthly | Features |
|------|---------|----------|
| Free | $0 | Unlimited logs, 30-day history, 1 buddy, 15-min soundscapes |
| Pro | $3.99/mo | All features, AI reports, full history, all games/sounds |
| Therapist Pro | $9.99/mo | Pro + client dashboard, unlimited clients, intake scores |

**The test account has Therapist Pro active** — all features are accessible.

---

## HealthKit Integration

The app requests HealthKit permission on first launch with a pre-prompt explanation screen. The test account includes mock synced data. On a real device with Apple Health:
1. Open the app → Dashboard
2. Tap the refresh icon next to "Body Today"
3. iOS will present the HealthKit permission sheet
4. Grant permissions to see live step/sleep/HR data

---

## Push Notifications

The app requests notification permission on first launch after onboarding (not immediately on cold start). A contextual explanation screen appears before the system prompt explaining the purpose (daily check-in reminders).

To test notifications:
1. Complete the onboarding flow (or use the pre-seeded test account which skips onboarding)
2. Go to Me → Settings → Notifications
3. Enable daily reminders

---

## Known Limitations (Non-Blocking for Review)

- YouTube meditation videos require internet connection to stream
- AI art generation (Mapp canvas) requires network — uses Supabase Edge Function
- Weather widget uses GPS or manual city input (test account defaults to New York)
- Schumann resonance data fetches from a live API — may show cached data

---

## App Privacy & Data

- All mood data encrypted and stored in Supabase PostgreSQL with RLS
- Health data never leaves the device except for cloud sync to the user's own account
- No third-party analytics or advertising SDKs
- NSPrivacyTracking = false (no cross-app tracking)

---

## EAS Build Notes (Before Submitting)

**No manual plugin changes needed.** Native-only plugins (`withoutWebRTC`, `withRCTFatalOverride`, `@sentry/react-native/expo`) are automatically injected via `app.config.js` when EAS sets the `EAS_BUILD=true` environment variable during the build. The OnSpace preview sandbox never sees these plugins.

**Current build number: 15**

Run:
```
eas build --platform ios --profile production
```

### Why WebRTC Was Crashing (Fixed in Build 15)

`react-native-webrtc` cannot be removed from `package.json` without breaking unrelated dependencies, but its native `+load` method fires at iOS app launch before the React JS bridge is ready. On iOS 26 this triggers an ObjC exception that React Native's `ExceptionsManagerQueue` catches and escalates to `abort()`. The `plugins/withoutWebRTC.js` config plugin removes the pod from the Podfile before `pod install` runs, so `WebRTC.framework` is never linked into the binary.

---

## Technical Notes for Reviewers

- Bundle ID: com.dkoravos.mymoodmapp
- Version: 1.0.0 (Build 3)
- Min iOS: 15.0
- Supports: iPhone and iPad
- Dark mode: Default (also supports light mode via in-app toggle)
- Orientation: Portrait (iPad supports all orientations)
- Background audio: Yes (soundscapes continue playing when app is backgrounded)
- Push notifications: Yes (daily check-in reminders, accountability alerts)
- HealthKit: Yes (read-only: steps, sleep, heart rate, calories, active minutes)
- Location: When In Use only (for local weather, approximate only)
- Microphone: For breathing game biofeedback in Mood Lab

---

*For questions during review, contact: dkoravos@gmail.com*
