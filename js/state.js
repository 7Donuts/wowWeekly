/* -------------------------------------------------------------------------
   STATE.JS: the client half of the authoritative store.

   The worker now owns weekly state and reconciles it. This is what talks to
   it, and the shape of it is decided by three constraints that pull against
   each other:

   The page must keep rendering from localStorage. app.js renders from local
   state in a hundred places, and rewriting the renderer to be async and
   server-driven in the same change that introduces the schema would be two
   risky changes at once. So localStorage stays as the read model and becomes
   a mirror of what the server decided, rather than the source of truth it
   used to be.

   Ticking a box must not wait for a network round trip. So writes are
   optimistic: local first, then an observation queued for the server, then the
   server's answer written back over the top. If they disagree, the server
   wins, because the whole point is that it is the one thing both devices and
   both programs agree to defer to.

   Losing the network must not lose the work. The queue lives in localStorage,
   so a closed laptop or a dead tunnel means the observations are still there
   on the next load. This is also what makes the merge rules earn their keep:
   observations that sat in a queue for a day arrive after ones made later
   elsewhere, and every rule in worker/merge.js is written so that does not
   matter.

   ── When D1 is not bound ─────────────────────────────────────────────────
   Everything here becomes a no-op and the old whole-blob sync in sync.js
   stays in charge. The worker reports `{ unavailable: true }` until the
   binding in wrangler.jsonc is uncommented, so the cutover is not a flag day
   and can be undone by commenting it out again. `stateAvailable()` is the one
   flag the rest of the site checks.
------------------------------------------------------------------------- */

const OBS_QUEUE_KEY = 'wow_mn_obs_queue';   // device-local: never synced
const STATE_META_KEY = 'wow_mn_state_meta'; // device-local: what we know of the server

/* Neither key is synced. The queue is a device's pending work and the meta is
   a device's view of the server, and pushing either into the shared blob
   would mean one device replaying another's observations. sync.js excludes
   them by name. */
const STATE_LOCAL_KEYS = [OBS_QUEUE_KEY, STATE_META_KEY];

let _stateAvailable = null;   // null = not yet asked
let _flushTimer = null;
let _flushing = false;

function loadQueue() {
  try { return JSON.parse(localStorage.getItem(OBS_QUEUE_KEY) || '{}'); }
  catch (_) { return {}; }
}
function saveQueue(q) {
  try { localStorage.setItem(OBS_QUEUE_KEY, JSON.stringify(q)); } catch (_) {}
}
function loadStateMeta() {
  try { return JSON.parse(localStorage.getItem(STATE_META_KEY) || '{}'); }
  catch (_) { return {}; }
}
function saveStateMeta(m) {
  try { localStorage.setItem(STATE_META_KEY, JSON.stringify(m)); } catch (_) {}
}

function stateAvailable() { return _stateAvailable === true; }

/* ── Queueing ────────────────────────────────────────────────────────────
   Keyed rather than appended. A member clicking a checkbox four times while
   offline should send one observation describing where they ended up, not
   four describing the journey: the server would reach the same answer either
   way, and four rows of history for one decision is not history.
------------------------------------------------------------------------- */

function nowSeconds() { return Math.floor(Date.now() / 1000); }

function observeTask(charId, taskId, fields, source) {
  if (!stateAvailable()) return;
  const q = loadQueue();
  q.tasks = q.tasks || {};
  const key = charId + '|' + taskId;
  q.tasks[key] = {
    charId, taskId,
    ...(q.tasks[key] || {}),
    ...fields,
    source: source || 'member',
    at: nowSeconds(),
  };
  saveQueue(q);
  scheduleFlush();
}

function observeBoss(charId, taskId, bossId, source) {
  if (!stateAvailable()) return;
  const q = loadQueue();
  q.bosses = q.bosses || {};
  q.bosses[charId + '|' + taskId + '|' + bossId] = {
    charId, taskId, bossId, source: source || 'member', at: nowSeconds(),
  };
  saveQueue(q);
  scheduleFlush();
}

function observeCollection(kind, key, source) {
  if (!stateAvailable()) return;
  const q = loadQueue();
  q.collections = q.collections || {};
  q.collections[kind + '|' + key] = { kind, key, source: source || 'armory', at: nowSeconds() };
  saveQueue(q);
  scheduleFlush();
}

