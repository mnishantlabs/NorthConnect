(() => {
  "use strict";
  // Material Symbols font icons (ligatures). No emoji, no SVG paths.
  const LIGATURES = {
    clock: 'schedule', search: 'search', close: 'close', settings: 'settings',
    add: 'add', check: 'check', delete: 'delete', export: 'ios_share',
    lock: 'lock', save: 'save', swap: 'swap_horiz', eye: 'visibility',
    eyeoff: 'visibility_off', login: 'login', copy: 'content_copy',
    star: 'star', edit: 'edit', warning: 'warning', chevron: 'chevron_right',
    verified: 'verified', backup: 'backup', refresh: 'refresh', more: 'more_vert',
    info: 'info', person: 'person', badge: 'badge', notes: 'notes',
    devices: 'devices', key: 'key', wifi_tethering: 'wifi_tethering', sync: 'sync', link: 'link',
  };

  function makeIcon(name, extraClass) {
    const el = document.createElement('span');
    el.setAttribute('data-icon', name);
    if (extraClass) el.className = extraClass;
    const span = document.createElement('span');
    span.className = 'material-symbols-outlined';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = LIGATURES[name] || 'schedule';
    el.appendChild(span);
    return el;
  }

  // Hydrate static [data-icon] elements, preserving sibling text (icon + label).
  function applyDataIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      const name = el.getAttribute('data-icon');
      if (el.querySelector('.material-symbols-outlined')) return;
      const span = document.createElement('span');
      span.className = 'material-symbols-outlined';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = LIGATURES[name] || 'schedule';
      const ph = el.querySelectorAll(':scope > span');
      if (ph.length) { el.insertBefore(span, ph[0]); ph.forEach((p) => { if (p !== span && !p.classList.contains('material-symbols-outlined')) p.remove(); }); }
      else el.prepend(span);
    });
  }

  function setBtnContent(btn, iconName, text) {
    btn.innerHTML = '';
    if (iconName) btn.appendChild(makeIcon(iconName, 'ic-sm'));
    if (text) { const t = document.createElement('span'); t.textContent = text; btn.appendChild(t); }
  }

  // ---- Core ----
  const $ = (id) => document.getElementById(id);
  const storage = typeof browser !== 'undefined' && browser.storage ? browser.storage : chrome.storage;

  const TOKEN_RE = /^[MN][A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/;
  const SAVED_KEY = 'savedTokens';
  const SETTINGS_KEY = 'settings';
  const LOCK_KEY = 'lockEnabled';
  const PIN_KEY = 'lockPin';

  const COLORS = ['purple', 'green', 'red', 'blue', 'yellow', 'gray'];
  const BADGES = [
    { key: 'favorite', label: 'Favorite', color: 'purple', icon: 'star' },
    { key: 'work', label: 'Work', color: 'work', icon: '' },
    { key: 'testing', label: 'Testing', color: 'testing', icon: '' },
    { key: 'bot', label: 'Bot', color: 'bot', icon: '' },
    { key: 'main', label: 'Main', color: 'main', icon: 'star' },
  ];

  let savedTokens = [];
  let settings = { compact: false, autoFetch: true, syncAvatars: true, encrypt: true, autoBackup: false, autoswitch: true, syncCookies: true, restoreStorage: false, verify: true, northSync: true };
  let lockEnabled = false;
  let currentToken = null;
  let currentUser = null;
  let selecting = false;
  let selectedIds = new Set();
  let editingIndex = -1;
  let dlgColor = 'purple';
  let dlgBadges = new Set();
  let searchTerm = '';
  let lockPin = '';

  function decodeUserId(token) {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const seg = parts[1];
      const b64 = seg + '===='.slice(0, (4 - (seg.length % 4)) % 4);
      const raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
      const buf = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
      return new DataView(buf.buffer).getBigUint64(buf.length - 8).toString();
    } catch (_) { return null; }
  }
  function snowflakeToDate(id) {
    try { if (!id) return null; const ms = (BigInt(id) >> 22n) + 1420070400000n; return new Date(Number(ms)); } catch (_) { return null; }
  }

  async function resolveUser(token) {
    const fallback = { id: null, username: null, displayName: null, avatar: null, banner: null, bio: null, nitro: false, createdAt: null };
    try {
      const res = await fetch('https://discord.com/api/v9/users/@me', { headers: { Authorization: token } });
      if (res.ok) {
        const d = await res.json();
        return { id: d.id || null, username: d.username || null, displayName: d.global_name || d.username || null, avatar: d.avatar || null, banner: d.banner || null, bio: (d.bio || '').slice(0, 200) || null, nitro: !!d.premium_type, createdAt: snowflakeToDate(d.id) };
      }
    } catch (_) {}
    try {
      const uid = decodeUserId(token);
      if (uid) {
        const res = await fetch(`https://discord.com/api/v9/users/${uid}`);
        if (res.ok) { const d = await res.json(); return { id: uid, username: d.username || null, displayName: d.global_name || d.username || null, avatar: d.avatar || null, banner: null, bio: null, nitro: false, createdAt: snowflakeToDate(uid) }; }
        return { ...fallback, id: uid };
      }
    } catch (_) {}
    return { ...fallback, id: decodeUserId(token) };
  }

  async function verifyToken(token) {
    try {
      const res = await fetch('https://discord.com/api/v9/users/@me', { headers: { Authorization: token } });
      if (res.ok) return 'valid';
      if (res.status === 401 || res.status === 403) return 'expired';
      return 'unknown';
    } catch (_) { return 'unknown'; }
  }

  function avatarUrl(id, hash) { return id && hash ? `https://cdn.discordapp.com/avatars/${id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=128` : null; }
  function bannerUrl(id, hash) { return id && hash ? `https://cdn.discordapp.com/banners/${id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=400` : null; }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (_) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
  }

  function relativeTime(ts) {
    if (!ts) return 'Never';
    const diff = Date.now() - ts; const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); if (d === 1) return 'yesterday'; if (d < 7) return `${d}d ago`;
    const w = Math.floor(d / 7); if (w < 5) return `${w}w ago`;
    return  `${Math.floor(d / 30)}mo ago`;
  }

  function toast(msg, color) {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:64px;left:50%;transform:translateX(-50%);background:${color || 'var(--primary)'};color:var(--on-primary);border-radius:12px;padding:8px 16px;font-size:12.5px;font-weight:600;z-index:300;box-shadow:0 4px 16px rgba(0,0,0,.4);display:flex;align-items:center;gap:7px;`;
    t.appendChild(makeIcon('check', 'ic-sm'));
    t.appendChild(document.createTextNode(msg));
    document.body.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity 200ms'; t.style.opacity = '0'; setTimeout(() => t.remove(), 220); }, 1300);
  }

  async function saveAll() { await storage.local.set({ [SAVED_KEY]: savedTokens }); }
  async function saveSettings() { await storage.local.set({ [SETTINGS_KEY]: settings }); }

  function statusMeta(acc) {
    const s = (acc && acc.verified) || 'unknown';
    return { cls: s, dot: s === 'valid' ? 'live' : s === 'expired' ? 'invalid' : 'idle', label: s === 'valid' ? 'Live' : s === 'expired' ? 'Invalid Token' : 'Idle' };
  }

  // ---- Filtering / grouping ----
  function filteredAccounts() {
    const term = searchTerm.trim().toLowerCase();
    let list = savedTokens.slice();
    list.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.lastUsed || 0) - (a.lastUsed || 0));
    if (term) list = list.filter((a) => `${a.label} ${a.username || ''} ${a.displayName || ''} ${a.id || ''} ${a.group || ''}`.toLowerCase().includes(term));
    return list;
  }
  function groupAccounts(list) {
    const groups = new Map(); groups.set('', []);
    for (const acc of list) { const g = acc.group && acc.group.trim() ? acc.group.trim() : ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(acc); }
    return groups;
  }

  // ---- Account card (2-row, item 6) ----
  function buildCard(acc) {
    const card = document.createElement('div');
    card.className = 'account-card' + (acc.favorite ? ' pinned' : '');
    card.dataset.accId = acc.id;
    if (acc.color) card.dataset.c = acc.color;
    if (acc.favorite) card.classList.add('pinned');
    card.classList.add('anim-in');

    const wrap = document.createElement('div');
    wrap.className = 'acc-avatar-wrap';
    const img = document.createElement('img');
    img.className = 'acc-avatar';
    img.alt = '';
    const av = avatarUrl(acc.id, acc.avatar);
    if (av) img.src = av; else img.classList.add('avatar-fallback');
    const fb = document.createElement('span');
    fb.className = 'acc-avatar-fallback';
    fb.textContent = (acc.displayName || acc.label || acc.username || '?').trim().charAt(0).toUpperCase() || '?';
    wrap.appendChild(fb); wrap.appendChild(img);
    const pres = document.createElement('span');
    pres.className = 'acc-presence ' + statusMeta(acc).dot;
    wrap.appendChild(pres);
    card.appendChild(wrap);

    const info = document.createElement('div');
    info.className = 'acc-info';

    const name = document.createElement('div');
    name.className = 'acc-name';
    if (acc.favorite) { const fav = document.createElement('span'); fav.className = 'acc-fav'; fav.textContent = '★'; fav.title = 'Favorite / pinned'; name.appendChild(fav); }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = acc.displayName || acc.label || 'Unnamed';
    name.appendChild(nameSpan);
    if (acc.nitro) { const t = document.createElement('span'); t.className = 'tag nitro'; t.textContent = 'Nitro'; name.appendChild(t); }
    info.appendChild(name);

    const sub = document.createElement('div');
    sub.className = 'acc-sub';
    sub.textContent = (acc.username ? '@' + acc.username : '') + (acc.id ? ` · ${acc.id}` : '');
    info.appendChild(sub);

    const ver = document.createElement('div');
    ver.className = 'acc-verified';
    const meta = statusMeta(acc);
    ver.appendChild(makeIcon(meta.cls === 'valid' ? 'verified' : 'warning', 'ic-sm'));
    const labelEl = document.createElement('span');
    labelEl.textContent = meta.label + (meta.cls === 'valid' && acc.lastUsed ? ' · last ' + relativeTime(acc.lastUsed) : '');
    ver.appendChild(labelEl);
    info.appendChild(ver);

    if (acc.badges && acc.badges.length) {
      const badges = document.createElement('div');
      badges.className = 'acc-badges';
      for (const b of acc.badges) { const bd = BADGES.find((x) => x.key === b); if (!bd) continue; const e = document.createElement('span'); e.className = 'tag-badge'; e.textContent = bd.icon === 'star' ? '★ ' + bd.label : bd.label; badges.appendChild(e); }
      info.appendChild(badges);
    }
    if (acc.notes) { const notes = document.createElement('div'); notes.className = 'acc-notes'; const nl = document.createElement('span'); nl.className = 'nl'; nl.textContent = 'Notes:'; notes.appendChild(nl); notes.appendChild(document.createTextNode(acc.notes)); info.appendChild(notes); }

    card.appendChild(info);

    // Actions: Copy + Switch + Details + More (visible on the card)
    const actions = document.createElement('div');
    actions.className = 'acc-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'icon-btn-action' + (settings.compact ? ' compact' : '');
    copyBtn.appendChild(makeIcon('copy')); copyBtn.title = 'Copy token';
    copyBtn.addEventListener('click', (e) => { e.stopPropagation(); copyToken(acc.token); });
    actions.appendChild(copyBtn);

    if (!settings.compact) {
      const swBtn = document.createElement('button');
      swBtn.className = 'btn primary small switch-btn';
      const ok = document.createElement('span'); ok.textContent = 'Switch'; swBtn.appendChild(ok);
      swBtn.addEventListener('click', (e) => { e.stopPropagation(); openLoginConfirm(acc.id); });
      actions.appendChild(swBtn);
    }

    const detailsBtn = document.createElement('button');
    detailsBtn.className = 'icon-btn-action' + (settings.compact ? ' compact' : '');
    detailsBtn.appendChild(makeIcon('info')); detailsBtn.title = 'Details';
    detailsBtn.addEventListener('click', (e) => { e.stopPropagation(); openDetails(acc.id); });
    actions.appendChild(detailsBtn);

    const more = document.createElement('button');
    more.className = 'icon-btn-action' + (settings.compact ? ' compact' : '');
    more.appendChild(makeIcon('more')); more.title = 'More';
    more.addEventListener('click', (e) => { e.stopPropagation(); const r = more.getBoundingClientRect(); openMenu(r.right, r.bottom, acc.id); });
    actions.appendChild(more);

    card.appendChild(actions);

    if (selecting) {
      const wrapcb = document.createElement('label');
      wrapcb.className = 'checkbox-wrap';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = selectedIds.has(acc.id);
      cb.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('change', () => { if (cb.checked) selectedIds.add(acc.id); else selectedIds.delete(acc.id); updateSelectCount(); card.classList.toggle('selecting', selectedIds.has(acc.id)); });
      wrapcb.appendChild(cb); card.appendChild(wrapcb);
      card.classList.toggle('selecting', selectedIds.has(acc.id));
    }
    return card;
  }

  // ---- Now Playing (active session, item 3) ----
  function buildNowPlaying(acc) {
    const card = document.createElement('div');
    card.className = 'np-card';
    if (acc.color) card.dataset.c = acc.color;
    const accent = document.createElement('div'); accent.className = 'np-accent'; card.appendChild(accent);

    const top = document.createElement('div'); top.className = 'np-top';
    const img = document.createElement('img'); img.className = 'np-avatar'; img.alt = '';
    const av = avatarUrl(acc.id, acc.avatar);
    if (av) img.src = av; else img.style.visibility = 'hidden';
    top.appendChild(img);

    const idn = document.createElement('div'); idn.className = 'np-identity';
    const name = document.createElement('div'); name.className = 'np-name';
    name.textContent = acc.displayName || acc.label || 'Unnamed';
    if (acc.nitro) { const t = document.createElement('span'); t.className = 'tag nitro'; t.textContent = 'Nitro'; name.appendChild(t); }
    idn.appendChild(name);

    const user = document.createElement('div'); user.className = 'np-username';
    user.textContent = acc.username ? '@' + acc.username : '';
    idn.appendChild(user);

    const statusPill = document.createElement('span');
    const meta = statusMeta(acc);
    statusPill.className = 'pill-' + meta.dot;
    const dot = document.createElement('span'); dot.className = 'status-dot ' + meta.cls;
    statusPill.appendChild(dot);
    const st = document.createElement('span'); st.textContent = meta.label; statusPill.appendChild(st);
    idn.appendChild(statusPill);

    const mm = document.createElement('div'); mm.className = 'np-meta';
    const id = document.createElement('span'); id.textContent = 'ID ' + (acc.id || '—'); mm.appendChild(id);
    if (acc.createdAt) { const cd = document.createElement('span'); cd.textContent = 'Joined ' + acc.createdAt.toLocaleDateString(); mm.appendChild(cd); }
    const lu = document.createElement('span'); lu.textContent = 'Last switched ' + relativeTime(acc.lastUsed); mm.appendChild(lu);
    idn.appendChild(mm);
    top.appendChild(idn);
    card.appendChild(top);

    const primary = document.createElement('div'); primary.className = 'action-primary';
    const launch = document.createElement('button');
    launch.className = 'btn primary';
    launch.style.width = '100%';
    launch.appendChild(makeIcon('login', 'ic-sm'));
    const lt = document.createElement('span'); lt.textContent = 'Launch Account'; launch.appendChild(lt);
    launch.addEventListener('click', () => openLoginConfirm(acc.id));
    primary.appendChild(launch);
    card.appendChild(primary);

    const secondary = document.createElement('div'); secondary.className = 'action-secondary';
    const sa = document.createElement('button'); sa.className = 'inline-btn'; sa.appendChild(makeIcon('save', 'ic-sm')); sa.appendChild(document.createTextNode('Save'));
    sa.addEventListener('click', () => saveCurrentAccount());
    const copy = document.createElement('button'); copy.className = 'inline-btn'; copy.appendChild(makeIcon('copy', 'ic-sm')); copy.appendChild(document.createTextNode('Copy Token'));
    copy.addEventListener('click', () => copyToken(acc.token));
    const verify = document.createElement('button'); verify.className = 'inline-btn'; verify.appendChild(makeIcon('verified', 'ic-sm')); verify.appendChild(document.createTextNode('Verify'));
    verify.addEventListener('click', () => verifyOne(acc.token));
    const ln = document.createElement('button'); ln.className = 'inline-btn'; ln.appendChild(makeIcon('ios_share', 'ic-sm')); ln.appendChild(document.createTextNode('Export'));
    ln.addEventListener('click', () => exportOne(acc));
    secondary.appendChild(sa); secondary.appendChild(copy); secondary.appendChild(verify); secondary.appendChild(ln);
    card.appendChild(secondary);
    return card;
  }

  // ---- Render ----
  function renderAccounts() {
    const container = $('groups-container');
    container.innerHTML = '';
    const all = filteredAccounts();
    const groups = groupAccounts(all);
    const groupsOrder = [...groups.entries()].sort((a, b) => (a[0] === '' ? 'zzz' : a[0].toLowerCase()).localeCompare(b[0] === '' ? 'zzz' : b[0].toLowerCase()));
    let count = 0;
    for (const [g, list] of groupsOrder) {
      if (!list.length) continue;
      count += list.length;
      const block = document.createElement('div');
      block.className = 'group-block';
      block.classList.add('anim-in');
      const body = document.createElement('div');
      for (const acc of list) body.appendChild(buildCard(acc));
      if (g !== '') {
        const head = document.createElement('div');
        head.className = 'group-head open';
        head.appendChild(makeIcon('chevron', 'caret'));
        const label = document.createElement('span'); label.textContent = g; head.appendChild(label);
        const gcount = document.createElement('span'); gcount.className = 'gcount'; gcount.textContent = list.length; head.appendChild(gcount);
        head.addEventListener('click', () => { head.classList.toggle('open'); body.classList.toggle('hidden'); });
        block.appendChild(head);
      }
      block.appendChild(body);
      container.appendChild(block);
    }
    $('empty-state').classList.toggle('hidden', count > 0);
    renderStats(count);
  }

  function renderStats(count) {
    const activeCount = savedTokens.filter((a) => a.verified === 'valid').length;
    const favCount = savedTokens.filter((a) => a.favorite).length;
    $('header-sub').textContent = count + ' saved · ' + activeCount + ' active';
    $('vault-stats').textContent = (count > 0 ? count + ' Saved · ' : '') + activeCount + ' Active' + (favCount ? ' · ' + favCount + ' Fav' : '');
  }

  function emptyAccountTemplate() {
    return { id: 'acc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), label: '', token: '', username: null, displayName: null, avatar: null, banner: null, bio: null, nitro: false, createdAt: null, color: 'purple', favorite: false, group: '', notes: '', badges: [], lastUsed: null, addedAt: Date.now(), verified: 'unknown', lastVerified: null };
  }

  async function fetchProfileInto(acc, isNew) {
    const user = await resolveUser(acc.token);
    if (user.id) {
      acc.id = user.id;
      if (isNew || settings.autoFetch) {
        acc.username = user.username; acc.displayName = user.displayName;
        if (settings.syncAvatars || isNew) { acc.avatar = user.avatar; acc.banner = user.banner; }
        acc.bio = user.bio; acc.nitro = user.nitro; acc.createdAt = user.createdAt;
      }
    }
    acc.verified = await verifyToken(acc.token);
    acc.lastVerified = Date.now();
    await saveAll();
    renderAccounts(); renderLive();
  }

  async function verifyAll(force) {
    const lastOk = Date.now() - (1000 * 60 * 60 * 24 * 3);
    for (const acc of savedTokens) {
      if (!force && acc.lastVerified && acc.lastVerified > lastOk) continue;
      acc.verified = await verifyToken(acc.token); acc.lastVerified = Date.now();
    }
    await saveAll();
    renderAccounts(); renderLive();
  }

  async function verifyOne(token) {
    const s = await verifyToken(token);
    toast(s === 'valid' ? 'Token verified — valid' : s === 'expired' ? 'Token invalid / expired' : 'Token status unknown', s === 'valid' ? 'var(--success)' : 'var(--warning)');
  }

  function markUsed(id) {
    const acc = savedTokens.find((a) => a.id === id); if (!acc) return;
    acc.lastUsed = Date.now();
    saveAll(); renderAccounts();
  }

  function copyToken(token) {
    copyText(token);
    toast('Token copied — clears in 10s');
  }

  // ---- Login ----
  function openLoginConfirm(id) {
    const acc = savedTokens.find((a) => a.id === id); if (!acc) return;
    const preview = $('login-preview');
    preview.innerHTML = '';
    const img = document.createElement('img'); img.className = 'avatar'; img.alt = '';
    const av = avatarUrl(acc.id, acc.avatar); if (av) img.src = av; else img.style.visibility = 'hidden';
    const tName = document.createElement('div'); tName.className = 'name'; tName.textContent = acc.displayName || acc.label;
    const tTag = document.createElement('div'); tTag.className = 'username-tag'; tTag.textContent = acc.username ? '@' + acc.username : '';
    preview.appendChild(img); preview.appendChild(tName); preview.appendChild(tTag);
    if (currentUser) { const c = document.createElement('div'); c.className = 'current-label'; c.textContent = 'Current: ' + (currentUser.displayName || currentUser.username); preview.appendChild(c); }
    $('login-backdrop').classList.remove('hidden');
    $('login-confirm').onclick = () => { $('login-backdrop').classList.add('hidden'); doLogin(acc.id); };
    $('login-cancel').onclick = () => $('login-backdrop').classList.add('hidden');
  }

  function doLogin(id) {
    const acc = savedTokens.find((a) => a.id === id); if (!acc) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;';
    const label = document.createElement('div'); label.style.cssText = 'color:var(--text);font-weight:600;font-size:15px;'; label.textContent = 'Switching…';
    const barWrap = document.createElement('div'); barWrap.style.cssText = 'width:220px;height:6px;background:var(--elev-2);border-radius:3px;overflow:hidden;';
    const bar = document.createElement('div'); bar.style.cssText = 'height:100%;width:0%;background:var(--primary);transition:width 100ms linear;border-radius:3px;';
    barWrap.appendChild(bar); overlay.appendChild(label); overlay.appendChild(barWrap); document.body.appendChild(overlay);
    let width = 0;
    const iv = setInterval(() => {
      width = Math.min(100, width + Math.random() * 18); bar.style.width = width + '%';
      if (width >= 100) {
        clearInterval(iv); label.textContent = 'Opening…';
        applyLogin(acc).then(() => { setTimeout(() => { overlay.remove(); markUsed(acc.id); renderAccounts(); }, 450); });
      }
    }, 110);
  }

  function isDiscordUrl(url) {
    try {
      const h = new URL(url).hostname.toLowerCase();
      return h === 'discord.com' || h.endsWith('.discord.com');
    } catch (_) { return false; }
  }

  function sendToTab(tabId, msg) {
    if (tabId == null) return;
    try {
      if (typeof browser !== 'undefined' && browser.tabs && browser.tabs.sendMessage) {
        const p = browser.tabs.sendMessage(tabId, msg);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } else if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.sendMessage(tabId, msg, () => { void chrome.runtime.lastError; });
      }
    } catch (_) {}
  }

  async function applyLogin(acc) {
    const token = acc.token;
    // Only ever operate on real discord.com tabs (never other sites).
    let tab = null;
    try { const tabs = await browserTabsQuery(); tab = tabs.find((t) => t.url && isDiscordUrl(t.url)); } catch (_) {}
    try { if (typeof browser !== 'undefined' && browser.runtime) browser.runtime.sendMessage({ type: 'SET_TOKEN', token }).catch(() => {}); } catch (_) {}

    let tabId = null;
    if (tab && tab.id != null) {
      tabId = tab.id;
      try {
        if (typeof browser !== 'undefined' && browser.tabs) await browser.tabs.update(tab.id, { active: true });
        else await chrome.tabs.update(tab.id, { active: true });
      } catch (_) {}
    } else {
      const url = 'https://discord.com/app';
      try {
        if (typeof browser !== 'undefined' && browser.tabs) { const t = await browser.tabs.create({ url }); tabId = (t && t.id != null) ? t.id : null; }
        else { const t = await chrome.tabs.create({ url }); tabId = (t && t.id != null) ? t.id : null; }
      } catch (_) {}
    }

    // Give the tab a moment to load, then inject the saved token into Discord's
    // storage and reload so the account actually logs in as the chosen session.
    setTimeout(() => {
      if (tabId == null) return;
      sendToTab(tabId, { type: 'SET_TOKEN_APPLY', token });
    }, 600);
  }
  function browserTabsQuery() { return new Promise((resolve) => { try { if (typeof browser !== 'undefined' && browser.tabs) browser.tabs.query({}).then(resolve).catch(() => resolve([])); else chrome.tabs.query({}, resolve); } catch (_) { resolve([]); } }); }

  // ---- Menu (more/emergency actions, item 2) ----
  function openMenu(x, y, id) {
    const menu = $('ctx-menu');
    menu.innerHTML = '';
    const acc = savedTokens.find((a) => a.id === id);
    if (!acc) return;
    const items = [
      { icon: 'login', label: 'Switch', fn: () => openLoginConfirm(id) },
      { icon: 'copy', label: 'Copy Token', fn: () => copyToken(acc.token) },
      { icon: 'star', label: (acc.favorite ? 'Unpin favorite' : 'Pin as favorite'), fn: () => toggleFavorite(id) },
      { icon: 'verified', label: 'Verify', fn: () => verifyOne(acc.token) },
      { icon: 'ios_share', label: 'Export', fn: () => exportOne(acc) },
    ];
    for (const it of items) {
      const b = document.createElement('button'); b.className = 'ctx-item';
      b.appendChild(makeIcon(it.icon)); const t = document.createElement('span'); t.textContent = it.label; b.appendChild(t);
      b.addEventListener('click', () => { closeMenu(); it.fn(); });
      menu.appendChild(b);
    }
    const sep = document.createElement('div'); sep.className = 'ctx-sep'; menu.appendChild(sep);
    if (!settings.compact) {
      const rename = document.createElement('button'); rename.className = 'ctx-item';
      rename.appendChild(makeIcon('edit')); rename.appendChild(document.createTextNode('Rename'));
      rename.addEventListener('click', () => { closeMenu(); renameAccount(id); });
      menu.appendChild(rename);
    }
    const del = document.createElement('button'); del.className = 'ctx-item danger';
    del.appendChild(makeIcon('delete')); del.appendChild(document.createTextNode('Delete'));
    del.addEventListener('click', () => { closeMenu(); deleteAccount(id); });
    menu.appendChild(del);

    menu.classList.remove('hidden');
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, window.innerWidth - rect.width - 8) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - rect.height - 8) + 'px';
  }
  function closeMenu() { $('ctx-menu').classList.add('hidden'); }

  // ---- Details dialog ----
  function openDetails(id) {
    const acc = savedTokens.find((a) => a.id === id); if (!acc) return;
    const body = $('details-body');
    body.innerHTML = '';
    const meta = statusMeta(acc);

    const head = document.createElement('div'); head.className = 'dt-head';
    const img = document.createElement('img'); img.className = 'avatar'; img.alt = '';
    const av = avatarUrl(acc.id, acc.avatar);
    if (av) img.src = av; else img.style.visibility = 'hidden';
    const idn = document.createElement('div'); idn.className = 'dt-idn';
    const nm = document.createElement('div'); nm.className = 'dt-name'; nm.textContent = acc.displayName || acc.label || 'Unnamed';
    const un = document.createElement('div'); un.className = 'dt-sub'; un.textContent = acc.username ? '@' + acc.username : '';
    idn.appendChild(nm); idn.appendChild(un); head.appendChild(img); head.appendChild(idn);
    body.appendChild(head);

    const rows = [];
    if (acc.id) rows.push(['User ID', acc.id]);
    rows.push(['Status', meta.label]);
    if (acc.createdAt) rows.push(['Joined', acc.createdAt.toLocaleDateString()]);
    if (acc.group) rows.push(['Group', acc.group]);
    if (acc.nitro) rows.push(['Subscription', 'Nitro']);
    if (acc.addedAt) rows.push(['Added', new Date(acc.addedAt).toLocaleDateString()]);
    if (acc.lastUsed) rows.push(['Last switched', relativeTime(acc.lastUsed)]);
    if (acc.lastVerified) rows.push(['Last verified', relativeTime(acc.lastVerified)]);
    if (acc.badges && acc.badges.length) {
      const labels = acc.badges.map((b) => { const bd = BADGES.find((x) => x.key === b); return bd ? bd.label : b; });
      rows.push(['Tags', labels.join(', ')]);
    }
    const list = document.createElement('div'); list.className = 'dt-rows';
    for (const [k, v] of rows) {
      const r = document.createElement('div'); r.className = 'dt-row';
      const rk = document.createElement('span'); rk.className = 'dt-k'; rk.textContent = k;
      const rv = document.createElement('span'); rv.className = 'dt-v'; rv.textContent = v;
      r.appendChild(rk); r.appendChild(rv); list.appendChild(r);
    }
    body.appendChild(list);

    if (acc.bio) { const b = document.createElement('div'); b.className = 'dt-bio'; b.textContent = acc.bio; body.appendChild(b); }
    if (acc.notes) { const n = document.createElement('div'); n.className = 'dt-notes'; const nl = document.createElement('span'); nl.textContent = 'Notes: '; n.appendChild(nl); n.appendChild(document.createTextNode(acc.notes)); body.appendChild(n); }

    $('details-title').textContent = acc.displayName || acc.label || 'Account details';
    $('details-copy').onclick = () => copyToken(acc.token);
    $('details-edit').onclick = () => { const idx = savedTokens.indexOf(acc); closeDetails(); openDialog(acc, idx); };
    $('details-close').onclick = closeDetails;
    $('details-backdrop').classList.remove('hidden');
  }
  function closeDetails() { $('details-backdrop').classList.add('hidden'); }

  function toggleFavorite(id) { const acc = savedTokens.find((a) => a.id === id); if (!acc) return; acc.favorite = !acc.favorite; saveAll(); renderAccounts(); }
  function renameAccount(id) {
    const acc = savedTokens.find((a) => a.id === id); if (!acc) return;
    const label = prompt('Rename account:', acc.label || '');
    if (label === null) return;
    acc.label = label.trim() || acc.label; saveAll(); renderAccounts();
  }
  function deleteAccount(id) {
    const acc = savedTokens.find((a) => a.id === id); if (!acc) return;
    if (!confirm('Delete "' + (acc.displayName || acc.label) + '"?')) return;
    // fade-out then remove (item 14 motion)
    savedTokens = savedTokens.filter((a) => a.id !== id);
    selectedIds.delete(id);
    saveAll(); renderAccounts(); toast('Session deleted', 'var(--danger)');
  }

  // ---- Export / Backup ----
  async function exportAll() {
    const blob = new Blob([JSON.stringify(savedTokens, null, 2)], { type: 'application/json' });
    let url; try { url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'discord-tokens-backup.json'; a.click(); } finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
    toast('Backup exported');
  }
  function exportOne(acc) {
    const blob = new Blob([JSON.stringify(acc, null, 2)], { type: 'application/json' });
    let url; try { url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = (acc.displayName || acc.label || 'session') + '.json'; a.click(); } finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  async function importJson(content) {
    if (!content || !content.trim()) return;
    try {
      const data = JSON.parse(content);
      if (!Array.isArray(data)) throw new Error('bad shape');
      let added = 0;
      for (const item of data) {
        if (!item.token) continue;
        if (savedTokens.some((a) => a.token === item.token)) continue; // duplicate detection stub
        savedTokens.push({ ...emptyAccountTemplate(), ...item }); added++;
      }
      await saveAll(); renderAccounts(); verifyAll(false);
      toast(added + ' session(s) imported');
      if (added) syncToNorthConnect(data.map((i) => i.token));
    } catch (_) { alert('Could not import: invalid JSON.'); }
  }
  async function importAll() {
    const content = prompt('Paste the exported JSON below:');
    if (!content) return;
    await importJson(content);
  }

  // ---- Lock ----
  function enableLock() {
    if (lockEnabled) { disableLock(); return; }
    const pin = prompt('Set a PIN to protect saved sessions:');
    if (!pin || pin.length < 4) { alert('PIN must be at least 4 characters.'); return; }
    lockEnabled = true; lockPin = pin;
    storage.local.set({ [LOCK_KEY]: true, [PIN_KEY]: pin });
    updateLockNav(); renderAccounts();
  }
  function disableLock() {
    lockEnabled = false; lockPin = '';
    storage.local.set({ [LOCK_KEY]: false, [PIN_KEY]: '' });
    updateLockNav(); renderAccounts();
  }
  function lockPrompt() {
    const pin = prompt('Enter PIN to unlock:');
    if (pin && pin === lockPin) { lockEnabled = false; updateLockNav(); renderAccounts(); }
    else alert('Incorrect PIN.');
  }
  function updateLockNav() {
    const nav = $('nav-lock');
    const t = nav.querySelector('span'); if (t) t.textContent = lockEnabled ? 'Unlock' : 'Lock';
    // rebuild icon label
    setBtnContent(nav, 'lock', null);
    // re-add label span
    nav.innerHTML = '';
    nav.appendChild(makeIcon('lock'));
    const s = document.createElement('span'); s.textContent = lockEnabled ? 'Unlock' : 'Lock'; nav.appendChild(s);

    // Reflect state in the Lock tab panel
    if ($('lock-status')) $('lock-status').textContent = lockEnabled ? 'Protection enabled' : 'Protection disabled';
    if ($('lock-btn-label')) $('lock-btn-label').textContent = lockEnabled ? 'Unlock Vault' : 'Enable Lock';
    if ($('btn-lock-clear')) $('btn-lock-clear').classList.toggle('hidden', !lockEnabled);
  }

  // ---- Multiselect ----
  function updateSelectCount() { $('select-count').textContent = selectedIds.size + ' selected'; }
  function deleteSelected() {
    if (!selectedIds.size) return;
    if (!confirm('Delete ' + selectedIds.size + ' session(s)?')) return;
    savedTokens = savedTokens.filter((a) => !selectedIds.has(a.id));
    selectedIds.clear();
    saveAll(); renderAccounts();
  }
  async function exportBySelection() {
    const selected = savedTokens.filter((a) => selectedIds.has(a.id));
    if (!selected.length) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    let url; try { url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'selected.json'; a.click(); } finally { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  function toggleSelectMode() {
    selecting = !selecting; if (!selecting) selectedIds.clear();
    $('multiselect-bar').classList.toggle('hidden', !selecting);
    renderAccounts();
  }

  // ---- Dialog ----
  function openDialog(acc, index) {
    editingIndex = index;
    dlgColor = acc ? (acc.color || 'purple') : 'purple';
    dlgBadges = new Set(acc ? acc.badges || [] : []);
    $('dialog-title').textContent = acc ? 'Edit session' : 'Add session';
    $('dlg-token').value = acc ? acc.token : '';
    $('dlg-nickname').value = acc ? acc.label || '' : '';
    $('dlg-group').value = acc ? acc.group || '' : '';
    $('dlg-favorite').checked = acc ? !!acc.favorite : false;
    $('dlg-notes').value = acc ? acc.notes || '' : '';
    renderColorRow(); renderBadgeRow(); populateGroups();
    $('dialog-backdrop').classList.remove('hidden');
  }
  function populateGroups() { const dl = $('group-list'); dl.innerHTML = ''; const groups = new Set(savedTokens.map((a) => a.group).filter(Boolean)); for (const g of groups) { const o = document.createElement('option'); o.value = g; dl.appendChild(o); } }
  function renderColorRow() { document.querySelectorAll('#dlg-color .swatch').forEach((s) => s.classList.toggle('selected', s.dataset.c === dlgColor)); }
  function renderBadgeRow() { document.querySelectorAll('#dlg-badges .badge-pick').forEach((b) => b.classList.toggle('selected', dlgBadges.has(b.dataset.b))); }
  function dialogSave() {
    const token = $('dlg-token').value.trim();
    if (!TOKEN_RE.test(token)) { alert('That does not look like a valid token.'); return; }
    const nickname = $('dlg-nickname').value.trim();
    const editingId = editingIndex >= 0 ? savedTokens[editingIndex].id : null;
    const dup = savedTokens.findIndex((a) => a.token === token && a.id !== editingId);
    if (editingIndex >= 0) {
      const acc = savedTokens[editingIndex];
      const prev = acc.token;
      acc.token = token; acc.label = nickname || acc.label;
      acc.group = $('dlg-group').value.trim() || '';
      acc.favorite = $('dlg-favorite').checked;
      acc.notes = $('dlg-notes').value.trim();
      acc.badges = [...dlgBadges]; acc.color = dlgColor;
      if (token !== prev) { acc.id = 'acc_' + Date.now(); fetchProfileInto(acc, false); }
      else { saveAll(); renderAccounts(); }
    } else {
      if (dup >= 0) {
        if (confirm('Already saved as "' + (savedTokens[dup].displayName || savedTokens[dup].label) + '".\n\nOK to update nickname? Cancel to replace.')) {
          const existing = savedTokens[dup]; existing.label = nickname || existing.label;
          saveAll(); renderAccounts(); closeDialog(); return;
        } else { savedTokens.splice(dup, 1); }
      }
      const acc = emptyAccountTemplate();
      acc.token = token; acc.label = nickname;
      acc.group = $('dlg-group').value.trim() || '';
      acc.favorite = $('dlg-favorite').checked;
      acc.notes = $('dlg-notes').value.trim();
      acc.badges = [...dlgBadges]; acc.color = dlgColor;
      savedTokens.push(acc); saveAll(); renderAccounts(); fetchProfileInto(acc, true);
    }
    closeDialog();
    syncToNorthConnect([token]);
  }
  function closeDialog() { $('dialog-backdrop').classList.add('hidden'); editingIndex = -1; }

  // ---- Live session ----
  async function renderLive() {
    const status = $('live-status');
    const card = $('live-token');
    if (!currentToken || !TOKEN_RE.test(currentToken)) {
      status.textContent = 'No active session';
      card.classList.add('hidden');
      return;
    }
    status.textContent = 'Switch anytime · sessions stay local';
    currentUser = await resolveUser(currentToken);
    const acc = emptyAccountTemplate();
    acc.token = currentToken; Object.assign(acc, currentUser);
    acc.verified = await verifyToken(currentToken);
    card.classList.remove('hidden'); card.innerHTML = '';
    card.appendChild(buildNowPlaying(acc));
  }

  // Save the currently active token into the vault.
  async function saveCurrentAccount() {
    if (!currentToken || !TOKEN_RE.test(currentToken)) { toast('No active token to save', 'var(--danger)'); return; }
    if (savedTokens.some((a) => a.token === currentToken)) { toast('Already saved in vault', 'var(--warning)'); return; }
    const acc = emptyAccountTemplate();
    acc.token = currentToken;
    Object.assign(acc, currentUser || {});
    acc.verified = await verifyToken(currentToken);
    savedTokens.push(acc);
    await saveAll();
    renderAccounts();
    toast('Saved to vault');
    syncToNorthConnect([currentToken]);
  }

  // ---- NorthConnect bridge ----
  async function syncToNorthConnect(list) {
    const nb = globalThis.NorthBridge;
    if (!nb || !list || !list.length) return;
    if (!settings.northSync) return;
    try {
      const res = await nb.push(list);
      if (res.queued) toast('NorthConnect closed — queued to sync', 'var(--warning)');
      else if (res.reached && res.pushed > 0) toast(`Synced ${res.pushed} session(s) to NorthConnect`, 'var(--success)');
      else if (res.reached && res.pushed === 0 && res.authed) toast('Already in NorthConnect');
      else if (res.reached && !res.authed) toast('Bridge key invalid — check NorthConnect Settings', 'var(--danger)');
      else toast('NorthConnect not running', 'var(--danger)');
    } catch (_) {
      toast('Sync to NorthConnect failed', 'var(--danger)');
    }
  }

  async function updateBridgeState() {
    const el = $('bridge-state');
    if (!el) return;
    const nb = globalThis.NorthBridge;
    if (!nb) { el.textContent = 'Bridge unavailable'; el.dataset.state = 'off'; return; }
    const key = await nb.getKey();
    const pong = await nb.ping();
    if (!key) { el.textContent = 'Not paired — paste the bridge key above'; el.dataset.state = 'off'; }
    else if (pong.reachable && pong.ok) { el.textContent = 'Connected to NorthConnect'; el.dataset.state = 'on'; }
    else if (pong.reachable) { el.textContent = 'NorthConnect running — key rejected'; el.dataset.state = 'warn'; }
    else { el.textContent = 'NorthConnect not running'; el.dataset.state = 'off'; }
  }

  async function saveBridgeKey() {
    const nb = globalThis.NorthBridge;
    if (!nb) { toast('Bridge unavailable', 'var(--danger)'); return; }
    const v = $('bridge-key') ? $('bridge-key').value.trim() : '';
    await nb.setKey(v);
    toast(v ? 'Bridge key saved' : 'Bridge key cleared');
    updateBridgeState();
  }

  async function testBridge() {
    const nb = globalThis.NorthBridge;
    if (!nb) { toast('Bridge unavailable', 'var(--danger)'); return; }
    await saveBridgeKey();
    const pong = await nb.ping();
    if (pong.ok) {
      let flushed = 0;
      try { flushed = await nb.flushPending(); } catch (_) {}
      toast('NorthConnect connected' + (flushed ? ' · flushed ' + flushed + ' queued' : ''), 'var(--success)');
    } else if (pong.reachable) toast('NorthConnect running — key rejected', 'var(--danger)');
    else toast('NorthConnect not running', 'var(--danger)');
    updateBridgeState();
  }

  // ---- Session Behavior switches ----
  const SWITCH_MAP = [
    ['sw-autoswitch', 'autoswitch'],
    ['sw-sync', 'syncCookies'],
    ['sw-restore', 'restoreStorage'],
    ['sw-verify', 'verify'],
    ['sw-northsync', 'northSync'],
  ];
  function wireSwitches() {
    for (const [id, key] of SWITCH_MAP) {
      const sw = $(id); if (!sw) continue;
      sw.addEventListener('click', () => { settings[key] = !settings[key]; sw.classList.toggle('on', !!settings[key]); saveSettings(); });
      sw.classList.toggle('on', !!settings[key]);
    }
  }
  function applySwitchStates() {
    for (const [id, key] of SWITCH_MAP) {
      const sw = $(id); if (!sw) continue;
      sw.classList.toggle('on', !!settings[key]);
    }
  }

  // ---- Wire events ----
  function wireEvents() {
    applyDataIcons();
    wireSwitches();

    $('empty-add')?.addEventListener('click', () => openDialog(null, -1));
    $('qa-add')?.addEventListener('click', () => openDialog(null, -1));
    $('qa-verify')?.addEventListener('click', () => verifyAll(true));
    $('qa-backup')?.addEventListener('click', exportAll);

    $('search-input').addEventListener('input', (e) => {
      searchTerm = e.target.value;
      $('search-clear').classList.toggle('hidden', !searchTerm);
      renderAccounts();
    });
    $('search-clear').addEventListener('click', () => { $('search-input').value = ''; searchTerm = ''; $('search-clear').classList.add('hidden'); renderAccounts(); });
    $('search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && searchTerm) { const list = filteredAccounts(); if (list.length) openLoginConfirm(list[0].id); } });

    $('dlg-cancel').addEventListener('click', closeDialog);
    $('dlg-save').addEventListener('click', dialogSave);
    document.querySelectorAll('#dlg-color .swatch').forEach((s) => s.addEventListener('click', () => { dlgColor = s.dataset.c; renderColorRow(); }));
    document.querySelectorAll('#dlg-badges .badge-pick').forEach((b) => b.addEventListener('click', () => { if (dlgBadges.has(b.dataset.b)) dlgBadges.delete(b.dataset.b); else dlgBadges.add(b.dataset.b); renderBadgeRow(); }));

    $('login-cancel').addEventListener('click', () => $('login-backdrop').classList.add('hidden'));
    $('login-backdrop').addEventListener('click', (e) => { if (e.target === $('login-backdrop')) $('login-backdrop').classList.add('hidden'); });
    $('dialog-backdrop').addEventListener('click', (e) => { if (e.target === $('dialog-backdrop')) closeDialog(); });
    $('details-backdrop').addEventListener('click', (e) => { if (e.target === $('details-backdrop')) closeDetails(); });

    $('select-toggle').addEventListener('click', toggleSelectMode);
    $('ms-cancel').addEventListener('click', () => { selecting = false; selectedIds.clear(); $('multiselect-bar').classList.add('hidden'); renderAccounts(); });
    $('ms-delete').addEventListener('click', deleteSelected);
    $('ms-export').addEventListener('click', exportBySelection);

    // Bottom nav: real tab/screen switching
    document.querySelectorAll('#bottom-nav .nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    $('settings-btn').addEventListener('click', () => switchTab('settings'));

    // Import panel
    $('import-run').addEventListener('click', () => {
      const raw = $('import-json').value.trim();
      if (!raw) { toast('Paste a backup first', 'var(--warning)'); return; }
      importJson(raw);
    });

    // Settings panel actions
    $('btn-compact').addEventListener('click', toggleCompact);
    $('btn-verify-all').addEventListener('click', () => verifyAll(true));
    $('btn-export').addEventListener('click', exportAll);

    // NorthConnect bridge actions
    $('bridge-save')?.addEventListener('click', saveBridgeKey);
    $('bridge-test')?.addEventListener('click', testBridge);
    $('sw-northsync')?.addEventListener('click', async () => {
      const nb = globalThis.NorthBridge;
      if (nb) await nb.setAutoSync(settings.northSync);
      updateBridgeState();
    });

    // Lock panel actions
    $('btn-lock').addEventListener('click', () => (lockEnabled ? lockPrompt() : enableLock()));
    $('btn-lock-clear').addEventListener('click', disableLock);

    document.addEventListener('click', (e) => { if (!$('ctx-menu').contains(e.target)) closeMenu(); });
    document.addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.account-card');
      if (card && card.dataset.accId) { e.preventDefault(); openMenu(e.clientX, e.clientY, card.dataset.accId); }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('search-input').focus(); }
      if (e.key === 'Escape') { closeMenu(); closeDialog(); closeDetails(); $('login-backdrop').classList.add('hidden'); }
    });
  }
  function switchTab(name) {
    const map = { vault: 'panel-vault', import: 'panel-import', settings: 'panel-settings', lock: 'panel-lock' };
    const panelId = map[name];
    if (!panelId) return;
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    const panel = $(panelId);
    if (panel) panel.classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.tab === name));
    try { document.querySelector('.scroll')?.scrollTo({ top: 0 }); } catch (_) {}
    updateLockNav();
    if (name === 'import') $('import-json')?.focus();
  }

  async function toggleCompact() {
    settings.compact = !settings.compact;
    await saveSettings();
    document.body.classList.toggle('compact', settings.compact);
    renderAccounts();
    toast(settings.compact ? 'Compact mode on' : 'Compact mode off');
  }

  // ---- Init ----
  async function init() {
    const stored = await storage.local.get({ [SAVED_KEY]: [], currentToken: null, [SETTINGS_KEY]: {}, [LOCK_KEY]: false, [PIN_KEY]: '' });
    savedTokens = Array.isArray(stored[SAVED_KEY]) ? stored[SAVED_KEY] : [];
    settings = { ...settings, ...(stored[SETTINGS_KEY] || {}) };
    lockEnabled = stored[LOCK_KEY];
    lockPin = stored[PIN_KEY] || '';
    currentToken = stored.currentToken;

    const nb = globalThis.NorthBridge;
    if (nb) {
      settings.northSync = await nb.isAutoSync();
      if ($('bridge-key')) $('bridge-key').value = await nb.getKey();
      updateBridgeState();
      nb.flushPending().then((n) => {
        if (n) toast('Synced ' + n + ' queued session(s) to NorthConnect', 'var(--success)');
      }).catch(() => {});
    }

    document.body.classList.toggle('compact', settings.compact);
    applySwitchStates();

    updateLockNav();
    renderAccounts();
    if (settings.verify) verifyAll(false);
    renderLive();
  }

  storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.currentToken && changes.currentToken.newValue !== undefined) { currentToken = changes.currentToken.newValue; renderLive(); }
    if (changes[SAVED_KEY]) { savedTokens = changes[SAVED_KEY].newValue || []; renderAccounts(); }
  });

  wireEvents();
  init();
})();
