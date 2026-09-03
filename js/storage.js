/* -------------------------------------------
   STORAGE: namespaced localStorage abstraction
   All keys follow the prefix "wow_mn_" to avoid
   collisions. Change the schema here and it
   propagates to every page that loads this file.
------------------------------------------- */
/* ── THE WEEKLY RESET ANCHOR ──────────────────────────────────────────────
   The reset is not the same moment everywhere. US realms reset Tuesday and
   EU realms Wednesday, and the exact hour is a Blizzard fact rather than
   something worth asserting from memory: guessing it wrong moves every
   storage key to a value that is also wrong, and then moves them again when
   the guess is corrected.

   So nothing here is guessed. The anchor is learned from Blizzard's own
   mythic keystone period, which /api/reset-time already returns per region,
   and cached. Until that first successful call every region keeps the
   Tuesday 15:00 UTC rule this site has always used, so the default is
   "unchanged" rather than "a different guess".

   A learned anchor is adopted at page load and never mid-session. A week key
   that changed while somebody was ticking boxes would file half their week
   under one key and half under another.
------------------------------------------------------------------------- */

const RESET_ANCHOR_KEY = 'wow_mn_reset_anchor';

// Tuesday, 15:00 UTC. What the site has always done, and what every region
// keeps until Blizzard says otherwise.
const DEFAULT_RESET_ANCHOR = { day: 2, hour: 15, source: 'default' };

function loadResetAnchor() {
  try {
    const stored = JSON.parse(localStorage.getItem(RESET_ANCHOR_KEY) || 'null');
    if (stored && Number.isInteger(stored.day) && Number.isInteger(stored.hour)
        && stored.day >= 0 && stored.day <= 6 && stored.hour >= 0 && stored.hour <= 23) {
      return stored;
    }
  } catch (_) {}
  return DEFAULT_RESET_ANCHOR;
}

function saveResetAnchor(anchor) {
  localStorage.setItem(RESET_ANCHOR_KEY, JSON.stringify(anchor));
}

/* The millisecond the current reset week began, under a given anchor.
   Everything else here is derived from this, so there is one implementation
   of the rule rather than one per caller. */
function weekStartMs(anchor, nowMs) {
  anchor = anchor || loadResetAnchor();
  const now = new Date(nowMs == null ? Date.now() : nowMs);
  const d = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), anchor.hour, 0, 0));
  while (d.getUTCDay() !== anchor.day) d.setUTCDate(d.getUTCDate() - 1);
  if (now < d) d.setUTCDate(d.getUTCDate() - 7);
  return d.getTime();
}

function getWeekKey(anchor, nowMs) {
  return new Date(weekStartMs(anchor, nowMs)).toISOString().slice(0, 10);
}

/* Whether a moment falls inside the current reset week. Used instead of
   comparing week labels, so a source that computes its own key from a
   slightly different rule (the addon, which cannot know each region's reset
   hour) still lands in the right week. */
function isThisWeek(unixSeconds) {
  if (!unixSeconds) return false;
  const start = weekStartMs();
  const ms = unixSeconds * 1000;
  return ms >= start && ms < start + 7 * 86400 * 1000;
}

/* Every per-week storage key family, so a change of anchor can carry the
   current week's work across instead of appearing to erase it. */
const WEEKLY_KEY_PREFIXES = ['wow_mn_', 'wow_mn_goals_', 'wow_mn_bosses_',
                             'wow_mn_autosrc_', 'wow_mn_untick_'];

function migrateWeekKeys(oldAnchor, newAnchor) {
  const oldKey = getWeekKey(oldAnchor);
  const newKey = getWeekKey(newAnchor);
  if (oldKey === newKey) return 0;

  let chars = [];
  try { chars = JSON.parse(localStorage.getItem('wow_midnight_chars') || '[]'); } catch (_) {}

  let moved = 0;
  for (const charName of chars) {
    for (const prefix of WEEKLY_KEY_PREFIXES) {
      const from = prefix + charName + '_' + oldKey;
      const to   = prefix + charName + '_' + newKey;
      const value = localStorage.getItem(from);
      // Never overwrite: if the new key already holds something it is newer
      // than whatever the old anchor left behind.
      if (value !== null && localStorage.getItem(to) === null) {
        localStorage.setItem(to, value);
        moved++;
      }
    }
  }
  return moved;
}

