/* The authoritative store and the merge rules.

   These are the rules that decide whether somebody's week survives. The old
   design had them right locally and then threw the result away by replacing
   the whole cloud blob on every save, so the case that matters most here is
   the one that used to lose data: two clients observing the same week and
   arriving in whatever order they happen to arrive in.

   Every test runs against real SQLite through tests/d1.js, so the migrations
   and the store's actual SQL are executed rather than matched.

   Run with: node --test tests/ */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { makeD1 } = require('./d1');

const SUB = 'bnet-sub-1';
const CHAR = 'Kaelthas@area-52';

let merge, Store;
test.before(async () => {
  merge = await import(path.join(__dirname, '..', 'worker', 'merge.js'));
  ({ Store } = await import(path.join(__dirname, '..', 'worker', 'store.js')));
});

function store() { return new Store(makeD1()); }

/* A moment inside a known reset week, so week keys in assertions are fixed
   rather than relative to when the suite runs. Tuesday 2026-09-01 15:00 UTC
   is a reset under the default anchor. */
const WEEK = '2026-09-01';
const IN_WEEK = Math.floor(Date.parse('2026-09-03T20:00:00Z') / 1000);
const LAST_WEEK = Math.floor(Date.parse('2026-08-27T20:00:00Z') / 1000);

function task(over = {}) {
  return { charId: CHAR, taskId: 'v3', source: 'member', at: IN_WEEK, ...over };
}

/* ── The merge rules, as a pure function ────────────────────────────────── */

test('anything a source reports done is done', () => {
  for (const source of merge.SOURCES) {
    const { next, changed } = merge.mergeTaskObservation(null, { done: true, source, at: 100 });
    assert.equal(next.done, 1, source + ' ticks it');
    assert.equal(next.done_source, source);
    assert.equal(changed, true);
  }
});

test('a box the member un-ticks stays un-ticked against automatic sources', () => {
  // The single most annoying way automatic completion can fail: the member
  // gets rid of a tick and the next sync puts it straight back.
  const unticked = merge.mergeTaskObservation(
    { done: 1, done_source: 'addon', done_at: 100, value: 0, untick_at: null },
    { done: false, source: 'member', at: 200 }).next;
  assert.equal(unticked.done, 0);
  assert.equal(unticked.untick_at, 200);

  for (const source of ['addon', 'armory']) {
    const again = merge.mergeTaskObservation(unticked, { done: true, source, at: 300 });
    assert.equal(again.next.done, 0, source + ' must not overturn the tombstone');
    assert.equal(again.changed, false, 'and there is nothing to write');
  }
});

test('the member ticking it again clears their own tombstone', () => {
  const unticked = merge.mergeTaskObservation(
    { done: 1, done_source: 'member', done_at: 100, value: 0, untick_at: null },
    { done: false, source: 'member', at: 200 }).next;

  const reticked = merge.mergeTaskObservation(unticked, { done: true, source: 'member', at: 300 }).next;
  assert.equal(reticked.done, 1);
  assert.equal(reticked.untick_at, null, 'so an automatic source is free again');

  const addon = merge.mergeTaskObservation(reticked, { done: true, source: 'addon', at: 400 }).next;
  assert.equal(addon.done, 1);
});

test('a tick made in game clears the tombstone too', () => {
  // The in-game display is the member on a second screen, not a third
  // automatic source. Treating it as automatic would make an un-tick on the
  // site un-fixable from in game.
  const unticked = merge.mergeTaskObservation(
    null, { done: false, source: 'member', at: 100 }).next;
  const inGame = merge.mergeTaskObservation(unticked, { done: true, source: 'member-game', at: 200 }).next;
  assert.equal(inGame.done, 1);
  assert.equal(inGame.untick_at, null);
});

test('an automatic source reporting not-done says nothing', () => {
  // It has not seen the thing. That is not a claim the thing did not happen,
  // and treating it as one would let a lagging armory read erase an evening.
  const done = merge.mergeTaskObservation(null, { done: true, source: 'member', at: 100 }).next;
  const result = merge.mergeTaskObservation(done, { done: false, source: 'armory', at: 200 });
  assert.equal(result.next.done, 1);
  assert.equal(result.next.untick_at, null, 'and it does not leave a tombstone either');
  assert.equal(result.changed, false);
});

