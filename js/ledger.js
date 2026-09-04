/* -------------------------------------------------------------------------
   LEDGER.JS: the Party Ledger bridge, and the merge rules every automatic
   source goes through.

   A WoW addon cannot make a network request. Party Ledger therefore writes
   what it knows into its own saved variables file and the member hands it
   over, either by granting this page read access to the file once (Chromium's
   File System Access API) or by pasting the string. There is no third path.

   The file is only written by the game at logout or /reload, so what we show
   is always "as of" a moment in the past, and the UI says so rather than
   implying it is live.

   The merge rules in the second half of this file are shared with armory.js,
   because the site now has three sources that can tick a box and they need to
   agree on what happens when they disagree. See INTEGRATION.md.
------------------------------------------------------------------------- */

/* ── Provenance and tombstones ───────────────────────────────────────────
   Two per-character, per-week records that make automatic ticking safe:

   autoSrc   which source ticked a task, so a wrong tick is traceable to the
             thing that made it rather than looking like the member did it.
   untick    tasks the member deliberately un-ticked this week. Without this
             an automatic source re-ticks the box on the next sync and the
             member cannot get rid of it, which is the single most annoying
             failure mode this feature can have.
------------------------------------------------------------------------- */

function autoSrcKey(charName)  { return 'wow_mn_autosrc_' + (charName || currentChar) + '_' + getWeekKey(); }
function loadAutoSrc(charName) { return JSON.parse(localStorage.getItem(autoSrcKey(charName)) || '{}'); }
function saveAutoSrc(m, charName) { localStorage.setItem(autoSrcKey(charName), JSON.stringify(m)); }

function untickKey(charName)   { return 'wow_mn_untick_' + (charName || currentChar) + '_' + getWeekKey(); }
function loadUnticked(charName){ return JSON.parse(localStorage.getItem(untickKey(charName)) || '{}'); }
function saveUnticked(m, charName) { localStorage.setItem(untickKey(charName), JSON.stringify(m)); }

/* Record that the member un-ticked a task by hand, or took that back.
   Called from toggle(); automatic sources read it and stand down. */
function markManualToggle(taskId, nowDone, charName) {
  const unticked = loadUnticked(charName);
  if (nowDone) {
    delete unticked[taskId];
  } else {
    unticked[taskId] = Date.now();
    // Ticking it back off also drops the provenance note: it is the
    // member's box now, not the addon's.
    const src = loadAutoSrc(charName);
    if (src[taskId]) { delete src[taskId]; saveAutoSrc(src, charName); }
  }
  saveUnticked(unticked, charName);
}

/* The one place an automatic source is allowed to tick a box.

   Returns { ticked, progressed, changed }. Ticking a box and advancing a
   counter are reported separately because they mean different things to the
   member: "8 objectives done" and "8 counters moved" are not the same
   sentence, and collapsing them makes the sync summary read wrong.

   `value` is merged by taking the maximum rather than the latest: a member
   who plays on two machines syncs them in whatever order they happen to open
   the site, and "most recent wins" would then walk a counter backwards. */
function applyAutoTask(charName, taskId, fields, source) {
  charName = charName || currentChar;
  const weekKey = getWeekKey();
  const doneKey  = 'wow_mn_' + charName + '_' + weekKey;
  const goalsKey = 'wow_mn_goals_' + charName + '_' + weekKey;

  const done     = JSON.parse(localStorage.getItem(doneKey)  || '{}');
  const goals    = JSON.parse(localStorage.getItem(goalsKey) || '{}');
  const unticked = loadUnticked(charName);
  const autoSrc  = loadAutoSrc(charName);

  let ticked = false, progressed = false;

  if (typeof fields.value === 'number') {
    const merged = Math.max(goals[taskId] || 0, fields.value);
    if (merged !== goals[taskId]) {
      goals[taskId] = merged;
      localStorage.setItem(goalsKey, JSON.stringify(goals));
      progressed = true;
    }
  }

  // A task the member un-ticked this week stays un-ticked. Progress still
  // accumulates above, so un-ticking hides the checkmark without throwing
  // away the count behind it.
  if (fields.done && !unticked[taskId] && !done[taskId]) {
    done[taskId] = true;
    localStorage.setItem(doneKey, JSON.stringify(done));
    autoSrc[taskId] = source;
    saveAutoSrc(autoSrc, charName);
    ticked = true;
  }

  return { ticked, progressed, changed: ticked || progressed };
}