/* Learn the anchor from Blizzard and adopt it. Returns true when it changed,
   which is the caller's signal to re-render. Safe to call on every load: it
   is a no-op once the stored anchor already matches. */
async function syncResetAnchor() {
  const region = localStorage.getItem('wow_mn_bnet_region') || 'us';
  let data;
  try {
    const res = await fetch('/api/reset-time?region=' + encodeURIComponent(region));
    if (!res.ok) return false;
    data = await res.json();
  } catch (_) { return false; }

  if (!data || !data.start_timestamp) return false;

  // The period start IS the reset moment, straight from Blizzard.
  const start = new Date(data.start_timestamp);
  const learned = {
    day: start.getUTCDay(), hour: start.getUTCHours(),
    region, source: 'blizzard', learnedAt: Date.now(),
  };

  const current = loadResetAnchor();
  if (current.day === learned.day && current.hour === learned.hour) {
    // Same rule, but record that it is now confirmed rather than assumed.
    if (current.source !== 'blizzard') saveResetAnchor(learned);
    return false;
  }

  const moved = migrateWeekKeys(current, learned);
  saveResetAnchor(learned);
  if (typeof showToast === 'function') {
    showToast('Weekly reset for ' + region.toUpperCase() + ' is '
      + ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][learned.day]
      + ' ' + String(learned.hour).padStart(2, '0') + ':00 UTC. '
      + (moved ? 'This week\'s progress was carried across.' : ''));
  }
  return true;
}

function storageKey() { return 'wow_mn_' + currentChar + '_' + getWeekKey(); }
function loadDone()   { return JSON.parse(localStorage.getItem(storageKey()) || '{}'); }
function saveDone(d)  { localStorage.setItem(storageKey(), JSON.stringify(d)); }

function hiddenKey()      { return 'wow_mn_hidden_' + currentChar; }
function loadHidden()     { return JSON.parse(localStorage.getItem(hiddenKey()) || '{}'); }
function saveHidden(h)    { localStorage.setItem(hiddenKey(), JSON.stringify(h)); }

function yourListKey()      { return 'wow_mn_yourlist_' + currentChar; }
function loadYourList()     { return JSON.parse(localStorage.getItem(yourListKey()) || '[]'); }
function saveYourList(l)    { localStorage.setItem(yourListKey(), JSON.stringify(l)); }

function notesKey()         { return 'wow_mn_notes_' + currentChar; }
function loadNotes()        { return JSON.parse(localStorage.getItem(notesKey()) || '{}'); }
function saveNotes(n)       { localStorage.setItem(notesKey(), JSON.stringify(n)); }

function yourListOrderKey()  { return 'wow_mn_ylorder_' + currentChar; }
function loadYourListOrder() { return JSON.parse(localStorage.getItem(yourListOrderKey()) || '[]'); }
function saveYourListOrder(o){ localStorage.setItem(yourListOrderKey(), JSON.stringify(o)); }

function bossKey()           { return 'wow_mn_bosses_' + currentChar + '_' + getWeekKey(); }
function loadBossKills()     { return JSON.parse(localStorage.getItem(bossKey()) || '{}'); }
function saveBossKills(b)    { localStorage.setItem(bossKey(), JSON.stringify(b)); }

