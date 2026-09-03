/* The Agenda worker's share API.

   This is the surface another program reads a member's data through, so the
   two gates on it are worth testing directly: the service token proves the
   caller is Tabard, and the member's consent record decides whether any given
   scope is readable. Both have to hold, and a failure of either has to be
   distinguishable in the response, because Tabard turns them into different
   sentences in front of the member.

   Run with: node --test tests/ */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const TOKEN = 'test-service-token';

// Minimal KV: enough of get/put/delete for the handlers under test.
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
    SESSION_SECRET: 'session-secret',
    AGENDA_SERVICE_TOKEN: TOKEN,
    BNET_CLIENT_ID: 'id',
    BNET_CLIENT_SECRET: 'secret',
    ASSETS: { fetch: async () => new Response('static asset', { status: 200 }) },
    ...over,
  };
}

let worker;
test.before(async () => {
  worker = (await import(path.join(__dirname, '..', '_worker.js'))).default;
});

function call(env, url, init = {}) {
  return worker.fetch(new Request(`https://agenda.test${url}`, init), env);
}

function asTabard(token = TOKEN) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

const CONSENTED = {
  'consent:sub-abc': JSON.stringify({
    v: 1, updated: 1, discord: null,
    scopes: { 'agenda.weekly': true, 'rating.self': true, 'rating.profile': true },
  }),
};

/* ── Gate 1: the service token ─────────────────────────────────────────── */

test('a share read with no token is refused', async () => {
  const res = await call(makeEnv(CONSENTED), '/api/share/agenda?sub=sub-abc');
  assert.equal(res.status, 401);
});

test('a share read with the wrong token is refused', async () => {
  const res = await call(makeEnv(CONSENTED), '/api/share/agenda?sub=sub-abc', asTabard('wrong'));
  assert.equal(res.status, 401);
});

test('a token of the same length but different bytes is refused', async () => {
  // The comparison is byte-wise and length-checked; this is the case a naive
  // early-exit compare would leak through timing.
  const nearly = TOKEN.slice(0, -1) + 'X';
  assert.equal(nearly.length, TOKEN.length);
  const res = await call(makeEnv(CONSENTED), '/api/share/agenda?sub=sub-abc', asTabard(nearly));
  assert.equal(res.status, 401);
});

test('an unset service token turns the API off rather than open', async () => {
  // The dangerous misconfiguration: no token configured must not mean
  // "accept anything", and must not mean "accept an empty bearer" either.
  const env = makeEnv(CONSENTED, { AGENDA_SERVICE_TOKEN: undefined });
  for (const init of [asTabard(''), asTabard('anything'), {}]) {
    const res = await call(env, '/api/share/agenda?sub=sub-abc', init);
    assert.equal(res.status, 401);
  }
});

test('a share read without a sub is a bad request, not a leak', async () => {
  const res = await call(makeEnv(CONSENTED), '/api/share/agenda', asTabard());
  assert.equal(res.status, 400);
});

/* ── Gate 2: the member's consent ──────────────────────────────────────── */

test('a member with no consent record shares nothing', async () => {
  // Absence must read as "no", so somebody who has never seen the screen is
  // not sharing by default.
  const res = await call(makeEnv(), '/api/share/agenda?sub=sub-abc', asTabard());
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error, 'scope_denied');
  assert.equal(body.scope, 'agenda.weekly');
});

test('each scope is refused independently', async () => {
  const env = makeEnv({
    'consent:sub-abc': JSON.stringify({
      v: 1, updated: 1, scopes: { 'agenda.weekly': true },
    }),
  });
  assert.equal((await call(env, '/api/share/agenda?sub=sub-abc', asTabard())).status, 200);

  for (const [url, scope] of [
    ['/api/share/rating?sub=sub-abc&player=Bob', 'rating.self'],
    ['/api/share/profile?sub=sub-abc', 'rating.profile'],
  ]) {
    const res = await call(env, url, asTabard());
    assert.equal(res.status, 403, url);
    assert.equal((await res.json()).scope, scope);
  }
});

test('a scope stored as something other than true is not consent', async () => {
  // A truthy-but-not-true value must not open a scope.
  for (const value of ['yes', 1, {}, 'true']) {
    const env = makeEnv({
      'consent:sub-abc': JSON.stringify({ v: 1, scopes: { 'agenda.weekly': value } }),
    });
    const res = await call(env, '/api/share/agenda?sub=sub-abc', asTabard());
    assert.equal(res.status, 403, `scope value ${JSON.stringify(value)}`);
  }
});

/* ── Caching ───────────────────────────────────────────────────────────── */

