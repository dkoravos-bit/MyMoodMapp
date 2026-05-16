/**
 * @sentry/react-native — web no-op shim
 *
 * @sentry/react-native is a native-only package (iOS/Android).
 * On web we replace it with safe no-ops so Metro can bundle without errors.
 * Sentry error tracking on web can be added separately via @sentry/browser if needed.
 */

const noop = () => {};
const noopReturn = (v) => v;

// Stub for Sentry.wrap — just returns the component unchanged
const wrap = (component) => component;

// Stub for Sentry.init
const init = noop;

// Stub for captureException / captureMessage
const captureException = noop;
const captureMessage = noop;
const captureEvent = noop;

// Stub for addBreadcrumb
const addBreadcrumb = noop;

// Stub for setUser / setTag / setContext / setExtra
const setUser = noop;
const setTag = noop;
const setTags = noop;
const setContext = noop;
const setExtra = noop;
const setExtras = noop;

// Stub for withScope
const withScope = (callback) => { try { callback({ setTag: noop, setExtra: noop, setUser: noop, setLevel: noop, setContext: noop, setExtras: noop, setTags: noop, addBreadcrumb: noop, clear: noop }); } catch {} };

// Stub for startTransaction / getCurrentHub
const startTransaction = () => ({ finish: noop, setTag: noop, setData: noop, setStatus: noop, setHttpStatus: noop, toContext: () => ({}), startChild: () => ({ finish: noop }) });
const getCurrentHub = () => ({ getScope: () => null, configureScope: noop, captureException: noop, captureMessage: noop });

// Stub for Sentry.Native (used in some React Navigation integrations)
const Native = { fetchNativeRelease: () => Promise.resolve({ id: '', version: '', build: '' }), crash: noop };

// Stub for ReactNativeTracing
class ReactNativeTracing { setupOnce() {} }

// Stub for ReactNavigationInstrumentation
class ReactNavigationInstrumentation { onRouteConfirmation() {} registerRoutingInstrumentation() {} }

// Stub for SentrySDK / touch
const lastEventId = () => '';
const flush = () => Promise.resolve(true);
const close = () => Promise.resolve(true);

const Severity = {
  Fatal: 'fatal', Error: 'error', Warning: 'warning',
  Log: 'log', Info: 'info', Debug: 'debug', Critical: 'critical',
};

// Support both ESM default import and named imports
const sentryWebShim = {
  init,
  wrap,
  captureException,
  captureMessage,
  captureEvent,
  addBreadcrumb,
  setUser,
  setTag,
  setTags,
  setContext,
  setExtra,
  setExtras,
  withScope,
  startTransaction,
  getCurrentHub,
  lastEventId,
  flush,
  close,
  Native,
  ReactNativeTracing,
  ReactNavigationInstrumentation,
  Severity,
  default: null, // set below
};
sentryWebShim.default = sentryWebShim;

module.exports = sentryWebShim;
module.exports.default = sentryWebShim;
