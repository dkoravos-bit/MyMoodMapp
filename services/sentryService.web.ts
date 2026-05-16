// sentryService.web.ts
// Web no-op stub for @sentry/react-native.
// Metro/Expo automatically prefers this file over sentryService.ts on web.
const noop = () => {};
const wrap = (c: any) => c;

const SentryStub = {
  init: noop,
  wrap,
  captureException: noop,
  captureMessage: noop,
  captureEvent: noop,
  addBreadcrumb: noop,
  setUser: noop,
  setTag: noop,
  setTags: noop,
  setContext: noop,
  setExtra: noop,
  setExtras: noop,
  withScope: (callback: any) => {
    try {
      callback({
        setTag: noop, setExtra: noop, setUser: noop, setLevel: noop,
        setContext: noop, setExtras: noop, setTags: noop,
        addBreadcrumb: noop, clear: noop,
      });
    } catch {}
  },
  startTransaction: () => ({ finish: noop, setTag: noop, setData: noop, setStatus: noop }),
  getCurrentHub: () => ({ getScope: () => null, configureScope: noop, captureException: noop }),
  Native: {
    fetchNativeRelease: () => Promise.resolve({ id: '', version: '', build: '' }),
    crash: noop,
  },
  Severity: {
    Fatal: 'fatal', Error: 'error', Warning: 'warning',
    Log: 'log', Info: 'info', Debug: 'debug', Critical: 'critical',
  },
  ReactNativeTracing: class { setupOnce() {} },
  ReactNavigationInstrumentation: class { onRouteConfirmation() {} registerRoutingInstrumentation() {} },
  lastEventId: () => '',
  flush: () => Promise.resolve(true),
  close: () => Promise.resolve(true),
};

export default SentryStub;
