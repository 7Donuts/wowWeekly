/* -------------------------------------------
   ARMORY.JS: WoW character sync via Battle.net API
   Requires the user to be logged in with Battle.net.
   Auto-syncs on page load; refreshes if data is > 1 hour old.
------------------------------------------- */

/* ── SESSION EXPIRY HANDLER ── */
function _handleSessionExpired() {
  showToast('Session expired: signing you back in…');
  const region = localStorage.getItem('wow_mn_bnet_region') || 'us';
  setTimeout(() => { window.location.href = '/auth/login?region=' + region; }, 1800);
}

/* ── SYNC ── */
async function armorySync(charName) {
  const slug = loadCharRealmSlug(charName);
  if (!slug) {
    showToast('Set a realm for ' + charDisplayName(charName) + ' first, via Manage characters in the roster header.');
    return;
  }

  try {
    const params = new URLSearchParams({ char: charDisplayName(charName).toLowerCase(), realm: slug });
    const res    = await fetch('/api/armory?' + params);

    if (res.status === 401) { _handleSessionExpired(); return; }
    if (res.status === 404) { showToast('Character not found on Battle.net. Check the name and realm.'); return; }
    if (!res.ok)            { showToast('Armory sync failed. Please try again.'); return; }

    const armory = await res.json();
    saveArmoryData(charName, armory);
    recordBlizzardLag(charName, armory.freshness);

    armoryAutoCheckBis(charName);
    armoryAutoTrackMythicPlus(charName);
    armoryAutoCheckRaidBosses(charName);

    if (armory.className && !loadCharClass(charName)) {
      const classId = _ARMORY_CLASS_MAP[armory.className];
      if (classId) saveCharClass(charName, classId);
    }

    renderChars();
    renderClassLinksBar();
    render();

    const spec = [armory.spec, armory.className].filter(Boolean).join(' ');
    showToast(charDisplayName(charName) + ' synced: ' + spec + ' · iLvl ' + armory.ilvl + (armory.mythicRating ? ' · M+ ' + armory.mythicRating : ''));
  } catch (_) {
    showToast('Armory sync failed. Please try again.');
  }
}

/* ── AUTO-SYNC (called after login, refreshes stale data) ── */
const _ARMORY_SESS_KEY = 'azeroth_armory_ts';
const _ARMORY_STALE_MS = 60 * 60 * 1000; // 1 hour: per-char stale threshold
const _ARMORY_SESS_MS  =  3 * 60 * 1000; // 3 minutes: debounce rapid re-calls within a session

async function autoSyncArmory() {
  const chars = JSON.parse(localStorage.getItem('wow_midnight_chars') || '["Main"]');
  const now   = Date.now();

  // On the first call this session (new tab / browser open), sync all chars that
  // have a realm set, regardless of the per-char stale threshold. Within the same
  // session, fall back to the 1-hour stale check so quick refreshes don't hammer
  // the Battle.net API.
  const lastSess      = parseInt(sessionStorage.getItem(_ARMORY_SESS_KEY) || '0', 10);
  const isFirstInSess = (now - lastSess) > _ARMORY_SESS_MS;
  if (isFirstInSess) sessionStorage.setItem(_ARMORY_SESS_KEY, String(now));

  let anyUpdated = false;

  for (const charName of chars) {
    const slug = loadCharRealmSlug(charName);
    if (!slug) continue;

    const existing = loadArmoryData(charName);
    const age = existing?.lastSync ? (now - existing.lastSync) : Infinity;

    // Skip chars whose data is complete and fresh enough for this call site.
    const hasFullData = existing?.gearItems && 'raidKills' in (existing || {});
    if (hasFullData && age < _ARMORY_STALE_MS && !isFirstInSess) continue;
    // Even on first-in-session, skip chars synced within the last 5 minutes.
    if (hasFullData && age < 5 * 60 * 1000) continue;

    try {
      const params = new URLSearchParams({ char: charDisplayName(charName).toLowerCase(), realm: slug });
      const res    = await fetch('/api/armory?' + params);
      if (!res.ok) continue;

      const armory = await res.json();
      saveArmoryData(charName, armory);
      recordBlizzardLag(charName, armory.freshness);
      armoryAutoCheckBis(charName);
      armoryAutoTrackMythicPlus(charName);
      armoryAutoCheckRaidBosses(charName);

      if (armory.className && !loadCharClass(charName)) {
        const classId = _ARMORY_CLASS_MAP[armory.className];
        if (classId) saveCharClass(charName, classId);
      }
      anyUpdated = true;
    } catch (_) {}

    // Brief pause between characters to avoid rate-limiting
    await new Promise(r => setTimeout(r, 400));
  }

  // Account-wide, so it runs once regardless of how many characters were
  // refreshed above, and even when none were.
  const collected = await armorySyncCollections();

  if (anyUpdated || collected > 0) {
    if (typeof renderChars      === 'function') renderChars();
    if (typeof renderClassLinksBar === 'function') renderClassLinksBar();
    if (typeof render           === 'function') render();
  }
}

