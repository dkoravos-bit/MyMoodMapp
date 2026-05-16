// shims/expo-auth-session-web.js
// Safe web shim for expo-auth-session.
// maybeCompleteAuthSession is a native-only function; on web it is a no-op.

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

var shim = {
  maybeCompleteAuthSession: maybeCompleteAuthSession,
  startAsync: startAsync,
  useAuthRequest: useAuthRequest,
  useAutoDiscovery: useAutoDiscovery,
  makeRedirectUri: makeRedirectUri,
};

// Named exports — used by: import { maybeCompleteAuthSession } from 'expo-auth-session'
exports.maybeCompleteAuthSession = maybeCompleteAuthSession;
exports.startAsync = startAsync;
exports.useAuthRequest = useAuthRequest;
exports.useAutoDiscovery = useAutoDiscovery;
exports.makeRedirectUri = makeRedirectUri;

// Default export — used by: import * as AuthSession from 'expo-auth-session'
// Metro resolves `import * as X` to module.exports when __esModule is not set,
// so we spread all methods onto exports directly (done above) AND set default.
exports.default = shim;

// Ensure `import * as AuthSession` destructuring works:
// When Metro bundles CJS as ESM namespace, it merges exports into the namespace
// object. Setting __esModule = true tells Metro this is already an ES module
// shape so named + default exports are preserved correctly.
Object.defineProperty(exports, '__esModule', { value: true });
