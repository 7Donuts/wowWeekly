/* The Party Ledger bridge and the shared merge rules.

   These cover the parts where a mistake is invisible: a box that re-ticks
   itself after the member unchecks it, a counter that walks backwards when
   two machines sync out of order, an envelope from last week overwriting this
   week. All of those look like the site working correctly right up until
   somebody notices their week is wrong.

   Run with: node --test tests/ */

const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./harness');

const FILES = ['js/data-tasks.js', 'js/storage.js', 'js/ledger.js'];
const EXPOSE = [
  'SECTIONS', 'getWeekKey', 'applyAutoTask', 'applyAutoBoss', 'markManualToggle',
  'loadAutoSrc', 'loadUnticked', 'parseLedgerEnvelope', 'applyLedgerEnvelope',
  'applyLedgerCollections', 'ledgerCharKey', 'extractLedgerPayload',
  'ledgerMatchCharacter', 'loadLedgerRatings', 'ledgerStatusText',
  'loadLedgerState', 'saveLedgerState',
];

function setup(opts = {}) {
  const ctx = load(FILES, {
    currentChar: opts.currentChar || 'Kaelthas@area-52',
    characters: opts.characters || ['Kaelthas@area-52'],
    expose: EXPOSE,
  });
  ctx.localStorage.setItem('wow_midnight_chars',
    JSON.stringify(opts.characters || ['Kaelthas@area-52']));
  return ctx;
}

function envelope(over = {}) {
  return {
    fmt: 'PLW1', v: 1, generated: Math.floor(Date.now() / 1000), addon: '0.2.0',
    week: over.week, characters: {}, collections: {}, ...over,
  };
}

function encode(env) {
  return Buffer.from(JSON.stringify(env), 'utf8').toString('base64');
}

/* ── The envelope ───────────────────────────────────────────────────────── */

test('a well formed envelope round trips through base64', () => {
  const ctx = setup();
  const env = envelope({ week: ctx.getWeekKey() });
  assert.deepEqual(ctx.parseLedgerEnvelope(encode(env)).fmt, 'PLW1');
});

test('a payload that is not ours is refused by name', () => {
  const ctx = setup();
  assert.throws(() => ctx.parseLedgerEnvelope(encode({ fmt: 'NOPE', v: 1 })),
    /not a Party Ledger sync payload/i);
  assert.throws(() => ctx.parseLedgerEnvelope('this is not base64 at all!!'),
    /does not look like|not a Party Ledger/i);
});

test('an envelope from a newer addon is refused rather than guessed at', () => {
  const ctx = setup();
  // An addon ahead of the site is a normal state. Reading it as version 1
  // would tick boxes from a shape we do not know.
  assert.throws(() => ctx.parseLedgerEnvelope(encode(envelope({ v: 2 }))),
    /version 2 and the site reads version 1/);
});

test('the payload is pulled out of the Lua the game wrote', () => {
  const ctx = setup();
  const lua = [
    'PartyLedgerBridgeDB = {',
    '\t["v"] = 1,',
    '\t["written"] = 1756900000,',
    '\t["summary"] = {',
    '\t\t["week"] = "2026-09-01",',
    '\t},',
    '\t["b64"] = "eyJmbXQiOiJQTFcxIn0=",',
    '}',
  ].join('\n');
  assert.equal(ctx.extractLedgerPayload(lua), 'eyJmbXQiOiJQTFcxIn0=');
});

test('a file with no payload says so instead of failing obscurely', () => {
  const ctx = setup();
  assert.throws(() => ctx.extractLedgerPayload('PartyLedgerDB = {\n["version"] = 2,\n}'),
    /no sync payload/i);
});

/* ── Character matching ─────────────────────────────────────────────────── */

test('the addon character key is reproduced exactly', () => {
  const ctx = setup();
  // Party Ledger lowercases and strips spaces, apostrophes and hyphens from
  // the realm. Getting this wrong means nothing ever matches.
  assert.equal(ctx.ledgerCharKey('Kaelthas', 'area-52'), 'kaelthas-area52');
  assert.equal(ctx.ledgerCharKey('Bob', "Twisting Nether"), 'bob-twistingnether');
  assert.equal(ctx.ledgerCharKey("Zul'jin", "Mal'Ganis"), "zul'jin-malganis");
});

