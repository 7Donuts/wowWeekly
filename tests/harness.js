/* Loads the site's browser scripts into a Node context with just enough of a
   browser around them to run.

   The site is plain scripts on a page with no module system. That is a
   deliberate choice and not one worth undoing for testability, so the harness
   evaluates the files the way the page does and stubs the handful of browser
   objects the code under test reaches for.

   The files are concatenated and evaluated as one script rather than one call
   per file, because separate vm scripts do not share top-level `const` and
   `function` declarations the way separate <script> tags on a page do. One
   script reproduces the page's single shared scope exactly.

   This is not a DOM. Anything that renders is a no-op; what these tests cover
   is the storage and merge logic, which is the part where a mistake silently
   corrupts somebody's week. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function makeStorage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key(i) { return [...data.keys()][i] ?? null; },
    getItem(k) { return data.has(String(k)) ? data.get(String(k)) : null; },
    setItem(k, v) { data.set(String(k), String(v)); },
    removeItem(k) { data.delete(String(k)); },
    clear() { data.clear(); },
    dump() { return Object.fromEntries(data); },
  };
}

/* `files` are loaded in page order. `expose` names the declarations the test
   needs handed back, since a top-level const is not a property of the global
   in a classic script either. */
function load(files, opts = {}) {
  const localStorage = makeStorage();
  const toasts = [];
  const sandbox = {
    localStorage,
    sessionStorage: makeStorage(),
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    // Node's Buffer decoder silently ignores characters outside the base64
    // alphabet; a browser's atob throws. Code under test branches on that
    // throw, so the stub has to be the strict one or the tests pass on
    // behaviour the browser does not have.
    atob(input) {
      const s = String(input).replace(/[ \t\n\f\r]/g, '');
      if (s.length % 4 !== 0 || /[^A-Za-z0-9+/]/.test(s.replace(/=+$/, ''))) {
        const err = new Error('Failed to execute atob: not correctly encoded.');
        err.name = 'InvalidCharacterError';
        throw err;
      }
      return Buffer.from(s, 'base64').toString('binary');
    },
    btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),

    // A vm context gets the language built-ins but none of the platform, and
    // the PLW2 transport inflates through the streams API. These are the real
    // Node implementations of the same web interfaces, so what the tests
    // exercise is the code path the browser takes rather than a stand-in.
    Blob, Response, DecompressionStream, CompressionStream, TextDecoder, TextEncoder,

    renders: 0,
    render() { sandbox.renders++; },
    renderChars() {},
    renderClassLinksBar() {},
    toasts,
    showToast(msg) { toasts.push(String(msg)); },

    currentChar: opts.currentChar || 'Main',
    characters: opts.characters || ['Main'],
    __exports: {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const source = files
    .map((rel) => `\n/* ==== ${rel} ==== */\n` + fs.readFileSync(path.join(ROOT, rel), 'utf8'))
    .join('\n');

  const expose = opts.expose || [];
  // typeof guards so naming something a file does not define is a missing
  // export rather than a ReferenceError halfway through setup.
  const exporter = expose
    .map((n) => `if (typeof ${n} !== 'undefined') __exports.${n} = ${n};`)
    .join('\n');

  vm.runInContext(source + '\n' + exporter, sandbox, { filename: 'site-bundle.js' });
  Object.assign(sandbox, sandbox.__exports);
  return sandbox;
}

module.exports = { load, makeStorage, ROOT };
