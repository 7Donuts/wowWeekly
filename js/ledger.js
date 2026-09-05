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

  /* The same observation, to the server, which is what lets another device
     and the Discord card see it without this browser being opened again.

     Sent whether or not anything changed locally. "Changed" here means
     changed on THIS device, and a box this device already had ticked can
     still be news to the server; the merge rules make a repeat a no-op
     rather than a write. The source travels as-is, so the server records
     which of the four ticked it and the badge keeps meaning something. */
  if (typeof observeTask === 'function') {
    const out = {};
    if (fields.done) out.done = true;
    if (typeof fields.value === 'number') out.value = fields.value;
    if (out.done !== undefined || out.value !== undefined) {
      observeTask(charName, taskId, out, source === 'addon-manual' ? 'member-game' : source);
    }
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

  // The kill itself, as a fact. The task tick derived from it goes through
  // applyAutoTask below, which reports separately: the boss list is here and
  // not in the worker.
  if (typeof observeBoss === 'function') {
    observeBoss(charName, taskId, bossId, source === 'addon-manual' ? 'member-game' : source);
  }

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
      // Name and realm, not just a label. The envelope already knows both,
      // and making the member retype what we were just handed is the reason
      // "none of your characters matched" used to be a dead end.
      report.unmatched.push({
        key:   envKey,
        name:  (envChar && envChar.name) || envKey,
        realm: (envChar && envChar.realm) || '',
      });
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

  // Everything the envelope produced is queued by now, so send it in one
  // request rather than letting the debounce fire mid-import: an envelope can
  // tick eleven boxes across three characters, and eleven requests for one
  // paste is not a sync, it is a stampede.
  if (typeof flushObservations === 'function') flushObservations();

  if (env.ratings) saveLedgerRatings(env.ratings);

  const state = loadLedgerState();
  state.lastImport   = Date.now();
  state.lastGenerated = env.generated;
  state.addonVersion = env.addon;
  // Held so the modal can offer to add them. Overwritten every import, never
  // merged: a character that matched this time is not still unmatched, and a
  // stale entry would offer to add a roster member who is already there.
  state.unmatched = report.unmatched;
  // What the addon says it can tick, as opposed to what it just did. Kept
  // when an envelope omits it, so an older addon does not erase the answer.
  if (Array.isArray(env.covers)) state.covers = env.covers;
  saveLedgerState(state);

  return report;
}

/* -------------------------------------------------------------------------
   Getting the addon, and knowing when it is old

   The page has always told members to install an addon and never said where
   to get one. A manual install has no updater behind it either, so a member
   running a version from four months ago sees boxes failing to tick and has
   no way to connect that to the cause.

   The envelope already reports the version it came from, so the only missing
   half was what the current one is. Fetched once per page and cached, and
   entirely optional: an unanswered lookup means the page says nothing about
   updates rather than showing an error about a request nobody asked for.
------------------------------------------------------------------------- */

let _addonRelease = null;

async function loadAddonRelease() {
  if (_addonRelease) return _addonRelease;
  try {
    const res = await fetch('/api/addon');
    if (!res.ok) return null;
    const data = await res.json();
    _addonRelease = (data && data.version) ? data : null;
  } catch (_) { _addonRelease = null; }
  return _addonRelease;
}

/* Compare two dotted versions numerically.

   String comparison gets this wrong at exactly the point it starts to matter:
   "0.9.0" sorts after "0.11.0", so the member who most needs telling is the
   one told they are up to date. Segments are compared as numbers, a missing
   segment counts as zero so "1.2" and "1.2.0" are equal, and anything
   non-numeric makes the whole comparison unanswerable rather than guessed at.

   Returns -1, 0, 1, or null when either side is not a version. */
function compareVersions(a, b) {
  const parse = (v) => {
    const parts = String(v == null ? '' : v).trim().replace(/^v/, '').split('.');
    if (!parts.length || parts.some((p) => !/^\d+$/.test(p))) return null;
    return parts.map(Number);
  };
  const left = parse(a), right = parse(b);
  if (!left || !right) return null;

  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const l = left[i] || 0, r = right[i] || 0;
    if (l !== r) return l < r ? -1 : 1;
  }
  return 0;
}

