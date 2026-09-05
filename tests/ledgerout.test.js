/* The list going out to the addon.

   The inbound half (ledger.test.js) is about not corrupting somebody's week.
   This half is about the list arriving intact: the addon draws whatever it is
   handed, so a field in the wrong place here is a heads-up display with the
   wrong tasks on it, and nothing on either side would say so.

   Run with: node --test tests/ */

const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./harness');

const FILES = ['js/data-tasks.js', 'js/storage.js', 'js/ledger.js', 'js/ledger-out.js'];
const EXPOSE = [
  'getWeekKey', 'buildAgendaListText', 'encodeAgendaList', 'agendaListSignature',
  'agendaListField', 'agendaListStatus', 'agendaListCharacters',
  'agendaListTasksFor', 'noteAgendaListInGame', 'noteAgendaListHandedOver',
  'loadLedgerState', 'AGENDA_LIST_VERSION', 'saveArmoryData', 'applyAutoTask',
  'applyLedgerEnvelope', 'loadAutoSrc', 'ledgerCharKey', 'SECTIONS',
];

const CHAR = 'Kaelthas@area-52';

function setup(opts = {}) {
  const ctx = load(FILES, {
    currentChar: opts.currentChar || CHAR,
    characters: opts.characters || [CHAR],
    expose: EXPOSE,
  });
  ctx.localStorage.setItem('wow_midnight_chars',
    JSON.stringify(opts.characters || [CHAR]));
  return ctx;
}

function starred(ctx, ids, charName = CHAR) {
  ctx.localStorage.setItem('wow_mn_yourlist_' + charName, JSON.stringify(ids));
}

/* Records of one kind, as arrays of fields. The whole document is
   tab-separated lines, so this is all the parsing a test needs. */
function records(text, kind) {
  return text.split('\n')
    .filter((line) => line.startsWith(kind + '\t'))
    .map((line) => line.split('\t'));
}

/* ── The document ──────────────────────────────────────────────────────── */

test('the list names itself, its week and its origin', () => {
  const ctx = setup();
  starred(ctx, ['v1']);
  const { text } = ctx.buildAgendaListText();

  const lines = text.split('\n');
  assert.equal(lines[0], 'AGENDALIST\t2', 'the first record is the document header');
  assert.equal(records(text, 'w')[0][1], ctx.getWeekKey());
  assert.ok(Number(records(text, 'g')[0][1]) > 0, 'a generated timestamp');
  assert.equal(records(text, 'h')[0][1], 'agenda.7donuts.dev');
});

test('a task record carries every field the addon draws', () => {
  const ctx = setup();
  starred(ctx, ['v3']);
  ctx.localStorage.setItem('wow_mn_goals_' + CHAR + '_' + ctx.getWeekKey(),
    JSON.stringify({ v3: 4 }));

  const { text } = ctx.buildAgendaListText();
  const [row] = records(text, 't');

  // Field order is the contract. The addon indexes these positionally, so a
  // reordering here is a display with the goal in the name column.
  assert.deepEqual(row.slice(0, 8), [
    't', 'v3', 'vault', 'weekly', '8', 'keys', '0', '4',
  ]);
  assert.equal(row[8], 'Fill the Dungeon row: 1 / 4 / 8 Mythic+ keys');
});

test('a section record comes with the title and priority the site gave it', () => {
  const ctx = setup();
  starred(ctx, ['v1', 'm1']);
  const { text } = ctx.buildAgendaListText();

  const sections = records(text, 's');
  assert.deepEqual(sections.map((r) => [r[1], r[2], r[3]]), [
    ['vault', '1', 'Great Vault'],
    ['mythicplus', '2', 'Mythic+ Dungeons'],
  ]);
});

/* ── What goes in it ──────────────────────────────────────────────────── */

test('only starred tasks go in, and hidden ones stay out', () => {
  const ctx = setup();
  starred(ctx, ['v1', 'v2', 'm1']);
  // Hiding a task is the member saying they are not doing it. Putting it on a
  // heads-up display is the opposite of what hiding it meant.
  ctx.localStorage.setItem('wow_mn_hidden_' + CHAR, JSON.stringify({ v2: true }));

  const { text, tasks } = ctx.buildAgendaListText();
  assert.deepEqual(records(text, 't').map((r) => r[1]), ['v1', 'm1']);
  assert.equal(tasks, 2);
});

test('what the site already has ticked travels with the list', () => {
  const ctx = setup();
  starred(ctx, ['v1', 'v2']);
  ctx.localStorage.setItem('wow_mn_' + CHAR + '_' + ctx.getWeekKey(),
    JSON.stringify({ v1: true }));

  // So the display is right the moment it is imported rather than showing a
  // week's worth of finished work as still to do.
  const byId = {};
  for (const r of records(ctx.buildAgendaListText().text, 't')) byId[r[1]] = r[6];
  assert.equal(byId.v1, '1');
  assert.equal(byId.v2, '0');
});

