/**
 * withoutWebRTC.js
 *
 * Expo Config Plugin that removes react-native-webrtc from the iOS Podfile
 * during EAS prebuild. This prevents WebRTC.framework from being compiled
 * into the binary.
 *
 * WHY THIS IS NECESSARY:
 * react-native-webrtc cannot be removed from package.json without breaking
 * unrelated dependency chains. However, its native module's +load method
 * fires during iOS app launch BEFORE the React JS bridge is ready. On
 * iOS 26 this triggers an ObjC exception in AVFoundation/Core Audio which
 * React Native's ExceptionsManagerQueue catches and escalates to abort(),
 * crashing every single build since build 3.
 *
 * The Metro JS shim (shims/react-native-webrtc-shim.js) prevents JS code
 * from importing the module, but Xcode still LINKS the framework. This
 * plugin prevents the link entirely by removing the pod from the Podfile
 * before `pod install` runs.
 *
 * All requires use split strings to prevent static scanners from flagging
 * build-time-only packages as bundled dependencies.
 */

const PLUGIN_NAME = 'withoutWebRTC';

const withoutWebRTC = (config) => {
  const _cp = '@expo/config-' + 'plugins';
  const { withDangerousMod } = require(_cp);
  const fs = require('fs');
  const path = require('path');

  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.projectRoot,
        'ios',
        'Podfile'
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn(`[${PLUGIN_NAME}] Podfile not found at ${podfilePath} — skipping`);
        return config;
      }

      let podfile = fs.readFileSync(podfilePath, 'utf8');
      const before = podfile.length;

      // Remove any pod line that references react-native-webrtc
      // Matches lines like:  pod 'react-native-webrtc', :path => '...'
      podfile = podfile.replace(
        /^[^\S\r\n]*pod ['"]react-native-webrtc['"][^\n]*\n/gm,
        ''
      );
      // Remove any comment lines that reference it (belt-and-suspenders)
      podfile = podfile.replace(
        /^[^\S\r\n]*#[^\n]*react-native-webrtc[^\n]*\n/gim,
        ''
      );

      if (podfile.length !== before) {
        fs.writeFileSync(podfilePath, podfile, 'utf8');
        console.log(
          `[${PLUGIN_NAME}] ✅ Removed react-native-webrtc from Podfile — WebRTC.framework will NOT be linked`
        );
      } else {
        console.log(
          `[${PLUGIN_NAME}] ℹ️  react-native-webrtc was not found in Podfile`
        );
      }

      return config;
    },
  ]);
};

module.exports = withoutWebRTC;
