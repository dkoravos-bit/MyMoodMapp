// sentryService.ts
// Native/default version: re-exports @sentry/react-native for use in app code.
// On web, sentryService.web.ts is automatically selected by Metro/Expo instead.
// This file is NEVER bundled for web — the .web.ts override takes priority.
// @ts-nocheck
import * as SentryLib from '@sentry/react-native';
export default SentryLib;
