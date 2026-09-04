/* The client half of the authoritative store.

   Two things here are worth pinning, and both are one-way doors.

   The import off the old blob runs once per account, and anything it gets
   wrong becomes rows nobody notices until they look at a week from before the
   cutover. The boss keys are the sharp edge: the blob stored them as
   `taskId + "_" + bossId` concatenated, and both halves contain underscores,
   so splitting them takes the boss lists rather than a regex.

   The observation queue is what stands between a lost tunnel and lost work,
   so it has to survive being written to while a request is in flight.

   Run with: node --test tests/ */

const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./harness');

const FILES = ['js/data-tasks.js', 'js/storage.js', 'js/state.js', 'js/ledger.js'];
const EXPOSE = [
  'buildLocalImport', 'splitBossKey', 'localWeeklyKeys', 'stateOwnsKey',
  'observeTask', 'observeBoss', 'observeCollection', 'observeCharacter',
  'flushObservations', 'hydrateState', 'startState', 'importLocalStateOnce',
  'applyServerReport', 'writeWeekTasks', 'pushList', 'stateAvailable',
  'loadStateMeta', 'getWeekKey', 'SECTIONS',
];

const CHAR = 'Kaelthas@area-52';
const WEEK = '2026-09-01';

/* The sandbox has no fetch. Each test installs one that records what it was
   given and answers with whatever that test is about, which is the whole
   surface between this file and the worker. */
function setup(opts = {}) {
  const ctx = load(FILES, {
    currentChar: opts.currentChar || CHAR,
    characters: opts.characters || [CHAR],
    expose: EXPOSE,
  });
  ctx.localStorage.setItem('wow_midnight_chars', JSON.stringify(opts.characters || [CHAR]));

  ctx.calls = [];
  ctx.fetch = async (url, init) => {
    const body = init && init.body ? JSON.parse(init.body) : null;
    ctx.calls.push({ url, method: (init && init.method) || 'GET', body });
    const answer = opts.respond ? opts.respond(url, body) : null;
    return {
      ok: true, status: 200,
      json: async () => (answer == null ? {} : answer),
    };
  };
  return ctx;
}

/* Nothing in state.js does anything until the server has said it is there,
   which is also the switch that keeps the site working with no D1 bound. */
async function makeAvailable(ctx, state = {}) {
  const previous = ctx.fetch;
  ctx.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({ week: WEEK, anchor: { day: 2, hour: 15, source: 'default' },
                         characters: [], byChar: {}, migrated: null, ...state }),
  });
  await ctx.hydrateState();
  ctx.fetch = previous;
  assert.equal(ctx.stateAvailable(), true);
}

/* ── The switch ─────────────────────────────────────────────────────────── */

test('with no store bound every write is a no-op', async () => {
  const ctx = setup({ respond: () => ({ unavailable: true, reason: 'no-d1' }) });
  await ctx.hydrateState();

  assert.equal(ctx.stateAvailable(), false);
  ctx.observeTask(CHAR, 'v1', { done: true }, 'member');
  ctx.observeBoss(CHAR, 'vab_h', 'nekzali', 'member');

  // Nothing queued, so nothing to send and nothing to clean up if the binding
  // is never turned on. The old blob sync stays the whole mechanism.
  assert.equal(ctx.localStorage.getItem('wow_mn_obs_queue'), null);
  assert.equal(await ctx.flushObservations(), null);
});

test('the keys the server owns are only claimed once the account has moved', () => {
  const ctx = setup();
  // Before anything, the blob is still the only home for these, so it must
  // keep syncing them.
  assert.equal(ctx.stateOwnsKey('wow_mn_' + CHAR + '_' + WEEK), false);

  ctx.localStorage.setItem('wow_mn_state_meta', JSON.stringify({ migrated: true }));
  assert.equal(ctx.stateOwnsKey('wow_mn_' + CHAR + '_' + WEEK), false,
    'and not until the store has answered either');
});

