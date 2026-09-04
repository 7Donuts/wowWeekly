/* The state API end to end, through the worker's own fetch handler.

   tests/state.test.js covers the merge rules and the store's SQL directly.
   This covers the surface: authentication, what happens when the D1 binding
   is absent, the client-driven import off the old blob, and the share
   endpoint's two paths. Those are the parts where the cutover can go wrong
   for somebody who has done nothing but open the site.

   Run with: node --test tests/ */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { makeD1 } = require('./d1');

const TOKEN = 'test-service-token';
const SUB = 'sub-abc';
const CHAR = 'Kaelthas@area-52';
const WEEK = '2026-09-01';
const IN_WEEK = Math.floor(Date.parse('2026-09-03T20:00:00Z') / 1000);

let worker, signJWT;
test.before(async () => {
  worker = (await import(path.join(__dirname, '..', '_worker.js'))).default;
  // The worker does not export its signer, so a session cookie is minted the
  // same way it does: HS256 over the same secret.
  const crypto = require('node:crypto');
  signJWT = (payload, secret) => {
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const head = b64({ alg: 'HS256', typ: 'JWT' });
    const now = Math.floor(Date.now() / 1000);
    const body = b64({ ...payload, iat: now, exp: now + 3600 });
    const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
    return `${head}.${body}.${sig}`;
  };
});

function kv(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    async get(key, opts) {
      const raw = data.get(key);
      if (raw === undefined) return null;
      return opts?.type === 'json' ? JSON.parse(raw) : raw;
    },
    async put(key, value) { data.set(key, String(value)); },
    async delete(key) { data.delete(key); },
    dump: () => Object.fromEntries(data),
  };
}

function makeEnv(seed = {}, over = {}) {
  return {
    USER_DATA: kv(seed),
    DB: makeD1(),
    SESSION_SECRET: 'session-secret',
    AGENDA_SERVICE_TOKEN: TOKEN,
    ASSETS: { fetch: async () => new Response('static', { status: 200 }) },
    ...over,
  };
}

function call(env, url, init = {}) {
  return worker.fetch(new Request(`https://agenda.test${url}`, init), env);
}

function asMember(env, extra = {}) {
  const token = signJWT({ sub: SUB, battletag: 'Kael#1234', region: 'us' },
                        env.SESSION_SECRET);
  return {
    ...extra,
    headers: { Cookie: `session=${token}`, 'Content-Type': 'application/json', ...(extra.headers || {}) },
  };
}

function asTabard() { return { headers: { Authorization: `Bearer ${TOKEN}` } }; }

const CONSENTED = {
  ['consent:' + SUB]: JSON.stringify({
    v: 1, updated: 1, discord: null,
    scopes: { 'agenda.weekly': true, 'rating.self': true, 'rating.profile': true },
  }),
};

function post(env, url, body) {
  return call(env, url, asMember(env, { method: 'POST', body: JSON.stringify(body) }));
}

/* ── Authentication ─────────────────────────────────────────────────────── */

test('the state API is closed to anyone without a session', async () => {
  const env = makeEnv();
  for (const [url, init] of [
    ['/api/state', {}],
    ['/api/weeks', {}],
    ['/api/observe', { method: 'POST', body: '{}' }],
    ['/api/list', { method: 'PUT', body: '{}' }],
  ]) {
    const res = await call(env, url, init);
    assert.equal(res.status, 401, url + ' must not answer without a session');
  }
});

test('a session for one member cannot read another\'s state', async () => {
  const env = makeEnv();
  await post(env, '/api/observe', {
    characters: [{ charId: CHAR, name: 'Kaelthas' }],
    tasks: [{ charId: CHAR, taskId: 'v1', done: true, source: 'member', at: IN_WEEK }],
  });

  // Every row is keyed by the sub from the signed cookie, never from the
  // request body, so there is nothing for a caller to ask for on somebody
  // else's behalf.
  const other = signJWT({ sub: 'someone-else' }, env.SESSION_SECRET);
  const res = await call(env, '/api/state', { headers: { Cookie: `session=${other}` } });
  const state = await res.json();
  assert.deepEqual(state.characters, []);
  assert.deepEqual(state.byChar, {});
});

/* ── Without the binding ────────────────────────────────────────────────── */

test('with no D1 bound the API says so instead of failing', async () => {
  // The cutover is not a flag day: the binding stays commented out until the
  // database exists, and until then the site runs on the KV blobs exactly as
  // it did. A 500 here would take the page down for everyone.
  const env = makeEnv({}, { DB: undefined });
  const res = await call(env, '/api/state', asMember(env));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { unavailable: true, reason: 'no-d1' });

  const observed = await post(env, '/api/observe', { tasks: [] });
  assert.equal(observed.status, 200);
  assert.equal((await observed.json()).unavailable, true);
});

