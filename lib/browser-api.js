/**
 * Tiny API shim so the same code runs on Firefox (`browser`) and Chromium (`chrome`).
 * Chrome MV3 APIs return Promises when no callback is passed.
 */
(() => {
  const api = globalThis.browser || globalThis.chrome;
  if (!api) {
    console.error("[SCC] No WebExtension API (browser/chrome) found");
    return;
  }
  if (!globalThis.browser) {
    globalThis.browser = api;
  }
})();
