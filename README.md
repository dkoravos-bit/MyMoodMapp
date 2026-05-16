# MyMoodMapp

AI-powered mood tracking and wellbeing intelligence platform.

## Features
- Mood logging with body/mind/energy dimensions
- AI wellness reports (daily/weekly/monthly)
- 24 ambient soundscapes + 28+ healing frequencies
- 19 guided meditations
- 7 stress relief games
- Health data fusion (Apple Health / Google Fit)
- Weather & mood correlation
- Cycle tracking
- Therapist dashboard
- Accountability buddies
- Astrology & Schumann resonance insights

## Build

```bash
npm install
npx expo start
```

## Production Build

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

## Environment

Copy `.env.example` to `.env` and fill in your Supabase credentials.

## App Store

- Bundle ID: `com.dkoravos.mymoodmapp`
- Version: 1.0.0
- Build: 3
- Apple Team ID: AH86J8H6P7

See `TESTFLIGHT_NOTES.md` for reviewer credentials and navigation guide.
