// crashShield.native.ts
// ─────────────────────────────────────────────────────────────────────────────
// Patches React Native's ExceptionsManager.handleException so that fatal JS
// errors NEVER reach the ObjC rethrow path (RCTExceptionManager → objc_exception_rethrow
// → _objc_terminate → demangling_terminate_handler → abort → SIGABRT).
//
// This file uses require() — NOT import — so the patching executes immediately
// when this module is first evaluated, before any component renders.
//
// Imported as the VERY FIRST import in app/_layout.tsx so it installs before
// any other module can trigger a fatal.
// ─────────────────────────────────────────────────────────────────────────────

// @ts-nocheck

try {
  // Patch 1: ExceptionsManager.handleException
  // React Native calls this with isFatal=true for unhandled JS errors.
  // isFatal=true → native RCTExceptionManager → objc_exception_rethrow → abort()
  // We force isFatal=false on every call so the native path only logs, never throws.
  const EM = require('react-native/Libraries/Core/ExceptionsManager');
  if (EM && typeof EM.handleException === 'function') {
    const _orig = EM.handleException;
    EM.handleException = function patchedHandleException(e: any, isFatal: any) {
      try { console.log('[CrashShield] JS exception (swallowed as non-fatal):', e?.message ?? String(e)); } catch {}
      try {
        // Always non-fatal so RCTExceptionManager logs but never calls objc_exception_rethrow
        _orig.call(EM, e, false);
      } catch {}
    };
  }
} catch {}

try {
  // Patch 2: ErrorUtils global handler — belt-and-suspenders
  // Intercepts errors before ExceptionsManager even sees them.
  if (typeof (global as any).ErrorUtils !== 'undefined') {
    (global as any).ErrorUtils.setGlobalHandler(function shieldHandler(err: any, _isFatal: any) {
      try {
        console.log('[CrashShield] ErrorUtils caught:', err?.message ?? String(err));
      } catch {}
      // Intentionally swallow — do NOT call previous handler (leads to RCTFatal)
    });
  }
} catch {}

export {};
