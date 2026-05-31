/* -------------------------------------------
   ARMORY.JS — WoW character sync via Battle.net API
   Requires the user to be logged in with Battle.net.
   Auto-syncs on page load; refreshes if data is > 1 hour old.
------------------------------------------- */

/* ── SESSION EXPIRY HANDLER ── */
function _handleSessionExpired() {
  showToast('Session expired — signing you back in…');
  const region = localStorage.getItem('wow_mn_bnet_region') || 'us';
  setTimeout(() => { window.location.href = '/auth/login?region=' + region; }, 1800);
}

/* ── SYNC ── */
async function armorySync(charName) {
  const slug = loadCharRealmSlug(charName);
  if (!slug) {
    showToast('Set a realm for ' + charDisplayName(charName) + ' via the ✏️ edit button first.');
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
const _ARMORY_STALE_MS = 60 * 60 * 1000; // 1 hour — per-char stale threshold
const _ARMORY_SESS_MS  =  3 * 60 * 1000; // 3 minutes — debounce rapid re-calls within a session

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

  if (anyUpdated) {
    if (typeof renderChars      === 'function') renderChars();
    if (typeof renderClassLinksBar === 'function') renderClassLinksBar();
    if (typeof render           === 'function') render();
  }
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

  const weekKey = getWeekKey();
  const doneKey = 'wow_mn_' + charName + '_' + weekKey;
  const done    = JSON.parse(localStorage.getItem(doneKey) || '{}');
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
      if (!done[ylId]) { done[ylId] = true; autoChecked++; }
    }
  });

  if (autoChecked > 0) localStorage.setItem(doneKey, JSON.stringify(done));
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

  const goalsKey = 'wow_mn_goals_' + charName + '_' + getWeekKey();
  const doneKey  = 'wow_mn_'       + charName + '_' + getWeekKey();
  const goals    = JSON.parse(localStorage.getItem(goalsKey) || '{}');
  const done     = JSON.parse(localStorage.getItem(doneKey)  || '{}');

  const m1Val = Math.min(total, 8);
  goals['m1'] = m1Val;
  if (m1Val >= 8) done['m1'] = true; else delete done['m1'];
  goals['m4'] = highKeys;

  localStorage.setItem(goalsKey, JSON.stringify(goals));
  localStorage.setItem(doneKey,  JSON.stringify(done));
  return { total, highKeys };
}

/* ── RAID BOSS AUTO-CHECK ── */
function armoryAutoCheckRaidBosses(charName) {
  const armory = loadArmoryData(charName);
  if (!armory?.raidKills || !Object.keys(armory.raidKills).length) return;

  const weekKey  = getWeekKey();
  const bossKey  = 'wow_mn_bosses_' + charName + '_' + weekKey;
  const doneKey  = 'wow_mn_' + charName + '_' + weekKey;
  const kills    = JSON.parse(localStorage.getItem(bossKey) || '{}');
  const done     = JSON.parse(localStorage.getItem(doneKey) || '{}');
  let bossChanged = false, doneChanged = false;

  for (const [taskId, bosses] of Object.entries(armory.raidKills)) {
    for (const [bossId, killed] of Object.entries(bosses)) {
      if (!killed) continue;
      const k = taskId + '_' + bossId;
      if (!kills[k]) { kills[k] = true; bossChanged = true; }
    }
    // Auto-complete task if every boss in that task is now killed
    const task = (typeof SECTIONS !== 'undefined')
      ? SECTIONS.flatMap(s => s.tasks).find(t => t.id === taskId)
      : null;
    if (task?.bosses) {
      const allKilled = task.bosses.every(b => kills[taskId + '_' + b.id]);
      if (allKilled && !done[taskId]) { done[taskId] = true; doneChanged = true; }
    }
  }

  if (bossChanged) localStorage.setItem(bossKey, JSON.stringify(kills));
  if (doneChanged) localStorage.setItem(doneKey,  JSON.stringify(done));
}

/* ── SYNC ALL BUTTON ── */
async function syncAllCharsButton() {
  const btn = document.getElementById('btn-sync-all');
  const chars = JSON.parse(localStorage.getItem('wow_midnight_chars') || '["Main"]');
  const toSync = chars.filter(c => loadCharRealmSlug(c));

  if (!toSync.length) {
    showToast('No characters with a realm set. Use ✏️ to add realm names first.');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Syncing…'; }

  let synced = 0;
  for (let i = 0; i < toSync.length; i++) {
    const charName = toSync[i];
    try {
      const slug   = loadCharRealmSlug(charName);
      const params = new URLSearchParams({ char: charDisplayName(charName).toLowerCase(), realm: slug });
      const res    = await fetch('/api/armory?' + params);
      if (res.status === 401) { if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync'; } _handleSessionExpired(); return; }
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

  if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync'; }
  if (typeof renderChars === 'function') renderChars();
  if (typeof renderClassLinksBar === 'function') renderClassLinksBar();
  if (typeof render === 'function') render();
  showToast(synced ? `Synced ${synced} character${synced !== 1 ? 's' : ''}` : 'Sync failed. Check your connection.');
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