function applyAutoBoss(charName, taskId, bossId, source) {
  charName = charName || currentChar;
  const weekKey = getWeekKey();
  const bossKey = 'wow_mn_bosses_' + charName + '_' + weekKey;
  const kills   = JSON.parse(localStorage.getItem(bossKey) || '{}');
  const k = taskId + '_' + bossId;
  if (kills[k]) return false;

  kills[k] = true;
  localStorage.setItem(bossKey, JSON.stringify(kills));

  // A raid task is done when every boss on its list is dead. That rule lives
  // on the site because the boss list does, so the addon reports kills and
  // this derives the rest.
  const task = (typeof SECTIONS !== 'undefined')
    ? SECTIONS.flatMap(s => s.tasks).find(t => t.id === taskId)
    : null;
  if (task && task.bosses && task.bosses.every(b => kills[taskId + '_' + b.id])) {
    applyAutoTask(charName, taskId, { done: true }, source);
  }
  return true;
}

/* -------------------------------------------------------------------------
   The envelope
------------------------------------------------------------------------- */

/* Every envelope shape the site reads, and the version that goes with each.
   `fmt` and `v` are checked as a pair: an envelope claiming PLW2 at version 1
   is not a thing the addon produces, so it is a corrupted or hand-edited
   payload and refusing it is the honest answer.

   PLW1 is base64 of the JSON. PLW2 is the same JSON deflated first, and says
   so with a `PLW2:` prefix on the string itself. Both stay readable: an addon
   older than the site is a normal state, and the member is not the person who
   should have to work out which half is behind. */
const LEDGER_FORMATS = { PLW1: 1, PLW2: 2 };
const LEDGER_STATE_KEY = 'wow_mn_ledger_state';   // synced: last import, per device

function loadLedgerState()  { return JSON.parse(localStorage.getItem(LEDGER_STATE_KEY) || '{}'); }
function saveLedgerState(s) { localStorage.setItem(LEDGER_STATE_KEY, JSON.stringify(s)); }

/* Party Ledger's own key for a character: name and realm, lowercased, with
   spaces, apostrophes and hyphens stripped from the realm. Reproduced here so
   an envelope can be matched against the site's character list, which stores
   "Name" or "Name@realm-slug". */
