/* Does index.html's script bundle actually load?

   It did not, for two commits. Moving the persistence layer out of js/app.js
   took the block of app-state declarations above it with it, and every one of
   `characters`, `currentChar`, `activeFilters`, `collapsed`, `revealHidden`,
   `editingYourList`, `yourListGrouped`, `searchQuery`, `lastChanceMode`,
   `hideSeason1`, `FUNCTIONAL_TAGS`, `CADENCE_FILTERS` and `sectionInSeason`
   became undeclared. app.js calls renderChars() at the bottom of the file, so
   the first thing the page did on load was throw ReferenceError and stop:
   the shell painted, the objective list stayed empty, the ring stayed at 0%
   and the countdown stayed on "calculating". The Battle.net import modal
   reported "characters is not defined" because its fetch handler was the one
   place that caught the error and showed it.

   The whole suite passed the entire time. Every test loaded storage.js,
   state.js or ledger.js and none loaded app.js, and tests/harness.js hands
   `characters` and `currentChar` to the sandbox itself, so the declarations
   that had gone missing were supplied by the harness in the only place they
   were checked.

   So this loads what the page loads, in the page's order, in one shared
   scope, and runs it. It asserts nothing about pixels. It asserts that the
   scripts get through their top level, which is the difference between a
   working site and an empty one, and it is the cheapest test in the suite to
   keep passing. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { pageIds, makeDocument, Storage, ROOT } = require('./dom');

/* The page is the source of truth for what loads and in what order. Reading
   the <script> tags rather than listing the files means a new one is covered
   the moment it is added to the page.

   Inline blocks count as much as files: changelog.html and events.html define
   their handlers in one, so a bundle of only the src= scripts would report
   them as missing. */
function bundleParts(page) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const parts = [];
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src = /\ssrc="([^"]+)"/.exec(m[1]);
    if (src) {
      const rel = src[1].split('?')[0];
      parts.push({ label: rel, source: fs.readFileSync(path.join(ROOT, rel), 'utf8') });
    } else if (m[2].trim()) {
      parts.push({ label: page + ' inline #' + (parts.length + 1), source: m[2] });
    }
  }
  return parts;
}

function bundleFiles(page) {
  return bundleParts(page).map((p) => p.label);
}

/* Loads a page's bundle and returns its shared scope.

   Timers are collected rather than run. app.js starts a one-second countdown
   interval on load and the sync layer schedules pushes; letting either fire
   would test the scheduler instead of the boot, and would keep the process
   alive after the assertions. `expose` names declarations to hand back,
   because a top-level `let` is not a property of the global in a classic
   script. */
