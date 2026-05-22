(function () {
  'use strict';

  let syncUser    = null;
  let pushTimer   = null;
  let pushPending = false;

  // Capture the real setItem before we override it so pull can write
  // to localStorage without triggering a push cycle.
  const _origSetItem = Storage.prototype.setItem;

  function isSyncKey(key) {
    if (key === 'wow_midnight_chars') return true;
    if (!key.startsWith('wow_mn_')) return false;
    if (key.startsWith('wow_mn_armory_')) return false; // Battle.net armory cache — skip
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
    if (!syncUser) return;
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
    // sessionStorage flag prevents re-pulling (and re-reloading) on the same
    // tab after we already synced once this session.
    if (sessionStorage.getItem('azeroth_synced')) return;
    try {
      const res = await fetch('/api/data');
      if (!res.ok) return;
      const serverData = await res.json();
      if (!serverData || Object.keys(serverData).length === 0) {
        sessionStorage.setItem('azeroth_synced', '1');
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
      sessionStorage.setItem('azeroth_synced', '1');
      if (changed) location.reload();
    } catch (_) {}
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

  // Push when tab hides or closes so nothing is lost.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && syncUser && pushPending) pushToCloud();
  });
  window.addEventListener('beforeunload', () => {
    if (syncUser && pushPending) pushToCloud();
  });

  window.addEventListener('DOMContentLoaded', initSync);
})();