function ledgerCharKey(name, realmSlug) {
  const realm = (realmSlug || '').replace(/[\s'’-]/g, '').toLowerCase();
  return (name || '').toLowerCase() + '-' + realm;
}

function ledgerMatchCharacter(envKey, envChar) {
  const chars = JSON.parse(localStorage.getItem('wow_midnight_chars') || '[]');

  // Exact match on the addon's own key is the reliable path.
  for (const c of chars) {
    if (ledgerCharKey(charDisplayName(c), loadCharRealmSlug(c)) === envKey) return c;
  }
  // Then the name and realm the envelope carries, in case the site stores the
  // realm differently from the way the addon normalises it.
  if (envChar && envChar.name) {
    for (const c of chars) {
      if (ledgerCharKey(charDisplayName(c), loadCharRealmSlug(c))
          === ledgerCharKey(envChar.name, envChar.realm)) return c;
    }
    // Last resort: a character added before realms were recorded at all.
    for (const c of chars) {
      if (!loadCharRealmSlug(c)
          && charDisplayName(c).toLowerCase() === envChar.name.toLowerCase()) return c;
    }
  }
  return null;
}

/* Split "PLW2:<base64>" into the transport it names and the payload itself.

   The prefix is on the string rather than only in a neighbouring field so
   that the paste box and the file read follow one rule, and so a member who
   pastes a bare string still gets the right answer. No prefix means PLW1,
   which is what the addon wrote before it started deflating. */
function ledgerSplitPayload(text) {
  const s = String(text || '').trim().replace(/\s+/g, '');
  const m = s.match(/^([A-Za-z][A-Za-z0-9]{0,7}):(.*)$/);
  return m ? { transport: m[1].toUpperCase(), body: m[2] } : { transport: 'PLW1', body: s };
}

/* atob hands back a string of char codes 0-255. The streams API wants bytes. */
function binaryToBytes(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* zlib, not raw deflate: the addon uses LibDeflate's CompressZlib, whose
   wrapper carries an Adler-32 checksum. That checksum is worth having on a
   path where the payload gets copied and pasted by hand, and it costs nothing
   here because DecompressionStream('deflate') is the zlib one. ('deflate-raw'
   is the unwrapped variant, and would fail on this input.)

   Async because that stream is the only inflater a page has without shipping
   one, which is why everything downstream of it is async too. */
async function ledgerInflate(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This browser cannot un-compress the sync string. Chrome, Edge, '
      + 'Firefox and Safari all can; a very old version of any of them cannot.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  try {
    return await new Response(stream).text();
  } catch (_) {
    throw new Error('The sync string is a compressed payload that would not un-compress. '
      + 'Copy it again from /ledger sync: part of it was probably lost in the paste.');
  }
}

/* The transport half: string in, JSON text out. */
async function ledgerPayloadToJson(text) {
  const { transport, body } = ledgerSplitPayload(text);

  if (!Object.prototype.hasOwnProperty.call(LEDGER_FORMATS, transport)) {
    throw new Error('This sync string says it is ' + transport + ', which this site does '
      + 'not read. Update the site, or the addon, so they match.');
  }

  let binary;
  try { binary = atob(body); }
  catch (_) { throw new Error('That does not look like a Party Ledger sync string.'); }

  if (transport === 'PLW1') return binary;
  return await ledgerInflate(binaryToBytes(binary));
}

/* The envelope half: JSON text in, checked envelope out. Kept separate from
   the transport so the worker and the tests can check an envelope they
   already hold without going through base64 again. */
function parseLedgerJson(json) {
  let env;
  try { env = JSON.parse(json); }
  catch (_) { throw new Error('The sync string decoded, but not into anything readable.'); }

  if (!env || !Object.prototype.hasOwnProperty.call(LEDGER_FORMATS, env.fmt || '')) {
    throw new Error('That is not a Party Ledger sync payload.');
  }
  // Refuse a version we do not know rather than guessing at its shape. An
  // addon newer than the site is a normal state, and a wrong guess would
  // silently tick the wrong boxes.
  if (env.v !== LEDGER_FORMATS[env.fmt]) {
    throw new Error('This payload says it is ' + env.fmt + ' at version ' + env.v
      + ', and ' + env.fmt + ' is version ' + LEDGER_FORMATS[env.fmt]
      + '. Copy it again from /ledger sync.');
  }
  return env;
}

async function parseLedgerEnvelope(text) {
  return parseLedgerJson(await ledgerPayloadToJson(text));
}

/* Merge a decoded envelope into local storage. Returns a report the UI can
   show, because "it worked" is not useful feedback for something that ticked
   eleven boxes across three characters. */
function applyLedgerEnvelope(env) {
  const report = {
    week: env.week, generated: env.generated, addon: env.addon,
    characters: [], unmatched: [], tasks: 0, bosses: 0, progressed: 0,
    collections: 0, ratings: env.ratings ? env.ratings.authored : 0,
    // By when the payload was generated, not by whether its week label
    // matches ours. The addon cannot know each region's exact reset hour, so
    // its label is advisory; the timestamp is the fact. This is also why an
    // EU member's addon does not need to be taught the EU reset.
    staleWeek: !isThisWeek(env.generated),
  };

  const knownTasks = new Set(SECTIONS.flatMap(s => s.tasks).map(t => t.id));

  for (const [envKey, envChar] of Object.entries(env.characters || {})) {
    const charName = ledgerMatchCharacter(envKey, envChar);
    if (!charName) {
      report.unmatched.push((envChar && envChar.name) || envKey);
      continue;
    }

    // Objectives are weekly, so an envelope from a previous reset must not
    // tick this week's boxes. Collections and ratings below are not weekly
    // and are applied regardless.
    let ticked = 0, bosses = 0, progressed = 0;
    if (!report.staleWeek) {
      for (const [taskId, task] of Object.entries(envChar.objectives || {})) {
        // The addon's task map lags the site's checklist by design. An id the
        // site no longer has is ignored, not an error.
        if (!knownTasks.has(taskId)) continue;
        // A tick the member made on the in-game display is a different
        // claim from one the game reported, so it is labelled differently:
        // "I did this" and "the game saw this" fail in different ways and
        // the badge on the task is where that gets explained.
        const source = task.src === 'manual' ? 'addon-manual' : 'addon';
        const result = applyAutoTask(charName, taskId, task, source);
        if (result.ticked) ticked++;
        if (result.progressed) progressed++;
      }
      for (const [taskId, bossMap] of Object.entries(envChar.bosses || {})) {
        if (!knownTasks.has(taskId)) continue;
        for (const bossId of Object.keys(bossMap || {})) {
          if (applyAutoBoss(charName, taskId, bossId, 'addon')) bosses++;
        }
      }
    }

    report.characters.push({ name: charName, tasks: ticked, bosses, progressed });
    report.tasks      += ticked;
    report.bosses     += bosses;
    report.progressed += progressed;
  }

  report.collections = applyLedgerCollections(env.collections);

  // Which of the member's lists is on screen in game. Recorded even when the
  // addon reports none, so a member who has cleared it in game stops being
  // told their in-game list is out of date.
  if (typeof noteAgendaListInGame === 'function') {
    noteAgendaListInGame(env.agenda || {});
    report.agenda = agendaListStatus();
  }

  if (env.ratings) saveLedgerRatings(env.ratings);

  const state = loadLedgerState();
  state.lastImport   = Date.now();
  state.lastGenerated = env.generated;
  state.addonVersion = env.addon;
  saveLedgerState(state);

  return report;
}

/* Collections are account-wide and permanent, so they tick the collectibles
   section on every character rather than the one that looted the mount. */
function applyLedgerCollections(collections, source) {
  if (!collections) return 0;
  source = source || 'addon';

  const byName = {};
  for (const t of SECTIONS.flatMap(s => s.tasks)) {
    if (t.collectable) byName[t.name.toLowerCase()] = t.id;
    if (t.mountName)   byName[String(t.mountName).toLowerCase()] = t.id;
  }
  const byAchievement = {};
  for (const t of SECTIONS.flatMap(s => s.tasks)) {
    if (t.achievementId) byAchievement[t.achievementId] = t.id;
  }

  const chars = JSON.parse(localStorage.getItem('wow_midnight_chars') || '[]');
  let applied = 0;

  const tick = (taskId) => {
    for (const c of chars) {
      if (applyAutoTask(c, taskId, { done: true }, source).ticked) applied++;
    }
  };

  for (const name of [].concat(collections.mounts || [], collections.toys || [])) {
    const taskId = byName[String(name).toLowerCase()];
    if (taskId) tick(taskId);
  }
  for (const id of (collections.achievements || [])) {
    const taskId = byAchievement[id];
    if (taskId) tick(taskId);
  }
  return applied;
}

/* Your own grades, kept for your own reading. Stored under one key so the
   existing cloud sync carries it without any change to sync.js, and so
   deleting it is one operation. */
function saveLedgerRatings(ratings) {
  localStorage.setItem('wow_mn_ledger_ratings', JSON.stringify(ratings));
}
function loadLedgerRatings() {
  return JSON.parse(localStorage.getItem('wow_mn_ledger_ratings') || 'null');
}

/* -------------------------------------------------------------------------
   Reading the file

   Chromium only. Everything here degrades to the paste box, which is why the
   capability check is a plain boolean the UI reads rather than a throw.
------------------------------------------------------------------------- */

function ledgerFileAccessSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/* Directory handles survive a reload but only in IndexedDB: they are
   structured-cloneable and not serialisable, so localStorage cannot hold one. */
const LEDGER_IDB = { name: 'azeroth-agenda', store: 'handles', key: 'wow-folder' };

function ledgerIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LEDGER_IDB.name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LEDGER_IDB.store)) db.createObjectStore(LEDGER_IDB.store);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function ledgerStoreHandle(handle) {
  const db = await ledgerIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEDGER_IDB.store, 'readwrite');
    tx.objectStore(LEDGER_IDB.store).put(handle, LEDGER_IDB.key);
    tx.oncomplete = () => resolve(true);
    tx.onerror    = () => reject(tx.error);
  });
}