test('the server owns the weekly and list keys, and nothing else', async () => {
  const ctx = setup();
  await makeAvailable(ctx, { migrated: { at: 1 } });
  ctx.localStorage.setItem('wow_mn_state_meta', JSON.stringify({ migrated: true }));

  for (const key of [
    'wow_mn_' + CHAR + '_' + WEEK,
    'wow_mn_goals_' + CHAR + '_' + WEEK,
    'wow_mn_bosses_' + CHAR + '_' + WEEK,
    'wow_mn_autosrc_' + CHAR + '_' + WEEK,
    'wow_mn_untick_' + CHAR + '_' + WEEK,
    'wow_mn_yourlist_' + CHAR, 'wow_mn_hidden_' + CHAR,
    'wow_mn_custom_' + CHAR, 'wow_mn_ylorder_' + CHAR,
    'wow_mn_collections',
  ]) {
    assert.equal(ctx.stateOwnsKey(key), true, key + ' is the server\'s now');
  }

  // Device preferences, notes and the history rollup have one writer each, so
  // they keep syncing the way they always did.
  for (const key of [
    'wow_mn_notes_' + CHAR, 'wow_mn_history_' + CHAR, 'wow_mn_prefs_' + CHAR,
    'wow_mn_theme', 'wow_mn_obs_queue', 'wow_mn_state_meta',
  ]) {
    assert.equal(ctx.stateOwnsKey(key), false, key + ' is not');
  }
});

/* ── The queue ──────────────────────────────────────────────────────────── */

test('repeated clicks on one box queue one observation', async () => {
  const ctx = setup();
  await makeAvailable(ctx);

  ctx.observeTask(CHAR, 'v1', { done: true }, 'member');
  ctx.observeTask(CHAR, 'v1', { done: false }, 'member');
  ctx.observeTask(CHAR, 'v1', { done: true }, 'member');

  const queue = JSON.parse(ctx.localStorage.getItem('wow_mn_obs_queue'));
  // Where they ended up, not the journey. The server would reach the same
  // answer either way and three rows of history for one decision is not
  // history.
  assert.equal(Object.keys(queue.tasks).length, 1);
  assert.equal(queue.tasks[CHAR + '|v1'].done, true);
});

test('the queue survives a reload, and is cleared only for what was sent', async () => {
  const ctx = setup();
  await makeAvailable(ctx);
  ctx.observeTask(CHAR, 'v1', { done: true }, 'member');

  // A second observation made while the request is in flight must not be
  // dropped by the success handler clearing the whole queue.
  ctx.fetch = async (url, init) => {
    ctx.calls.push({ url, body: JSON.parse(init.body) });
    ctx.observeTask(CHAR, 'v2', { done: true }, 'member');
    return { ok: true, status: 200, json: async () => ({ week: WEEK, weeks: {} }) };
  };

  await ctx.flushObservations();
  const queue = JSON.parse(ctx.localStorage.getItem('wow_mn_obs_queue'));
  assert.deepEqual(Object.keys(queue.tasks), [CHAR + '|v2']);
});

test('a failed flush keeps the work rather than losing it', async () => {
  const ctx = setup();
  await makeAvailable(ctx);
  ctx.observeTask(CHAR, 'v1', { done: true }, 'member');

  ctx.fetch = async () => { throw new Error('offline'); };
  assert.equal(await ctx.flushObservations(), null);

  const queue = JSON.parse(ctx.localStorage.getItem('wow_mn_obs_queue'));
  assert.deepEqual(Object.keys(queue.tasks), [CHAR + '|v1']);
});

test('being signed out queues rather than discards', async () => {
  const ctx = setup();
  await makeAvailable(ctx);
  ctx.observeTask(CHAR, 'v1', { done: true }, 'member');

  ctx.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await ctx.flushObservations();

  const queue = JSON.parse(ctx.localStorage.getItem('wow_mn_obs_queue'));
  assert.deepEqual(Object.keys(queue.tasks), [CHAR + '|v1'],
    'signing back in should pick this up, not start from nothing');
});

/* ── The server's answer wins ───────────────────────────────────────────── */