/* Characters are described rather than observed: the fields are whatever this
   caller happens to know, and the server's upsert preserves the columns it
   does not mention. */
function observeCharacter(charId, fields) {
  if (!stateAvailable() || !charId) return;
  const q = loadQueue();
  q.characters = q.characters || {};
  q.characters[charId] = { ...(q.characters[charId] || {}), charId, ...fields };
  saveQueue(q);
  scheduleFlush();
}

function scheduleFlush(delay) {
  if (!stateAvailable()) return;
  clearTimeout(_flushTimer);
  _flushTimer = setTimeout(flushObservations, delay == null ? 1200 : delay);
}

function queueIsEmpty(q) {
  return !['tasks', 'bosses', 'collections', 'characters']
    .some((k) => q[k] && Object.keys(q[k]).length);
}

/* ── Flushing ────────────────────────────────────────────────────────────
   The queue is cleared only for what was actually sent. Anything enqueued
   while the request was in flight stays, which is why the sent keys are
   captured before the await and removed after it rather than the whole queue
   being emptied on success.
------------------------------------------------------------------------- */

async function flushObservations() {
  if (!stateAvailable() || _flushing) return null;
  const q = loadQueue();
  if (queueIsEmpty(q)) return null;

  const sent = {
    tasks: Object.keys(q.tasks || {}),
    bosses: Object.keys(q.bosses || {}),
    collections: Object.keys(q.collections || {}),
    characters: Object.keys(q.characters || {}),
  };

  const payload = {
    anchor: typeof loadResetAnchor === 'function' ? loadResetAnchor() : undefined,
    characters: Object.values(q.characters || {}),
    tasks: Object.values(q.tasks || {}),
    bosses: Object.values(q.bosses || {}),
    collections: Object.values(q.collections || {}),
  };

  _flushing = true;
  try {
    const res = await fetch('/api/observe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // Signed out. The work is not lost: it stays queued and local rendering
    // is unaffected, so signing back in picks it up.
    if (res.status === 401) return null;
    if (!res.ok) return null;

    const report = await res.json();
    if (report && report.unavailable) { _stateAvailable = false; return null; }

    const after = loadQueue();
    for (const kind of Object.keys(sent)) {
      if (!after[kind]) continue;
      for (const key of sent[kind]) delete after[kind][key];
    }
    saveQueue(after);

    applyServerReport(report);
    return report;
  } catch (_) {
    // Offline. Keep the queue and try again on the next write or load.
    return null;
  } finally {
    _flushing = false;
  }
}

/* ── Writing the server's answer back ───────────────────────────────────
   The reconciled rows, into the same localStorage keys the renderer already
   reads. Where the server disagrees with what this device optimistically
   wrote, the server wins: that is what makes two devices converge instead of
   fighting.
------------------------------------------------------------------------- */

function applyServerReport(report) {
  if (!report || !report.weeks) return;
  if (report.anchor && typeof saveResetAnchor === 'function'
      && report.anchor.source === 'blizzard') {
    saveResetAnchor(report.anchor);
  }

  for (const [week, chars] of Object.entries(report.weeks)) {
    for (const [charName, tasks] of Object.entries(chars)) {
      writeWeekTasks(charName, week, tasks);
    }
  }
}

function writeWeekTasks(charName, week, tasks) {
  const doneKey  = 'wow_mn_' + charName + '_' + week;
  const goalsKey = 'wow_mn_goals_' + charName + '_' + week;
  const srcKey   = 'wow_mn_autosrc_' + charName + '_' + week;
  const untickKey = 'wow_mn_untick_' + charName + '_' + week;

  const done   = JSON.parse(localStorage.getItem(doneKey) || '{}');
  const goals  = JSON.parse(localStorage.getItem(goalsKey) || '{}');
  const src    = JSON.parse(localStorage.getItem(srcKey) || '{}');
  const untick = JSON.parse(localStorage.getItem(untickKey) || '{}');

  for (const [taskId, row] of Object.entries(tasks)) {
    if (row.done) done[taskId] = true; else delete done[taskId];
    if (row.value) goals[taskId] = row.value; else delete goals[taskId];

    // The badge answers "why is this ticked", so only an automatic source
    // gets one. A box the member ticked here needs no explanation.
    if (row.done && row.source && row.source !== 'member') {
      src[taskId] = row.source === 'member-game' ? 'addon-manual' : row.source;
    } else {
      delete src[taskId];
    }

    if (row.untickAt) untick[taskId] = row.untickAt * 1000; else delete untick[taskId];
  }

  try {
    localStorage.setItem(doneKey, JSON.stringify(done));
    localStorage.setItem(goalsKey, JSON.stringify(goals));
    localStorage.setItem(srcKey, JSON.stringify(src));
    localStorage.setItem(untickKey, JSON.stringify(untick));
  } catch (_) {
    // Quota. Nothing useful to do per key, and the server still holds the
    // truth, so the next hydrate recovers whatever did not land.
  }
}

/* ── Hydrating ──────────────────────────────────────────────────────────── */

/* Ask the server what it has, and mirror it locally. Called once per load,
   before the first render, and it is also how a device that has been closed
   for a week catches up on what the others did. */
async function hydrateState() {
  let state;
  try {
    const res = await fetch('/api/state');
    if (res.status === 401) { _stateAvailable = false; return null; }
    if (!res.ok) { _stateAvailable = false; return null; }
    state = await res.json();
  } catch (_) {
    _stateAvailable = false;
    return null;
  }

  if (!state || state.unavailable) { _stateAvailable = false; return null; }
  _stateAvailable = true;

  const meta = loadStateMeta();
  meta.week = state.week;
  meta.migrated = !!state.migrated;
  meta.hydratedAt = Date.now();
  saveStateMeta(meta);

  if (state.anchor && state.anchor.source === 'blizzard'
      && typeof saveResetAnchor === 'function') {
    saveResetAnchor(state.anchor);
  }

  for (const [charName, bucket] of Object.entries(state.byChar || {})) {
    writeWeekTasks(charName, state.week, bucket.tasks || {});
    writeBossKills(charName, state.week, bucket.bosses || {});
    writeList(charName, bucket);
  }

  if (state.collections) {
    try {
      localStorage.setItem('wow_mn_collections', JSON.stringify({
        mounts: state.collections.mount || [],
        toys: state.collections.toy || [],
        achievements: state.collections.achievement || [],
      }));
    } catch (_) {}
  }

  return state;
}

function writeBossKills(charName, week, bosses) {
  const key = 'wow_mn_bosses_' + charName + '_' + week;
  const kills = {};
  for (const [taskId, byBoss] of Object.entries(bosses)) {
    for (const bossId of Object.keys(byBoss)) kills[taskId + '_' + bossId] = true;
  }
  try { localStorage.setItem(key, JSON.stringify(kills)); } catch (_) {}
}

function writeList(charName, bucket) {
  try {
    const list = bucket.list || [];
    localStorage.setItem('wow_mn_yourlist_' + charName, JSON.stringify(list));
    localStorage.setItem('wow_mn_hidden_' + charName, JSON.stringify(bucket.hidden || {}));
    // The server returns the list in the order the member dragged it into, so
    // the sort key the renderer uses is derived from that rather than synced
    // separately. Two representations of one ordering is how they drift.
    localStorage.setItem('wow_mn_ylorder_' + charName, JSON.stringify(list));
    if (bucket.custom) {
      localStorage.setItem('wow_mn_custom_' + charName, JSON.stringify(bucket.custom));
    }
  } catch (_) {}
}

/* Which localStorage keys the server is now authoritative for.

   sync.js reads this to stop pushing them into the shared blob: two writers
   for one value is the race this whole change removes, and leaving the blob
   carrying them would also leave it growing without bound. Everything else
   (device preferences, notes, the history rollup) keeps syncing the old way,
   because none of it has two writers.

   False until the account has actually been migrated, so nothing stops
   syncing before there is somewhere else for it to live. */
function stateOwnsKey(key) {
  if (!stateAvailable()) return false;
  if (!loadStateMeta().migrated) return false;
  return /^wow_mn_.+_\d{4}-\d{2}-\d{2}$/.test(key)
      || /^wow_mn_(yourlist_|hidden_|custom_|ylorder_)/.test(key)
      || key === 'wow_mn_collections';
}

/* ── The list ───────────────────────────────────────────────────────────── */

/* Your List is replaced wholesale per character rather than observed, because
   that is what it is: a set the member curates, not a stream of events. The
   ordering and the hidden flags travel with it. */
async function pushList(charName) {
  if (!stateAvailable() || !charName) return false;

  const list = JSON.parse(localStorage.getItem('wow_mn_yourlist_' + charName) || '[]');
  const hidden = JSON.parse(localStorage.getItem('wow_mn_hidden_' + charName) || '{}');
  const order = JSON.parse(localStorage.getItem('wow_mn_ylorder_' + charName) || '[]');
  const custom = JSON.parse(localStorage.getItem('wow_mn_custom_' + charName) || '[]');

  const rank = new Map(order.map((id, i) => [id, i]));
  const entries = [...list]
    .sort((a, b) => (rank.has(a) ? rank.get(a) : 999) - (rank.has(b) ? rank.get(b) : 999))
    .map((taskId) => ({ taskId, hidden: !!hidden[taskId] }));

  // A hidden task the member has not starred is still a decision worth
  // keeping: un-hiding it should not also un-star it.
  for (const taskId of Object.keys(hidden)) {
    if (!list.includes(taskId)) entries.push({ taskId, hidden: true });
  }

  try {
    const res = await fetch('/api/list', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ charId: charName, entries, custom }),
    });
    return res.ok;
  } catch (_) { return false; }
}