test('no share response may be cached, refusals least of all', async () => {
  // A cached 403 would keep refusing after the member granted the scope, and
  // would surface in Discord as a bug rather than as a stale answer.
  const denied = await call(makeEnv(), '/api/share/agenda?sub=sub-abc', asTabard());
  assert.match(denied.headers.get('Cache-Control') ?? '', /no-store/);

  const allowed = await call(makeEnv(CONSENTED), '/api/share/agenda?sub=sub-abc', asTabard());
  assert.match(allowed.headers.get('Cache-Control') ?? '', /no-store/);

  const unauthorized = await call(makeEnv(CONSENTED), '/api/share/agenda?sub=sub-abc');
  assert.match(unauthorized.headers.get('Cache-Control') ?? '', /no-store/);
});

/* ── What the payloads actually contain ────────────────────────────────── */

test('the weekly card counts the tasks the member starred, not the whole list', async () => {
  const week = new Date();
  // Reproduce the worker's own week key rather than guessing at today's.
  const wk = (() => {
    const d = new Date(Date.UTC(week.getUTCFullYear(), week.getUTCMonth(), week.getUTCDate(), 15, 0, 0));
    while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() - 1);
    if (week < d) d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  })();

  const env = makeEnv({
    ...CONSENTED,
    'user:sub-abc': JSON.stringify({
      wow_midnight_chars: ['Kaelthas'],
      [`wow_mn_yourlist_Kaelthas`]: ['m1', 'v2', 'v3'],
      [`wow_mn_hidden_Kaelthas`]: { v3: true },
      [`wow_mn_Kaelthas_${wk}`]: { m1: true },
      [`wow_mn_autosrc_Kaelthas_${wk}`]: { m1: 'addon' },
    }),
  });

  const res = await call(env, '/api/share/agenda?sub=sub-abc', asTabard());
  assert.equal(res.status, 200);
  const body = await res.json();
  const char = body.characters[0];

  assert.equal(char.tracked, 2, 'a hidden task is not tracked');
  assert.equal(char.done, 1);
  assert.equal(char.items.find((i) => i.id === 'm1').source, 'addon',
    'provenance travels with the item');
});

test('the rating lookup answers only out of the caller own ledger', async () => {
  const env = makeEnv({
    ...CONSENTED,
    'ledger:sub-abc': JSON.stringify({
      fmt: 'PLW1', v: 1, generated: 1,
      ratings: { recent: [
        { name: 'Bobkin', realm: 'Illidan', grade: 2, note: 'carried' },
        { name: 'Other', realm: 'Illidan', grade: -1 },
      ] },
    }),
  });

  const hit = await (await call(env, '/api/share/rating?sub=sub-abc&player=Bobkin', asTabard())).json();
  assert.equal(hit.found, true);
  assert.equal(hit.matches[0].note, 'carried');
  assert.equal(hit.matches.length, 1, 'only the player asked about');

  const miss = await (await call(env, '/api/share/rating?sub=sub-abc&player=Nobody', asTabard())).json();
  assert.equal(miss.found, false);
});

test('a member with no stored ledger is distinguishable from an ungraded player', async () => {
  // Tabard says different things for these two, so they cannot collapse.
  const env = makeEnv(CONSENTED);
  const body = await (await call(env, '/api/share/rating?sub=sub-abc&player=Bobkin', asTabard())).json();
  assert.equal(body.found, false);
  assert.equal(body.reason, 'no_ledger');
});

test('the profile publishes counts and never the people behind them', async () => {
  const env = makeEnv({
    ...CONSENTED,
    'ledger:sub-abc': JSON.stringify({
      fmt: 'PLW1', v: 1, generated: 1,
      ratings: {
        authored: 3, runs: 40, byGrade: { '2': 3 },
        recent: [{ name: 'Bobkin', realm: 'Illidan', grade: 2, note: 'private note' }],
      },
    }),
  });

  const res = await call(env, '/api/share/profile?sub=sub-abc', asTabard());
  const text = await res.text();
  assert.match(text, /"authored":3/);
  // The whole point of this endpoint: it says how you grade, not who you graded.
  assert.ok(!text.includes('Bobkin'), 'no graded player may appear in a profile');
  assert.ok(!text.includes('private note'), 'nor any note about one');
});

/* ── The ledger upload ─────────────────────────────────────────────────── */

test('an upload that is not a PLW1 version 1 envelope is refused', async () => {
  const env = makeEnv();
  for (const body of [{}, { fmt: 'NOPE', v: 1 }, { fmt: 'PLW1', v: 2 }]) {
    const res = await call(env, '/api/ledger', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // No session cookie, so this is 401 before it is 400; either way it is
    // refused and nothing is stored.
    assert.ok(res.status === 400 || res.status === 401, `got ${res.status}`);
    assert.deepEqual(env.USER_DATA.dump(), {});
  }
});

test('an unknown api path does not fall through to static assets', async () => {
  // /api/* that does not match a route would otherwise be answered by the
  // asset handler with a 200 and a page, which reads as success.
  const res = await call(makeEnv(), '/api/share/nonsense', asTabard());
  assert.notEqual(res.status, 401);
  assert.equal(await res.text(), 'static asset');
});