test('finished tasks sink within their section, as they do on screen', () => {
  const ctx = setup();
  starred(ctx, ['v1', 'v2', 'v3']);
  ctx.localStorage.setItem('wow_mn_' + CHAR + '_' + ctx.getWeekKey(),
    JSON.stringify({ v1: true }));

  const ids = records(ctx.buildAgendaListText().text, 't').map((r) => r[1]);
  assert.equal(ids[ids.length - 1], 'v1', 'the done one is last');
});

test('the order the member dragged their list into is the order sent', () => {
  const ctx = setup();
  starred(ctx, ['v1', 'v2', 'v3']);
  ctx.localStorage.setItem('wow_mn_ylorder_' + CHAR, JSON.stringify(['v3', 'v1', 'v2']));

  const ids = records(ctx.buildAgendaListText().text, 't').map((r) => r[1]);
  assert.deepEqual(ids, ['v3', 'v1', 'v2']);
});

test('the member\'s own tasks come across under the id the site ticks', () => {
  const ctx = setup();
  starred(ctx, ['custom_mine', 'custom_bis_helm']);
  ctx.localStorage.setItem('wow_mn_custom_' + CHAR, JSON.stringify([
    { id: 'mine', name: 'Repair my gear' },
    { id: 'bis_helm', name: 'Helm of the Deep' },
  ]));

  const { text } = ctx.buildAgendaListText();
  const rows = records(text, 't');
  const byId = Object.fromEntries(rows.map((r) => [r[1], r]));

  // The "custom_" prefix is a site-side distinction; resolving it here means
  // the addon only ever sees the id the box is ticked under.
  assert.ok(byId['custom_mine'], 'a custom task keeps its prefixed id');
  assert.equal(byId['custom_mine'][2], 'custom');
  assert.equal(byId['custom_bis_helm'][2], 'bis', 'gear targets get their own group');
  assert.deepEqual(records(text, 's').map((r) => r[1]), ['bis', 'custom']);
});

test('every character with a list contributes a block, and empty ones do not', () => {
  const ctx = setup({ characters: ['Kaelthas@area-52', 'Alt@area-52', 'Bare@area-52'] });
  starred(ctx, ['v1', 'v2'], 'Kaelthas@area-52');
  starred(ctx, ['m1'], 'Alt@area-52');
  starred(ctx, [], 'Bare@area-52');

  const { text, characters, tasks } = ctx.buildAgendaListText();
  assert.equal(characters, 2);
  assert.equal(tasks, 3);

  const chars = records(text, 'c');
  assert.deepEqual(chars.map((r) => r[1]), ['kaelthas-area52', 'alt-area52']);
  assert.deepEqual(chars[0].slice(2, 4), ['Kaelthas', 'area-52']);

  // The character key is the addon's own, so the addon can match the list to
  // whoever is logged in without being taught the site's naming.
  assert.equal(chars[0][1], ctx.ledgerCharKey('Kaelthas', 'area-52'));

  // A section two characters share appears once: section records are
  // account-wide and the addon looks them up by id.
  const seen = records(text, 's').map((r) => r[1]);
  assert.equal(new Set(seen).size, seen.length, 'no section is emitted twice');
});

/* ── Making it safe to hand over ──────────────────────────────────────── */

test('a name cannot break the record format or the game\'s text escaping', () => {
  const ctx = setup();
  starred(ctx, ['custom_odd']);
  ctx.localStorage.setItem('wow_mn_custom_' + CHAR, JSON.stringify([
    // A tab would shift every field after it; a pipe is WoW's own escape
    // character and would eat whatever followed it on screen. Both come from
    // custom tasks, which the member types themselves.
    { id: 'odd', name: 'Tab\there\tand |cffff0000red|r and\na newline' },
  ]));

  const { text } = ctx.buildAgendaListText();
  const rows = records(text, 't');
  assert.equal(rows.length, 1, 'still one record');
  assert.equal(rows[0].length, 10, 'still ten fields');
  assert.ok(!rows[0][8].includes('|'), 'the pipe is gone');
  assert.equal(rows[0][8], 'Tab here and /cffff0000red/r and a newline');
});

test('a very long name is cut rather than sent whole', () => {
  const ctx = setup();
  starred(ctx, ['custom_long']);
  ctx.localStorage.setItem('wow_mn_custom_' + CHAR, JSON.stringify([
    { id: 'long', name: 'x'.repeat(400) },
  ]));
  const row = records(ctx.buildAgendaListText().text, 't')[0];
  assert.ok(row[8].length <= 120, 'the addon draws these in a fixed-width row');
});

/* ── The transport ────────────────────────────────────────────────────── */