test('a character the site does not track is reported, not silently dropped', () => {
  const ctx = setup();
  const env = envelope({
    week: ctx.getWeekKey(),
    characters: {
      'kaelthas-area52': { name: 'Kaelthas', realm: 'area-52', objectives: { m1: { done: true } }, bosses: {} },
      'stranger-illidan': { name: 'Stranger', realm: 'illidan', objectives: { m1: { done: true } }, bosses: {} },
    },
  });
  const report = ctx.applyLedgerEnvelope(env);
  assert.deepEqual(report.characters.map(c => c.name), ['Kaelthas@area-52']);
  assert.deepEqual(report.unmatched, ['Stranger']);
});

/* ── The merge rules ────────────────────────────────────────────────────── */

test('an automatic source ticks a box and records what did it', () => {
  const ctx = setup();
  assert.equal(ctx.applyAutoTask('Kaelthas@area-52', 'm1', { done: true }, 'addon').ticked, true);

  const week = ctx.getWeekKey();
  const done = JSON.parse(ctx.localStorage.getItem('wow_mn_Kaelthas@area-52_' + week));
  assert.equal(done.m1, true);
  assert.equal(ctx.loadAutoSrc('Kaelthas@area-52').m1, 'addon');

  // Applying the same thing again is not a change, so callers can skip a
  // pointless repaint.
  assert.equal(ctx.applyAutoTask('Kaelthas@area-52', 'm1', { done: true }, 'addon').changed, false);
});

test('a box the member unchecks stays unchecked through later syncs', () => {
  const ctx = setup();
  ctx.applyAutoTask('Kaelthas@area-52', 'm1', { done: true }, 'addon');

  // The member unchecks it by hand.
  ctx.markManualToggle('m1', false, 'Kaelthas@area-52');
  const week = ctx.getWeekKey();
  const done = JSON.parse(ctx.localStorage.getItem('wow_mn_Kaelthas@area-52_' + week));
  delete done.m1;
  ctx.localStorage.setItem('wow_mn_Kaelthas@area-52_' + week, JSON.stringify(done));

  // Every later automatic source has to leave it alone. This is the single
  // most annoying way this feature could fail.
  ctx.applyAutoTask('Kaelthas@area-52', 'm1', { done: true }, 'addon');
  ctx.applyAutoTask('Kaelthas@area-52', 'm1', { done: true }, 'armory');
  const after = JSON.parse(ctx.localStorage.getItem('wow_mn_Kaelthas@area-52_' + week));
  assert.equal(after.m1, undefined);

  // And the provenance note goes with it: it is the member's box now.
  assert.equal(ctx.loadAutoSrc('Kaelthas@area-52').m1, undefined);
});

test('re-checking a box by hand lifts the block', () => {
  const ctx = setup();
  ctx.markManualToggle('m1', false, 'Kaelthas@area-52');
  ctx.markManualToggle('m1', true, 'Kaelthas@area-52');
  assert.equal(ctx.applyAutoTask('Kaelthas@area-52', 'm1', { done: true }, 'addon').ticked, true);
});

test('progress still accumulates behind an unchecked box', () => {
  const ctx = setup();
  ctx.markManualToggle('m1', false, 'Kaelthas@area-52');
  ctx.applyAutoTask('Kaelthas@area-52', 'm1', { done: true, value: 6 }, 'addon');

  const week = ctx.getWeekKey();
  const goals = JSON.parse(ctx.localStorage.getItem('wow_mn_goals_Kaelthas@area-52_' + week));
  // Unchecking hides the tick without throwing away the count behind it, so
  // re-checking does not start from zero.
  assert.equal(goals.m1, 6);
  const done = JSON.parse(ctx.localStorage.getItem('wow_mn_Kaelthas@area-52_' + week) || '{}');
  assert.equal(done.m1, undefined);
});

