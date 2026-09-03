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
  const body = functionBody(STORAGE, 'toggleBoss');
  assert.match(body, /markManualToggle\(/,
    'toggleBoss() derives a task tick, so it has to record the manual intent too');
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
