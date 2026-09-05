import "./bridge.js";

(() => {
  "use strict";

  const DISCORD_TOKEN_RE = /^[MN][A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/;

  const storage = (typeof browser !== "undefined" && browser.storage)
    ? browser.storage.local
    : chrome.storage.local;
  const alarms = (typeof browser !== "undefined" && browser.alarms)
    ? browser.alarms
    : chrome.alarms;

  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        storage.get(keys, resolve);
      } catch (_) {
        resolve({});
      }
    });
  }

  // Only push tokens the app has not already received (avoid re-sending).
  async function syncTokenToApp(token) {
    const nb = globalThis.NorthBridge;
    if (!nb || typeof token !== "string") return;
    try {
      const { bridgePushedTokens = [] } = await storageGet({ bridgePushedTokens: [] });
      if (bridgePushedTokens.includes(token)) return;
      await nb.push([{ token }]);
    } catch (_) {
      /* nothing fatal — the popup retries on open */
    }
  }

  function upsertCurrentToken(token, tabId) {
    return new Promise((resolve) => {
      storage.get({ currentToken: null }, (stored) => {
        const changed = stored.currentToken !== token;
        storage.set({ currentToken: token }, () => resolve(changed));
      });
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "DISCORD_TOKEN") {
      const token = message.token;
      const tabId = message.tabId != null ? message.tabId : (sender.tab ? sender.tab.id : null);

      if (typeof token !== "string" || !DISCORD_TOKEN_RE.test(token)) {
        sendResponse({ ok: false, error: "Invalid token format detected." });
        return false;
      }

      upsertCurrentToken(token, tabId).then((changed) => {
        sendResponse({ ok: true, changed, tabId });
        // Newly detected session -> make sure it lands in NorthConnect's store.
        if (changed) syncTokenToApp(token);
      });

      return true;
    }

    if (message && message.type === "SET_TOKEN") {
      const token = message.token;
      if (typeof token === "string" && DISCORD_TOKEN_RE.test(token)) {
        storage.set({ currentToken: token }, () => {
          sendResponse({ ok: true });
          syncTokenToApp(token);
        });
      } else {
        sendResponse({ ok: false });
      }
      return true;
    }
    return false;
  });

  // Retry queued tokens periodically (case: NorthConnect was closed).
  if (alarms && alarms.onAlarm) {
    alarms.onAlarm.addListener((alarm) => {
      if (!alarm || alarm.name !== "northbridge-flush") return;
      const nb = globalThis.NorthBridge;
      if (nb) nb.flushPending().catch(() => {});
    });
    const p = alarms.create("northbridge-flush", { periodInMinutes: 1 });
    if (p && typeof p.catch === "function") p.catch(() => {});
  }
})();