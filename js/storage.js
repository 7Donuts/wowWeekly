/* -------------------------------------------
   STORAGE — namespaced localStorage abstraction
   All keys follow the prefix "wow_mn_" to avoid
   collisions. Change the schema here and it
   propagates to every page that loads this file.
------------------------------------------- */
function getWeekKey() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0));
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() - 1);
  if (now < d) d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
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
  const gearColor = cur >= 8 ? 'var(--void-glow)' : 'var(--light-gold)';
  let btns = '';
  for (let t = 1; t <= 11; t++) {
    btns += '<button class="tier-btn' + (cur === t ? ' active' : '') + '" onclick="setDelveTier(' + t + ',\'' + taskId + '\')">T' + t + '</button>';
  }
  return '<div class="tier-selector" onclick="event.stopPropagation()">'
    + '<span class="tier-label">Your max Delve tier:</span>'
    + '<div class="tier-btns">' + btns + '</div>'
    + '<span class="tier-gear-label" style="color:' + gearColor + ';">→ ' + gearLabel + '</span>'
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

/* ── TEMPLATE PROFILES ── */
function profilesKey()       { return 'wow_mn_profiles'; }
function loadProfiles()      { return JSON.parse(localStorage.getItem(profilesKey()) || '[]'); }
function saveProfiles(p)     { localStorage.setItem(profilesKey(), JSON.stringify(p)); }


function customStorageKey() { return 'wow_mn_custom_' + currentChar; }
function loadCustomTasks()  { return JSON.parse(localStorage.getItem(customStorageKey()) || '[]'); }
function saveCustomTasks(t) { localStorage.setItem(customStorageKey(), JSON.stringify(t)); }

/* ── ARMORY ── */
function loadCharRealm(n)         { return localStorage.getItem('wow_mn_realm_' + n) || ''; }
function saveCharRealm(n, r)      { if (r) localStorage.setItem('wow_mn_realm_' + n, r); else localStorage.removeItem('wow_mn_realm_' + n); }
function loadCharRealmSlug(n)     { return localStorage.getItem('wow_mn_realmslug_' + n) || realmToSlug(loadCharRealm(n)); }
function saveCharRealmSlug(n, s)  { if (s) localStorage.setItem('wow_mn_realmslug_' + n, s); else localStorage.removeItem('wow_mn_realmslug_' + n); }
function realmToSlug(name)        { return (name||'').toLowerCase().replace(/['‘’]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''); }
function loadArmoryData(n)   { return JSON.parse(localStorage.getItem('wow_mn_armory_' + n) || 'null'); }
function saveArmoryData(n, d){ localStorage.setItem('wow_mn_armory_' + n, JSON.stringify(d)); }
function loadBnetCreds()     { return JSON.parse(localStorage.getItem('wow_mn_bnet_creds') || 'null'); }
function saveBnetCreds(d)    { localStorage.setItem('wow_mn_bnet_creds', JSON.stringify(d)); }
