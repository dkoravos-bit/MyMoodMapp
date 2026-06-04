// metro.config.js
// Ensures the web bundle doesn't attempt to compile native-only packages.
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [
  'jsx', 'js', 'ts', 'tsx', 'json', 'svg', 'cjs', 'mjs'
];

config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: { keep_fnames: true }
};

// Ensure Hermes byte-code compilation is NOT disabled for native builds
// (this setting only affects JS bundling, not native linking)
config.transformer.hermesParser = true;

// ── Block Metro from ever bundling files in the plugins/ directory ────────────
// Config plugins (plugins/*.js) are build-time-only tools for Expo prebuild.
// They use Node built-ins (fs, path) and @expo/config-plugins which are not
// compatible with the React Native JS bundle.
const pluginsDir = path.resolve(__dirname, 'plugins');
const existingBlockList = config.resolver.blockList;
const pluginsBlockRegex = new RegExp(`^${pluginsDir.replace(/\\/g, '\\\\')}.*`);

if (existingBlockList) {
  // Merge with any existing blockList (could be a RegExp or array)
  const existing = Array.isArray(existingBlockList)
    ? existingBlockList
    : [existingBlockList];
  config.resolver.blockList = [...existing, pluginsBlockRegex];
} else {
  config.resolver.blockList = pluginsBlockRegex;
}

// Absolute path to the empty shim — @/ alias doesn't work inside resolveRequest
const EMPTY_SHIM = path.resolve(__dirname, 'shims/native-empty.js');
// WebRTC shim — applied on ALL platforms to prevent iOS 26 native crash
const WEBRTC_SHIM = path.resolve(__dirname, 'shims/react-native-webrtc-shim.js');

// Packages that need a custom web shim (partial support)
const AUTH_SESSION_SHIM       = path.resolve(__dirname, 'shims/expo-auth-session-web.js');
const NOTIFICATIONS_WEB_SHIM  = path.resolve(__dirname, 'shims/expo-notifications-web.js');
const DEVICE_WEB_SHIM         = path.resolve(__dirname, 'shims/expo-device-web.js');
const ASYNC_STORAGE_WEB_SHIM  = path.resolve(__dirname, 'shims/async-storage-web.js');
const YOUTUBE_IFRAME_WEB_SHIM = path.resolve(__dirname, 'shims/react-native-youtube-iframe-web.js');
const SENTRY_WEB_SHIM         = path.resolve(__dirname, 'shims/sentry-react-native-web.js');

// Native-only packages that are replaced with the empty shim on web.
// This list covers packages used in app code AND build tooling that might
// accidentally get resolved during web bundling.
const nativeOnlyModules = [
  'expo-health',
  'react-native-health',
  'react-native-maps',
  '@react-native-community/geolocation',
  'react-native-share',
  'expo-file-system',
  // react-native-web-webview is a peer dep of react-native-youtube-iframe
  // that is not installed; shim it to prevent bundle errors on web
  'react-native-web-webview',
  // RevenueCat — native IAP SDK, no web support
  'react-native-purchases',
  'react-native-purchases-ui',
  // Expo Config Plugins — build-time only, never bundled in the app
  '@expo/config-plugins',
  // Node built-ins that config plugins use — safe to empty-shim in the browser bundle
  'fs',
  'path',
  'child_process',
  'os',
  'module',
  // react-native-youtube-iframe — fallback for cases where the conditional
  // require() in sound-lab.tsx is still evaluated by the web bundler
  'react-native-youtube-iframe',
];

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    const isWeb = platform === 'web' || platform == null;

    // ── react-native-webrtc: shim on ALL platforms ──────────────────────────
    // WebRTC.framework crashes iOS 26 at startup (native module registration
    // triggers AVFoundation / Core Audio before the React bridge is ready).
    // Replacing all JS references with a safe stub prevents the ObjC exception
    // that causes abort() on com.facebook.react.ExceptionsManagerQueue.
    if (
      moduleName === 'react-native-webrtc' ||
      moduleName.startsWith('react-native-webrtc/')
    ) {
      return { filePath: WEBRTC_SHIM, type: 'sourceFile' };
    }

    if (isWeb) {
      // @sentry/react-native — native-only SDK; replace with no-op on web
      if (
        moduleName === '@sentry/react-native' ||
        moduleName.startsWith('@sentry/react-native/')
      ) {
        return { filePath: SENTRY_WEB_SHIM, type: 'sourceFile' };
      }
      // react-native-youtube-iframe — web uses plain <iframe>; shim the native package
      if (
        moduleName === 'react-native-youtube-iframe' ||
        moduleName.startsWith('react-native-youtube-iframe/')
      ) {
        return { filePath: YOUTUBE_IFRAME_WEB_SHIM, type: 'sourceFile' };
      }
      // expo-notifications — replace with safe no-op shim
      if (moduleName === 'expo-notifications' || moduleName.startsWith('expo-notifications/')) {
        return { filePath: NOTIFICATIONS_WEB_SHIM, type: 'sourceFile' };
      }
      // expo-device — replace with safe stub
      if (moduleName === 'expo-device' || moduleName.startsWith('expo-device/')) {
        return { filePath: DEVICE_WEB_SHIM, type: 'sourceFile' };
      }
      // AsyncStorage — replace with localStorage-backed shim
      if (
        moduleName === '@react-native-async-storage/async-storage' ||
        moduleName.startsWith('@react-native-async-storage/async-storage/')
      ) {
        return { filePath: ASYNC_STORAGE_WEB_SHIM, type: 'sourceFile' };
      }
      // expo-auth-session — web-only shim (native uses real package)
      if (moduleName === 'expo-auth-session' || moduleName.startsWith('expo-auth-session/')) {
        return { filePath: AUTH_SESSION_SHIM, type: 'sourceFile' };
      }
      // Fully native / build-time-only packages — empty shim on web
      if (nativeOnlyModules.some(m => moduleName === m || moduleName.startsWith(m + '/'))) {
        return { filePath: EMPTY_SHIM, type: 'sourceFile' };
      }
      // NativeExceptionsManager — internal RN spec file that requires a relative
      // Platform path which doesn't exist in web builds. Shim it so that any
      // transitive import chain pulling in ExceptionsManager never breaks the web bundle.
      if (
        moduleName.includes('NativeExceptionsManager') ||
        moduleName.includes('specs_DEPRECATED/modules/NativeExceptionsManager') ||
        moduleName === 'react-native/Libraries/Core/ExceptionsManager' ||
        moduleName.includes('Libraries/Core/ExceptionsManager')
      ) {
        return { filePath: EMPTY_SHIM, type: 'sourceFile' };
      }
    }

    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};


// Shim @opentelemetry/api (optional supabase dep)
const OTEL_SHIM = path.resolve(__dirname, 'shims/native-empty.js');
const _origResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@opentelemetry')) return { filePath: OTEL_SHIM, type: 'sourceFile' };
  if (_origResolve) return _origResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
