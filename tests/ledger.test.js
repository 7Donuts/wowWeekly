/* The Party Ledger bridge and the shared merge rules.

   These cover the parts where a mistake is invisible: a box that re-ticks
   itself after the member unchecks it, a counter that walks backwards when
   two machines sync out of order, an envelope from last week overwriting this
   week. All of those look like the site working correctly right up until
   somebody notices their week is wrong.

   Run with: node --test tests/ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./harness');

const FILES = ['js/data-tasks.js', 'js/storage.js', 'js/ledger.js'];
const EXPOSE = [
  'SECTIONS', 'getWeekKey', 'applyAutoTask', 'applyAutoBoss', 'markManualToggle',
  'loadAutoSrc', 'loadUnticked', 'parseLedgerEnvelope', 'applyLedgerEnvelope',
  'applyLedgerCollections', 'ledgerCharKey', 'extractLedgerPayload',
  'ledgerMatchCharacter', 'loadLedgerRatings', 'ledgerStatusText',
  'loadLedgerState', 'saveLedgerState',
  'ledgerAddCharacter', 'ledgerReportIsNews', 'ledgerButtonState',
  'loadCharRealm', 'realmToSlug',
  'taskCoverage', 'coverageSummary', 'blizzardCoverage', 'addonCoverage',
  'saveArmoryData', 'compareVersions', 'addonUpdateState',
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

/* PLW1: base64 of the JSON, no prefix. */
function encode(env) {
  return Buffer.from(JSON.stringify(env), 'utf8').toString('base64');
}

/* PLW2: the same JSON, deflated, with the transport named on the string.
   Built with CompressionStream so the test compresses the way a real client
   would rather than through a fixture nobody can regenerate. */
async function encodeDeflated(env) {
  const bytes = new TextEncoder().encode(JSON.stringify(env));
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  const buf = Buffer.from(await new Response(stream).arrayBuffer());
  return 'PLW2:' + buf.toString('base64');
}

/* ── The envelope ───────────────────────────────────────────────────────── */

test('a well formed PLW1 envelope round trips through base64', async () => {
  const ctx = setup();
  const env = envelope({ week: ctx.getWeekKey() });
  assert.equal((await ctx.parseLedgerEnvelope(encode(env))).fmt, 'PLW1');
});

/* The regression this pair exists for: the addon started deflating its
   payload and naming the transport on the string, and the site read neither.
   Every sync failed, and it failed by telling the member their string was
   malformed, which sent them looking in the wrong place. */
test('a deflated PLW2 envelope is read, prefix and all', async () => {
  const ctx = setup();
  const env = envelope({ fmt: 'PLW2', v: 2, week: ctx.getWeekKey() });
  const parsed = await ctx.parseLedgerEnvelope(await encodeDeflated(env));
  assert.equal(parsed.fmt, 'PLW2');
  assert.equal(parsed.week, ctx.getWeekKey());
});

test('a PLW2 string whose body is truncated says the paste lost something', async () => {
  const ctx = setup();
  const env = envelope({ fmt: 'PLW2', v: 2, week: ctx.getWeekKey() });
  const full = await encodeDeflated(env);
  // Cut to a length that is still valid base64, so what fails is the
  // inflation rather than the decode in front of it.
  const cut = full.slice(0, 5 + 4 * Math.floor((full.length - 5) / 8));
  await assert.rejects(() => ctx.parseLedgerEnvelope(cut), /un-compress|readable/i);
});

/* The contract test. Everything above builds its own compressed payload, so
   everything above would still pass if the two repositories disagreed about
   which deflate variant they meant. This one is a string a real Party Ledger
   actually produced, so it fails if the addon changes what it writes.

   Regenerate from a checkout of the addon repo:
     lua5.1 -e 'local H=require("tests.harness") local PL=H.Load()
                PL.Objectives:MarkDone("v1") PL.Objectives:Increment("v3")
                H.Stub.rawPrint(PL.Bridge:Write().b64)'
   Produced under the addon's own test harness, which is why the character is
   testchar-testrealm, the week is a fixed date, and the envelope's `addon`
   field reads 0.1.0: the harness has no .toc metadata to read a version from
   and falls back. None of that is what this test is checking. */
test('a payload a real addon produced is read by the real site code', async () => {
  const ctx = setup();
  const real = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'plw2-from-addon.txt'), 'utf8').trim();

  const env = await ctx.parseLedgerEnvelope(real);
  assert.equal(env.fmt, 'PLW2');
  assert.equal(env.v, 2);

  const char = env.characters['testchar-testrealm'];
  assert.ok(char, 'the envelope names its character by the addon\'s own key');
  assert.equal(char.objectives.v1.done, true);
  assert.equal(char.objectives.v3.value, 1);
  assert.equal(char.objectives.v3.max, 8);
});

