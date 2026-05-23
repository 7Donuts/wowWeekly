(function () {
  'use strict';

  let syncUser    = null;
  let pushTimer   = null;
  let pushPending = false;
  let _hasPulled  = false; // gate: never push until cloud state has been seen this session

  // Capture the real setItem before we override it so pull can write
  // to localStorage without triggering a push cycle.
  const _origSetItem = Storage.prototype.setItem;

  // Pull at most once per 10 minutes within a session (prevents reload loops
  // while still re-syncing when you return to the tab after a while).
  const SYNC_SS_KEY = 'azeroth_last_sync_ts';
  const SYNC_TTL_MS = 10 * 60 * 1000;

  function shouldPull() {
    const last = parseInt(sessionStorage.getItem(SYNC_SS_KEY) || '0', 10);
    return Date.now() - last > SYNC_TTL_MS;
  }

  function markSynced() {
    sessionStorage.setItem(SYNC_SS_KEY, String(Date.now()));
  }

  function isSyncKey(key) {
    if (key === 'wow_midnight_chars') return true;
    if (!key.startsWith('wow_mn_')) return false;
    if (key.startsWith('wow_mn_armory_')) return false; // Battle.net armory cache — skip
    if (key === 'wow_mn_item_icons')    return false;   // item icon cache — derived, skip
    if (key === 'wow_mn_bnet_creds')    return false;   // region pref only, skip
    if (key === 'wow_mn_light_mode')    return false;   // device-local UI pref
    if (key === 'wow_mn_compact')       return false;   // device-local UI pref
    return true;
  }

  function getAllSyncData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!isSyncKey(key)) continue;
      try        { data[key] = JSON.parse(localStorage.getItem(key)); }
      catch (_)  { data[key] = localStorage.getItem(key); }
    }
    return data;
  }

  async function pushToCloud() {
    if (!syncUser)   return;
    if (!_hasPulled) return; // never overwrite cloud with stale local state
    pushPending = false;
    try {
      await fetch('/api/data', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(getAllSyncData()),
      });
    } catch (_) {}
  }

  function schedulePush() {
    if (!syncUser) return;
    pushPending = true;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushToCloud, 3000);
  }

  async function pullFromCloud() {
    if (!shouldPull()) { _hasPulled = true; return; }
    try {
      const res = await fetch('/api/data');
      if (!res.ok) { _hasPulled = true; return; }
      const serverData = await res.json();
      if (!serverData || Object.keys(serverData).length === 0) {
        // Cloud is empty — seed it with local state so other devices pick it up.
        _hasPulled = true;
        markSynced();
        await pushToCloud();
        return;
      }
      let changed = false;
      for (const [key, value] of Object.entries(serverData)) {
        if (!isSyncKey(key)) continue;
        const stored = typeof value === 'string' ? value : JSON.stringify(value);
        if (localStorage.getItem(key) !== stored) {
          _origSetItem.call(localStorage, key, stored); // bypass push interceptor
          changed = true;
        }
      }
      _hasPulled = true;
      markSynced();
      if (changed) location.reload();
    } catch (_) {
      _hasPulled = true; // if cloud is unreachable allow pushes from current local state
    }
  }

  function updateAuthUI(user) {
    const loginEl  = document.getElementById('auth-login');
    const logoutEl = document.getElementById('auth-logout');
    const nameEl   = document.getElementById('auth-battletag');
    const dotEl    = document.getElementById('auth-dot');
    const importEl = document.getElementById('btn-import-chars');
    const syncEl   = document.getElementById('btn-sync-all');
    if (!loginEl) return;
    if (user) {
      loginEl.style.display = 'none';
      if (logoutEl)  logoutEl.style.display  = '';
      if (dotEl)     dotEl.style.display      = '';
      if (nameEl)    { nameEl.textContent = user.battletag; nameEl.style.display = ''; }
      if (importEl)  importEl.style.display   = '';
      if (syncEl)    syncEl.style.display     = '';
    } else {
      loginEl.style.display = '';
      if (logoutEl)  logoutEl.style.display  = 'none';
      if (dotEl)     dotEl.style.display      = 'none';
      if (importEl)  importEl.style.display   = 'none';
      if (syncEl)    syncEl.style.display     = 'none';
      if (nameEl)    nameEl.style.display     = 'none';
    }
  }

  async function initSync() {
    try {
      const res = await fetch('/api/user');
      if (!res.ok) return;
      const { user } = await res.json();
      syncUser = user;
      updateAuthUI(user);
      if (user) {
        await pullFromCloud();
        if (typeof autoSyncArmory === 'function') autoSyncArmory();
      }
    } catch (_) {}
  }

  // Intercept localStorage writes from this tab to schedule a cloud push.
  Storage.prototype.setItem = function (key, value) {
    _origSetItem.call(this, key, value);
    if (this === localStorage && isSyncKey(key)) schedulePush();
  };

  // Re-pull when the tab comes back into focus after the TTL has elapsed,
  // so changes made on another device appear without a full page reload by the user.
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && syncUser && shouldPull()) {
      await pullFromCloud();
    }
    if (document.hidden && syncUser && pushPending) {
      pushToCloud();
    }
  });

  window.addEventListener('beforeunload', () => {
    if (syncUser && pushPending) pushToCloud();
  });

  window.addEventListener('DOMContentLoaded', initSync);
})();