test('the payload names its transport and is smaller compressed', async () => {
  const ctx = setup();
  starred(ctx, ['v1', 'v2', 'v3', 'm1', 'mc1', 'mc2', 'mc3']);

  const built = await ctx.encodeAgendaList();
  assert.equal(built.transport, 'AGL2', 'deflated where the browser can');
  assert.match(built.payload, /^AGL2:[A-Za-z0-9+/=]+$/);
  assert.ok(built.payload.length < built.text.length,
    'a longer paste is a worse experience');
});

test('a browser without a compressor still produces a usable payload', async () => {
  const ctx = setup();
  starred(ctx, ['v1']);
  // Failing to hand the member anything because the compressor is missing
  // would be a worse outcome than a longer string.
  ctx.CompressionStream = undefined;

  const built = await ctx.encodeAgendaList();
  assert.equal(built.transport, 'AGL1');
  assert.match(built.payload, /^AGL1:[A-Za-z0-9+/=]+$/);
  assert.equal(Buffer.from(built.payload.slice(5), 'base64').toString('utf8'), built.text);
});

test('the payload survives characters outside Latin-1', async () => {
  const ctx = setup();
  starred(ctx, ['custom_curly']);
  // btoa refuses anything above U+00FF, and the checklist is full of curly
  // apostrophes, so the encoder has to go through UTF-8 first.
  ctx.localStorage.setItem('wow_mn_custom_' + CHAR, JSON.stringify([
    { id: 'curly', name: 'Ashes of Al’ar — Ula’tek' },
  ]));
  ctx.CompressionStream = undefined;

  const built = await ctx.encodeAgendaList();
  const back = Buffer.from(built.payload.slice(5), 'base64').toString('utf8');
  assert.match(back, /Ashes of Al’ar/);
});

/* ── The signature ────────────────────────────────────────────────────── */

test('the signature is stable, eight hex digits, and moves with the list', () => {
  const ctx = setup();
  const a = ctx.agendaListSignature('AGENDALIST\t1\n');
  assert.equal(a, ctx.agendaListSignature('AGENDALIST\t1\n'));
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.notEqual(a, ctx.agendaListSignature('AGENDALIST\t1\nw\t2026-09-01\n'));
});

test('the site can tell the member their in-game list has moved on', () => {
  const ctx = setup();

  // Nothing starred: there is nothing to put in game, and saying "out of
  // date" would be answering a question nobody asked.
  assert.equal(ctx.agendaListStatus().state, 'empty');

  starred(ctx, ['v1', 'v2']);
  assert.equal(ctx.agendaListStatus().state, 'never', 'never handed over yet');

  // The addon reports the signature of whatever list it holds.
  const held = ctx.buildAgendaListText().signature;
  ctx.noteAgendaListInGame({ sig: held, tasks: 2, imported: 1756900000 });
  assert.equal(ctx.agendaListStatus().state, 'current');

  // Star one more and the display in game is showing a list that no longer
  // exists. Without this, "why isn't my new task in the HUD" has no answer.
  starred(ctx, ['v1', 'v2', 'm1']);
  const stale = ctx.agendaListStatus();
  assert.equal(stale.state, 'stale');
  assert.match(stale.text, /Copy it again/);
});

/* ── Telling the addon what Battle.net already answered ─────────────────── */

test('a task Battle.net has already answered is marked on the way out', () => {
  /* The addon sees raid kills and keystones too, and reported all of them
     back in every envelope: a second copy of what the site already had from
     a source that needed nothing installed and no reload. Marking them here
     is what lets the addon stop. */
  const ctx = setup();
  starred(ctx, ['m1', 'v3']);

  // Covered by Battle.net, and it has actually answered m1.
  ctx.saveArmoryData(CHAR, { covers: ['m1', 'v3'] });
  ctx.applyAutoTask(CHAR, 'm1', { done: true }, 'armory');

  const rows = ctx.buildAgendaListText().text.split('\n').filter(l => l.startsWith('t\t'));
  const byId = {};
  for (const line of rows) { const f = line.split('\t'); byId[f[1]] = f; }

  assert.equal(byId.m1[9], '1', 'answered, so the addon need not report it');
  assert.equal(byId.v3[9], '0',
    'covered but not answered: the API may simply be lagging, and dropping it '
    + 'would lose a real observation');
});

test('coverage alone never marks a task settled', () => {
  // The distinction the whole optimisation rests on. What gets suppressed is
  // a duplicate of something the site holds, never an observation only the
  // addon has.
  const ctx = setup();
  starred(ctx, ['m1']);
  ctx.saveArmoryData(CHAR, { covers: ['m1'] });

  const line = ctx.buildAgendaListText().text.split('\n').find(l => l.startsWith('t\tm1\t'));
  assert.equal(line.split('\t')[9], '0');
});

