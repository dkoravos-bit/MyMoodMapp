# Sentry Setup Guide — MyMoodMapp

## 1. Create a Sentry project

1. Go to https://sentry.io and sign in (free tier is sufficient)
2. **Create New Project** → choose **React Native** → name it `mymoodmapp`
3. Note the **DSN** (looks like `https://abc123@o123.ingest.sentry.io/456`)

## 2. Add environment variables

### Local development — `.env` file

Add to your project root `.env`:

```
EXPO_PUBLIC_SENTRY_DSN=https://YOUR_DSN_HERE@o0.ingest.sentry.io/0
```

### EAS build secrets (required for source map upload)

In the EAS dashboard → **Secrets**, add:

| Key | Value |
|-----|-------|
| `EXPO_PUBLIC_SENTRY_DSN` | your Sentry DSN |
| `SENTRY_AUTH_TOKEN` | token from https://sentry.io/settings/account/api/auth-tokens/ (scope: `project:releases`, `org:read`) |

## 3. Update `sentry.properties`

Edit `sentry.properties` and set `defaults.org` to your Sentry organization slug
(visible in your Sentry URL: `https://sentry.io/organizations/YOUR-SLUG/`).

## 4. Build

```bash
eas build --platform ios --profile production
```

The `@sentry/react-native/expo` Expo config plugin will automatically:
- Inject the Sentry native SDK into the Xcode project
- Upload dSYM files after build for symbolicated native crash reports
- Upload JS source maps so JS stack traces show file + line number

## 5. Verify

After your next TestFlight crash, go to **Sentry → Issues**.  
You should see the full symbolicated JS stack trace with file names and line numbers.

---

## What is captured

| Event | Captured |
|-------|----------|
| Unhandled JS exceptions (fatal) | ✅ via `ErrorUtils.setGlobalHandler` |
| React component crashes | ✅ via `ErrorBoundary.componentDidCatch` |
| Native iOS crashes (ObjC/C++) | ✅ via dSYM upload + native handler |
| Console breadcrumbs | ✅ last 50 events before crash |
| Navigation breadcrumbs | ✅ automatic |
| Performance traces | ✅ 20% sample rate |
