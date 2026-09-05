/* The Battle.net tier's own measurements.

   The site now has two automatic sources and puts this one in front, on the
   grounds that it answers without anything installed and without a reload.
   The second half of that claim is the one nobody had checked: several
   profile endpoints refresh lazily, and an endpoint that waits on the
   character logging out is no fresher than the addon's file, which would put
   its tasks on the wrong side of the split.

   So the lag is sampled rather than assumed, and this covers the sampling.
   What it cannot cover is the answer: that comes from a live character, and
   these only make sure the evidence is gathered and summarised honestly when
   it arrives.

   Run with: node --test tests/ */

const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./harness');

/* armory.js declares its own showToast, which shadows the harness collector
   and reaches for a document this sandbox does not have. Nothing under test
   here calls it, and loading armory.js alongside the files that do would put
   that landmine in somebody else's suite, which is why this is its own. */
const FILES = ['js/storage.js', 'js/armory.js'];
const EXPOSE = ['recordBlizzardLag', 'blizzardLagReport'];

function setup() {
  return load(FILES, { currentChar: 'Main', characters: ['Main'], expose: EXPOSE });
}

/* One /api/armory freshness block, as the worker builds it. */
function freshness(over = {}) {
  const at = over.at || Date.now();
  const age = (s) => ({ at: at - s * 1000, ageSeconds: s });
  return {
    at,
    lastLogin: over.lastLogin === undefined ? at - 600 * 1000 : over.lastLogin,
    profile:   age(over.profile   === undefined ? 300 : over.profile),
    keystone:  age(over.keystone  === undefined ? 60  : over.keystone),
    raids:     age(over.raids     === undefined ? 900 : over.raids),
    equipment: age(over.equipment === undefined ? 300 : over.equipment),
  };
}

test('nothing sampled yet is null, not a report full of zeroes', () => {
  // A zero here would read as "every endpoint is perfectly live", which is
  // the opposite of what no evidence means.
  const ctx = setup();
  assert.equal(ctx.blizzardLagReport(), null);
});

test('a sync records the lag of each endpoint', () => {
  const ctx = setup();
  ctx.recordBlizzardLag('Main', freshness());

  const report = ctx.blizzardLagReport();
  assert.equal(report.samples, 1);
  assert.equal(report.endpoints.keystone.medianSeconds, 60);
  assert.equal(report.endpoints.raids.medianSeconds, 900);
  assert.equal(report.sinceLastLogin, 600);
});

test('the report is a median and a worst case, not an average', () => {
  /* One sample taken while Blizzard was having a bad afternoon should not
     decide an architecture, and this distribution has a long right tail. The
     median is what the endpoint usually does; the worst is the one that
     would bite. A mean would be dragged somewhere that describes neither. */
  const ctx = setup();
  for (const raids of [60, 60, 60, 60, 36000]) {
    ctx.recordBlizzardLag('Main', freshness({ raids }));
  }

  const seen = ctx.blizzardLagReport().endpoints.raids;
  assert.equal(seen.medianSeconds, 60, 'the usual case is not moved by one outlier');
  assert.equal(seen.worstSeconds, 36000, 'and the outlier is still reported');
  assert.equal(seen.samples, 5);
});

test('the sample window is bounded', () => {
  // It lives in a member's localStorage and is written on every sync of every
  // character, so an unbounded log is a quota error eventually.
  const ctx = setup();
  for (let i = 0; i < 120; i++) ctx.recordBlizzardLag('Main', freshness({ raids: i }));

  const report = ctx.blizzardLagReport();
  assert.ok(report.samples <= 40, 'kept to the window');
  assert.equal(report.endpoints.raids.worstSeconds, 119,
    'and it is the newest that are kept: an old sample says nothing about today');
});

test('an endpoint that answered nothing is absent rather than guessed at', () => {
  // A 502 from one of the eight sub-requests means no Last-Modified to read.
  // Reporting it as zero lag would be inventing evidence.
  const ctx = setup();
  const f = freshness();
  f.raids = null;
  ctx.recordBlizzardLag('Main', f);

  const report = ctx.blizzardLagReport();
  assert.equal(report.endpoints.raids, undefined);
  assert.ok(report.endpoints.keystone, 'the ones that did answer are still there');
});

test('a response with no freshness block records nothing', () => {
  // An older worker, or a cached response from before this existed.
  const ctx = setup();
  ctx.recordBlizzardLag('Main', undefined);
  assert.equal(ctx.blizzardLagReport(), null);
});