function toggleBoss(taskId, bossId) {
  const kills = loadBossKills();
  const k = taskId + '_' + bossId;
  kills[k] = !kills[k];
  saveBossKills(kills);

  // Auto-check task if all bosses killed; auto-uncheck if any unchecked
  const task = SECTIONS.flatMap(s => s.tasks).find(t => t.id === taskId);
  if (task && task.bosses) {
    const allKilled = task.bosses.every(b => kills[taskId + '_' + b.id]);
    const done = loadDone();
    if (allKilled) done[taskId] = true;
    else delete done[taskId];
    saveDone(done);
    // Clicking a bubble is a manual action, so the resulting tick is recorded
    // as one: an automatic source must not later claim credit for it, and
    // clearing a bubble must not be undone by the next sync.
    if (typeof markManualToggle === 'function') markManualToggle(taskId, allKilled);
  }
  render();
}

function goalsKey()          { return 'wow_mn_goals_' + currentChar + '_' + getWeekKey(); }
function loadGoals()         { return JSON.parse(localStorage.getItem(goalsKey()) || '{}'); }
function saveGoals(g)        { localStorage.setItem(goalsKey(), JSON.stringify(g)); }

/* ── CHAR PREFS (non-weekly, per-character settings) ── */
function charPrefsKey()      { return 'wow_mn_prefs_' + currentChar; }
function loadCharPrefs()     { return JSON.parse(localStorage.getItem(charPrefsKey()) || '{}'); }
function saveCharPref(k, v)  { const p = loadCharPrefs(); p[k] = v; localStorage.setItem(charPrefsKey(), JSON.stringify(p)); }
function getCharPref(k, def) { return loadCharPrefs()[k] ?? def; }

/* ── DELVE TIER SELECTOR ── */
function renderTierSelector(taskId) {
  const cur = getCharPref('delveTier', 7);
  const gearLabel = cur >= 8 ? 'Hero (ilvl 259–276)' : 'Champion (ilvl 246–263)';
  let btns = '';
  for (let t = 1; t <= 11; t++) {
    btns += '<button class="tier-btn' + (cur === t ? ' active' : '') + '" onclick="setDelveTier(' + t + ',\'' + taskId + '\')">T' + t + '</button>';
  }
  return '<div class="tier-selector" onclick="event.stopPropagation()">'
    + '<span class="tier-label">Max tier</span>'
    + '<div class="tier-btns">' + btns + '</div>'
    + '<span class="tier-gear-label"><i class="ph ph-arrow-right"></i> ' + gearLabel + '</span>'
    + '</div>';
}

function setDelveTier(tier, taskId) {
  saveCharPref('delveTier', tier);
  render();
}

function historyKey(charName) { return 'wow_mn_history_' + (charName || currentChar); }
function loadHistory(charName) { return JSON.parse(localStorage.getItem(historyKey(charName)) || '[]'); }
function saveHistory(entries, charName) { localStorage.setItem(historyKey(charName), JSON.stringify(entries)); }

function snapshotWeekForChar(charName, weekKey) {
  // Compute done/total for this character's weekKey
  const done    = JSON.parse(localStorage.getItem('wow_mn_' + charName + '_' + weekKey) || '{}');
  const hidden  = JSON.parse(localStorage.getItem('wow_mn_hidden_' + charName) || '{}');
  const custom  = JSON.parse(localStorage.getItem('wow_mn_custom_' + charName) || '[]');
  let total = 0, completed = 0;
  const sections = {};
  SECTIONS.forEach(sec => {
    let secTotal = 0, secDone = 0;
    sec.tasks.filter(t => !hidden[t.id]).forEach(t => {
      total++; secTotal++;
      if (done[t.id]) { completed++; secDone++; }
    });
    if (secTotal > 0) sections[sec.id] = { done: secDone, total: secTotal, title: sec.title };
  });
  if (custom.length) {
    let cTotal = 0, cDone = 0;
    custom.forEach(t => {
      total++; cTotal++;
      if (done['custom_' + t.id]) { completed++; cDone++; }
    });
    sections['custom'] = { done: cDone, total: cTotal, title: 'Custom Tasks' };
  }
  if (total === 0) return; // nothing to record
  const history = loadHistory(charName);
  // Avoid duplicate entries for same week
  if (!history.find(e => e.week === weekKey)) {
    history.unshift({ week: weekKey, done: completed, total, sections });
    if (history.length > 52) history.pop(); // keep ~1 year
    saveHistory(history, charName);
  }
}



