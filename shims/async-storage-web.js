// shims/async-storage-web.js
// localStorage-backed AsyncStorage shim for web builds.
// Mirrors the @react-native-async-storage/async-storage API.
// SSR-safe: all localStorage access is guarded with typeof window checks
// so the shim works in both browser and Node.js (Expo static export).

function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

const AsyncStorage = {
  getItem: async (key) => {
    try {
      const s = getStorage();
      return s ? s.getItem(key) : null;
    } catch { return null; }
  },
  setItem: async (key, value) => {
    try {
      const s = getStorage();
      if (s) s.setItem(key, value);
    } catch {}
  },
  removeItem: async (key) => {
    try {
      const s = getStorage();
      if (s) s.removeItem(key);
    } catch {}
  },
  mergeItem: async (key, value) => {
    try {
      const s = getStorage();
      if (!s) return;
      const existing = s.getItem(key);
      const merged = existing
        ? JSON.stringify({ ...JSON.parse(existing), ...JSON.parse(value) })
        : value;
      s.setItem(key, merged);
    } catch {}
  },
  clear: async () => {
    try {
      const s = getStorage();
      if (s) s.clear();
    } catch {}
  },
  getAllKeys: async () => {
    try {
      const s = getStorage();
      return s ? Object.keys(s) : [];
    } catch { return []; }
  },
  multiGet: async (keys) => {
    try {
      const s = getStorage();
      return s ? keys.map(k => [k, s.getItem(k)]) : keys.map(k => [k, null]);
    } catch { return []; }
  },
  multiSet: async (pairs) => {
    try {
      const s = getStorage();
      if (s) pairs.forEach(([k, v]) => s.setItem(k, v));
    } catch {}
  },
  multiRemove: async (keys) => {
    try {
      const s = getStorage();
      if (s) keys.forEach(k => s.removeItem(k));
    } catch {}
  },
  flushGetRequests: () => {},
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