test('a task the addon ticked is not marked back at the addon', () => {
  /* Done, but done by the addon rather than by Battle.net. Marking it would
     tell the addon to stop reporting the only thing keeping it ticked, and
     the box would fall off the next time the week rolled. */
  const ctx = setup();
  starred(ctx, ['d1']);
  ctx.saveArmoryData(CHAR, { covers: ['m1'] });   // d1 is not covered
  ctx.applyAutoTask(CHAR, 'd1', { done: true }, 'addon');

  const line = ctx.buildAgendaListText().text.split('\n').find(l => l.startsWith('t\td1\t'));
  assert.equal(line.split('\t')[9], '0');
});

test('the document version says it carries the field', () => {
  // Appended rather than inserted, so a version 1 reader stops early and is
  // correct rather than merely tolerated.
  const ctx = setup();
  starred(ctx, ['v1']);
  assert.equal(ctx.AGENDA_LIST_VERSION, 2);
  const header = ctx.buildAgendaListText().text.split('\n')[0];
  assert.equal(header, 'AGENDALIST\t2');
});

test('a list just copied does not read as out of date', () => {
  /* The bug this pins: the only signal the site had was the one the addon
     sends back in an envelope, and an envelope needs a /reload. So copying
     the list and looking at the status a second later said "out of date",
     which is precisely wrong: the member had just done the thing being asked
     of them, and the site would keep asking until they logged out. */
  const ctx = setup();
  starred(ctx, ['v1', 'v2']);
  const held = ctx.buildAgendaListText().signature;
  ctx.noteAgendaListInGame({ sig: held, tasks: 2 });
  assert.equal(ctx.agendaListStatus().state, 'current');

  // Star another, then take the new list. Between the copy and the next
  // /reload there is nothing the site can observe, so it says so.
  starred(ctx, ['v1', 'v2', 'm1']);
  assert.equal(ctx.agendaListStatus().state, 'stale');

  ctx.noteAgendaListHandedOver(ctx.buildAgendaListText().signature);
  const pending = ctx.agendaListStatus();
  assert.equal(pending.state, 'pending');
  assert.match(pending.text, /next sync/);

  // The envelope comes back holding it. Now it is confirmed, not assumed.
  ctx.noteAgendaListInGame({ sig: ctx.buildAgendaListText().signature, tasks: 3 });
  assert.equal(ctx.agendaListStatus().state, 'current');
  assert.equal(ctx.loadLedgerState().agendaHanded, undefined,
    'a confirmed hand-over is spent, not kept');
});

test('a hand-over that never reached the game goes stale like anything else', () => {
  /* "Pending" must not be a state the member can get stuck in. If they copy
     the list and then edit it again without ever pasting, what is in game is
     neither of those lists and the status has to say so. */
  const ctx = setup();
  starred(ctx, ['v1']);
  ctx.noteAgendaListHandedOver(ctx.buildAgendaListText().signature);
  assert.equal(ctx.agendaListStatus().state, 'pending');

  starred(ctx, ['v1', 'v2']);
  assert.equal(ctx.agendaListStatus().state, 'stale');
});

test('an addon reporting no list clears the comparison rather than keeping it', () => {
  const ctx = setup();
  starred(ctx, ['v1']);
  ctx.noteAgendaListInGame({ sig: ctx.buildAgendaListText().signature });
  assert.equal(ctx.agendaListStatus().state, 'current');

  // The member cleared it in game. Continuing to say "current" would point
  // them at a display that is not there.
  ctx.noteAgendaListInGame({});
  assert.equal(ctx.agendaListStatus().state, 'never');
  assert.equal(ctx.loadLedgerState().agendaSignature, null);
});

/* ── Back the other way ───────────────────────────────────────────────── */

test('a tick made on the in-game display is labelled as the member\'s own', () => {
  const ctx = setup();
  const week = ctx.getWeekKey();

  ctx.applyLedgerEnvelope({
    fmt: 'PLW2', v: 2, generated: Math.floor(Date.now() / 1000), addon: '0.9.3',
    week,
    characters: {
      'kaelthas-area52': {
        name: 'Kaelthas', realm: 'area-52',
        objectives: {
          // Ticked by hand on the heads-up display, versus reported by the
          // game. Different claims, and they fail in different ways.
          v1: { done: true, src: 'manual' },
          v2: { done: true },
        },
        bosses: {},
      },
    },
    collections: {},
    agenda: { sig: 'deadbeef', tasks: 4, imported: 1756900000 },
  });

  const src = ctx.loadAutoSrc('Kaelthas@area-52');
  assert.equal(src.v1, 'addon-manual');
  assert.equal(src.v2, 'addon');

  // And the envelope's report of which list is in game was recorded.
  assert.equal(ctx.loadLedgerState().agendaSignature, 'deadbeef');
});