/* -------------------------------------------------------------------------
   How far behind the game the Battle.net tier actually runs

   Putting this tier in front of the addon rests on a claim nobody here has
   measured: that it answers sooner. Several profile endpoints refresh lazily
   rather than live, and at least some appear to wait on the character logging
   out, which would make them no fresher than the addon's own file and would
   change which tier should answer what.

   So rather than assume it, sample it. The worker reads each response's
   Last-Modified and the character's last_login_timestamp; this keeps a
   rolling window of those, per endpoint, so the question can be answered from
   real observations instead of from anybody's recollection of the docs.

   Read it with blizzardLagReport(), which is also what the diagnostics block
   in the addon modal renders. Bounded so it cannot grow without limit in a
   member's localStorage.
------------------------------------------------------------------------- */

const _LAG_KEY     = 'wow_mn_bnet_lag';
const _LAG_SAMPLES = 40;

function recordBlizzardLag(charName, freshness) {
  if (!freshness) return;
  let log;
  try { log = JSON.parse(localStorage.getItem(_LAG_KEY) || '[]'); } catch (_) { log = []; }
  if (!Array.isArray(log)) log = [];

  const sample = { char: charName, at: freshness.at, lastLogin: freshness.lastLogin || null };
  for (const key of ['profile', 'keystone', 'raids', 'equipment']) {
    const seen = freshness[key];
    if (seen && typeof seen.ageSeconds === 'number') sample[key] = seen.ageSeconds;
  }

  log.push(sample);
  // Newest kept. An old sample says nothing about how the API behaves today.
  while (log.length > _LAG_SAMPLES) log.shift();
  try { localStorage.setItem(_LAG_KEY, JSON.stringify(log)); } catch (_) {}
}

/* Median rather than mean, per endpoint.

   One sample taken while Blizzard was having a bad afternoon should not
   decide an architecture, and the distribution here is the kind with a long
   right tail. Median plus worst gives both the usual case and the one that
   would bite. */
function blizzardLagReport() {
  let log;
  try { log = JSON.parse(localStorage.getItem(_LAG_KEY) || '[]'); } catch (_) { return null; }
  if (!Array.isArray(log) || !log.length) return null;

  const out = { samples: log.length, endpoints: {} };
  for (const key of ['profile', 'keystone', 'raids', 'equipment']) {
    const values = log.map((s) => s[key]).filter((v) => typeof v === 'number').sort((a, b) => a - b);
    if (!values.length) continue;
    out.endpoints[key] = {
      medianSeconds: values[Math.floor(values.length / 2)],
      worstSeconds:  values[values.length - 1],
      samples:       values.length,
    };
  }

  // How long ago the character last logged out, on the most recent sample.
  // If an endpoint's lag tracks this rather than staying flat, the endpoint
  // is waiting on the logout and is no fresher than the addon's file.
  const last = log[log.length - 1];
  if (last && last.lastLogin) {
    out.sinceLastLogin = Math.round((last.at - last.lastLogin) / 1000);
  }
  return out;
}