test('the reconciled rows overwrite what this device hoped for', async () => {
  const ctx = setup();
  await makeAvailable(ctx);

  const doneKey = 'wow_mn_' + CHAR + '_' + WEEK;
  ctx.localStorage.setItem(doneKey, JSON.stringify({ v1: true, v2: true }));

  // The server says v2 is not done, because the member un-ticked it
  // elsewhere. Converging means believing it.
  ctx.applyServerReport({
    week: WEEK,
    weeks: { [WEEK]: { [CHAR]: {
      v1: { done: true, source: 'addon', value: 0, untickAt: null },
      v2: { done: false, source: null, value: 0, untickAt: 1756900000 },
      v3: { done: false, source: 'armory', value: 4, untickAt: null },
    } } },
  });

  assert.deepEqual(JSON.parse(ctx.localStorage.getItem(doneKey)), { v1: true });
  assert.deepEqual(
    JSON.parse(ctx.localStorage.getItem('wow_mn_goals_' + CHAR + '_' + WEEK)), { v3: 4 });
  // The tombstone comes back too, so this device stops re-ticking it.
  assert.ok(JSON.parse(ctx.localStorage.getItem('wow_mn_untick_' + CHAR + '_' + WEEK)).v2);
  // And the badge, which only an automatic source gets: a box the member
  // ticked here needs no explanation.
  assert.deepEqual(
    JSON.parse(ctx.localStorage.getItem('wow_mn_autosrc_' + CHAR + '_' + WEEK)), { v1: 'addon' });
});

test('a tick made in game is badged as the member\'s own', async () => {
  const ctx = setup();
  await makeAvailable(ctx);
  ctx.applyServerReport({
    weeks: { [WEEK]: { [CHAR]: {
      v1: { done: true, source: 'member-game', value: 0, untickAt: null },
      v2: { done: true, source: 'member', value: 0, untickAt: null },
    } } },
  });
  const src = JSON.parse(ctx.localStorage.getItem('wow_mn_autosrc_' + CHAR + '_' + WEEK));
  assert.equal(src.v1, 'addon-manual', 'the in-game display gets its own badge');
  assert.equal(src.v2, undefined, 'and a tick made here gets none');
});

/* ── The one-time import ────────────────────────────────────────────────── */

test('a boss key is split against the catalogue, not by a regex', () => {
  const ctx = setup();
  // Both halves contain underscores. "vab_h_nekzali" has no honest split
  // without the boss list, which is why the import cannot live in the worker.
  const raid = ctx.SECTIONS.flatMap((s) => s.tasks).find((t) => t.bosses && t.bosses.length);
  assert.ok(raid, 'the catalogue has a raid with bosses');
  const boss = raid.bosses[0];

  assert.deepEqual(ctx.splitBossKey(raid.id + '_' + boss.id),
    { taskId: raid.id, bossId: boss.id });
  // A kill whose task the catalogue no longer has is dropped rather than
  // guessed at: a row under an unrenderable task id is worse than no bubble.
  assert.equal(ctx.splitBossKey('retired_raid_someboss'), null);
});

test('the import finds every week the blob accumulated', () => {
  const ctx = setup();
  const weeks = ['2026-08-18', '2026-08-25', WEEK];
  for (const w of weeks) {
    ctx.localStorage.setItem('wow_mn_' + CHAR + '_' + w, JSON.stringify({ v1: true }));
  }
  // Nothing ever pruned these, so they are found by shape rather than by
  // asking which weeks exist.
  ctx.localStorage.setItem('wow_mn_notes_' + CHAR, JSON.stringify({ v1: 'not a week' }));

  const found = ctx.localWeeklyKeys(CHAR);
  assert.deepEqual(found.weeks, weeks);
});

test('the import carries the provenance the blob recorded', () => {
  const ctx = setup();
  ctx.localStorage.setItem('wow_mn_' + CHAR + '_' + WEEK,
    JSON.stringify({ v1: true, v2: true, v3: true, v4: true }));
  ctx.localStorage.setItem('wow_mn_autosrc_' + CHAR + '_' + WEEK,
    JSON.stringify({ v1: 'addon', v2: 'armory', v3: 'addon-manual' }));

  const payload = ctx.buildLocalImport();
  const by = Object.fromEntries(payload.tasks.map((t) => [t.taskId, t]));

  // A box the addon ticked keeps saying so, rather than every badge on a
  // member's history changing meaning on the day of the cutover.
  assert.equal(by.v1.source, 'addon');
  assert.equal(by.v2.source, 'armory');
  assert.equal(by.v3.source, 'member-game');
  assert.equal(by.v4.source, 'member', 'no note recorded means they did it');
  assert.equal(payload.migrate, true);
});