/* ── The one-time import ────────────────────────────────────────────────
   Everything this device already holds, sent as observations once.

   It has to happen here rather than in the worker for one concrete reason:
   the old blob stored boss kills under `taskId + "_" + bossId` concatenated
   into a single string, and both halves contain underscores
   ("vab_h_nekzali"). Splitting that needs the boss lists, which live in the
   task catalogue, which is a static file this page already has and the worker
   deliberately does not.

   Everything about it is safe to run twice. The merge rules make a repeated
   observation a no-op, so a member who opens the site on three devices at
   once gets one set of rows and three acknowledgements.
------------------------------------------------------------------------- */

function splitBossKey(key) {
  if (typeof SECTIONS === 'undefined') return null;
  for (const section of SECTIONS) {
    for (const task of section.tasks) {
      if (!task.bosses) continue;
      for (const boss of task.bosses) {
        if (key === task.id + '_' + boss.id) return { taskId: task.id, bossId: boss.id };
      }
    }
  }
  return null;
}

/* Which localStorage keys are a week of this character's state. Matched by
   shape rather than by listing weeks, because nothing ever pruned them and a
   member can have years of them. */
function localWeeklyKeys(charName) {
  const weeks = new Set();
  const prefixes = {
    done: 'wow_mn_' + charName + '_',
    goals: 'wow_mn_goals_' + charName + '_',
    bosses: 'wow_mn_bosses_' + charName + '_',
    autosrc: 'wow_mn_autosrc_' + charName + '_',
    untick: 'wow_mn_untick_' + charName + '_',
  };
  const isWeek = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    for (const prefix of Object.values(prefixes)) {
      if (key.startsWith(prefix) && isWeek(key.slice(prefix.length))) {
        weeks.add(key.slice(prefix.length));
      }
    }
  }
  return { weeks: [...weeks].sort(), prefixes };
}

