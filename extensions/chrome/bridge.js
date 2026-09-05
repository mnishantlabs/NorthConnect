(() => {
  "use strict";
  // NorthConnect <-> browser extension bridge.
  // Talks to the desktop app's loopback HTTP server (127.0.0.1) so tokens that
  // are saved or detected (on discord.com) are written to the app's tokens.json.

  const HOST = "127.0.0.1";
  const PORT = 47474;
  const BASE = `http://${HOST}:${PORT}/api/bridge`;

  const KEY_KEY = "bridgeKey";
  const AUTO_KEY = "bridgeAutoSync";
  const PUSHED_KEY = "bridgePushedTokens";
  const PENDING_KEY = "bridgePendingTokens";

  const storage = (typeof browser !== "undefined" && browser.storage)
    ? browser.storage.local
    : chrome.storage.local;

  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        storage.get(keys, resolve);
      } catch (_) {
        try {
          storage.get(keys).then(resolve).catch(() => resolve({}));
        } catch (__) {
          resolve({});
        }
      }
    });
  }

  function storageSet(obj) {
    return new Promise((resolve) => {
      const done = () => resolve();
      try {
        storage.set(obj, done);
      } catch (_) {
        try {
          storage.set(obj).then(done).catch(done);
        } catch (__) {
          done();
        }
      }
    });
  }

  async function request(path, method, body) {
    const { [KEY_KEY]: secret } = await storageGet({ [KEY_KEY]: "" });
    const headers = { "X-Bridge-Key": secret || "" };
    if (body) headers["Content-Type"] = "application/json";
    const res = await fetch(BASE + path, {
      method: method || (body ? "POST" : "GET"),
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  const toItems = (list) => (list || [])
    .map((t) => (typeof t === "string" ? { token: t } : t))
    .filter((t) => t && typeof t.token === "string" && t.token.length > 0);

  const NorthBridge = {
    HOST,
    PORT,
    BASE,

    async getKey() {
      const { [KEY_KEY]: key } = await storageGet({ [KEY_KEY]: "" });
      return key || "";
    },
    async setKey(key) {
      const k = String(key || "").trim();
      await storageSet({ [KEY_KEY]: k });
      return k;
    },
    async clearKey() {
      await storageSet({ [KEY_KEY]: "" });
    },

    async isAutoSync() {
      const { [AUTO_KEY]: v } = await storageGet({ [AUTO_KEY]: true });
      return v !== false;
    },
    async setAutoSync(on) {
      await storageSet({ [AUTO_KEY]: !!on });
    },

    // Checks whether the app is reachable AND the saved key is accepted.
    async ping() {
      try {
        const res = await request("/ping", "GET");
        return {
          reachable: true,
          ok: res.status === 200 && res.data.ok === true,
          data: res.data,
        };
      } catch (_) {
        return { reachable: false, ok: false, data: null };
      }
    },

    // Messages -> app
    async importTokens(list) {
      const items = toItems(list);
      if (!items.length) return { ok: true, reached: true, pushed: 0, skipped: 0, invalid: 0, duplicates: 0 };
      let res;
      try {
        res = await request("/import", "POST", { tokens: items });
      } catch (_) {
        return { ok: false, reached: false, pushed: 0, skipped: 0, invalid: 0, duplicates: 0 };
      }
      if (res.status === 403) {
        return { ok: false, reached: true, authed: false, pushed: 0, skipped: 0, invalid: 0, duplicates: 0 };
      }
      if (res.status >= 200 && res.status < 300) {
        const d = res.data || {};
        const { [PUSHED_KEY]: pushed = [] } = await storageGet({ [PUSHED_KEY]: [] });
        const src = items.map((t) => t.token);
        await storageSet({ [PUSHED_KEY]: [...new Set(pushed.concat(src))] });
        return {
          ok: true,
          reached: true,
          authed: true,
          pushed: d.imported ?? src.length,
          skipped: d.skipped ?? 0,
          invalid: d.invalid ?? 0,
          duplicates: Math.max(0, items.length - (d.imported ?? 0)),
        };
      }
      return { ok: false, reached: true, authed: true, pushed: 0, skipped: 0, invalid: 0, duplicates: 0, status: res.status };
    },

    // Queue tokens for later (app offline / key not yet set).
    async enqueue(list) {
      const items = toItems(list);
      if (!items.length) return 0;
      const { [PENDING_KEY]: queued = [] } = await storageGet({ [PENDING_KEY]: [] });
      const seen = new Set(queued.map((t) => t.token));
      const add = items.filter((t) => !seen.has(t.token));
      if (add.length) await storageSet({ [PENDING_KEY]: queued.concat(add) });
      return add.length;
    },

    // Deliver queued tokens now that the app is reachable. Returns # pushed.
    async flushPending() {
      const { [PENDING_KEY]: queued = [] } = await storageGet({ [PENDING_KEY]: [] });
      if (!queued.length) return 0;
      const key = await this.getKey();
      if (!key) return 0;
      const pong = await this.ping();
      if (!pong.ok) return 0;
      const res = await this.importTokens(queued);
      if (res.ok) {
        await storageSet({ [PENDING_KEY]: [] });
        return res.pushed ?? 0;
      }
      return 0;
    },

    // High-level: push tokens, respecting auto-sync; queues when app is down.
    async push(list) {
      const items = toItems(list);
      const autoSync = await this.isAutoSync();
      if (!items.length) return { reached: false, queued: false, pushed: 0, autoSync, authed: false };
      if (!autoSync) return { reached: false, queued: false, pushed: 0, autoSync, authed: false };
      const key = await this.getKey();
      if (!key) return { reached: false, queued: false, pushed: 0, autoSync, authed: false };
      let pong;
      try {
        pong = await this.ping();
      } catch (_) {
        pong = { reachable: false, ok: false };
      }
      if (!pong.ok || !pong.reachable) {
        const n = await this.enqueue(items);
        return { reached: pong.reachable, queued: n > 0, pushed: 0, autoSync, authed: !!pong.ok };
      }
      const flushN = await this.flushPending();
      const res = await this.importTokens(items);
      return {
        reached: true,
        queued: false,
        pushed: (res.pushed ?? 0) + flushN,
        autoSync,
        authed: res.authed !== false,
        duplicates: res.duplicates ?? 0,
      };
    },
  };

  if (typeof globalThis !== "undefined") globalThis.NorthBridge = NorthBridge;
  else window.NorthBridge = NorthBridge;
})();