test('counters take the maximum, never the latest', () => {
  // Observations arrive out of order as a matter of course: one of the sources
  // is a paste. Latest-wins walks a counter backwards.
  let row = merge.mergeTaskObservation(null, { value: 6, source: 'addon', at: 200 }).next;
  assert.equal(row.value, 6);

  const older = merge.mergeTaskObservation(row, { value: 2, source: 'addon', at: 100 });
  assert.equal(older.next.value, 6, 'an older, smaller reading does not win');
  assert.equal(older.changed, false);

  row = merge.mergeTaskObservation(row, { value: 8, source: 'armory', at: 300 }).next;
  assert.equal(row.value, 8);
  assert.equal(row.value_source, 'armory');
});

test('the member can correct a counter downward; a source cannot', () => {
  // The site has always let somebody decrement a counter by hand, so the
  // maximum rule above cannot apply to them: it would make a correction
  // impossible and there would be no way to fix a mis-click.
  let row = merge.mergeTaskObservation(null, { value: 6, source: 'addon', at: 100 }).next;
  row = merge.mergeTaskObservation(row, { value: 3, source: 'member', at: 200 }).next;
  assert.equal(row.value, 3, 'the member set it');

  // An older member observation does not win, so two devices do not depend on
  // which request happened to land first.
  const stale = merge.mergeTaskObservation(row, { value: 9, source: 'member', at: 150 });
  assert.equal(stale.next.value, 3);
  assert.equal(stale.changed, false);

  // And the game counting more than they typed still raises it, because that
  // is a fact and the typed number was a guess. This is what the site did
  // locally before any of it moved server-side.
  row = merge.mergeTaskObservation(row, { value: 8, source: 'addon', at: 300 }).next;
  assert.equal(row.value, 8);
});

test('un-ticking keeps the count behind the box', () => {
  // The count came from play. Un-ticking hides the checkmark rather than
  // denying the work, which is what the site has always done locally.
  const row = merge.mergeTaskObservation(
    { done: 1, done_source: 'addon', done_at: 100, value: 6, value_source: 'addon', untick_at: null },
    { done: false, source: 'member', at: 200 }).next;
  assert.equal(row.done, 0);
  assert.equal(row.value, 6);
});

test('attribution goes to the member and the timestamp to the first sighting', () => {
  // The badge answers "why is this ticked" and the timestamp answers "when
  // did I do this". They are different questions and can have different
  // answers, so they are merged differently.
  let row = merge.mergeTaskObservation(null, { done: true, source: 'armory', at: 100 }).next;
  assert.equal(row.done_source, 'armory');
  assert.equal(row.done_at, 100);

  row = merge.mergeTaskObservation(row, { done: true, source: 'member', at: 500 }).next;
  assert.equal(row.done_source, 'member', 'the member outranks the armory');
  assert.equal(row.done_at, 100, 'but it was still done at 100');

  row = merge.mergeTaskObservation(row, { done: true, source: 'addon', at: 700 }).next;
  assert.equal(row.done_source, 'member', 'and a lower rank does not take it back');
});

/* ── The week key, computed in one place ────────────────────────────────── */

test('the week key is the reset the moment falls in, not a label', () => {
  const anchor = { day: 2, hour: 15 };
  // Just before Tuesday's reset is still last week.
  assert.equal(merge.weekKeyFor(anchor, Date.parse('2026-09-01T14:59:00Z')), '2026-08-25');
  assert.equal(merge.weekKeyFor(anchor, Date.parse('2026-09-01T15:00:00Z')), '2026-09-01');
  // EU resets Wednesday, which is the whole reason the anchor is stored per
  // account rather than assumed.
  assert.equal(merge.weekKeyFor({ day: 3, hour: 15 }, Date.parse('2026-09-01T20:00:00Z')), '2026-08-26');
});

test('an unusable anchor falls back to unchanged rather than to a new guess', () => {
  for (const bad of [null, {}, { day: 9, hour: 1 }, { day: 2, hour: 99 }, { day: 2.5, hour: 1 }]) {
    assert.equal(merge.validAnchor(bad), false);
    assert.equal(merge.weekKeyFor(bad, Date.parse('2026-09-03T20:00:00Z')), '2026-09-01');
  }
});

/* ── The store ──────────────────────────────────────────────────────────── */

