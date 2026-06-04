/**
 * app.config.js
 *
 * Replaces app.json as the Expo config source.
 * On EAS builds (EAS_BUILD=true set by EAS automatically, or CI=true),
 * native-only plugins are added that would break the OnSpace preview sandbox.
 * In all other environments the config is identical to app.json.
 */

const { expo: base } = require('./app.json');

// EAS automatically sets EAS_BUILD=true in the build environment.
// CI=true is also reliable on EAS runners.
const isEASBuild = !!(
  process.env.EAS_BUILD === 'true' ||
  process.env.EAS_BUILD ||
  process.env.CI === 'true'
);

// Plugins that must ONLY run during EAS native builds.
// They require @expo/config-plugins, fs, path — none of which exist in
// the OnSpace preview sandbox where `expo` itself is not installed.
const easNativePlugins = [];

if (isEASBuild) {
  // 1. Remove react-native-webrtc from the Podfile so WebRTC.framework
  //    is never linked. WebRTC's +load method crashes iOS 26 on launch.
  easNativePlugins.push('./plugins/withoutWebRTC');

  // 2. Override RCTFatal at the native ObjC level so any JS exception that
  //    reaches the native handler is swallowed instead of calling
  //    objc_exception_rethrow → std::terminate → abort → SIGABRT.
  //    Uses withDangerousMod + direct pbxproj string manipulation (no xcode
  //    npm package APIs that previously caused prebuild failures).
  easNativePlugins.push('./plugins/withRCTFatalOverride');

  // 2. Sentry dSYM + source map upload — only if the package is installed.
  //    @sentry/react-native is optional; skip gracefully if absent.
  try {
    require.resolve('@sentry/react-native/expo');
    easNativePlugins.push([
      '@sentry/react-native/expo',
      {
        organization: 'maverick-investments-llc',
        project: 'apple-ios',
        url: 'https://sentry.io/',
      },
    ]);
  } catch {
    // @sentry/react-native not installed — skip Sentry plugin
  }
}

module.exports = {
  ...base,
  plugins: [
    ...(base.plugins || []),
    ...easNativePlugins,
  ],
};