/* A week key back into a moment inside that week, so the server files the
   observation where this device had it. Noon on the week's first day is
   comfortably inside the week under any anchor the site supports. */
function weekMidpointSeconds(week) {
  return Math.floor(Date.parse(week + 'T12:00:00Z') / 1000) + 86400;
}

function buildLocalImport() {
  const chars = JSON.parse(localStorage.getItem('wow_midnight_chars') || '[]');
  const payload = { migrate: true, tasks: [], bosses: [], collections: [], characters: [] };

  if (typeof loadResetAnchor === 'function') payload.anchor = loadResetAnchor();

  chars.forEach((charName, index) => {
    const armory = JSON.parse(localStorage.getItem('wow_mn_armory_' + charName) || '{}');
    payload.characters.push({
      charId: charName,
      name: typeof charDisplayName === 'function' ? charDisplayName(charName) : charName,
      realmSlug: typeof loadCharRealmSlug === 'function' ? loadCharRealmSlug(charName) : null,
      ledgerKey: (typeof ledgerCharKey === 'function' && typeof charDisplayName === 'function')
        ? ledgerCharKey(charDisplayName(charName),
                        typeof loadCharRealmSlug === 'function' ? loadCharRealmSlug(charName) : null)
        : null,
      className: armory.className || localStorage.getItem('wow_mn_class_' + charName) || null,
      level: armory.level || null,
      ilvl: armory.ilvl || null,
      mythicRating: armory.mythicRating || null,
      position: index,
    });

    const { weeks, prefixes } = localWeeklyKeys(charName);
    for (const week of weeks) {
      const at = weekMidpointSeconds(week);
      const read = (prefix) => {
        try { return JSON.parse(localStorage.getItem(prefix + week) || '{}'); }
        catch (_) { return {}; }
      };
      const done = read(prefixes.done);
      const goals = read(prefixes.goals);
      const bosses = read(prefixes.bosses);
      const autosrc = read(prefixes.autosrc);
      const untick = read(prefixes.untick);

      const touched = new Set([...Object.keys(done), ...Object.keys(goals)]);
      for (const taskId of touched) {
        // The provenance the blob recorded is carried across rather than
        // flattened to "member": a box the addon ticked keeps saying so, and
        // the badges on a member's history do not all change meaning on the
        // day of the cutover.
        const recorded = autosrc[taskId];
        const source = recorded === 'addon' ? 'addon'
          : recorded === 'addon-manual' ? 'member-game'
          : recorded === 'armory' ? 'armory'
          : 'member';
        const obs = { charId: charName, taskId, source, at };
        if (done[taskId]) obs.done = true;
        if (goals[taskId]) obs.value = goals[taskId];
        payload.tasks.push(obs);
      }

      // Tombstones travel too, and they have to travel after the ticks they
      // suppress or the import would re-tick what the member got rid of. They
      // are sent as a member un-tick, which is what they are.
      for (const taskId of Object.keys(untick)) {
        payload.tasks.push({
          charId: charName, taskId, done: false, source: 'member',
          at: Math.max(at, Math.floor((untick[taskId] || 0) / 1000)),
        });
      }

      for (const key of Object.keys(bosses)) {
        if (!bosses[key]) continue;
        const split = splitBossKey(key);
        // A kill whose task the catalogue no longer has is dropped rather
        // than guessed at. The alternative is a row under a task id that
        // cannot be rendered, which is worse than a missing bubble.
        if (split) {
          payload.bosses.push({ charId: charName, ...split, source: 'member', at });
        }
      }
    }
  });

  const collections = JSON.parse(localStorage.getItem('wow_mn_collections') || '{}');
  for (const kind of ['mounts', 'toys', 'achievements']) {
    for (const key of (collections[kind] || [])) {
      payload.collections.push({
        kind: kind.replace(/s$/, ''), key: String(key), source: 'armory',
        at: Math.floor(Date.now() / 1000),
      });
    }
  }

  payload.migrateNote = chars.length + ' characters, ' + payload.tasks.length + ' task rows';
  return payload;
}