test('an observation lands in the week its timestamp falls in', async () => {
  const s = store();
  const report = await s.observe(SUB, {
    characters: [{ charId: CHAR, name: 'Kaelthas', realmSlug: 'area-52', ledgerKey: 'kaelthas-area52' }],
    tasks: [
      task({ taskId: 'v1', done: true, at: IN_WEEK }),
      // Not this week's box, and structurally so: the caller does not get to
      // name the week, so a stale envelope cannot tick a current task.
      task({ taskId: 'v2', done: true, at: LAST_WEEK, source: 'addon' }),
    ],
  });

  assert.equal(report.applied, 2);
  assert.deepEqual(Object.keys(report.weeks).sort(), ['2026-08-25', WEEK]);

  const thisWeek = await s.weekState(SUB, WEEK);
  assert.equal(thisWeek.byChar[CHAR].tasks.v1.done, true);
  assert.equal(thisWeek.byChar[CHAR].tasks.v2, undefined);

  const last = await s.weekState(SUB, '2026-08-25');
  assert.equal(last.byChar[CHAR].tasks.v2.done, true);
});

test('two clients observing the same week no longer lose each other\'s work', async () => {
  // The regression this whole change exists for. Under the old whole-blob
  // sync, whichever device pushed last erased the other's evening.
  const s = store();
  await s.observe(SUB, { characters: [{ charId: CHAR, name: 'Kaelthas' }] });

  // Laptop ticks two things.
  await s.observe(SUB, { tasks: [
    task({ taskId: 'v1', done: true }),
    task({ taskId: 'v2', done: true }),
  ] });

  // Desktop, which never saw those, ticks two others and reports its own
  // stale view of the first two as untouched.
  await s.observe(SUB, { tasks: [
    task({ taskId: 'v4', done: true }),
    task({ taskId: 'v5', done: true }),
    task({ taskId: 'v1', done: false, source: 'armory' }),
  ] });

  const state = await s.weekState(SUB, WEEK);
  const tasks = state.byChar[CHAR].tasks;
  assert.deepEqual(Object.keys(tasks).sort(), ['v1', 'v2', 'v4', 'v5']);
  for (const id of ['v1', 'v2', 'v4', 'v5']) {
    assert.equal(tasks[id].done, true, id + ' survived');
  }
});

test('re-sending the same observations writes nothing the second time', async () => {
  const s = store();
  const payload = { characters: [{ charId: CHAR, name: 'Kaelthas' }],
                    tasks: [task({ taskId: 'v1', done: true }), task({ taskId: 'v3', value: 4 })] };
  const first = await s.observe(SUB, payload);
  const second = await s.observe(SUB, payload);
  assert.equal(first.applied, 2);
  assert.equal(second.applied, 0, 'a re-sync is not a write');
});

test('an observation with no source or no character is dropped and counted', async () => {
  const s = store();
  const report = await s.observe(SUB, { tasks: [
    { charId: CHAR, taskId: 'v1', done: true, source: 'nonsense', at: IN_WEEK },
    { taskId: 'v2', done: true, source: 'member', at: IN_WEEK },
    { charId: CHAR, done: true, source: 'member', at: IN_WEEK },
  ] });
  // Never guessed at: a wrong source mislabels a badge and a guessed
  // character puts somebody's progress on the wrong alt.
  assert.equal(report.applied, 0);
  assert.equal(report.ignored, 3);
});

test('boss kills are stored as facts and the task tick comes from the client', async () => {
  const s = store();
  await s.observe(SUB, {
    characters: [{ charId: CHAR, name: 'Kaelthas' }],
    bosses: [
      { charId: CHAR, taskId: 'vab_h', bossId: 'nekzali', source: 'addon', at: IN_WEEK },
      { charId: CHAR, taskId: 'vab_h', bossId: 'sentinels', source: 'addon', at: IN_WEEK },
    ],
    // The worker does not hold the boss list, so it never derives this. The
    // client that has the catalogue sends it alongside.
    tasks: [task({ taskId: 'vab_h', done: true, source: 'addon' })],
  });

  const state = await s.weekState(SUB, WEEK);
  assert.deepEqual(Object.keys(state.byChar[CHAR].bosses.vab_h).sort(), ['nekzali', 'sentinels']);
  assert.equal(state.byChar[CHAR].tasks.vab_h.done, true);
});