/* Is the addon that sent us the last envelope behind the current release?

   Only answers when both versions are known and comparable. A member who has
   never synced is not "out of date", they have not started, and telling them
   about an update would be answering a question they have not reached. */
function addonUpdateState() {
  const installed = loadLedgerState().addonVersion;
  const latest    = _addonRelease && _addonRelease.version;
  if (!latest) return { latest: null };
  if (!installed) return { latest, installed: null, behind: false };

  const cmp = compareVersions(installed, latest);
  return { latest, installed, behind: cmp === -1, unknown: cmp === null };
}

/* -------------------------------------------------------------------------
   Which tier answers which task

   There are two automatic sources and they answer different questions.

     Battle.net    raid kills, keys, gear, collections, the roster itself.
                   Needs nothing installed and no reload, but it can only
                   see what Blizzard chose to expose, and it is silent for
                   anyone not signed in.

     Party Ledger  delves, world content, currencies, and everything the
                   ledger is actually for. Sees whatever the client sees,
                   but only reaches the site through a file the game writes
                   at a reload.

   Everything else is the member's to tick by hand, and there is nothing
   wrong with that: most of the checklist is things only a person can confirm.
   What was wrong was that none of this was visible, so a box that did not
   tick looked the same whichever of the three reasons applied, and the addon
   looked mandatory for a list it is mostly not needed for.

   Neither tier is described here. Each reports what it covers in its own
   payload (`covers`), because a list on this side of what the addon can do
   would be wrong the first time TaskMap.lua gains a row, and the same in
   reverse. This only subtracts one from the other.
------------------------------------------------------------------------- */

/* Task ids the Battle.net tier says it answers, for one character.

   Per character, because raid coverage comes out of that character's own
   encounters document. A character never synced has no declaration and is
   correctly reported as covered by nothing: we do not know yet. */
function blizzardCoverage(charName) {
  const armory = (typeof loadArmoryData === 'function') ? loadArmoryData(charName) : null;
  const covers = new Set(armory && Array.isArray(armory.covers) ? armory.covers : []);

  // Collections are account-wide and are answered by /api/collections rather
  // than by the per-character armory call, so they are added here rather than
  // declared by that response. The rule is a property of the task: a task
  // satisfied by owning something is one the profile API can see.
  if (covers.size && typeof SECTIONS !== 'undefined') {
    for (const t of SECTIONS.flatMap((s) => s.tasks)) {
      if (t.collectable || t.mountName) covers.add(t.id);
    }
  }
  return covers;
}

/* Task ids the addon says it can tick, from the last envelope it sent. */
function addonCoverage() {
  const state = loadLedgerState();
  return new Set(Array.isArray(state.covers) ? state.covers : []);
}

/* Per-task provenance for one character's starred list.

   Returns counts and the per-task answer, so a caller can render either a
   summary sentence or a badge on a row. "blizzard" wins over "addon" where
   both cover a task, because it is the tier that needs nothing of the member.

   `addonKnown` is false when no envelope has ever arrived. In that state
   every uncovered task is reported as `unknown` rather than `manual`: we
   cannot tell "the addon would do this for you" from "nobody can do this",
   and guessing the second would talk a member out of installing the thing
   that would have helped. */
function taskCoverage(charName) {
  charName = charName || currentChar;
  const blizzard = blizzardCoverage(charName);
  const addon    = addonCoverage();
  const addonKnown = addon.size > 0;

  const list = JSON.parse(localStorage.getItem('wow_mn_yourlist_' + charName) || '[]');
  const hidden = JSON.parse(localStorage.getItem('wow_mn_hidden_' + charName) || '{}');

  const by = {};
  const counts = { blizzard: 0, addon: 0, manual: 0, unknown: 0, total: 0 };

  for (const id of list) {
    if (hidden[id]) continue;
    counts.total++;
    let tier;
    if (blizzard.has(id))      tier = 'blizzard';
    else if (addon.has(id))    tier = 'addon';
    else if (addonKnown)       tier = 'manual';
    else                       tier = 'unknown';
    by[id] = tier;
    counts[tier]++;
  }

  return { by, counts, addonKnown, blizzardKnown: blizzard.size > 0 };
}