test('the payload survives being pulled out of the Lua and then parsed', async () => {
  const ctx = setup();
  const real = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'plw2-from-addon.txt'), 'utf8').trim();
  // The transport prefix contains a colon, which is exactly what the
  // extraction pattern used to reject.
  const lua = 'PartyLedgerBridgeDB = {\n\t["fmt"] = "PLW2",\n\t["b64"] = "' + real + '",\n}';
  assert.equal(ctx.extractLedgerPayload(lua), real);
  assert.equal((await ctx.parseLedgerEnvelope(ctx.extractLedgerPayload(lua))).fmt, 'PLW2');
});

test('a payload that is not ours is refused by name', async () => {
  const ctx = setup();
  await assert.rejects(() => ctx.parseLedgerEnvelope(encode({ fmt: 'NOPE', v: 1 })),
    /not a Party Ledger sync payload/i);
  await assert.rejects(() => ctx.parseLedgerEnvelope('this is not base64 at all!!'),
    /does not look like|not a Party Ledger/i);
});

test('a transport the site does not know is named in the refusal', async () => {
  const ctx = setup();
  await assert.rejects(() => ctx.parseLedgerEnvelope('PLW9:' + encode(envelope())),
    /says it is PLW9/);
});

test('an envelope whose format and version disagree is refused', async () => {
  const ctx = setup();
  // Not a shape the addon produces: PLW1 is version 1 and PLW2 is version 2.
  // Reading it anyway would tick boxes from a document of unknown shape.
  await assert.rejects(() => ctx.parseLedgerEnvelope(encode(envelope({ v: 2 }))),
    /PLW1 at version 2/);
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
  // Name and realm both, because the modal offers to add the character and
  // making the member retype a realm the envelope already carried is the
  // reason this used to be a dead end.
  assert.deepEqual(report.unmatched, [{ key: 'stranger-illidan', name: 'Stranger', realm: 'illidan' }]);
  // Held across the import so the modal can render the offer later.
  assert.deepEqual(ctx.loadLedgerState().unmatched, report.unmatched);
});

test('an unmatched character can be added to the roster with its realm', () => {
  const ctx = setup();
  const env = envelope({
    week: ctx.getWeekKey(),
    characters: {
      'stranger-illidan': { name: 'Stranger', realm: 'Illidan', objectives: { m1: { done: true } }, bosses: {} },
    },
  });
  ctx.applyLedgerEnvelope(env);

  const id = ctx.ledgerAddCharacter('Stranger', 'Illidan');
  assert.equal(id, 'Stranger@illidan');

  const roster = JSON.parse(ctx.localStorage.getItem('wow_midnight_chars'));
  assert.ok(roster.includes('Stranger@illidan'), 'the character is on the roster');
  assert.equal(ctx.loadCharRealm('Stranger@illidan'), 'Illidan');

  // Offered once. A character already added must stop being offered, or the
  // modal keeps a button that would do nothing.
  assert.deepEqual(ctx.loadLedgerState().unmatched, []);

  // And the envelope now lands on it, which is the whole point of adding it.
  const report = ctx.applyLedgerEnvelope(env);
  assert.deepEqual(report.characters.map(c => c.name), ['Stranger@illidan']);
  assert.deepEqual(report.unmatched, []);
});

test('adding a character the roster already holds does not duplicate it', () => {
  const ctx = setup();
  const before = JSON.parse(ctx.localStorage.getItem('wow_midnight_chars')).length;
  ctx.ledgerAddCharacter('Kaelthas', 'area-52');
  const after = JSON.parse(ctx.localStorage.getItem('wow_midnight_chars'));
  assert.equal(after.length, before, 'no second entry for a character already there');
});

test('a quiet sync only speaks when the import changed something', () => {
  const ctx = setup();
  // Nothing ticked, nothing unmatched: a poll that found a file the game
  // rewrote without the member having done anything new.
  assert.equal(ctx.ledgerReportIsNews({ tasks: 0, bosses: 0, collections: 0, progressed: 0, unmatched: [] }), false);
  assert.equal(ctx.ledgerReportIsNews({ tasks: 1, bosses: 0, collections: 0, progressed: 0, unmatched: [] }), true);
  assert.equal(ctx.ledgerReportIsNews({ tasks: 0, bosses: 0, collections: 0, progressed: 0, unmatched: [{ name: 'X' }] }), true);
  // A payload from before the reset is worth saying out loud even though it
  // ticked nothing: it is the reason nothing was ticked.
  assert.equal(ctx.ledgerReportIsNews({ tasks: 0, bosses: 0, collections: 0, progressed: 0, staleWeek: true, unmatched: [] }), true);
});