async function ledgerLoadHandle() {
  try {
    const db = await ledgerIdb();
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(LEDGER_IDB.store, 'readonly');
      const req = tx.objectStore(LEDGER_IDB.store).get(LEDGER_IDB.key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => reject(req.error);
    });
  } catch (_) { return null; }
}

async function ledgerForgetHandle() {
  try {
    const db = await ledgerIdb();
    await new Promise((resolve) => {
      const tx = db.transaction(LEDGER_IDB.store, 'readwrite');
      tx.objectStore(LEDGER_IDB.store).delete(LEDGER_IDB.key);
      tx.oncomplete = resolve;
      tx.onerror    = resolve;
    });
  } catch (_) {}
  const state = loadLedgerState();
  delete state.folderName;
  saveLedgerState(state);
}

/* Walk WTF/Account/<ACCOUNT>/SavedVariables/PartyLedger.lua.

   The account folder is named after the member's Battle.net account and there
   can be several, so it is enumerated rather than assumed. A member who
   picked the wrong folder is the common failure, so the error says which
   folder was searched. */
async function ledgerFindSavedVariables(root) {
  const wtf = await root.getDirectoryHandle('WTF').catch(() => null);
  if (!wtf) {
    throw new Error('No WTF folder inside "' + root.name + '". Pick the folder that '
      + 'contains WTF, usually _retail_.');
  }
  const accounts = await wtf.getDirectoryHandle('Account').catch(() => null);
  if (!accounts) throw new Error('No WTF/Account folder inside "' + root.name + '".');

  const found = [];
  for await (const [name, handle] of accounts.entries()) {
    if (handle.kind !== 'directory') continue;
    const sv = await handle.getDirectoryHandle('SavedVariables').catch(() => null);
    if (!sv) continue;
    const file = await sv.getFileHandle('PartyLedger.lua').catch(() => null);
    if (file) found.push({ account: name, file });
  }

  if (!found.length) {
    throw new Error('No PartyLedger.lua under WTF/Account. Install the addon, log in, '
      + 'then log out or /reload so the game writes the file.');
  }
  // More than one account folder means more than one Battle.net account on
  // this machine. Newest file wins, which is the one just played on.
  if (found.length === 1) return found[0];

  const withTimes = await Promise.all(found.map(async (f) => ({
    ...f, modified: (await f.file.getFile()).lastModified,
  })));
  withTimes.sort((a, b) => b.modified - a.modified);
  return withTimes[0];
}

