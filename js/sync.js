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
  const SYNC_TTL_MS = 2 * 60 * 1000;

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
    if (key.startsWith('wow_mn_armory_')) return false; // Battle.net armory cache: skip
    if (key === 'wow_mn_item_icons')    return false;   // item icon cache: derived, skip
    if (key === 'wow_mn_bnet_creds')    return false;   // region pref only, skip
    if (key === 'wow_mn_bnet_region')   return false;   // device-local: OAuth region for re-login
    if (key === 'wow_mn_light_mode')    return false;   // device-local UI pref
    if (key === 'wow_mn_compact')       return false;   // device-local UI pref
    if (key === 'wow_mn_welcomed')      return false;   // device-local: has this device seen the welcome
    if (key === 'wow_mn_seen_version')  return false;   // device-local: has this device seen the changelog
    if (key === 'wow_mn_last_battletag') return false;  // device-local: cached battletag for optimistic UI

    // Device-local by construction: a pending observation queue is this
    // device's unsent work and the state meta is this device's view of the
    // server. Pushing either into the shared blob would have one device
    // replay another's writes.
    if (key === 'wow_mn_obs_queue')     return false;
    if (key === 'wow_mn_state_meta')    return false;

    // Owned by the worker once this account has been migrated. Two writers
    // for one value is the race the D1 store exists to remove, so the blob
    // stops carrying them rather than carrying a second opinion. It is also
    // what stops the blob growing without bound: nothing ever pruned the
    // weekly keys, and they were the bulk of it.
    if (typeof stateOwnsKey === 'function' && stateOwnsKey(key)) return false;

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

  let _syncStatusTimer = null;

  function updateSyncStatus(state) {
    const el = document.getElementById('sync-status');
    if (!el || !syncUser) return;
    clearTimeout(_syncStatusTimer);
    if (state === 'saving') {
      el.textContent  = 'Saving…';
      el.className    = 'sync-status sync-saving';
      el.style.display = '';
    } else if (state === 'saved') {
      el.textContent  = 'Synced';
      el.className    = 'sync-status sync-saved';
      el.style.display = '';
      _syncStatusTimer = setTimeout(() => { el.style.display = 'none'; }, 4000);
    }
  }

  // Returns true on success, false on failure.
  async function pushToCloud() {
    if (!syncUser)   return false;
    if (!_hasPulled) return false; // never overwrite cloud with stale local state
    pushPending = false;
    try {
      const res = await fetch('/api/data', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(getAllSyncData()),
      });
      if (res && res.status === 401 && typeof _handleSessionExpired === 'function') _handleSessionExpired();
      if (res && !res.ok && res.status !== 401) {
        // Show a one-time warning per session so the failure isn't invisible.
        if (!sessionStorage.getItem('azeroth_sync_warn') && typeof showToast === 'function') {
          sessionStorage.setItem('azeroth_sync_warn', '1');
          showToast('Sync error: your progress may not be saving across devices.');
        }
        return false;
      }
      if (res && res.ok) updateSyncStatus('saved');
      return !!(res && res.ok);
    } catch (_) {
      if (!sessionStorage.getItem('azeroth_sync_warn') && typeof showToast === 'function') {
        sessionStorage.setItem('azeroth_sync_warn', '1');
        showToast('Sync error: check your connection.');
      }
      return false;
    }
  }

  function schedulePush() {
    if (!syncUser) return;
    pushPending = true;
    clearTimeout(pushTimer);
    updateSyncStatus('saving');
    pushTimer = setTimeout(pushToCloud, 3000);
  }

  async function pullFromCloud(force = false) {
    if (!force && !shouldPull()) { _hasPulled = true; return; }
    try {
      const res = await fetch('/api/data');
      if (res.status === 401) { if (typeof _handleSessionExpired === 'function') _handleSessionExpired(); return; }
      if (!res.ok) { _hasPulled = true; return; }
      const serverData = await res.json();

      // Server signals KV storage is not configured: warn once and bail.
      if (serverData && serverData._sync_unavailable) {
        _hasPulled = true;
        markSynced();
        if (typeof showToast === 'function') {
          showToast('Cloud sync is not set up, data will only save on this device.');
        }
        return;
      }

      if (!serverData || Object.keys(serverData).length === 0) {
        // Cloud is empty: seed it with local state so other devices pick it up.
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
      updateSyncStatus('saved');
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
    const panelEl  = document.querySelector('.account-panel');
    if (!loginEl) return;
    if (user) {
      if (panelEl) panelEl.classList.add('is-connected');
      localStorage.setItem('wow_mn_last_battletag', user.battletag);
      loginEl.style.display = 'none';
      if (logoutEl)  logoutEl.style.display  = '';
      if (dotEl)     dotEl.style.display     = '';
      if (nameEl)    {
        nameEl.textContent   = user.battletag;
        nameEl.style.display = '';
        nameEl.style.opacity = '';   // clear pending dim
        nameEl.title         = '';   // clear "Verifying…" tooltip
      }
      if (importEl)  importEl.style.display = '';
      if (syncEl)    syncEl.style.display   = '';
    } else {
      if (panelEl) panelEl.classList.remove('is-connected');
      const hadSession = !!localStorage.getItem('wow_mn_last_battletag');
      localStorage.removeItem('wow_mn_last_battletag');
      loginEl.style.display = '';
      if (logoutEl)  logoutEl.style.display  = 'none';
      if (dotEl)     dotEl.style.display     = 'none';
      if (importEl)  importEl.style.display  = 'none';
      if (syncEl)    syncEl.style.display    = 'none';
      if (nameEl)    { nameEl.style.display = 'none'; nameEl.style.opacity = ''; nameEl.title = ''; }
      const statusEl = document.getElementById('sync-status');
      if (statusEl) statusEl.style.display = 'none';
      if (hadSession && typeof showToast === 'function') {
        showToast('Session expired: use Battle.net at the top of the page to sign in again.');
      }
    }
  }

  // Apply last-known auth state immediately so returning users see their battletag
  // right away instead of the "Battle.net" logged-out state while the /api/user
  // check is in flight. The name is shown dimmed until the server confirms.
  function _applyOptimisticAuth() {
    const tag = localStorage.getItem('wow_mn_last_battletag');
    if (!tag) return;
    const loginEl = document.getElementById('auth-login');
    const nameEl  = document.getElementById('auth-battletag');
    const dotEl   = document.getElementById('auth-dot');
    if (loginEl) loginEl.style.display = 'none';
    if (dotEl)   dotEl.style.display   = '';
    if (nameEl)  {
      nameEl.textContent   = tag;
      nameEl.style.display = '';
      nameEl.style.opacity = '0.45';
      nameEl.title         = 'Verifying session…';
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _applyOptimisticAuth);
  } else {
    _applyOptimisticAuth();
  }

  async function initSync() {
    try {
      const res = await fetch('/api/user');
      if (!res.ok) return;
      const { user } = await res.json();
      syncUser = user;
      updateAuthUI(user);
      // Notify app: it re-renders the welcome step now that auth is confirmed,
      // and advances from bnet-choice to bnet-import if returning from OAuth.
      if (typeof onSyncAuthConfirmed === 'function') onSyncAuthConfirmed(user);
      if (user) {
        // Store the OAuth region device-locally so _handleSessionExpired can
        // redirect back to the correct region instead of always defaulting to US.
        if (user.region) _origSetItem.call(localStorage, 'wow_mn_bnet_region', user.region);

        // Pull on fresh tab open (no sync timestamp yet in sessionStorage).
        // On refresh, the timestamp is preserved so the TTL applies: this
        // prevents a reload loop when pullFromCloud writes localStorage and
        // triggers location.reload(), which would otherwise force-pull again.
        const isFreshTab = !sessionStorage.getItem(SYNC_SS_KEY);
        await pullFromCloud(isFreshTab);

        // After the pull, so a learned anchor synced from another device is
        // already in hand, and before the member touches anything, because
        // adopting one moves this week's storage keys.
        if (typeof syncResetAnchor === 'function') {
          try {
            if (await syncResetAnchor()) {
              if (typeof renderChars === 'function') renderChars();
              if (typeof render === 'function') render();
            }
          } catch (_) {}
        }

        /* The authoritative store, after the blob pull and deliberately so.

           Both write the same weekly keys during the changeover, and the
           server is the one that reconciled them, so it has to land second.
           Reversing these two would let a blob some other device pushed
           overwrite rows the server had already merged, which is the exact
           failure this replaces.

           A no-op until the D1 binding is uncommented, in which case the
           blob sync above remains the whole mechanism. */
        if (typeof startState === 'function') {
          try {
            if (await startState()) {
              if (typeof renderChars === 'function') renderChars();
              if (typeof render === 'function') render();
            }
          } catch (_) {}
        }
        // Open standalone import modal only when the welcome is not open.
        // When welcome is open the bnet-import step handles character import inline.
        if (sessionStorage.getItem('azeroth_pending_import')) {
          sessionStorage.removeItem('azeroth_pending_import');
          const welcomeOpen = document.getElementById('modal-welcome')?.classList.contains('open');
          if (!welcomeOpen && typeof openImportChars === 'function') {
            setTimeout(openImportChars, 600);
          }
        }
        if (typeof autoSyncArmory === 'function') autoSyncArmory();
      }
    } catch (_) {}
  }

  // Intercept localStorage writes from this tab to schedule a cloud push.
  Storage.prototype.setItem = function (key, value) {
    _origSetItem.call(this, key, value);
    if (this === localStorage && isSyncKey(key)) schedulePush();
  };

  // Anything still queued when the tab goes away. The queue survives in
  // localStorage either way, so this is a courtesy rather than the guarantee.
  window.addEventListener('beforeunload', () => {
    if (typeof flushObservations === 'function') flushObservations();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && typeof flushObservations === 'function') flushObservations();
  });

  // Background poll: re-pull once the TTL has elapsed even if the tab stays focused.
  setInterval(async () => {
    if (syncUser && !document.hidden && shouldPull()) await pullFromCloud();
  }, 30 * 1000);

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

  // Called after popup OAuth completes: re-checks session without a full page reload.
  window.refreshAuth = async function () {
    try {
      const res = await fetch('/api/user');
      if (!res.ok) return;
      const { user } = await res.json();
      syncUser = user;
      updateAuthUI(user);
      if (typeof onSyncAuthConfirmed === 'function') onSyncAuthConfirmed(user);
      if (user) {
        if (user.region) _origSetItem.call(localStorage, 'wow_mn_bnet_region', user.region);
        await pullFromCloud(true);
        if (sessionStorage.getItem('azeroth_pending_import')) {
          sessionStorage.removeItem('azeroth_pending_import');
          const welcomeOpen = document.getElementById('modal-welcome')?.classList.contains('open');
          if (!welcomeOpen && typeof openImportChars === 'function') setTimeout(openImportChars, 600);
        }
        if (typeof autoSyncArmory === 'function') autoSyncArmory();
      }
    } catch (_) {}
  };
})();