async function importLocalStateOnce() {
  if (!stateAvailable()) return null;
  const meta = loadStateMeta();
  if (meta.migrated) return null;

  const payload = buildLocalImport();
  // Nothing to send is still a migration: it records that this account has
  // been looked at, so the share API stops falling back to the blob.
  try {
    const res = await fetch('/api/observe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const report = await res.json();
    if (report && report.unavailable) { _stateAvailable = false; return null; }

    meta.migrated = true;
    meta.migratedAt = Date.now();
    saveStateMeta(meta);
    applyServerReport(report);

    // The list is not observations, so it needs its own push. Sequential
    // rather than parallel: a member with a dozen alts firing a dozen
    // requests at once is how a first load gets rate limited.
    const chars = JSON.parse(localStorage.getItem('wow_midnight_chars') || '[]');
    for (const charName of chars) await pushList(charName);

    return report;
  } catch (_) { return null; }
}

/* ── Startup ────────────────────────────────────────────────────────────
   Hydrate, import if this is the first time, then flush anything that was
   queued while offline. In that order: the import must not run before the
   server has been asked whether it already happened, and the queue must not
   flush before the import, or observations would arrive ahead of the history
   they belong after.
------------------------------------------------------------------------- */

async function startState() {
  const state = await hydrateState();
  if (!state) return null;
  await importLocalStateOnce();
  await flushObservations();
  return state;
}