/* The summary sentence, or null when there is nothing worth saying.

   Deliberately not four numbers in a row. The member is deciding one thing,
   which is whether they need to go and do something, so the sentence leads
   with how much is already handled for them. */
function coverageSummary(charName) {
  const cov = taskCoverage(charName);
  if (!cov.counts.total) return null;

  const c = cov.counts;
  const parts = [];
  if (c.blizzard) parts.push(c.blizzard + ' live from Battle.net');
  if (c.addon)    parts.push(c.addon + ' from the addon');
  if (c.manual)   parts.push(c.manual + ' yours to tick');
  if (c.unknown)  parts.push(c.unknown + ' unknown until the addon syncs once');

  return { ...cov, text: parts.join(', ') + '.' };
}

/* Add a character the envelope named and the roster does not have.

   Mirrors the non-rename branch of saveChar() in app.js rather than calling
   it, because that one reads the add-character modal's inputs and its class
   and group pickers, none of which are open here. What the envelope gives us
   is a name and a realm, so that is what gets written; class arrives on its
   own from the next armory sync. */
function ledgerAddCharacter(name, realm) {
  if (!name) return null;
  const slug = typeof realmToSlug === 'function' ? realmToSlug(realm || '') : '';
  const id   = typeof charIdentifier === 'function' ? charIdentifier(name, slug) : name;

  const roster = JSON.parse(localStorage.getItem('wow_midnight_chars') || '[]');
  if (!roster.includes(id)) {
    roster.push(id);
    localStorage.setItem('wow_midnight_chars', JSON.stringify(roster));
    // app.js holds the roster in a module-level `characters` that every
    // renderer reads. Writing localStorage alone leaves the page showing the
    // old list until a refresh. `let` in another script means a bare typeof
    // still throws while that script is in its temporal dead zone, which this
    // is not called during but is one script-reorder away from being.
    try { if (Array.isArray(characters)) characters.push(id); } catch (_) {}
  }
  if (realm) {
    if (typeof saveCharRealm === 'function')     saveCharRealm(id, realm);
    if (typeof saveCharRealmSlug === 'function') saveCharRealmSlug(id, slug);
  }

  // Drop it from the held list so the modal stops offering it.
  const state = loadLedgerState();
  state.unmatched = (state.unmatched || []).filter((u) => (u.name || u) !== name);
  saveLedgerState(state);

  return id;
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

  for (const name of (collections.mounts || [])) {
    if (typeof observeCollection === 'function') observeCollection('mount', String(name), source);
    const taskId = byName[String(name).toLowerCase()];
    if (taskId) tick(taskId);
  }
  for (const name of (collections.toys || [])) {
    if (typeof observeCollection === 'function') observeCollection('toy', String(name), source);
    const taskId = byName[String(name).toLowerCase()];
    if (taskId) tick(taskId);
  }
  for (const id of (collections.achievements || [])) {
    if (typeof observeCollection === 'function') observeCollection('achievement', String(id), source);
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
  // The automatic paths must never open a permission prompt. Chrome only
  // grants one inside a user gesture, so a prompt raised from a timer is
  // either ignored or, worse, spends the member's one chance to say yes on a
  // moment they were not looking at the page.
  const permitted = opts.quiet ? await ledgerPermissionGranted(root)
                               : await ledgerEnsurePermission(root);
  if (!permitted) {
    if (!opts.quiet) showToast('Read access to the folder was declined.');
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
    // What the automatic reader compares against. Without it every poll
    // re-reads and re-applies a file nothing has touched.
    state.fileModified = file.lastModified;
    saveLedgerState(state);

    if (typeof render === 'function') render();
    if (typeof renderChars === 'function') renderChars();
    // A quiet read is one nobody asked for, so it only speaks when it has
    // news. "Nothing new" is the expected result of a poll and saying it
    // every ten seconds would make the toast useless for everything else.
    if (!opts.quiet || ledgerReportIsNews(report)) reportLedgerImport(report);
    updateLedgerButton();
    return report;
  } catch (err) {
    if (!opts.quiet) showToast(err.message);
    return null;
  }
}

/* -------------------------------------------------------------------------
   Reading it without being asked

   The handle is already in IndexedDB and a read is one getFile(), so making
   the member open a modal and press a button for it was a choice, not a
   constraint. This removes that choice: on load, on returning to the tab, and
   while the tab is visible, the file's timestamp is checked and a newer file
   is applied silently.

   Two rules keep it from being intrusive:

     Nothing here ever requests permission. queryPermission is read-only and
     answers without a prompt; when the answer is anything but granted the
     automatic path stands down and the button label says so, which is a
     click the member makes when they are ready.

     Nothing here says "nothing new". A poll that reports every time it ran
     is noise, and the whole point is that a successful sync should feel like
     it did not happen.

   The game writes the file at logout or /reload and at no other time, so
   watching it is watching for exactly one event, and ten seconds is well
   inside the time it takes to alt-tab after a reload.
------------------------------------------------------------------------- */

const LEDGER_WATCH_MS = 10000;
let _ledgerWatchTimer = null;
let _ledgerBusy = false;

/* Read-only permission check. Never prompts, so it is safe from a timer. */
async function ledgerPermissionGranted(handle) {
  if (!handle) return false;
  if (!handle.queryPermission) return true;
  try {
    return await handle.queryPermission({ mode: 'read' }) === 'granted';
  } catch (_) { return false; }
}

/* Did this import change anything the member would want told about? */
function ledgerReportIsNews(report) {
  if (!report) return false;
  return !!(report.tasks || report.bosses || report.collections || report.progressed
            || report.staleWeek || (report.unmatched && report.unmatched.length));
}

/* The file's mtime, or null for every reason it might not be readable. Cheap
   enough to call on a timer: it opens no file contents. */
async function ledgerPeekModified() {
  const root = await ledgerLoadHandle();
  if (!root) return null;
  if (!await ledgerPermissionGranted(root)) return null;
  try {
    const found = await ledgerFindSavedVariables(root);
    return (await found.file.getFile()).lastModified;
  } catch (_) { return null; }
}

/* Sync if, and only if, the game has written the file since we last read it.

   `force` is for the first check of a session, where the stored timestamp may
   be from a previous browser session that read a file this device has since
   replaced, and for the moment a folder is first connected. */
async function ledgerAutoSync(opts) {
  opts = opts || {};
  if (_ledgerBusy) return null;
  if (!ledgerFileAccessSupported()) return null;

  _ledgerBusy = true;
  try {
    const modified = await ledgerPeekModified();
    if (modified === null) return null;

    const seen = loadLedgerState().fileModified || 0;
    if (!opts.force && modified <= seen) return null;

    return await readLedgerFromDisk({ silent: true, quiet: true });
  } finally {
    _ledgerBusy = false;
    updateLedgerButton();
  }
}

/* Poll only while the tab is visible. A background tab is a browser the
   member is not looking at, and the answer would be stale by the time they
   were, so the visibility handler re-checks on the way back in instead. */
function startLedgerWatch() {
  if (typeof document === 'undefined') return;
  if (_ledgerWatchTimer) return;

  const tick = () => {
    if (document.hidden) return;
    ledgerAutoSync();
  };
  _ledgerWatchTimer = setInterval(tick, LEDGER_WATCH_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    // Coming back to the tab is the single most likely moment for the file to
    // have changed, because the member has just alt-tabbed out of the game.
    ledgerAutoSync();
    updateLedgerButton();
  });
}

