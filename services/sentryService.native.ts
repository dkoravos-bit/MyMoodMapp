// sentryService.native.ts
// Native version (iOS + Android): wraps @sentry/react-native.
// Metro automatically selects this file over sentryService.ts on native platforms.
// The base sentryService.ts is a no-op stub safe for web/static scanning.
// @ts-nocheck
import * as SentryLib from '@sentry/react-native';
export default SentryLib;