/* ── Observing ──────────────────────────────────────────────────────────── */

test('an observation round trips through the API', async () => {
  const env = makeEnv();
  const res = await post(env, '/api/observe', {
    characters: [{ charId: CHAR, name: 'Kaelthas', realmSlug: 'area-52' }],
    tasks: [
      { charId: CHAR, taskId: 'v1', done: true, source: 'member', at: IN_WEEK },
      { charId: CHAR, taskId: 'v3', value: 6, source: 'addon', at: IN_WEEK },
    ],
  });
  assert.equal(res.status, 200);
  const report = await res.json();
  assert.equal(report.applied, 2);
  assert.equal(report.weeks[WEEK][CHAR].v1.done, true);
  assert.equal(report.weeks[WEEK][CHAR].v3.value, 6);

  const state = await (await call(env, '/api/state', asMember(env))).json();
  assert.equal(state.week, WEEK);
  assert.equal(state.byChar[CHAR].tasks.v1.done, true);
  assert.equal(state.byChar[CHAR].tasks.v3.value, 6);
});

test('malformed JSON is a 400 rather than a 500', async () => {
  const env = makeEnv();
  const res = await call(env, '/api/observe',
    asMember(env, { method: 'POST', body: 'not json at all' }));
  assert.equal(res.status, 400);
});

test('a list needs a character to belong to', async () => {
  const env = makeEnv();
  const res = await call(env, '/api/list',
    asMember(env, { method: 'PUT', body: JSON.stringify({ entries: ['v1'] }) }));
  assert.equal(res.status, 400);
});

test('a saved list comes back in the order it was sent', async () => {
  const env = makeEnv();
  await post(env, '/api/observe', { characters: [{ charId: CHAR, name: 'Kaelthas' }] });
  const res = await call(env, '/api/list', asMember(env, {
    method: 'PUT',
    body: JSON.stringify({
      charId: CHAR,
      entries: [{ taskId: 'v3' }, { taskId: 'v1' }, { taskId: 'v2', hidden: true }],
      custom: [{ id: 'mine', name: 'Repair my gear' }],
    }),
  }));
  assert.equal(res.status, 200);

  const state = await (await call(env, '/api/state', asMember(env))).json();
  assert.deepEqual(state.byChar[CHAR].list, ['v3', 'v1']);
  assert.deepEqual(state.byChar[CHAR].hidden, { v2: true });
  assert.equal(state.byChar[CHAR].custom[0].name, 'Repair my gear');
});

/* ── The cutover off the old blob ───────────────────────────────────────── */

test('an import marks the account migrated, and is safe to repeat', async () => {
  const env = makeEnv();
  const payload = {
    migrate: true,
    migrateNote: '1 character',
    characters: [{ charId: CHAR, name: 'Kaelthas' }],
    tasks: [{ charId: CHAR, taskId: 'v1', done: true, source: 'member', at: IN_WEEK }],
  };

  const first = await (await post(env, '/api/observe', payload)).json();
  assert.equal(first.applied, 1);

  let state = await (await call(env, '/api/state', asMember(env))).json();
  assert.ok(state.migrated, 'the account is recorded as folded in');

  // A member who opens the site on three devices at once submits three
  // imports. The merge rules make that harmless; this checks it stays so.
  const second = await (await post(env, '/api/observe', payload)).json();
  assert.equal(second.applied, 0);

  state = await (await call(env, '/api/state', asMember(env))).json();
  assert.equal(Object.keys(state.byChar[CHAR].tasks).length, 1);
});

test('an account with nothing to import is still marked migrated', async () => {
  // Otherwise the share endpoint keeps falling back to a blob that is empty,
  // and the account never actually moves across.
  const env = makeEnv();
  await post(env, '/api/observe', { migrate: true, tasks: [], characters: [] });
  const state = await (await call(env, '/api/state', asMember(env))).json();
  assert.ok(state.migrated);
});

/* ── What Tabard sees ───────────────────────────────────────────────────── */