test('counters merge by maximum, so out of order syncs cannot go backwards', () => {
  const ctx = setup();
  const week = ctx.getWeekKey();
  const goals = () => JSON.parse(ctx.localStorage.getItem('wow_mn_goals_Kaelthas@area-52_' + week));

  ctx.applyAutoTask('Kaelthas@area-52', 'm1', { value: 6 }, 'addon');
  assert.equal(goals().m1, 6);

  // A stale sync from the other machine arrives afterwards. Latest-wins would
  // walk this back to 3.
  ctx.applyAutoTask('Kaelthas@area-52', 'm1', { value: 3 }, 'armory');
  assert.equal(goals().m1, 6);

  ctx.applyAutoTask('Kaelthas@area-52', 'm1', { value: 8 }, 'armory');
  assert.equal(goals().m1, 8);
});

/* ── Bosses ─────────────────────────────────────────────────────────────── */

test('a raid task completes only once every boss on its list is dead', () => {
  const ctx = setup();
  const week = ctx.getWeekKey();
  const task = ctx.SECTIONS.flatMap(s => s.tasks).find(t => t.id === 'vab_h');
  assert.ok(task && task.bosses.length === 8, 'the heroic raid task has eight bosses');

  for (const boss of task.bosses.slice(0, 7)) {
    ctx.applyAutoBoss('Kaelthas@area-52', 'vab_h', boss.id, 'addon');
  }
  let done = JSON.parse(ctx.localStorage.getItem('wow_mn_Kaelthas@area-52_' + week) || '{}');
  assert.equal(done.vab_h, undefined, 'seven of eight is not a clear');

  ctx.applyAutoBoss('Kaelthas@area-52', 'vab_h', task.bosses[7].id, 'addon');
  done = JSON.parse(ctx.localStorage.getItem('wow_mn_Kaelthas@area-52_' + week));
  assert.equal(done.vab_h, true, 'eight of eight is');
});

test('the same boss reported twice is recorded once', () => {
  const ctx = setup();
  assert.equal(ctx.applyAutoBoss('Kaelthas@area-52', 'vab_h', 'nekzali', 'addon'), true);
  assert.equal(ctx.applyAutoBoss('Kaelthas@area-52', 'vab_h', 'nekzali', 'armory'), false);
});

/* ── Weeks ──────────────────────────────────────────────────────────────── */

test('an envelope from last week does not tick this week', () => {
  const ctx = setup();
  const env = envelope({
    week: '2020-01-07',
    characters: {
      'kaelthas-area52': {
        name: 'Kaelthas', realm: 'area-52',
        objectives: { m1: { done: true } },
        bosses: { vab_h: { nekzali: true } },
      },
    },
    collections: { mounts: ["Ashes of Al'ar"] },
  });
  const report = ctx.applyLedgerEnvelope(env);

  assert.equal(report.staleWeek, true);
  assert.equal(report.tasks, 0);
  assert.equal(report.bosses, 0);

  const done = JSON.parse(
    ctx.localStorage.getItem('wow_mn_Kaelthas@area-52_' + ctx.getWeekKey()) || '{}');
  assert.equal(done.m1, undefined, 'weekly objectives are not applied');
  // Collections are not weekly, so a stale envelope still credits them.
  assert.equal(done.hunt_alar, true, 'collectibles are');
});

/* ── Collections ────────────────────────────────────────────────────────── */

test('a collected mount ticks its task on every character', () => {
  const ctx = setup({ characters: ['Kaelthas@area-52', 'Alt@area-52'] });
  const applied = ctx.applyLedgerCollections({ mounts: ["Ashes of Al'ar", 'Not A Real Mount'] });
  assert.equal(applied, 2, 'one mount, two characters');

  const week = ctx.getWeekKey();
  for (const c of ['Kaelthas@area-52', 'Alt@area-52']) {
    const done = JSON.parse(ctx.localStorage.getItem('wow_mn_' + c + '_' + week));
    assert.equal(done.hunt_alar, true);
  }
});