/* -------------------------------------------------------------------------
   The ambient signal

   Everything the member needs to know about sync state used to live inside a
   modal, which meant the answer to "is this current" required opening the
   thing that would have told you. The account button is on screen already.
------------------------------------------------------------------------- */

function ledgerButtonState() {
  const state = loadLedgerState();
  if (!state.lastImport) {
    return { state: 'never', label: 'Addon & Discord',
             title: 'Connect the Party Ledger addon to sync what you did in game.' };
  }

  // Age of the data, not of the read. A read a second ago of a file the game
  // wrote yesterday is a day old, and that is the number that decides whether
  // the member should go and /reload.
  const hours = state.lastGenerated
    ? Math.floor((Date.now() / 1000 - state.lastGenerated) / 3600)
    : null;

  const listStatus = (typeof agendaListStatus === 'function') ? agendaListStatus() : null;
  if (listStatus && listStatus.state === 'stale') {
    return { state: 'list-stale', label: 'List out of date in game',
             title: listStatus.text };
  }

  if (hours === null) {
    return { state: 'synced', label: 'Addon synced', title: ledgerStatusText() || '' };
  }
  if (hours >= 12) {
    return { state: 'stale', label: 'Game data ' + hours + 'h old',
             title: 'The addon writes its file at logout or /reload. Run /reload in game '
                  + 'to refresh it; this page picks it up on its own.' };
  }
  if (hours >= 1) {
    return { state: 'aging', label: 'Synced · ' + hours + 'h old',
             title: ledgerStatusText() || '' };
  }
  return { state: 'fresh', label: 'Addon synced', title: ledgerStatusText() || '' };
}

