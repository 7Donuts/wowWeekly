/* A small stand-in DOM for booting the page's scripts in Node.

   The point of this file is one specific failure: js/app.js runs its whole
   init sequence at the bottom of the file, so a name that is not declared any
   more is a ReferenceError before the first paint and the page renders as an
   empty shell. Nothing in the suite loaded app.js, so that shipped.

   Two rules keep the stub honest, because a stub that answers yes to
   everything hides exactly the bugs it is here to find:

     getElementById answers only for ids that really exist in index.html.
     The ids are read out of the page, so `if (el)` is truthy here for the
     same elements it is truthy for in a browser, and a renderer that reaches
     for an element the page does not have gets the null it would really get.

     Elements are plain objects with the handful of members the site uses,
     not a permissive proxy. An unknown member is undefined and a misuse of
     one shows up as a TypeError rather than being quietly absorbed.

   It is not a DOM, and it does not try to be: layout is zeroes, nothing is
   painted, and no event ever fires on its own. What it establishes is that
   the scripts load, declare what each other reach for, and get through init.
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* The ids the real page has. Read from the markup so the stub cannot drift
   away from it: an element renamed in index.html is renamed here too. */
function pageIds(file = 'index.html') {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const ids = new Set();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  return ids;
}

function makeClassList(el) {
  const set = new Set();
  return {
    add(...names)    { names.forEach((n) => set.add(n)); },
    remove(...names) { names.forEach((n) => set.delete(n)); },
    toggle(name, on) {
      const want = on === undefined ? !set.has(name) : !!on;
      if (want) set.add(name); else set.delete(name);
      return want;
    },
    contains(name) { return set.has(name); },
    get length()   { return set.size; },
  };
}

/* Enough of a 2d context to be taken and held. Nothing is painted. */
function makeContext2d() {
  const noop = () => {};
  return {
    canvas: null,
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    fillText: noop, drawImage: noop, setTransform: noop,
    measureText: () => ({ width: 0 }),
  };
}

function makeElement(tag, id) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    id: id || '',
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    hidden: false,
    href: '',
    download: '',
    title: '',
    children: [],
    parentElement: null,
    offsetTop: 0,
    offsetHeight: 0,
    width: 0,
    height: 0,
    dataset: {},
    style: {
      setProperty() {},
      removeProperty() {},
      getPropertyValue() { return ''; },
    },
    attributes: {},
    setAttribute(k, v) { el.attributes[k] = String(v); },
    getAttribute(k) { return k in el.attributes ? el.attributes[k] : null; },
    removeAttribute(k) { delete el.attributes[k]; },
    appendChild(child) { el.children.push(child); child.parentElement = el; return child; },
    removeChild(child) {
      el.children = el.children.filter((c) => c !== child);
      return child;
    },
    remove() { if (el.parentElement) el.parentElement.removeChild(el); },
    // Nothing is laid out and nothing is nested, so these answer the way an
    // unattached element does rather than pretending to a tree we do not have.
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    getBoundingClientRect() {
      return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
    },
    scrollIntoView() {},
    // A canvas answers with a context that records nothing. The confetti
    // layer draws every frame and there is no frame here, but it takes its
    // context at load, so refusing one would fail the boot for the wrong
    // reason.
    getContext: () => makeContext2d(),
    focus() {},
    blur() {},
    click() {},
    addEventListener() {},
    removeEventListener() {},
  };
  el.classList = makeClassList(el);
  return el;
}

function makeDocument(ids) {
  const byId = new Map();
  const document = {
    readyState: 'complete',
    hidden: false,
    title: '',
    getElementById(id) {
      const key = String(id);
      if (!ids.has(key)) return null;   // the same null a browser gives
      if (!byId.has(key)) byId.set(key, makeElement('div', key));
      return byId.get(key);
    },
    createElement(tag) { return makeElement(tag); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    documentElement: makeElement('html'),
    head: makeElement('head'),
  };
  document.body = makeElement('body');
  return document;
}

/* localStorage as a class, because js/sync.js patches
   Storage.prototype.setItem to notice its own writes. A plain object literal
   would make that patch a ReferenceError, and the sandbox would then be
   testing a site whose sync layer cannot exist. */
class Storage {
  constructor() { Object.defineProperty(this, '_data', { value: new Map() }); }
  get length() { return this._data.size; }
  key(i) { return [...this._data.keys()][i] ?? null; }
  getItem(k) { return this._data.has(String(k)) ? this._data.get(String(k)) : null; }
  setItem(k, v) { this._data.set(String(k), String(v)); }
  removeItem(k) { this._data.delete(String(k)); }
  clear() { this._data.clear(); }
  dump() { return Object.fromEntries(this._data); }
}

module.exports = { pageIds, makeDocument, makeElement, makeContext2d, Storage, ROOT };