/* ── CLASS MAP ── */
const _ARMORY_CLASS_MAP = {
  'Death Knight': 'death-knight', 'Demon Hunter': 'demon-hunter',
  'Druid':   'druid',   'Evoker':  'evoker',   'Hunter':  'hunter',
  'Mage':    'mage',    'Monk':    'monk',      'Paladin': 'paladin',
  'Priest':  'priest',  'Rogue':   'rogue',     'Shaman':  'shaman',
  'Warlock': 'warlock', 'Warrior': 'warrior',
};

/* ── BIS AUTO-CHECK ── */
const _BIS_SLOT_MAP = {
  'head': 'head', 'neck': 'neck', 'shoulder': 'shoulder', 'shoulders': 'shoulder',
  'back': 'back', 'chest': 'chest', 'wrist': 'wrist', 'wrists': 'wrist',
  'hands': 'hands', 'waist': 'waist', 'legs': 'legs', 'feet': 'feet',
  'ring 1': 'finger1', 'ring 2': 'finger2',
  'trinket 1': 'trinket1', 'trinket 2': 'trinket2',
  'main hand': 'main_hand', 'off hand': 'off_hand', 'shield': 'off_hand',
};

function armoryAutoCheckBis(charName) {
  const armory = loadArmoryData(charName);
  if (!armory?.gearItems || !Object.keys(armory.gearItems).length) return 0;

  const yourList    = JSON.parse(localStorage.getItem('wow_mn_yourlist_' + charName) || '[]');
  const customTasks = JSON.parse(localStorage.getItem('wow_mn_custom_'   + charName) || '[]');
  if (!yourList.length || !customTasks.length) return 0;

  const customMap = {};
  customTasks.forEach(t => { customMap[t.id] = t; });

  let autoChecked = 0;

  yourList.forEach(ylId => {
    if (!ylId.startsWith('custom_bis_')) return;
    const task = customMap[ylId.slice('custom_'.length)];
    if (!task) return;
    const nameMatch = task.name.match(/^\[([^\]]+)\]\s*(.+)$/);
    if (!nameMatch) return;
    const gearSlot    = _BIS_SLOT_MAP[nameMatch[1].toLowerCase().trim()];
    const bisItemName = nameMatch[2].trim();
    if (!gearSlot) return;
    const equipped = armory.gearItems[gearSlot];
    if (!equipped?.name) return;
    if (equipped.name.toLowerCase() === bisItemName.toLowerCase()) {
      if (applyAutoTask(charName, ylId, { done: true }, 'armory').ticked) autoChecked++;
    }
  });

  return autoChecked;
}

/* ── MYTHIC+ AUTO-TRACK ── */
function armoryAutoTrackMythicPlus(charName) {
  const armory    = loadArmoryData(charName);
  const weeklyData = armory?.weeklyRuns;
  if (!weeklyData?.runs) return { total: 0, highKeys: 0 };
  if (weeklyData.week !== getWeekKey()) return { total: 0, highKeys: 0 };

  const runs     = weeklyData.runs;
  const total    = runs.length;
  const highKeys = runs.filter(r => r.mythic_level >= 10).length;

  // Through applyAutoTask rather than written straight in, so the counters
  // merge by maximum and a manually un-ticked m1 stays un-ticked. The armory
  // can no longer walk a counter backwards, which is deliberate: it and the
  // addon count the same week, and a member syncing two machines in whatever
  // order they open the site should not see progress go down.
  applyAutoTask(charName, 'm1', { done: total >= 8, value: Math.min(total, 8) }, 'armory');
  applyAutoTask(charName, 'v3', { done: total >= 8, value: Math.min(total, 8) }, 'armory');
  applyAutoTask(charName, 'm4', { value: highKeys }, 'armory');

  return { total, highKeys };
}