/* ── Telling a member their addon is old ────────────────────────────────── */

test('versions compare numerically, not as strings', () => {
  /* The bug this exists to prevent, and it bites at exactly the point it
     starts to matter: "0.9.0" sorts after "0.11.0" as a string, so the member
     furthest behind is the one told they are current. The addon is already
     past 0.9, so this is not hypothetical. */
  const ctx = setup();
  assert.equal(ctx.compareVersions('0.9.0', '0.11.0'), -1, '0.9 is behind 0.11');
  assert.equal(ctx.compareVersions('0.11.0', '0.9.0'), 1);
  assert.equal(ctx.compareVersions('0.11.2', '0.11.2'), 0);
  assert.equal(ctx.compareVersions('1.0.0', '0.99.99'), 1);

  // A missing segment is zero, so the two spellings of the same release are
  // equal rather than one being behind the other forever.
  assert.equal(ctx.compareVersions('1.2', '1.2.0'), 0);
  assert.equal(ctx.compareVersions('1.2', '1.2.1'), -1);

  // A leading v is how the tag is spelled and the .toc is not.
  assert.equal(ctx.compareVersions('v0.11.2', '0.11.2'), 0);
});

test('an unparseable version is unanswerable, not a guess', () => {
  // A hand-edited .toc, a fork's version string, a release candidate. Any of
  // these guessed at is either a nag that will not go away or a member left
  // on a broken version, so the answer is "cannot tell".
  const ctx = setup();
  assert.equal(ctx.compareVersions('0.11.2-dev', '0.11.2'), null);
  assert.equal(ctx.compareVersions('', '0.11.2'), null);
  assert.equal(ctx.compareVersions(undefined, '0.11.2'), null);
  assert.equal(ctx.compareVersions('0.11.2', null), null);
});

test('a member who has never synced is not told they are out of date', () => {
  /* They have not started, which is a different problem with a different
     answer. Telling them about an update is answering a question they have
     not reached, and the panel shows install steps instead. */
  const ctx = setup();
  ctx.saveLedgerState({});
  const state = ctx.addonUpdateState();
  assert.equal(state.latest, null, 'and with no release fetched there is nothing to say at all');
});

/* ── Which tier answers which task ──────────────────────────────────────── */

const CHAR = 'Kaelthas@area-52';

function starList(ctx, ids) {
  ctx.localStorage.setItem('wow_mn_yourlist_' + CHAR, JSON.stringify(ids));
}

test('each tier declares its own coverage and the site subtracts', () => {
  /* The point of this arrangement: neither side carries a list of what the
     other can do. A raid mapped in the worker is covered the moment it is
     mapped, and a row added to TaskMap.lua the moment the addon reports it,
     with nothing on the opposite side agreeing to say so. */
  const ctx = setup();
  starList(ctx, ['vab_h', 'm1', 'd1', 'v1']);

  // Nothing has told us anything yet.
  let cov = ctx.taskCoverage(CHAR);
  assert.equal(cov.counts.unknown, 4, 'with no declarations, nothing is claimed');
  assert.equal(cov.counts.manual, 0,
    'and nothing is written off as manual: "nobody can do this" and "you have not '
    + 'installed the thing that would" are different answers');

  // The Battle.net tier reports what it answers for this character.
  ctx.saveArmoryData(CHAR, { covers: ['vab_h', 'vab_n', 'm1', 'm4', 'v3'] });
  cov = ctx.taskCoverage(CHAR);
  assert.equal(cov.by.vab_h, 'blizzard');
  assert.equal(cov.by.m1, 'blizzard');
  assert.equal(cov.counts.blizzard, 2);

  // The addon reports its own, in an envelope.
  ctx.applyLedgerEnvelope(envelope({
    week: ctx.getWeekKey(), characters: {}, covers: ['m1', 'd1'],
  }));
  cov = ctx.taskCoverage(CHAR);
  assert.equal(cov.by.d1, 'addon', 'the addon answers what Blizzard does not publish');
  assert.equal(cov.by.m1, 'blizzard',
    'and where both cover a task, the tier that needs nothing of the member wins');
  assert.equal(cov.by.v1, 'manual',
    'a task neither covers is the member\'s own, now that we can tell');
  assert.deepEqual(cov.counts, { blizzard: 2, addon: 1, manual: 1, unknown: 0, total: 4 });
});