/* Pull the payload out of the Lua the game wrote.

   The addon stores it base64 in a single field precisely so this does not
   have to understand Lua string escaping, which is a client implementation
   detail. One capture, no parser. */
function extractLedgerPayload(luaText) {
  // The colon is in the class because the payload names its own transport
  // ("PLW2:..."). Leaving it out is not a graceful degradation: the pattern
  // simply stops matching, and the member is told the file has no payload in
  // it when the payload is right there.
  const match = luaText.match(/\["b64"\]\s*=\s*"([A-Za-z0-9+/=:]*)"/)
             || luaText.match(/\bb64\s*=\s*"([A-Za-z0-9+/=:]*)"/);
  if (!match || !match[1]) {
    throw new Error('Found PartyLedger.lua, but no sync payload in it. The bridge may be '
      + 'switched off in /ledger config, or the game has not written the file since '
      + 'you installed this version.');
  }
  return match[1];
}

async function ledgerEnsurePermission(handle) {
  if (!handle.queryPermission) return true;
  const opts = { mode: 'read' };
  if (await handle.queryPermission(opts) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

/* Ask for the folder once. The handle is remembered, so every later read is
   a button press with no picker. */
async function connectLedgerFolder() {
  if (!ledgerFileAccessSupported()) {
    showToast('This browser cannot read files directly. Use "Paste sync string" instead.');
    return null;
  }
  let root;
  try {
    root = await window.showDirectoryPicker({ id: 'wow-install', mode: 'read' });
  } catch (_) {
    return null;   // the member cancelled the picker: not an error
  }

  try {
    const found = await ledgerFindSavedVariables(root);
    await ledgerStoreHandle(root);
    const state = loadLedgerState();
    state.folderName = root.name;
    state.account    = found.account;
    saveLedgerState(state);
    return await readLedgerFromDisk({ silent: true });
  } catch (err) {
    showToast(err.message);
    return null;
  }
}

async function readLedgerFromDisk(opts) {
  opts = opts || {};
  const root = await ledgerLoadHandle();
  if (!root) {
    if (!opts.silent) showToast('Connect your WoW folder first.');
    return null;
  }
  if (!await ledgerEnsurePermission(root)) {
    showToast('Read access to the folder was declined.');
    return null;
  }

  try {
    const found = await ledgerFindSavedVariables(root);
    const file  = await found.file.getFile();
    const env   = await parseLedgerEnvelope(extractLedgerPayload(await file.text()));

    const report = applyLedgerEnvelope(env);
    report.fileModified = file.lastModified;
    // Not awaited: the local sync has already happened and is what the member
    // is watching for. The upload only matters to Discord.
    uploadLedgerEnvelope(env);

    const state = loadLedgerState();
    state.account = found.account;
    saveLedgerState(state);

    if (typeof render === 'function') render();
    if (typeof renderChars === 'function') renderChars();
    reportLedgerImport(report);
    return report;
  } catch (err) {
    showToast(err.message);
    return null;
  }
}

async function importLedgerFromPaste(text) {
  try {
    const env = await parseLedgerEnvelope(text);
    const report = applyLedgerEnvelope(env);
    uploadLedgerEnvelope(env);
    if (typeof render === 'function') render();
    if (typeof renderChars === 'function') renderChars();
    reportLedgerImport(report);
    return report;
  } catch (err) {
    showToast(err.message);
    return null;
  }
}

function reportLedgerImport(report) {
  if (!report) return;

  if (report.staleWeek) {
    const when = report.generated
      ? new Date(report.generated * 1000).toLocaleString()
      : 'an earlier week';
    showToast('That payload was written ' + when + ', before this week\'s reset. '
      + 'Collections were applied; weekly objectives were not. Log in and /reload to refresh it.');
    return;
  }
  if (!report.characters.length && report.unmatched.length) {
    showToast('Synced, but none of the characters matched: ' + report.unmatched.join(', ')
      + '. Add them to your roster, or set their realms, and sync again.');
    return;
  }

  const parts = [];
  if (report.tasks)       parts.push(report.tasks + ' objective' + (report.tasks === 1 ? '' : 's'));
  if (report.bosses)      parts.push(report.bosses + ' boss kill' + (report.bosses === 1 ? '' : 's'));
  if (report.collections) parts.push(report.collections + ' collectible' + (report.collections === 1 ? '' : 's'));
  if (report.progressed)  parts.push(report.progressed + ' counter' + (report.progressed === 1 ? '' : 's'));

  let message = parts.length ? 'Synced from Party Ledger: ' + parts.join(', ') + '.'
                             : 'Synced from Party Ledger: nothing new.';
  if (report.unmatched.length) {
    message += ' Not matched: ' + report.unmatched.join(', ') + '.';
  }
  showToast(message);
}

/* How stale the last import is, for the connect panel. */
function ledgerStatusText() {
  const state = loadLedgerState();
  if (!state.lastImport) return null;

  const minutes = Math.floor((Date.now() - state.lastImport) / 60000);
  let when;
  if (minutes < 1)        when = 'just now';
  else if (minutes < 60)  when = minutes + ' min ago';
  else if (minutes < 1440) when = Math.floor(minutes / 60) + 'h ago';
  else                    when = Math.floor(minutes / 1440) + 'd ago';

  // The generated timestamp is what actually matters: the file only changes
  // when the game writes it, so a recent import of an old file is still old.
  let detail = '';
  if (state.lastGenerated) {
    const age = Math.floor((Date.now() / 1000 - state.lastGenerated) / 3600);
    detail = age < 1 ? ' · game data under an hour old'
                     : ' · game data ' + age + 'h old, /reload in game to refresh';
  }
  return 'Last synced ' + when + detail;
}

/* -------------------------------------------------------------------------
   Uploading to the cloud

   Tabard reads the envelope from the worker, not from the browser, so the
   decoded payload has to get there. Best effort: a failure here costs the
   Discord card, not the local sync that just succeeded.
------------------------------------------------------------------------- */

async function uploadLedgerEnvelope(env) {
  try {
    const res = await fetch('/api/ledger', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(env),
    });
    if (res.status === 401) return false;   // signed out: local sync still stands
    if (res.status === 413) {
      showToast('Synced locally. The payload is too large to share with Discord; '
        + 'turn off grade sharing in /ledger config to shrink it.');
      return false;
    }
    return res.ok;
  } catch (_) {
    return false;
  }
}

async function deleteCloudLedger() {
  try { await fetch('/api/ledger', { method: 'DELETE' }); } catch (_) {}
  localStorage.removeItem('wow_mn_ledger_ratings');
  const state = loadLedgerState();
  delete state.lastImport;
  delete state.lastGenerated;
  saveLedgerState(state);
  showToast('Removed the stored ledger. Discord can no longer read it.');
  renderLedgerModal();
}

/* -------------------------------------------------------------------------
   Consent
------------------------------------------------------------------------- */

let _ledgerConsent = null;

async function loadConsent() {
  try {
    const res = await fetch('/api/consent');
    if (!res.ok) return null;
    _ledgerConsent = await res.json();
    return _ledgerConsent;
  } catch (_) { return null; }
}

async function setConsentScope(scope, on) {
  try {
    const res = await fetch('/api/consent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopes: { [scope]: on } }),
    });
    if (!res.ok) { showToast('Could not save that. Are you still signed in?'); return; }
    _ledgerConsent = await res.json();
    renderLedgerModal();
  } catch (_) {
    showToast('Could not save that. Check your connection.');
  }
}

