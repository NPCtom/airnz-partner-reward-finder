// sw.js
const MATCHES = [
  "https://www.airnewzealand.co.nz/*",
  "https://airnewzealand.co.nz/*"
];

// --- helpers ---------------------------------------------------------------
function shouldInject(urlStr) {
  try { const u = new URL(urlStr); return /(^|\.)airnewzealand\.co\.nz$/.test(u.hostname); }
  catch { return false; }
}

// Persisted registration: runs on every future navigation automatically
async function registerContent() {
  try {
    // If already registered, update instead of throwing
    const existing = await chrome.scripting.getRegisteredContentScripts();
    const has = existing.some(s => s.id === "airnz-injected");
    const def = {
      id: "airnz-injected",
      matches: MATCHES,
      js: ["injected.js"],
      runAt: "document_start",
      world: "MAIN",
      allFrames: true
    };
    if (has) { await chrome.scripting.updateContentScripts([def]); }
    else     { await chrome.scripting.registerContentScripts([def]); }
    console.debug("[AirNZ Finder] content script registered (MAIN world)");
  } catch (e) {
    console.warn("[AirNZ Finder] register error:", e.message);
  }
}

// One-shot execute for already open tabs (and as a fallback)
async function injectNow(tabId, frameId) {
  try {
    await chrome.scripting.executeScript({
      target: frameId != null ? { tabId, frameIds: [frameId] } : { tabId },
      files: ["injected.js"],
      // IMPORTANT: world is a top-level option, not inside target
      world: "MAIN"
    });
    console.debug("[AirNZ Finder] injected.js executed", { tabId, frameId });
  } catch (e) {
    console.warn("[AirNZ Finder] inject error:", e.message);
  }
}

// --- lifecycle -------------------------------------------------------------
chrome.runtime.onInstalled.addListener(async () => {
  await registerContent();
  // inject into any already-open matching tabs
  const tabs = await chrome.tabs.query({ url: MATCHES });
  for (const t of tabs) if (t.id) injectNow(t.id);
});

chrome.runtime.onStartup.addListener(registerContent);

// Extra safety: inject when a tab completes loading
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete") return;
  if (!tab.url || !shouldInject(tab.url)) return;
  injectNow(tabId);
});

// Hard navigations
chrome.webNavigation.onCommitted.addListener((e) => {
  if (shouldInject(e.url)) injectNow(e.tabId, e.frameId);
});

// SPA route changes
chrome.webNavigation.onHistoryStateUpdated.addListener((e) => {
  if (shouldInject(e.url)) injectNow(e.tabId, e.frameId);
});

// Toolbar click: force (re)inject
chrome.action.onClicked.addListener((tab) => {
  if (tab.id && tab.url && shouldInject(tab.url)) injectNow(tab.id);
});
