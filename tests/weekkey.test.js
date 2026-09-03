/* The weekly reset boundary.

   Two independent implementations of one rule: js/storage.js in the browser
   and _worker.js on the server. They key every piece of weekly data, so if
   they ever disagree the browser writes into a bucket the server does not
   read, and nothing errors — the week simply looks empty. That is the failure
   mode worth pinning.

   The addon is deliberately NOT in this comparison. It cannot know each
   region's reset hour, so its week label is advisory and the site buckets its
   payloads by timestamp instead. See isThisWeek. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { load } = require('./harness');

const ROOT = path.join(__dirname, '..');

// The worker's copies, lifted out so they can be exercised without a fetch.
function workerImpl() {
  const src = fs.readFileSync(path.join(ROOT, '_worker.js'), 'utf8');
  const wanted = ['DEFAULT_RESET_ANCHOR', 'readResetAnchor', 'getWowWeekStartMs',
                  'getWowWeekKey', 'getWowWeekResetMs'];
  const parts = wanted.map((name) => {
    const re = new RegExp(`\\n(?:const|function) ${name}[\\s\\S]*?\\n}`);
    const m = src.match(re);
    assert.ok(m, `${name} not found in _worker.js; this test needs updating`);
    return m[0];
  });
  const ctx = { Date, Number, console };
  vm.createContext(ctx);
  vm.runInContext(parts.join('\n') + '\n'
    + wanted.map((n) => `this.${n}=${n};`).join('\n'), ctx);
  return ctx;
}

function siteImpl() {
  return load(['js/storage.js'], {
    expose: ['getWeekKey', 'weekStartMs', 'isThisWeek', 'loadResetAnchor',
             'saveResetAnchor', 'migrateWeekKeys', 'DEFAULT_RESET_ANCHOR'],
  });
}

const ANCHORS = [
  { day: 2, hour: 15, label: 'us, the historical default' },
  { day: 3, hour: 7, label: 'a Wednesday reset' },
  { day: 4, hour: 0, label: 'a Thursday midnight reset' },
  { day: 0, hour: 23, label: 'a Sunday late reset' },
];

test('the site and the worker agree on every anchor, all year', () => {
  const site = siteImpl();
  const worker = workerImpl();

  let checked = 0;
  for (const anchor of ANCHORS) {
    // Half-hour steps across a full year, so every boundary crossing and both
    // daylight-saving shifts are covered.
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 1800_000) {
      const a = site.getWeekKey(anchor, t);
      const b = worker.getWowWeekKey(anchor, t);
      if (a !== b) {
        assert.fail(`disagreement at ${new Date(t).toISOString()} `
          + `under ${anchor.label}: site ${a}, worker ${b}`);
      }
      checked++;
    }
  }
  assert.ok(checked > 70000, `expected a year of samples per anchor, got ${checked}`);
});

test('the default anchor is unchanged from what the site has always used', () => {
  // Every region keeps this until Blizzard says otherwise. A different
  // default would silently move everyone's storage keys.
  const site = siteImpl();
  const worker = workerImpl();
  assert.deepEqual(
    { day: site.DEFAULT_RESET_ANCHOR.day, hour: site.DEFAULT_RESET_ANCHOR.hour },
    { day: 2, hour: 15 });
  assert.deepEqual(worker.DEFAULT_RESET_ANCHOR, { day: 2, hour: 15 });
});

test('the boundary is exact, and the hour before it belongs to the week before', () => {
  const site = siteImpl();
  const anchor = { day: 2, hour: 15 };
  const reset = Date.UTC(2026, 8, 1, 15, 0, 0);  // Tuesday 2026-09-01, 15:00Z

  assert.equal(site.getWeekKey(anchor, reset), '2026-09-01', 'at the reset');
  assert.equal(site.getWeekKey(anchor, reset + 1), '2026-09-01', 'just after');
  assert.equal(site.getWeekKey(anchor, reset - 1), '2026-08-25', 'just before');
  // The whole of Tuesday before the hour still belongs to the previous week,
  // which is the case a naive "most recent Tuesday" gets wrong.
  assert.equal(site.getWeekKey(anchor, reset - 14 * 3600_000), '2026-08-25', 'Tuesday morning');
  assert.equal(site.getWeekKey(anchor, reset + 7 * 86400_000), '2026-09-08', 'next week');
});

test('a Wednesday anchor puts Tuesday night in the week that is ending', () => {
  const site = siteImpl();
  const eu = { day: 3, hour: 7 };
  // Tuesday evening under a Wednesday reset is still last week, which is the
  // whole reason a region-aware anchor matters: under the US rule it would
  // already have been counted as the new week.
  assert.equal(site.getWeekKey(eu, Date.UTC(2026, 8, 1, 20, 0, 0)), '2026-08-26');
  assert.equal(site.getWeekKey(eu, Date.UTC(2026, 8, 2, 7, 0, 0)), '2026-09-02');
});

test('isThisWeek brackets the current week and nothing else', () => {
  const site = siteImpl();
  const start = site.weekStartMs() / 1000;
  assert.equal(site.isThisWeek(start), true, 'the first second');
  assert.equal(site.isThisWeek(start + 7 * 86400 - 1), true, 'the last second');
  assert.equal(site.isThisWeek(start - 1), false, 'a second before');
  assert.equal(site.isThisWeek(start + 7 * 86400), false, 'the next reset');
  assert.equal(site.isThisWeek(0), false);
  assert.equal(site.isThisWeek(null), false);
});

test('changing the anchor carries this week across instead of erasing it', () => {
  const site = siteImpl();
  const oldAnchor = { day: 2, hour: 15 };
  const newAnchor = { day: 3, hour: 7 };
  const oldKey = site.getWeekKey(oldAnchor);
  const newKey = site.getWeekKey(newAnchor);
  assert.notEqual(oldKey, newKey, 'the fixture needs the two keys to differ');

  site.localStorage.setItem('wow_midnight_chars', JSON.stringify(['Kaelthas', 'Alt']));
  site.localStorage.setItem(`wow_mn_Kaelthas_${oldKey}`, JSON.stringify({ m1: true }));
  site.localStorage.setItem(`wow_mn_goals_Kaelthas_${oldKey}`, JSON.stringify({ m1: 8 }));
  site.localStorage.setItem(`wow_mn_untick_Alt_${oldKey}`, JSON.stringify({ v2: 1 }));

  const moved = site.migrateWeekKeys(oldAnchor, newAnchor);
  assert.equal(moved, 3);
  assert.deepEqual(JSON.parse(site.localStorage.getItem(`wow_mn_Kaelthas_${newKey}`)), { m1: true });
  assert.deepEqual(JSON.parse(site.localStorage.getItem(`wow_mn_goals_Kaelthas_${newKey}`)), { m1: 8 });
  assert.deepEqual(JSON.parse(site.localStorage.getItem(`wow_mn_untick_Alt_${newKey}`)), { v2: 1 });
});

test('a migration never overwrites work already done under the new key', () => {
  const site = siteImpl();
  const oldAnchor = { day: 2, hour: 15 };
  const newAnchor = { day: 3, hour: 7 };
  const oldKey = site.getWeekKey(oldAnchor);
  const newKey = site.getWeekKey(newAnchor);

  site.localStorage.setItem('wow_midnight_chars', JSON.stringify(['Kaelthas']));
  site.localStorage.setItem(`wow_mn_Kaelthas_${oldKey}`, JSON.stringify({ m1: true }));
  site.localStorage.setItem(`wow_mn_Kaelthas_${newKey}`, JSON.stringify({ v2: true }));

  assert.equal(site.migrateWeekKeys(oldAnchor, newAnchor), 0);
  assert.deepEqual(JSON.parse(site.localStorage.getItem(`wow_mn_Kaelthas_${newKey}`)), { v2: true });
});

test('a stored anchor that is nonsense falls back rather than breaking every key', () => {
  const site = siteImpl();
  for (const bad of ['null', '{}', '{"day":9,"hour":0}', '{"day":2}', 'not json', '{"day":2,"hour":99}']) {
    site.localStorage.setItem('wow_mn_reset_anchor', bad);
    const anchor = site.loadResetAnchor();
    assert.deepEqual({ day: anchor.day, hour: anchor.hour }, { day: 2, hour: 15 }, bad);
  }
});