/* -------------------------------------------------------------------------
   The modal
------------------------------------------------------------------------- */

async function openLedgerModal() {
  document.getElementById('modal-ledger').classList.add('open');
  renderLedgerModal();
  await loadConsent();
  renderLedgerModal();
}

function closeLedgerModal() {
  document.getElementById('modal-ledger').classList.remove('open');
}

function _consentRow(scope, title, body) {
  const on = !!(_ledgerConsent && _ledgerConsent.scopes && _ledgerConsent.scopes[scope]);
  return '<label class="ledger-consent">'
    + '<input type="checkbox" ' + (on ? 'checked' : '')
    + ' onchange="setConsentScope(\'' + scope + '\', this.checked)">'
    + '<span class="ledger-consent-copy"><strong>' + title + '</strong>'
    + '<span>' + body + '</span></span>'
    + '</label>';
}

function renderLedgerModal() {
  const el = document.getElementById('ledger-modal-content');
  if (!el) return;

  const state  = loadLedgerState();
  const status = ledgerStatusText();
  const canReadFiles = ledgerFileAccessSupported();

  let html = '';

  /* ── Connect ── */
  html += '<div class="ledger-block">';
  html += '<h4>Party Ledger addon</h4>';
  html += '<p class="ledger-note">The addon records boss kills, keys, delves and '
        + 'collectibles as you earn them, and this reads that file. An addon cannot '
        + 'send anything anywhere, so nothing leaves your machine until you hand it over here.</p>';

  if (status) html += '<p class="ledger-status"><i class="ph-fill ph-check-circle"></i>' + status + '</p>';

  if (canReadFiles) {
    if (state.folderName) {
      html += '<p class="ledger-status"><i class="ph ph-folder-open"></i>Reading from <code>'
            + escHtml(state.folderName) + '</code>'
            + (state.account ? ' · account <code>' + escHtml(state.account) + '</code>' : '')
            + '</p>';
      html += '<div class="ledger-btns">'
            + '<button class="btn-primary" onclick="readLedgerFromDisk()">Sync now</button>'
            + '<button class="btn-cancel" onclick="ledgerForgetHandle().then(renderLedgerModal)">Forget folder</button>'
            + '</div>';
    } else {
      html += '<div class="ledger-btns">'
            + '<button class="btn-primary" onclick="connectLedgerFolder().then(renderLedgerModal)">'
            + 'Connect your WoW folder</button></div>';
      html += '<p class="ledger-note">Pick the folder that contains <code>WTF</code>, '
            + 'usually <code>_retail_</code>. You are asked once; after that syncing is one button.</p>';
    }
  } else {
    html += '<p class="ledger-note"><i class="ph-fill ph-warning"></i> This browser cannot read '
          + 'files directly. Chrome or Edge can. Otherwise use the paste box below, which works everywhere.</p>';
  }

  /* ── Paste ── */
  html += '<details class="ledger-paste"' + (canReadFiles ? '' : ' open') + '>';
  html += '<summary>Paste a sync string instead</summary>';
  html += '<p class="ledger-note">Run <code>/ledger sync</code> in game and copy what it shows you.</p>';
  html += '<textarea id="ledger-paste-box" rows="4" placeholder="eyJmbXQiOiJQTFcxIi..."></textarea>';
  html += '<div class="ledger-btns"><button class="btn-primary" onclick="_ledgerPasteSubmit()">Sync from string</button></div>';
  html += '</details>';
  html += '</div>';

  /* ── The list, going the other way ──────────────────────────────────────
     The half that was missing. The addon reports what the game saw; without
     this it had no idea what the member was actually trying to do, so there
     was no to-do list in game to report against. */
  html += '<div class="ledger-block">';
  html += '<h4>Your list, in game</h4>';
  html += '<p class="ledger-note">Party Ledger can show the tasks you have starred '
        + 'on a heads-up display in game, grouped by activity, and tick off the ones '
        + 'the game can confirm. Paste this into <code>/ledger list import</code>.</p>';

  const listStatus = (typeof agendaListStatus === 'function') ? agendaListStatus() : null;
  if (listStatus) {
    const icon = { current: 'ph-fill ph-check-circle', stale: 'ph-fill ph-warning',
                   never: 'ph ph-arrow-square-out', empty: 'ph ph-star' }[listStatus.state];
    html += '<p class="ledger-listout-status ledger-listout-' + listStatus.state + '">'
          + '<i class="' + icon + '"></i><span>' + escHtml(listStatus.text) + '</span></p>';
  }

  if (!listStatus || listStatus.state !== 'empty') {
    html += '<div class="ledger-btns">'
          + '<button class="btn-primary" onclick="_agendaListCopy()">'
          + '<i class="ph-fill ph-copy"></i>Copy list for the addon</button>'
          + '<button class="btn-cancel" onclick="_agendaListShow()">Show it</button>'
          + '</div>';
    // Rendered empty and filled on demand: the payload is a few kilobytes of
    // base64 and putting it on screen every time the modal opens is noise in
    // front of the button that actually does the job.
    html += '<textarea id="agenda-list-box" class="ledger-listout-box" rows="3" '
          + 'readonly hidden></textarea>';
  }
  html += '</div>';

  /* ── Discord ── */
  html += '<div class="ledger-block">';
  html += '<h4>Share with Discord</h4>';
  html += '<p class="ledger-note">Tabard reads these from here when you run a command. '
        + 'Everything is off until you turn it on, and turning one off takes effect immediately.</p>';

  html += _consentRow('agenda.weekly', 'Weekly progress',
    'Lets <code>/agenda</code> show how far through your list you are. Your characters, '
    + 'their item level and what you have ticked off this week.');
  html += _consentRow('rating.self', 'Your own grades, shown only to you',
    'Lets <code>/rating</code> tell you what <em>you</em> thought of a player, privately. '
    + 'Nobody else can see it, and nobody can look up what anyone else thought.');
  html += _consentRow('rating.profile', 'Your grading profile',
    'Publishes how <em>you</em> grade: how many players, the spread, how many runs. '
    + 'It says something about you and nothing about anyone you graded.');

  html += '<p class="ledger-note ledger-limit"><i class="ph-fill ph-info"></i> '
        + 'There is no way to look up what the guild thinks of a player, and there is not '
        + 'going to be. Party Ledger records what <em>you</em> thought of people; it keeps no '
        + 'pooled reputation, and building one would make the guild answerable for a record '
        + 'on people who never agreed to be in it.</p>';

  if (state.lastImport) {
    html += '<div class="ledger-btns"><button class="btn-cancel" onclick="deleteCloudLedger()">'
          + 'Delete the stored ledger</button></div>';
  }
  html += '</div>';

  el.innerHTML = html;
}