/* ── RAID BOSS AUTO-CHECK ── */
function armoryAutoCheckRaidBosses(charName) {
  const armory = loadArmoryData(charName);
  if (!armory?.raidKills || !Object.keys(armory.raidKills).length) return 0;

  let recorded = 0;
  for (const [taskId, bosses] of Object.entries(armory.raidKills)) {
    for (const [bossId, killed] of Object.entries(bosses)) {
      if (!killed) continue;
      // applyAutoBoss derives the task completion from the boss list, so the
      // "every boss dead" rule lives in exactly one place now that the addon
      // reports kills through the same door.
      if (applyAutoBoss(charName, taskId, bossId, 'armory')) recorded++;
    }
  }
  return recorded;
}

/* ── COLLECTIONS AUTO-CHECK ──
   Mounts, toys and achievements from the Battle.net profile. Account-wide, so
   a collectible ticks on every character rather than the one that looted it.

   The addon reports the same things faster; this is the backstop that credits
   anything collected before the addon was installed, or on a machine that
   never syncs the file. Whichever arrives first wins and the other no-ops. */
async function armorySyncCollections() {
  try {
    const res = await fetch('/api/collections');
    if (res.status === 401) { _handleSessionExpired(); return 0; }
    if (!res.ok) return 0;

    const data = await res.json();
    if (!data || data.unavailable) return 0;

    localStorage.setItem('wow_mn_collections', JSON.stringify({
      mounts: data.mounts?.length || 0,
      toys: data.toys?.length || 0,
      achievements: data.achievements?.length || 0,
      lastSync: Date.now(),
    }));

    // Same merge path the addon's collections take, so the two cannot
    // disagree about what "collected" means.
    return applyLedgerCollections(data, 'armory');
  } catch (_) {
    return 0;
  }
}

/* ── SYNC ALL BUTTON ── */
async function syncAllCharsButton() {
  const btn = document.getElementById('btn-sync-all');
  const chars = JSON.parse(localStorage.getItem('wow_midnight_chars') || '["Main"]');
  const toSync = chars.filter(c => loadCharRealmSlug(c));

  if (!toSync.length) {
    showToast('No characters with a realm set. Add realm names via Manage characters first.');
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph ph-hourglass-high"></i>'; btn.title = 'Syncing…'; }

  let synced = 0;
  for (let i = 0; i < toSync.length; i++) {
    const charName = toSync[i];
    try {
      const slug   = loadCharRealmSlug(charName);
      const params = new URLSearchParams({ char: charDisplayName(charName).toLowerCase(), realm: slug });
      const res    = await fetch('/api/armory?' + params);
      if (res.status === 401) { if (btn) { _resetSyncBtn(btn); } _handleSessionExpired(); return; }
      if (!res.ok) continue;

      const armory = await res.json();
      saveArmoryData(charName, armory);
      armoryAutoCheckBis(charName);
      armoryAutoTrackMythicPlus(charName);
      armoryAutoCheckRaidBosses(charName);

      if (armory.className && !loadCharClass(charName)) {
        const classId = _ARMORY_CLASS_MAP[armory.className];
        if (classId) saveCharClass(charName, classId);
      }
      synced++;
    } catch (_) {}

    if (i < toSync.length - 1) await new Promise(r => setTimeout(r, 400));
  }

  if (btn) _resetSyncBtn(btn);
  if (typeof renderChars === 'function') renderChars();
  if (typeof renderClassLinksBar === 'function') renderClassLinksBar();
  if (typeof render === 'function') render();
  showToast(synced ? `Synced ${synced} character${synced !== 1 ? 's' : ''}` : 'Sync failed. Check your connection.');
}

function _resetSyncBtn(btn) {
  btn.disabled = false;
  btn.innerHTML = '<i class="ph ph-arrows-clockwise"></i>';
  btn.title = 'Sync all characters from Battle.net';
}

/* ── TOAST ── */
function showToast(msg) {
  const t = document.getElementById('share-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}