function updateLedgerButton() {
  if (typeof document === 'undefined') return;
  const label = document.getElementById('ledger-btn-label');
  if (!label) return;

  const s = ledgerButtonState();
  label.textContent = s.label;

  const btn = document.getElementById('btn-ledger');
  if (btn) {
    if (s.title) btn.title = s.title;
    if (btn.dataset) btn.dataset.ledgerState = s.state;
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
    updateLedgerButton();
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
  const unmatchedNames = (report.unmatched || []).map((u) => (u && u.name) || u);

  if (!report.characters.length && unmatchedNames.length) {
    showToast('Synced, but none of the characters matched: ' + unmatchedNames.join(', ')
      + '. Open Addon & Discord to add them in one click.');
    return;
  }

  const parts = [];
  if (report.tasks)       parts.push(report.tasks + ' objective' + (report.tasks === 1 ? '' : 's'));
  if (report.bosses)      parts.push(report.bosses + ' boss kill' + (report.bosses === 1 ? '' : 's'));
  if (report.collections) parts.push(report.collections + ' collectible' + (report.collections === 1 ? '' : 's'));
  if (report.progressed)  parts.push(report.progressed + ' counter' + (report.progressed === 1 ? '' : 's'));

  let message = parts.length ? 'Synced from Party Ledger: ' + parts.join(', ') + '.'
                             : 'Synced from Party Ledger: nothing new.';
  if (unmatchedNames.length) {
    message += ' Not matched: ' + unmatchedNames.join(', ') + '.';
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
  // Painted immediately from what is already known, then repainted as the two
  // lookups land. Neither is worth a spinner: the panel is useful without
  // either, and a modal that opens empty while it waits on GitHub is worse
  // than one that fills in.
  renderLedgerModal();
  await Promise.all([
    loadConsent(),
    loadAddonRelease(),
  ]);
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

  /* ── What answers what ──────────────────────────────────────────────────
     First, because it is the thing that decides whether the member needs to
     read the rest of this at all. */
  const cov = coverageSummary();
  if (cov) {
    html += '<div class="ledger-block ledger-coverage">';
    html += '<h4>Your list, and what keeps it current</h4>';
    html += '<p class="ledger-note">' + escHtml(cov.text) + '</p>';
    html += '<ul class="ledger-tiers">';
    html += '<li class="tier-blizzard"><i class="ph-fill ph-lightning"></i>'
          + '<span><strong>' + cov.counts.blizzard + ' from Battle.net.</strong> '
          + 'Raid kills, keys, gear and collections. Nothing to install and no reload: '
          + 'this refreshes whenever you open the page.</span></li>';
    html += '<li class="tier-addon"><i class="ph-fill ph-plug"></i>'
          + '<span><strong>' + cov.counts.addon + ' from the addon.</strong> '
          + 'Delves, world content and currencies, which Blizzard does not publish. '
          + 'These move when the game writes its file, at a <code>/reload</code> or a logout.</span></li>';
    if (cov.counts.manual) {
      html += '<li class="tier-manual"><i class="ph ph-hand-pointing"></i>'
            + '<span><strong>' + cov.counts.manual + ' yours to tick.</strong> '
            + 'Nothing can confirm these from outside your own head, which is not a '
            + 'gap to be closed.</span></li>';
    }
    if (cov.counts.unknown) {
      html += '<li class="tier-unknown"><i class="ph ph-question"></i>'
            + '<span><strong>' + cov.counts.unknown + ' not yet known.</strong> '
            + 'The addon has not told us what it can tick. Sync once and this '
            + 'splits into the two rows above.</span></li>';
    }
    html += '</ul>';
    if (!cov.blizzardKnown) {
      html += '<p class="ledger-note"><i class="ph-fill ph-warning"></i> '
            + 'Not signed in to Battle.net, so none of the first row is running. '
            + 'Connecting it is the fastest thing you can do here.</p>';
    }
    html += '</div>';
  }

  /* ── Connect ── */
  html += '<div class="ledger-block">';
  html += '<h4>Party Ledger addon</h4>';
  html += '<p class="ledger-note">The addon records boss kills, keys, delves and '
        + 'collectibles as you earn them, and this reads that file. An addon cannot '
        + 'send anything anywhere, so nothing leaves your machine until you hand it over here.</p>';

  /* Where to get it, which this panel never said.
     Rendered whether or not the release lookup answered: a member without the
     addon needs the instructions more than they need a version number, and a
     GitHub link that is one click further away still beats no link. */
  const rel = addonUpdateState();
  if (!state.lastImport) {
    html += '<div class="ledger-install">';
    html += '<ol>';
    html += '<li>Download <code>PartyLedger-' + escHtml(rel.latest || 'latest')
          + '.zip</code>' + (rel.latest ? '' : ' from the releases page') + '.</li>';
    html += '<li>Unzip it into <code>World of Warcraft/_retail_/Interface/AddOns</code>, '
          + 'so you end up with an <code>AddOns/PartyLedger</code> folder.</li>';
    html += '<li>Log in and play. Then <code>/reload</code>, which is when the game '
          + 'writes the file this page reads.</li>';
    html += '<li>Come back and connect your WoW folder below.</li>';
    html += '</ol>';
    html += '<div class="ledger-btns">'
          + '<a class="btn-primary" href="' + escHtml(
              (_addonRelease && (_addonRelease.zip || _addonRelease.url))
              || 'https://github.com/7Donuts/rateaplayer/releases/latest')
          + '" target="_blank" rel="noopener"><i class="ph-fill ph-download-simple"></i>'
          + 'Download the addon</a></div>';
    html += '<p class="ledger-note">If you use WoWUp, add '
          + '<code>github.com/7Donuts/rateaplayer</code> as an addon source and it '
          + 'will keep this updated for you.</p>';
    html += '</div>';
  } else if (rel.behind) {
    // The case a manual install has no other way to discover. Boxes that stop
    // ticking after a season change look like a broken addon rather than an
    // old one, and nothing else on either side would say which.
    html += '<p class="ledger-note ledger-update"><i class="ph-fill ph-arrow-circle-up"></i> '
          + 'Your addon reported <strong>' + escHtml(rel.installed) + '</strong> and '
          + '<strong>' + escHtml(rel.latest) + '</strong> is out. '
          + '<a href="' + escHtml((_addonRelease && (_addonRelease.zip || _addonRelease.url)) || '#')
          + '" target="_blank" rel="noopener">Get it</a>, unzip over the old folder, '
          + 'and <code>/reload</code>.</p>';
  }

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
      html += '<p class="ledger-note">This reads the file on its own when you come back to '
            + 'the tab, and while the tab is open. The game only writes it at logout or '
            + '<code>/reload</code>, so a <code>/reload</code> in game is the thing that '
            + 'makes new results appear here.</p>';
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
  html += '<p class="ledger-note">Run <code>/ledger sync</code> in game and copy what it shows you. '
        + 'It syncs as soon as you paste; the button is there if it does not.</p>';
  html += '<textarea id="ledger-paste-box" rows="4" placeholder="PLW2:eNqrVkrLz1eyUsp..." '
        + 'oninput="_ledgerPasteChanged()"></textarea>';
  html += '<div class="ledger-btns"><button class="btn-primary" onclick="_ledgerPasteSubmit()">Sync from string</button></div>';
  html += '</details>';

  /* ── Characters the envelope named and the roster does not have ──
     Previously a dead end: the toast said "add them to your roster" and the
     member had to retype a name and realm the payload had already given us. */
  const unmatched = (state.unmatched || []).filter((u) => u && u.name);
  if (unmatched.length) {
    html += '<p class="ledger-note ledger-unmatched"><i class="ph-fill ph-warning"></i> '
          + 'These characters are in the addon but not on your roster, so nothing they did '
          + 'was applied.</p>';
    html += '<div class="ledger-btns">';
    for (const u of unmatched) {
      const label = escHtml(u.name + (u.realm ? '-' + u.realm : ''));
      html += '<button class="btn-cancel" onclick="_ledgerAddUnmatched('
            + JSON.stringify(u.name).replace(/"/g, '&quot;') + ', '
            + JSON.stringify(u.realm || '').replace(/"/g, '&quot;') + ')">'
            + '<i class="ph ph-plus"></i>Add ' + label + '</button>';
    }
    html += '</div>';
  }
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
                   pending: 'ph-fill ph-clipboard-text',
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

  html += _diagnosticsBlock();

  el.innerHTML = html;
}

/* -------------------------------------------------------------------------
   Diagnostics

   Two things that are evidence rather than features, collapsed because
   nobody needs them to use the site and somebody needs them to decide what
   the site should do next.
------------------------------------------------------------------------- */

function _diagnosticsBlock() {
  const lag = (typeof blizzardLagReport === 'function') ? blizzardLagReport() : null;
  const armory = (typeof loadArmoryData === 'function') ? loadArmoryData(currentChar) : null;
  const quests = armory && armory.questsCompleted;
  if (!lag && !quests) return '';

  let html = '<div class="ledger-block"><details class="ledger-paste">';
  html += '<summary>Diagnostics</summary>';

  if (lag) {
    /* Whether the Battle.net tier deserves to be called the immediate one.
       If an endpoint's lag tracks time-since-logout rather than staying flat,
       it is waiting on the logout and is no fresher than the addon's file,
       and that endpoint's tasks belong on the other side of the split. */
    html += '<p class="ledger-note">How far behind each Battle.net endpoint is running, '
          + 'over ' + lag.samples + ' sample' + (lag.samples === 1 ? '' : 's') + '. '
          + 'An endpoint whose lag grows with time since logout is waiting on the logout, '
          + 'and is no fresher than the addon file.</p>';
    html += '<ul class="ledger-tiers">';
    for (const [name, s] of Object.entries(lag.endpoints)) {
      html += '<li><i class="ph ph-clock"></i><span><strong>' + escHtml(name) + '</strong> '
            + 'median ' + _mins(s.medianSeconds) + ', worst ' + _mins(s.worstSeconds)
            + ' (' + s.samples + ')</span></li>';
    }
    if (typeof lag.sinceLastLogin === 'number') {
      html += '<li><i class="ph ph-sign-out"></i><span><strong>since logout</strong> '
            + _mins(lag.sinceLastLogin) + ' at the last sample</span></li>';
    }
    html += '</ul>';
  }

  if (quests) {
    /* Deliberately not wired to anything.

       The completed-quests endpoint returns bare ids with no completion
       timestamp, so "done this reset" and "done in March" are the same
       answer, which is the one distinction this site is built on. It is also
       documented as returning an incomplete list. So the ids are here to be
       read and verified against a completion somebody actually watched
       happen, which is the posture the addon takes in TaskMap.lua, where an
       unverified quest id is left unmapped because an invented one is a
       silently wrong checkbox. */
    html += '<p class="ledger-note">' + quests.count + ' completed quest ids for '
          + escHtml(charDisplayName(currentChar)) + '. Nothing ticks off these: the endpoint '
          + 'carries no completion time, so it cannot tell this reset from last year, '
          + 'and it is documented as returning an incomplete list. They are here to be '
          + 'verified and mapped by hand.</p>';
    html += '<textarea class="ledger-listout-box" rows="3" readonly>'
          + escHtml((quests.ids || []).join(',')) + '</textarea>';
  }

  html += '</details></div>';
  return html;
}

function _mins(seconds) {
  if (typeof seconds !== 'number') return '?';
  if (seconds < 90) return seconds + 's';
  if (seconds < 5400) return Math.round(seconds / 60) + 'm';
  return (seconds / 3600).toFixed(1) + 'h';
}

/* Add a character the last import could not match, then sync again so the
   week it did in game lands on the roster entry we just made. Re-reading the
   file is the point: adding the character without it leaves the member
   looking at an empty week and going back to the game for a second /reload. */
async function _ledgerAddUnmatched(name, realm) {
  const id = ledgerAddCharacter(name, realm);
  if (!id) return;
  showToast('Added ' + name + (realm ? '-' + realm : '') + '. Re-reading the addon file.');
  if (typeof renderChars === 'function') renderChars();
  await ledgerAutoSync({ force: true });
  renderLedgerModal();
}

/* Copy straight to the clipboard where the browser allows it, and fall back
   to showing the string with it selected. The clipboard API needs a user
   gesture and a permission, and both can be absent for reasons that have
   nothing to do with this site. */
async function _agendaListCopy() {
  const built = await encodeAgendaList();
  if (!built.tasks) { showToast('Star a few tasks first.'); return; }

  noteAgendaListHandedOver(built.signature);

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
  updateLedgerButton();
}

async function _agendaListShow() {
  const built = await encodeAgendaList();
  const box = document.getElementById('agenda-list-box');
  if (!box) return;
  noteAgendaListHandedOver(built.signature);
  box.value = built.payload;
  box.hidden = false;
  box.focus();
  box.select();
  updateLedgerButton();
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

/* Import the moment a recognisable payload lands in the box.

   Pasting a sync string and then pressing a button labelled "sync from
   string" is asking the member to confirm the thing they just did. The button
   stays, because a paste that arrives in pieces (a slow clipboard, a member
   typing) should not fire mid-way, and because a failed auto-import needs
   somewhere to retry from.

   The guard is the prefix, not a parse: parsing is async and inflating a
   partial payload throws in a way that is indistinguishable from a corrupt
   one. A string that names a transport we know and is long enough to be more
   than the prefix is a paste; anything else waits for the button. */
function _ledgerPasteChanged() {
  const box = document.getElementById('ledger-paste-box');
  if (!box) return;
  const text = String(box.value || '').trim();
  if (text.length < 64) return;

  const { transport } = ledgerSplitPayload(text);
  if (!Object.prototype.hasOwnProperty.call(LEDGER_FORMATS, transport)) return;
  if (box.dataset && box.dataset.autoImported === text.slice(-32)) return;
  if (box.dataset) box.dataset.autoImported = text.slice(-32);

  _ledgerPasteSubmit();
}

/* -------------------------------------------------------------------------
   Boot

   Registered here rather than in app.js so the whole bridge, including when
   it runs, stays in one file. Nothing in it depends on app.js having
   initialised: the renderers it would call are typeof-guarded and the roster
   is read from localStorage.
------------------------------------------------------------------------- */

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    updateLedgerButton();
    startLedgerWatch();
    // Forced, because the stored timestamp came from whatever this browser
    // last read and the member may have played on another machine, or cleared
    // site data, since. One read on load is cheap and settles it.
    ledgerAutoSync({ force: true });
    // The data ages while the page sits open, so the label has to as well.
    setInterval(updateLedgerButton, 60000);
  });
}