test('collections are account-wide and recorded once', async () => {
  const s = store();
  await s.observe(SUB, { collections: [
    { kind: 'mount', key: "Ashes of Al'ar", source: 'addon', at: IN_WEEK },
    { kind: 'mount', key: "Ashes of Al'ar", source: 'armory', at: IN_WEEK + 10 },
    { kind: 'achievement', key: '2336', source: 'addon', at: IN_WEEK },
  ] });
  const state = await s.weekState(SUB, WEEK);
  assert.deepEqual(state.collections.mount, ["Ashes of Al'ar"]);
  assert.deepEqual(state.collections.achievement, ['2336']);
});

test('a learned anchor sticks, and the default never replaces it', async () => {
  const s = store();
  assert.deepEqual(await s.anchor(SUB), merge.DEFAULT_RESET_ANCHOR);

  await s.learnAnchor(SUB, { day: 3, hour: 15, source: 'blizzard' });
  assert.deepEqual(await s.anchor(SUB), { day: 3, hour: 15, source: 'blizzard' });

  // A client that has not learned one yet must not walk the account back to
  // the default, which would move every weekly key and then move it again.
  await s.learnAnchor(SUB, { day: 2, hour: 15, source: 'default' });
  assert.equal((await s.anchor(SUB)).day, 3);

  // And an unusable one changes nothing at all.
  await s.learnAnchor(SUB, { day: 99, hour: 0, source: 'blizzard' });
  assert.equal((await s.anchor(SUB)).day, 3);
});

test('the anchor decides which week an observation lands in', async () => {
  const s = store();
  await s.learnAnchor(SUB, { day: 3, hour: 15, source: 'blizzard' });
  const report = await s.observe(SUB, {
    characters: [{ charId: CHAR, name: 'Kaelthas' }],
    tasks: [task({ taskId: 'v1', done: true, at: IN_WEEK })],
  });
  // Wednesday-anchored. The observation is Thursday the 3rd, so it belongs to
  // Wednesday the 2nd, where the default Tuesday anchor would have filed it
  // under the 1st. Same moment, different week: which is exactly why the
  // anchor is stored once on the server instead of computed on each client.
  assert.deepEqual(Object.keys(report.weeks), ['2026-09-02']);
  assert.equal(merge.weekKeyFor(merge.DEFAULT_RESET_ANCHOR, IN_WEEK * 1000), WEEK);
});

test('a character upsert does not blank columns the caller did not mention', async () => {
  const s = store();
  await s.observe(SUB, { characters: [
    { charId: CHAR, name: 'Kaelthas', realmSlug: 'area-52', ledgerKey: 'kaelthas-area52' },
  ] });
  // The armory knows the class and level; the addon knows the ledger key.
  // Neither should erase the other's column by not knowing it.
  await s.observe(SUB, { characters: [{ charId: CHAR, name: 'Kaelthas', className: 'MAGE', level: 80 }] });

  const [row] = await s.characters(SUB);
  assert.equal(row.ledger_key, 'kaelthas-area52');
  assert.equal(row.realm_slug, 'area-52');
  assert.equal(row.class_name, 'MAGE');
  assert.equal(row.level, 80);
});

test('an envelope\'s character is matched by the addon\'s key, then by name', async () => {
  const s = store();
  await s.observe(SUB, { characters: [
    { charId: CHAR, name: 'Kaelthas', realmSlug: 'area-52', ledgerKey: 'kaelthas-area52' },
    { charId: 'Bare', name: 'Bare' },
  ] });

  assert.equal(await s.matchLedgerCharacter(SUB, 'kaelthas-area52', 'Kaelthas'), CHAR);
  // A character added before realms were recorded at all: matched on name
  // rather than dropped, which would silently lose its whole week.
  assert.equal(await s.matchLedgerCharacter(SUB, 'bare-somewhere', 'Bare'), 'Bare');
  assert.equal(await s.matchLedgerCharacter(SUB, 'nobody-nowhere', 'Nobody'), null);
});

/* ── The list ───────────────────────────────────────────────────────────── */

