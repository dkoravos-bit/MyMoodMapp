// sentryService.ts
// Web-safe base stub — zero native imports.
// On native platforms, sentryService.native.ts is automatically selected by Metro.
// On web, sentryService.web.ts is automatically selected by Metro.
// This file is the final fallback and must never import native packages.

const noop = () => {};
const noopCapture = (_e: any, _opts?: any) => {};
const noopWrap = (Component: any) => Component;

const SentryStub = {
  init: noop,
  captureException: noopCapture,
  captureMessage: noopCapture,
  addBreadcrumb: noop,
  setUser: noop,
  setTag: noop,
  setExtra: noop,
  setContext: noop,
  withScope: (_cb: any) => {},
  wrap: noopWrap,
  ReactNativeTracing: class {},
  ReactNavigationInstrumentation: class {},
  Severity: { Fatal: 'fatal', Error: 'error', Warning: 'warning', Info: 'info', Debug: 'debug' },
};

export default SentryStub;