test('a mount whose journal name differs from the task name still matches', () => {
  const ctx = setup();
  // The task is called "Invincible's Reins"; the mount journal calls it
  // "Invincible". mountName is what bridges the two.
  ctx.applyLedgerCollections({ mounts: ['Invincible'] });
  const done = JSON.parse(
    ctx.localStorage.getItem('wow_mn_Kaelthas@area-52_' + ctx.getWeekKey()));
  assert.equal(done.hunt_invincible, true);
});

test('an earned achievement ticks its task', () => {
  const ctx = setup();
  ctx.applyLedgerCollections({ achievements: [2336, 999999] });
  const done = JSON.parse(
    ctx.localStorage.getItem('wow_mn_Kaelthas@area-52_' + ctx.getWeekKey()));
  assert.equal(done.hunt_insane, true);
  assert.equal(Object.keys(done).length, 1, 'an unknown achievement ticks nothing');
});

test('every collectable task can actually be matched by something', () => {
  const ctx = setup();
  // A collectable with no mountName has to match on its own task name, so a
  // name nothing will ever report is a task that can never tick. This catches
  // the mistake at the point somebody adds an entry.
  const sec = ctx.SECTIONS.find(s => s.id === 'collectibles');
  for (const t of sec.tasks) {
    assert.ok(t.collectable || t.achievementId,
      `${t.id} is in the collectibles section but has no way to be checked`);
    if (t.achievementId) assert.equal(typeof t.achievementId, 'number');
  }
});

/* ── The whole path ─────────────────────────────────────────────────────── */

test('a full envelope applies objectives, bosses, collections and grades', () => {
  const ctx = setup();
  const env = envelope({
    week: ctx.getWeekKey(),
    characters: {
      'kaelthas-area52': {
        name: 'Kaelthas', realm: 'area-52', class: 'MAGE', level: 80,
        objectives: { m1: { done: true, value: 8, max: 8 }, v3: { value: 5, max: 8 } },
        bosses: { vab_h: { nekzali: true, sentinels: true } },
      },
    },
    collections: { mounts: ["Ashes of Al'ar"], achievements: [7520] },
    ratings: { authored: 3, runs: 40, byGrade: { '2': 3 }, recent: [{ name: 'Alpha', grade: 2 }] },
  });

  const report = ctx.applyLedgerEnvelope(env);
  assert.equal(report.tasks, 1, 'm1 is the only box ticked');
  assert.equal(report.progressed, 2, 'both counters carry progress');
  assert.equal(report.bosses, 2);
  assert.equal(report.collections, 2);
  assert.equal(report.ratings, 3);

  const week = ctx.getWeekKey();
  const goals = JSON.parse(ctx.localStorage.getItem('wow_mn_goals_Kaelthas@area-52_' + week));
  assert.equal(goals.v3, 5, 'progress on an unfinished counter is still carried');

  assert.equal(ctx.loadLedgerRatings().authored, 3);
  assert.ok(ctx.loadLedgerState().lastImport > 0);
});

test('a task id the site no longer has is ignored, not an error', () => {
  const ctx = setup();
  const env = envelope({
    week: ctx.getWeekKey(),
    characters: {
      'kaelthas-area52': {
        name: 'Kaelthas', realm: 'area-52',
        objectives: { m1: { done: true }, task_from_last_patch: { done: true } },
        bosses: { raid_that_no_longer_exists: { someboss: true } },
      },
    },
  });
  const report = ctx.applyLedgerEnvelope(env);
  assert.equal(report.tasks, 1);
  assert.equal(report.bosses, 0);

  const done = JSON.parse(ctx.localStorage.getItem('wow_mn_Kaelthas@area-52_' + ctx.getWeekKey()));
  assert.equal(done.task_from_last_patch, undefined);
});

test('the status line distinguishes a recent import from recent game data', () => {
  const ctx = setup();
  // The file only changes when the game writes it, so importing an old file a
  // moment ago is still old data and the member has to be told which is which.
  ctx.saveLedgerState({
    lastImport: Date.now(),
    lastGenerated: Math.floor(Date.now() / 1000) - 5 * 3600,
  });
  const status = ctx.ledgerStatusText();
  assert.match(status, /just now/);
  assert.match(status, /5h old/);
  assert.match(status, /reload in game/);
});
