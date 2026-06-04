// shims/expo-auth-session-web.js
// Safe web shim for expo-auth-session.
// Works for both:
//   import { maybeCompleteAuthSession } from 'expo-auth-session'
//   import * as AuthSession from 'expo-auth-session'
// Metro resolves the CJS module.exports as the namespace for `import *`,
// so every function must be a top-level property of module.exports.

function maybeCompleteAuthSession() {
  return { type: 'notsupported' };
}

function startAsync() {
  return Promise.resolve({ type: 'error' });
}

function useAuthRequest() {
  return [null, null, function () {}];
}

function useAutoDiscovery() {
  return null;
}

function makeRedirectUri() {
  return '';
}

// Named exports — covers `import { maybeCompleteAuthSession } from 'expo-auth-session'`
module.exports = {
  maybeCompleteAuthSession: maybeCompleteAuthSession,
  startAsync: startAsync,
  useAuthRequest: useAuthRequest,
  useAutoDiscovery: useAutoDiscovery,
  makeRedirectUri: makeRedirectUri,
};

// Default export — covers `import * as AuthSession from 'expo-auth-session'`
// Metro maps `import *` to the module.exports object, so the functions above
// are already accessible as AuthSession.maybeCompleteAuthSession etc.
// Setting __esModule prevents Metro from wrapping this in an extra { default } layer.
Object.defineProperty(module.exports, '__esModule', { value: true });
module.exports.default = module.exports;