test('the share API reads rows once the account has moved across', async () => {
  const env = makeEnv(CONSENTED);
  await post(env, '/api/observe', {
    migrate: true,
    characters: [{ charId: CHAR, name: 'Kaelthas', realmSlug: 'area-52',
                   className: 'Mage', ilvl: 302, mythicRating: 2450 }],
    tasks: [
      { charId: CHAR, taskId: 'v1', done: true, source: 'addon', at: IN_WEEK },
      { charId: CHAR, taskId: 'v3', value: 4, source: 'member', at: IN_WEEK },
    ],
  });
  await call(env, '/api/list', asMember(env, {
    method: 'PUT',
    body: JSON.stringify({ charId: CHAR, entries: ['v1', 'v3', 'v9'] }),
  }));

  const res = await call(env, '/api/share/agenda?sub=' + SUB, asTabard());
  assert.equal(res.status, 200);
  const body = await res.json();

  // Tabard's contract is unchanged: same shape, different source.
  assert.equal(body.week, WEEK);
  assert.equal(body.characters.length, 1);
  const c = body.characters[0];
  assert.equal(c.name, CHAR);
  assert.equal(c.className, 'Mage');
  assert.equal(c.ilvl, 302);
  assert.equal(c.tracked, 3, 'Your List is the denominator, not the whole checklist');
  assert.equal(c.done, 1);
  assert.deepEqual(c.items.find((i) => i.id === 'v1'), { id: 'v1', done: true, value: null, source: 'addon' });
  // A starred task nothing has touched is still on the list, at zero.
  assert.deepEqual(c.items.find((i) => i.id === 'v9'), { id: 'v9', done: false, value: null, source: null });
});

test('the share API falls back to the blob for an account not yet moved', async () => {
  /* The case that would otherwise go quiet: a member who has not opened the
     site since the cutover has no rows, because the import is client-driven.
     Reading the blob one more time is better than telling Tabard they have
     nothing. */
  const env = makeEnv({
    ...CONSENTED,
    ['user:' + SUB]: JSON.stringify({
      wow_midnight_chars: ['Legacy'],
      ['wow_mn_yourlist_Legacy']: ['v1', 'v2'],
      [`wow_mn_Legacy_${WEEK}`]: { v1: true },
    }),
  });

  const body = await (await call(env, '/api/share/agenda?sub=' + SUB, asTabard())).json();
  assert.equal(body.characters.length, 1);
  assert.equal(body.characters[0].name, 'Legacy');
  assert.equal(body.characters[0].tracked, 2);
});

test('the envelope records what the addon is holding without merging it', async () => {
  const env = makeEnv(CONSENTED);
  await post(env, '/api/observe', { migrate: true, characters: [{ charId: CHAR, name: 'K' }] });

  const res = await call(env, '/api/ledger', asMember(env, {
    method: 'PUT',
    body: JSON.stringify({
      fmt: 'PLW2', v: 2, addon: '0.10.0', generated: IN_WEEK, week: WEEK,
      characters: {}, collections: {},
      agenda: { sig: '2abec521', week: WEEK, tasks: 24, imported: IN_WEEK },
    }),
  }));
  assert.equal(res.status, 200);

  const body = await (await call(env, '/api/share/agenda?sub=' + SUB, asTabard())).json();
  assert.deepEqual(body.ledger, { generated: IN_WEEK, addon: '0.10.0' });
  // The hash of the in-game list, so a card can say the display is out of
  // date. The list itself never travels back.
  assert.equal(body.agenda.sig, '2abec521');
  assert.equal(body.agenda.tasks, 24);
});

test('a PLW1 envelope is still accepted and a nonsense one is not', async () => {
  const env = makeEnv();
  const put = (body) => call(env, '/api/ledger',
    asMember(env, { method: 'PUT', body: JSON.stringify(body) }));

  assert.equal((await put({ fmt: 'PLW1', v: 1, characters: {} })).status, 200);
  assert.equal((await put({ fmt: 'PLW2', v: 1, characters: {} })).status, 400);
  assert.equal((await put({ fmt: 'NOPE', v: 9 })).status, 400);
});

/* ── History ────────────────────────────────────────────────────────────── */

test('the weeks endpoint answers what the blob design could not', async () => {
  const env = makeEnv();
  await post(env, '/api/observe', {
    characters: [{ charId: CHAR, name: 'K' }],
    tasks: [
      { charId: CHAR, taskId: 'v1', done: true, source: 'member', at: IN_WEEK },
      { charId: CHAR, taskId: 'v2', done: true, source: 'member', at: IN_WEEK },
      { charId: CHAR, taskId: 'v1', done: true, source: 'member',
        at: IN_WEEK - 7 * 86400 },
    ],
  });

  const body = await (await call(env, '/api/weeks', asMember(env))).json();
  assert.deepEqual(body.weeks, [
    { week: WEEK, tasks: 2, done: 2 },
    { week: '2026-08-25', tasks: 1, done: 1 },
  ]);
});