test('the import sends tombstones after the ticks they suppress', () => {
  const ctx = setup();
  ctx.localStorage.setItem('wow_mn_' + CHAR + '_' + WEEK, JSON.stringify({ v1: true }));
  ctx.localStorage.setItem('wow_mn_autosrc_' + CHAR + '_' + WEEK, JSON.stringify({ v1: 'addon' }));
  ctx.localStorage.setItem('wow_mn_untick_' + CHAR + '_' + WEEK,
    JSON.stringify({ v2: Date.parse('2026-09-04T10:00:00Z') }));

  const payload = ctx.buildLocalImport();
  const untick = payload.tasks.find((t) => t.taskId === 'v2');
  assert.ok(untick, 'the tombstone travels');
  assert.equal(untick.done, false);
  assert.equal(untick.source, 'member', 'which is what a tombstone is');

  // Ordering matters: an un-tick that arrived before the tick it suppresses
  // would let the import re-tick what the member got rid of.
  const tick = payload.tasks.find((t) => t.taskId === 'v1');
  assert.ok(untick.at >= tick.at);
});

test('the import carries counters, kills, characters and collections', () => {
  const ctx = setup();
  const raid = ctx.SECTIONS.flatMap((s) => s.tasks).find((t) => t.bosses && t.bosses.length);

  ctx.localStorage.setItem('wow_mn_goals_' + CHAR + '_' + WEEK, JSON.stringify({ v3: 6 }));
  ctx.localStorage.setItem('wow_mn_bosses_' + CHAR + '_' + WEEK,
    JSON.stringify({ [raid.id + '_' + raid.bosses[0].id]: true, 'nonsense_key': true }));
  ctx.localStorage.setItem('wow_mn_armory_' + CHAR,
    JSON.stringify({ className: 'Mage', level: 80, ilvl: 302, mythicRating: 2450 }));
  ctx.localStorage.setItem('wow_mn_collections',
    JSON.stringify({ mounts: ["Ashes of Al'ar"], toys: [], achievements: [2336] }));

  const payload = ctx.buildLocalImport();

  assert.equal(payload.tasks.find((t) => t.taskId === 'v3').value, 6);
  assert.equal(payload.bosses.length, 1, 'the unsplittable key was dropped, not guessed');
  assert.deepEqual(payload.bosses[0].taskId, raid.id);

  const char = payload.characters[0];
  assert.equal(char.charId, CHAR);
  assert.equal(char.ilvl, 302);
  assert.equal(char.mythicRating, 2450);
  assert.equal(char.ledgerKey, 'kaelthas-area52', 'so an envelope can be matched to it');
  assert.equal(char.position, 0, 'and the member\'s own ordering is kept');

  assert.deepEqual(payload.collections.map((c) => [c.kind, c.key]).sort(),
    [['achievement', '2336'], ['mount', "Ashes of Al'ar"]]);
});

test('every week lands in its own week, not all in the current one', () => {
  const ctx = setup();
  ctx.localStorage.setItem('wow_mn_' + CHAR + '_2026-08-18', JSON.stringify({ v1: true }));
  ctx.localStorage.setItem('wow_mn_' + CHAR + '_' + WEEK, JSON.stringify({ v2: true }));

  const payload = ctx.buildLocalImport();
  const at = Object.fromEntries(payload.tasks.map((t) => [t.taskId, t.at]));
  // The server files by timestamp, so the import has to date each observation
  // inside the week it came from or a year of history collapses into one.
  assert.ok(at.v1 < at.v2);
  assert.ok(at.v1 >= Math.floor(Date.parse('2026-08-18T15:00:00Z') / 1000));
  assert.ok(at.v1 < Math.floor(Date.parse('2026-08-25T15:00:00Z') / 1000));
});

