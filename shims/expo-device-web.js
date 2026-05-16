// shims/expo-device-web.js
// Safe no-op shim for expo-device on web.

module.exports = {
  isDevice: false,
  brand: null,
  manufacturer: null,
  modelName: null,
  modelId: null,
  designName: null,
  productName: null,
  deviceYearClass: null,
  totalMemory: null,
  supportedCpuArchitectures: null,
  osName: 'web',
  osVersion: null,
  osBuildId: null,
  osInternalBuildId: null,
  osBuildFingerprint: null,
  platformApiLevel: null,
  deviceName: null,
  DeviceType: { UNKNOWN: 0, PHONE: 1, TABLET: 2, DESKTOP: 3, TV: 4 },
  getDeviceTypeAsync: async () => 3, // DESKTOP
  isRootedExperimentalAsync: async () => false,
  hasDynamicIsland: false,
  default: {},
};