test('a list is replaced per character and keeps its order', async () => {
  const s = store();
  await s.observe(SUB, { characters: [{ charId: CHAR, name: 'K' }, { charId: 'Alt', name: 'A' }] });

  await s.replaceList(SUB, CHAR, ['v3', 'v1', 'v2'], [{ id: 'mine', name: 'Repair my gear' }]);
  await s.replaceList(SUB, 'Alt', ['m1'], []);

  const state = await s.weekState(SUB, WEEK);
  assert.deepEqual(state.byChar[CHAR].list, ['v3', 'v1', 'v2']);
  assert.deepEqual(state.byChar[CHAR].custom, [{ id: 'mine', name: 'Repair my gear', desc: undefined }]);
  assert.deepEqual(state.byChar.Alt.list, ['m1'], 'saving on one character left the other alone');

  // Replaced wholesale: what the member means by saving is "this is the list
  // now", and merging would need a rule for a task the new list drops.
  await s.replaceList(SUB, CHAR, ['v1'], []);
  const after = await s.weekState(SUB, WEEK);
  assert.deepEqual(after.byChar[CHAR].list, ['v1']);
  assert.deepEqual(after.byChar[CHAR].custom, []);
});

test('a hidden task is on the list without being in it', async () => {
  const s = store();
  await s.observe(SUB, { characters: [{ charId: CHAR, name: 'K' }] });
  await s.replaceList(SUB, CHAR, [
    { taskId: 'v1' }, { taskId: 'v2', hidden: true },
  ]);
  const state = await s.weekState(SUB, WEEK);
  assert.deepEqual(state.byChar[CHAR].list, ['v1']);
  assert.deepEqual(state.byChar[CHAR].hidden, { v2: true });
});

/* ── History, which the blobs could not answer at all ───────────────────── */

test('every week the account has rows for can be listed', async () => {
  const s = store();
  await s.observe(SUB, { characters: [{ charId: CHAR, name: 'K' }] });
  await s.observe(SUB, { tasks: [
    task({ taskId: 'v1', done: true, at: IN_WEEK }),
    task({ taskId: 'v2', done: true, at: IN_WEEK }),
    task({ taskId: 'v3', value: 4, at: IN_WEEK }),
    task({ taskId: 'v1', done: true, at: LAST_WEEK }),
  ] });

  const weeks = await s.weeks(SUB);
  assert.deepEqual(weeks, [
    { week: WEEK, tasks: 3, done: 2 },
    { week: '2026-08-25', tasks: 1, done: 1 },
  ]);
});

/* ── What the addon is holding ──────────────────────────────────────────── */

test('the in-game list and the last envelope are recorded separately', async () => {
  const s = store();
  await s.recordAgendaList(SUB, { sig: '2abec521', week: WEEK, tasks: 24, imported: IN_WEEK });
  await s.recordLedgerReceipt(SUB, { addon: '0.10.0', generated: IN_WEEK, week: WEEK });

  const agenda = await s.agendaList(SUB);
  assert.equal(agenda.sig, '2abec521');
  assert.equal(agenda.tasks, 24);

  const receipt = await s.ledgerReceipt(SUB);
  assert.equal(receipt.addon, '0.10.0');
  assert.equal(receipt.generated_at, IN_WEEK);
});

test('deleting an account leaves nothing behind', async () => {
  const s = store();
  await s.observe(SUB, {
    characters: [{ charId: CHAR, name: 'K' }],
    tasks: [task({ taskId: 'v1', done: true })],
    bosses: [{ charId: CHAR, taskId: 'vab_h', bossId: 'nekzali', at: IN_WEEK }],
    collections: [{ kind: 'mount', key: 'X', at: IN_WEEK }],
    anchor: { day: 3, hour: 15, source: 'blizzard' },
  });
  await s.replaceList(SUB, CHAR, ['v1'], [{ id: 'mine', name: 'Mine' }]);
  await s.recordAgendaList(SUB, { sig: 'abc' });

  // Revoking has to be one operation or nobody will actually do it.
  await s.deleteAccount(SUB);

  const state = await s.weekState(SUB, WEEK);
  assert.deepEqual(state.characters, []);
  assert.deepEqual(state.byChar, {});
  assert.equal(state.agenda, null);
  assert.deepEqual(await s.weeks(SUB), []);
  assert.deepEqual(await s.anchor(SUB), merge.DEFAULT_RESET_ANCHOR);
});