function boot(page, opts = {}) {
  const timers = [];
  const errors = [];
  const ids = pageIds(page);
  const document = makeDocument(ids);

  const sandbox = {
    console: { log() {}, warn() {}, error(...a) { errors.push(a.join(' ')); }, info() {}, debug() {} },
    document,
    localStorage: opts.localStorage || new Storage(),
    sessionStorage: new Storage(),
    location: { href: 'https://azerothagenda.com/' + page, search: '', hash: '', pathname: '/' + page, origin: 'https://azerothagenda.com', assign() {}, replace() {}, reload() {} },
    navigator: { userAgent: 'node', clipboard: { writeText: async () => {} }, language: 'en-US' },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    setTimeout: (fn, ms) => { timers.push({ kind: 'timeout', fn, ms }); return timers.length; },
    clearTimeout: () => {},
    setInterval: (fn, ms) => { timers.push({ kind: 'interval', fn, ms }); return timers.length; },
    clearInterval: () => {},
    requestAnimationFrame: (fn) => { timers.push({ kind: 'frame', fn, ms: 0 }); return timers.length; },
    cancelAnimationFrame: () => {},
    // No network during boot. A boot that depends on a reachable worker is
    // itself a bug, so this stays pending rather than resolving something up.
    fetch: () => new Promise(() => {}),
    atob: (s) => Buffer.from(String(s), 'base64').toString('binary'),
    btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),
    Storage,
    Blob, Response, Request, Headers, URL, URLSearchParams,
    TextDecoder, TextEncoder, DecompressionStream, CompressionStream,
    alert() {}, confirm: () => false, prompt: () => null,
    devicePixelRatio: 1, innerWidth: 1440, innerHeight: 900,
    scrollTo() {}, addEventListener() {}, removeEventListener() {},
    __exports: {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  const parts = bundleParts(page);
  assert.ok(parts.length, page + ' loads no scripts; this test is looking at the wrong file');

  const source = parts
    .map((part) => `\n/* ==== ${part.label} ==== */\n` + part.source)
    .join('\n');

  const exporter = (opts.expose || [])
    .map((n) => `if (typeof ${n} !== 'undefined') __exports.${n} = ${n};`)
    .join('\n');

  vm.runInContext(source + '\n' + exporter, sandbox, { filename: page + '-bundle.js' });
  Object.assign(sandbox, sandbox.__exports);
  return { sandbox, timers, errors, files: parts.map((part) => part.label) };
}

test('index.html\'s scripts load and get through init', () => {
  // A ReferenceError here means a declaration the renderer reaches for is
  // gone, and the page is blank in a browser. Nothing about this test is
  // subtle: it either loads or it does not.
  const { files } = boot('index.html');
  assert.ok(files.includes('js/app.js'), 'the bundle must include app.js');
  assert.ok(files.includes('js/storage.js'), 'the bundle must include storage.js');
});

test('the app-state declarations the renderer reads are all present', () => {
  /* The specific regression, named. Every one of these is read from at least
     one render path and several are reassigned, so they have to be
     declarations in the shared scope and not properties anybody assigns
     later. `typeof` would pass on an undeclared name, so each is read. */
  const names = [
    'characters', 'currentChar', 'activeFilters', 'activeTagFilter', 'collapsed',
    'revealHidden', 'editingYourList', 'yourListGrouped', 'searchQuery',
    'lastChanceMode', 'hideSeason1', 'FUNCTIONAL_TAGS', 'CADENCE_FILTERS',
  ];
  const { sandbox } = boot('index.html', { expose: names.concat(['sectionInSeason']) });
  for (const name of names) {
    assert.notEqual(sandbox[name], undefined, name + ' is not declared in the page bundle');
  }
  assert.equal(typeof sandbox.sectionInSeason, 'function', 'sectionInSeason must be defined');

  assert.ok(Array.isArray(sandbox.characters) && sandbox.characters.length,
    'characters must default to a non-empty roster');
  assert.equal(sandbox.currentChar, sandbox.characters[0],
    'currentChar must start on the first character');
});

test('storage.js reads the character the app state declares', () => {
  /* storage.js loads first and every one of its keys is built from
     currentChar, which it does not declare: app.js does, further down the
     bundle. That is fine on a page (one shared scope, and nothing calls into
     storage.js before init) and it is exactly why deleting the declaration
     broke the site rather than just app.js. This pins the arrangement down. */
  const localStorage = new Storage();
  localStorage.setItem('wow_midnight_chars', JSON.stringify(['Thrall@durotan', 'Jaina@dalaran']));
  const { sandbox } = boot('index.html', { localStorage, expose: ['storageKey', 'currentChar'] });

  assert.equal(sandbox.currentChar, 'Thrall@durotan');
  assert.match(sandbox.storageKey(), /^wow_mn_Thrall@durotan_\d{4}-\d{2}-\d{2}$/,
    'storageKey must be built from the character app.js selected');
});

/* Every function an inline handler in the markup names. `onclick="foo()"` is
   resolved off the global object when the click happens, so a function that
   has been renamed or deleted is a button that throws in the console and does
   nothing at all, with no sign of it at load. */
function inlineHandlerNames(page) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const names = new Set();
  for (const attr of html.matchAll(/\son[a-z]+="([^"]*)"/g)) {
    for (const call of attr[1].matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!JS_KEYWORDS.has(call[2])) names.add(call[2]);
    }
  }
  return [...names].sort();
}

// Control flow and operators that take a parenthesis and are not calls.
const JS_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function',
  'new', 'do', 'else', 'void', 'delete', 'in', 'of', 'await', 'try',
]);

test('every function the markup calls from a handler exists', () => {
  /* The import modal was where the outage surfaced, and it surfaced there for
     a reason worth keeping a test on: openImportChars is reached only from an
     onclick, so nothing at load touches it, and its own catch block turned a
     ReferenceError into "Failed to load characters (characters is not
     defined)" in the modal, which reads like the Battle.net call failed. */
  for (const page of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
    const names = inlineHandlerNames(page);
    if (!names.length) continue;
    const { sandbox } = boot(page, { expose: names });
    const missing = names.filter((n) => typeof sandbox[n] !== 'function');
    assert.deepEqual(missing, [],
      page + ' has handlers calling functions the bundle does not define: ' + missing.join(', '));
  }
});

test('the other pages in the site load too', () => {
  /* Each page loads its own subset of the bundle, so a declaration only
     app.js provides is the difference between a page that works and one that
     does not, and index.html booting says nothing about the rest. Pages with
     no scripts of their own (patchnotes.html is all markup) have nothing to
     boot and are skipped rather than counted as passing. */
  let booted = 0;
  for (const page of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
    if (page === 'index.html') continue;                   // covered above
    if (!bundleFiles(page).length) continue;               // nothing to load
    assert.doesNotThrow(() => boot(page), page + ' does not load');
    booted++;
  }
  assert.ok(booted > 0, 'no other page loads any script; this test found nothing to check');
});
