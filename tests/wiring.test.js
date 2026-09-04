/* Wiring guards for js/app.js.

   These read the source rather than running it, which is a weaker test than
   exercising a click, and the weakness is the point of writing them down.
   app.js renders into the page from load and from toggle(), so calling it
   here means stubbing enough of a DOM to run the whole renderer. That stub
   was tried: a permissive element proxy makes `if (el)` true everywhere,
   which hides exactly the bugs a DOM test would be for, and it sent the
   renderer into a loop that never returned.

   So these check the one thing that actually went wrong: a patch that was
   never applied. The merge rules in js/ledger.js are covered behaviourally in
   ledger.test.js; what is unprotected without this is whether app.js calls
   into them at all, and a checkbox that does not record a manual uncheck
   looks completely normal until an automatic sync puts the tick back. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const STORAGE = fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8');

// The body of a top-level `function name(...)`, to the first line that starts
// at column zero with a closing brace. Good enough for this file's style, and
// it fails loudly rather than silently matching nothing.
function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is not defined any more; this guard needs updating`);
  const end = source.indexOf('\n}', start);
  assert.notEqual(end, -1, `could not find the end of ${name}`);
  return source.slice(start, end);
}

test('toggling a task by hand records the manual intent', () => {
  // Without this the tombstone is never written, so an automatic source
  // re-ticks the box on the next sync and the member cannot get rid of it.
  const body = functionBody(APP, 'toggle');
  assert.match(body, /markManualToggle\(/,
    'toggle() must tell markManualToggle what the member just did');
});

test('clearing a boss bubble records it the same way', () => {
  // storage.js is the only definition now. It was not always: app.js carried
  // a second copy that won at runtime and had no markManualToggle in it, so
  // this guard passed for a long time while clearing a bubble was silently
  // re-ticked by the next automatic sync. The single-definition guard below
  // is what stops that shape of bug returning.
  const body = functionBody(STORAGE, 'toggleBoss');
  assert.match(body, /markManualToggle\(/,
    'toggleBoss() derives a task tick, so it has to record the manual intent too');
});

test('the persistence layer is defined once', () => {
  /* js/storage.js and js/app.js used to define the same 36 functions. They
     share one scope on the page and app.js loads second, so app.js's copies
     won and storage.js's were dead, which is the opposite of what its own
     header says ("change the schema here and it propagates to every page").

     Two of them had drifted, and both drifts were live bugs:

       getWeekKey        app.js's copy hardcoded Tuesday 15:00 UTC and ignored
                         its arguments, so the learned reset anchor was inert.
                         migrateWeekKeys compared getWeekKey(old) against
                         getWeekKey(new), got the same answer both times, and
                         returned without moving anything. An EU member's site
                         filed everything under the US key.
       toggleBoss        app.js's copy had no markManualToggle at all, so
                         clearing a boss bubble left no tombstone and the next
                         automatic sync re-ticked the task.

     Neither showed up because the tests that cover them load storage.js
     without app.js, and so exercised the copy that never runs. This guard is
     what makes that impossible to reintroduce. */
  const names = (source) => {
    const found = new Set();
    for (const m of source.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) {
      found.add(m[1]);
    }
    return found;
  };

  const inApp = names(APP);
  const shared = [...names(STORAGE)].filter((name) => inApp.has(name));
  assert.deepEqual(shared, [],
    'defined in both js/storage.js and js/app.js, and app.js wins: ' + shared.join(', '));
});

test('the live week key honours the reset anchor', () => {
  // The specific regression above. A getWeekKey that takes no arguments
  // cannot be anchor-aware, and every weekly storage key is filed under it.
  const body = functionBody(STORAGE, 'getWeekKey');
  assert.match(body, /function getWeekKey\(anchor/,
    'getWeekKey must take the anchor, not assume Tuesday');
  assert.ok(!/function getWeekKey/.test(APP),
    'and app.js must not shadow it with a copy that does not');
});

test('both task views show which source ticked a box', () => {
  // The section list and Your List render the same task-name markup. Adding
  // the badge to one and not the other is how the two views drift apart, and
  // Your List is the one most members actually look at.
  for (const fn of ['sectionTaskHtml', 'ylTaskHtml']) {
    assert.match(functionBody(APP, fn), /autoSrcBadge\(/,
      `${fn} must show the automatic-source badge`);
  }
});

test('the badge distinguishes the addon from the armory', () => {
  const body = functionBody(APP, 'autoSrcBadge');
  assert.match(body, /addon/);
  assert.match(body, /Ledger/);
  assert.match(body, /Armory/);
  // The tooltip is what tells a member the tick is theirs to remove.
  assert.match(body, /stays unchecked/);
});

test('no automatic path writes the done map directly', () => {
  // Every automatic tick has to go through applyAutoTask so the tombstone and
  // the provenance note are applied. armory.js writing its own done map is
  // the regression this catches.
  const armory = fs.readFileSync(path.join(__dirname, '..', 'js', 'armory.js'), 'utf8');
  assert.ok(!/localStorage\.setItem\(\s*doneKey/.test(armory),
    'armory.js must tick tasks through applyAutoTask, not by writing the done map');
  assert.match(armory, /applyAutoTask\(/);
  assert.match(armory, /applyAutoBoss\(/);
});