function customStorageKey() { return 'wow_mn_custom_' + currentChar; }
function loadCustomTasks()  { return JSON.parse(localStorage.getItem(customStorageKey()) || '[]'); }
function saveCustomTasks(t) { localStorage.setItem(customStorageKey(), JSON.stringify(t)); }

/* ── CHARACTER IDENTITY ── */
// Identifiers are "Name" (legacy/no realm) or "Name@realm-slug" (realm-aware).
function charDisplayName(id)      { const i = (id||'').indexOf('@'); return i !== -1 ? id.slice(0, i) : id; }
function charRealmSlugFromId(id)  { const i = (id||'').indexOf('@'); return i !== -1 ? id.slice(i + 1) : null; }
function charIdentifier(name, realmSlug) { return realmSlug ? name + '@' + realmSlug : name; }

/* ── ARMORY ── */
function loadCharRealm(n)         { return localStorage.getItem('wow_mn_realm_' + n) || ''; }
function saveCharRealm(n, r)      { if (r) localStorage.setItem('wow_mn_realm_' + n, r); else localStorage.removeItem('wow_mn_realm_' + n); }
function loadCharRealmSlug(n)     {
  const embedded = charRealmSlugFromId(n);
  if (embedded) return embedded;
  return localStorage.getItem('wow_mn_realmslug_' + n) || realmToSlug(loadCharRealm(n));
}
function saveCharRealmSlug(n, s)  { if (s) localStorage.setItem('wow_mn_realmslug_' + n, s); else localStorage.removeItem('wow_mn_realmslug_' + n); }
function realmToSlug(name)        { return (name||'').toLowerCase().replace(/[''']/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''); }
/* Combat role of a character: 'tank' | 'heal' | 'dps' | ''.
   Derived from the synced spec against the spec tables in data-bis.js, with an
   explicit per-character override (wow_mn_role_*) taking precedence. Returns ''
   when nothing is known, which the roster reads as "leave the socket empty". */
function saveCharRole(n, r) { if (r) localStorage.setItem('wow_mn_role_' + n, r); else localStorage.removeItem('wow_mn_role_' + n); }
function loadCharRole(n) {
  const stored = localStorage.getItem('wow_mn_role_' + n);
  if (stored) return stored;
  const spec = loadArmoryData(n)?.spec;
  const cls  = loadCharClass(n);
  if (!spec || !cls || typeof WOW_CLASSES === 'undefined') return '';
  const def = WOW_CLASSES.find(c => c.key === cls.replace(/-/g, ''));
  const sp  = def?.specs.find(s => s.label.toLowerCase() === String(spec).toLowerCase());
  return sp?.role || '';
}

function loadArmoryData(n)   { return JSON.parse(localStorage.getItem('wow_mn_armory_' + n) || 'null'); }
function saveArmoryData(n, d){
  localStorage.setItem('wow_mn_armory_' + n, JSON.stringify(d));
  if (d?.gearItems) _cacheItemIcons(d.gearItems);
}
function _cacheItemIcons(gearItems) {
  const cache = JSON.parse(localStorage.getItem('wow_mn_item_icons') || '{}');
  let changed = false;
  for (const item of Object.values(gearItems)) {
    if (item.name && item.icon) {
      const key = item.name.toLowerCase();
      if (cache[key] !== item.icon) { cache[key] = item.icon; changed = true; }
    }
  }
  if (changed) localStorage.setItem('wow_mn_item_icons', JSON.stringify(cache));
}
function loadBnetCreds()     { return JSON.parse(localStorage.getItem('wow_mn_bnet_creds') || 'null'); }
function saveBnetCreds(d)    { localStorage.setItem('wow_mn_bnet_creds', JSON.stringify(d)); }
