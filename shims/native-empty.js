// shims/native-empty.js
// Empty shim used for native-only packages when bundling for web.
// Exports a default object and named AppleHealthKit so existing
// try/catch require() calls resolve to null-safe stubs.

const stub = {};
module.exports = stub;
module.exports.default = stub;
module.exports.AppleHealthKit = stub;