test('the import runs once and then stops asking', async () => {
  const ctx = setup({ respond: () => ({ week: WEEK, weeks: {}, applied: 0 }) });
  await makeAvailable(ctx);

  await ctx.importLocalStateOnce();
  assert.ok(ctx.loadStateMeta().migrated);
  const after = ctx.calls.length;

  assert.equal(await ctx.importLocalStateOnce(), null);
  assert.equal(ctx.calls.length, after, 'no second import');
});

/* ── The list ───────────────────────────────────────────────────────────── */

test('the list is pushed in the member\'s own order, hidden entries and all', async () => {
  const ctx = setup();
  await makeAvailable(ctx);

  ctx.localStorage.setItem('wow_mn_yourlist_' + CHAR, JSON.stringify(['v1', 'v2', 'v3']));
  ctx.localStorage.setItem('wow_mn_ylorder_' + CHAR, JSON.stringify(['v3', 'v1', 'v2']));
  ctx.localStorage.setItem('wow_mn_hidden_' + CHAR, JSON.stringify({ v2: true, v9: true }));
  ctx.localStorage.setItem('wow_mn_custom_' + CHAR, JSON.stringify([{ id: 'mine', name: 'Mine' }]));

  await ctx.pushList(CHAR);
  const call = ctx.calls.find((c) => c.url === '/api/list');
  assert.ok(call, 'the list was pushed');
  assert.equal(call.body.charId, CHAR);
  assert.deepEqual(call.body.entries.map((e) => e.taskId), ['v3', 'v1', 'v2', 'v9']);
  assert.equal(call.body.entries.find((e) => e.taskId === 'v2').hidden, true);
  // A hidden task the member never starred is still a decision: un-hiding it
  // should not also un-star it.
  assert.equal(call.body.entries.find((e) => e.taskId === 'v9').hidden, true);
  assert.deepEqual(call.body.custom, [{ id: 'mine', name: 'Mine' }]);
});

test('hydrating mirrors the server into the keys the renderer reads', async () => {
  const ctx = setup();
  const raid = ctx.SECTIONS.flatMap((s) => s.tasks).find((t) => t.bosses && t.bosses.length);

  ctx.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({
      week: WEEK,
      anchor: { day: 3, hour: 15, source: 'blizzard' },
      characters: [{ char_id: CHAR }],
      byChar: { [CHAR]: {
        tasks: { v1: { done: true, source: 'addon', value: 0, untickAt: null } },
        bosses: { [raid.id]: { [raid.bosses[0].id]: 1756900000 } },
        list: ['v1', 'v3'], hidden: { v9: true },
        custom: [{ id: 'mine', name: 'Mine' }],
      } },
      collections: { mount: ["Ashes of Al'ar"], toy: [], achievement: ['2336'] },
      migrated: { at: 1 },
    }),
  });

  const state = await ctx.hydrateState();
  assert.equal(state.week, WEEK);

  const LS = ctx.localStorage;
  assert.deepEqual(JSON.parse(LS.getItem('wow_mn_' + CHAR + '_' + WEEK)), { v1: true });
  assert.deepEqual(JSON.parse(LS.getItem('wow_mn_bosses_' + CHAR + '_' + WEEK)),
    { [raid.id + '_' + raid.bosses[0].id]: true });
  assert.deepEqual(JSON.parse(LS.getItem('wow_mn_yourlist_' + CHAR)), ['v1', 'v3']);
  // The sort key the renderer uses is derived from the server's order rather
  // than synced separately: two representations of one ordering is how they
  // drift apart.
  assert.deepEqual(JSON.parse(LS.getItem('wow_mn_ylorder_' + CHAR)), ['v1', 'v3']);
  assert.deepEqual(JSON.parse(LS.getItem('wow_mn_hidden_' + CHAR)), { v9: true });
  assert.deepEqual(JSON.parse(LS.getItem('wow_mn_collections')).mounts, ["Ashes of Al'ar"]);
  // A learned anchor is adopted from the server, so both screens agree on
  // what week it is.
  assert.equal(JSON.parse(LS.getItem('wow_mn_reset_anchor')).day, 3);
});