test('an envelope without a coverage list does not erase the one we have', () => {
  // An older addon says nothing about what it covers. Treating silence as
  // "covers nothing" would move every addon row to "yours to tick" and tell
  // the member to do by hand what is already being done for them.
  const ctx = setup();
  starList(ctx, ['d1']);
  ctx.applyLedgerEnvelope(envelope({ week: ctx.getWeekKey(), characters: {}, covers: ['d1'] }));
  assert.equal(ctx.taskCoverage(CHAR).by.d1, 'addon');

  ctx.applyLedgerEnvelope(envelope({ week: ctx.getWeekKey(), characters: {} }));
  assert.equal(ctx.taskCoverage(CHAR).by.d1, 'addon', 'silence is not a retraction');
});

test('collections count as Battle.net coverage without being declared per character', () => {
  /* Mounts and toys come from /api/collections, which is account-wide and is
     not the per-character armory call, so they are not in that response's
     declaration. The rule is a property of the task rather than of the
     endpoint: a task satisfied by owning something is one the profile API
     can see. */
  const ctx = setup();
  const collectable = ctx.SECTIONS.flatMap(s => s.tasks).find(t => t.collectable || t.mountName);
  assert.ok(collectable, 'the checklist has at least one collectable task to test with');

  starList(ctx, [collectable.id]);
  assert.equal(ctx.taskCoverage(CHAR).by[collectable.id], 'unknown',
    'not until Battle.net has answered for this character at all');

  ctx.saveArmoryData(CHAR, { covers: ['m1'] });
  assert.equal(ctx.taskCoverage(CHAR).by[collectable.id], 'blizzard');
});

test('a hidden task is not counted in either tier', () => {
  // Hiding a task is the member saying they are not doing it. Counting it in
  // "3 yours to tick" is telling them about work they already declined.
  const ctx = setup();
  starList(ctx, ['v1', 'v2']);
  ctx.localStorage.setItem('wow_mn_hidden_' + CHAR, JSON.stringify({ v2: true }));
  assert.equal(ctx.taskCoverage(CHAR).counts.total, 1);
});

test('the coverage summary says nothing when there is no list', () => {
  const ctx = setup();
  assert.equal(ctx.coverageSummary(CHAR), null);
});

test('the account button says how old the game data is, not how old the read is', () => {
  const ctx = setup();

  // Nothing ever synced: the button is an invitation, not a status.
  assert.equal(ctx.ledgerButtonState().state, 'never');

  const now = Date.now();
  const hoursAgo = (h) => Math.floor(now / 1000) - h * 3600;

  // Read a second ago, of a file the game wrote yesterday. The read being
  // fresh is not the question the member is asking.
  ctx.saveLedgerState({ lastImport: now, lastGenerated: hoursAgo(20) });
  const stale = ctx.ledgerButtonState();
  assert.equal(stale.state, 'stale');
  assert.match(stale.label, /20h old/);
  assert.match(stale.title, /\/reload/);

  ctx.saveLedgerState({ lastImport: now, lastGenerated: hoursAgo(3) });
  assert.equal(ctx.ledgerButtonState().state, 'aging');

  ctx.saveLedgerState({ lastImport: now, lastGenerated: hoursAgo(0) });
  assert.equal(ctx.ledgerButtonState().state, 'fresh');
});

test('the file timestamp is recorded so a poll can tell new from unchanged', () => {
  const ctx = setup();
  const env = envelope({ week: ctx.getWeekKey(), characters: {} });
  ctx.applyLedgerEnvelope(env);
  // applyLedgerEnvelope does not stat the file; readLedgerFromDisk does. What
  // this pins is that nothing else in the import path clears the value the
  // watcher compares against.
  const state = ctx.loadLedgerState();
  state.fileModified = 1756900000000;
  ctx.saveLedgerState(state);
  ctx.applyLedgerEnvelope(env);
  assert.equal(ctx.loadLedgerState().fileModified, 1756900000000);
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

test('an envelope from before this reset does not tick this week', () => {
  const ctx = setup();
  const env = envelope({
    // Stale by when it was written, not by its week label. The addon cannot
    // know each region's reset hour, so its label is advisory; the timestamp
    // is what decides.
    generated: Math.floor(Date.now() / 1000) - 30 * 86400,
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

test('an envelope whose label is wrong but whose timestamp is current still counts', () => {
  // The case region-awareness created: an EU member's addon computes a
  // Tuesday-anchored label while the site is on a Wednesday anchor. Matching
  // labels would reject a payload written twenty minutes ago.
  const ctx = setup();
  const env = envelope({
    week: 'a-label-from-a-different-rule',
    generated: Math.floor(Date.now() / 1000) - 60,
    characters: {
      'kaelthas-area52': {
        name: 'Kaelthas', realm: 'area-52',
        objectives: { m1: { done: true } }, bosses: {},
      },
    },
  });
  const report = ctx.applyLedgerEnvelope(env);
  assert.equal(report.staleWeek, false);
  assert.equal(report.tasks, 1);
});

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