/* Copy straight to the clipboard where the browser allows it, and fall back
   to showing the string with it selected. The clipboard API needs a user
   gesture and a permission, and both can be absent for reasons that have
   nothing to do with this site. */
async function _agendaListCopy() {
  const built = await encodeAgendaList();
  if (!built.tasks) { showToast('Star a few tasks first.'); return; }

  let copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(built.payload);
      copied = true;
    }
  } catch (_) { /* fall through to showing it */ }

  const box = document.getElementById('agenda-list-box');
  if (box) {
    box.value = built.payload;
    box.hidden = false;
    if (!copied) { box.focus(); box.select(); }
  }
  showToast(copied
    ? built.tasks + ' task' + (built.tasks === 1 ? '' : 's') + ' copied. Paste it into /ledger list import.'
    : 'Select the string below and copy it, then paste it into /ledger list import.');
}

async function _agendaListShow() {
  const built = await encodeAgendaList();
  const box = document.getElementById('agenda-list-box');
  if (!box) return;
  box.value = built.payload;
  box.hidden = false;
  box.focus();
  box.select();
}

async function _ledgerPasteSubmit() {
  const box = document.getElementById('ledger-paste-box');
  if (!box || !box.value.trim()) { showToast('Paste the string from /ledger sync first.'); return; }
  const report = await importLedgerFromPaste(box.value);
  if (report) {
    box.value = '';
    renderLedgerModal();
  }
}
