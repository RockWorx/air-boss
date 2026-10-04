/* Air Boss shared test loader (v3.3 suites). Binds to the SHIPPED engine: it extracts the model <script> from the
 * game HTML and runs it in a Node vm sandbox behind a storage-backed fake DOM and an optional virtual clock, then
 * returns window.__airbossTest. No model code is copied here.
 *   loadEngine(htmlPath, {reduce:true, clock:true, ignoreClear:false})
 *   builds(): the game builds to test -- AIR_BOSS_HTML (or argv[2]) when set, else every build present.
 * Pure Node built-ins only. ASCII only.
 */
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

function builds() {
  const pick = process.argv[2] || process.env.AIR_BOSS_HTML;
  if (pick) return [path.resolve(__dirname, pick)];
  const found = ['air_boss.html', 'air_boss_public.html', 'air-boss-offline.html', 'index.html']
    .map(f => path.join(__dirname, f)).filter(f => fs.existsSync(f));
  const seen = new Set(), out = [];
  for (const f of found) { const k = fs.readFileSync(f, 'utf8'); if (!seen.has(k)) { seen.add(k); out.push(f); } }
  if (!out.length) throw new Error('no Air Boss build found next to the tests');
  return out;
}

// Universal stub: every read answers itself, writes are swallowed (as the acceptance shim).
function stub() {
  const t = function () {};
  const p = new Proxy(t, {
    get(_, k) { if (k === Symbol.toPrimitive) return () => 0; if (typeof k === 'symbol') return undefined; if (k === 'length') return 0; return p; },
    set() { return true; }, apply() { return p; }, construct() { return p; }, has() { return true; }
  });
  return p;
}

function makeClock(ignoreClear) {
  let now = 0, seq = 0;
  const q = new Map();
  return {
    now: () => now,
    setTimeout(fn, ms) { const id = ++seq; q.set(id, { at: now + Math.max(0, +ms || 0), fn, id }); return id; },
    clearTimeout(id) { if (!ignoreClear) q.delete(id); },
    pending: () => q.size,
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const t of q.values()) if (t.at <= end && (!next || t.at < next.at || (t.at === next.at && t.id < next.id))) next = t;
        if (!next) break;
        q.delete(next.id); now = next.at; next.fn(now);
      }
      now = end;
    }
  };
}

function loadEngine(htmlPath, opts) {
  opts = Object.assign({ reduce: true, clock: true, ignoreClear: false }, opts || {});
  const html = fs.readFileSync(htmlPath, 'utf8');
  let source = null;
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) if (m[1].includes('function evalWing')) { source = m[1]; break; }
  if (!source) throw new Error('model script not found in ' + htmlPath);
  const clock = makeClock(opts.ignoreClear);
  const registry = new Map(), docListeners = {};
  function makeEl(id) {
    const store = { id: id || '', hidden: false, textContent: '', innerHTML: '', value: '', dataset: {}, style: {}, disabled: false, tabIndex: -1 };
    const classes = new Set(), listeners = {}, attrs = {}, scrolls = [];
    let self;
    const api = {
      classList: { add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)),
        toggle: (c, f) => { const on = f === undefined ? !classes.has(c) : !!f; if (on) classes.add(c); else classes.delete(c); return on; },
        contains: c => classes.has(c) },
      addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
      removeEventListener() {},
      setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: k => (k in attrs ? attrs[k] : null), removeAttribute: k => { delete attrs[k]; },
      scrollIntoView: o => { scrolls.push(o); },
      insertAdjacentElement: (pos, n) => n,
      animate: (frames, o) => { let fin = null; const a = {}; Object.defineProperty(a, 'onfinish', { set(f) { fin = f; clock.setTimeout(() => fin && fin(), (o && o.duration) || 0); }, get() { return fin; } }); return a; },
      contains: n => n === self, closest: () => null,
      querySelectorAll: () => stub(), querySelector: () => stub(), getContext: () => stub(),
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
      focus() {}, blur() {}, click() {}, animateCalls: null,
      __listeners: listeners, __scrolls: scrolls, __classes: classes, __attrs: attrs,
      fire: (t, e) => (listeners[t] || []).forEach(fn => fn(Object.assign({ type: t, target: self, preventDefault() {} }, e || {})))
    };
    self = new Proxy(function () {}, {
      get(_, k) { if (k === Symbol.toPrimitive) return () => 0; if (typeof k === 'symbol') return undefined;
        if (k in api) return api[k]; if (k in store) return store[k]; if (k === 'length') return 0; return stub(); },
      set(_, k, v) { store[k] = v; return true; }, has() { return true; }
    });
    return self;
  }
  const byId = id => { if (!registry.has(id)) registry.set(id, makeEl(id)); return registry.get(id); };
  const body = makeEl('body');
  const document = {
    getElementById: byId, createElement: () => makeEl(''), body,
    querySelectorAll: () => stub(), querySelector: () => stub(),
    addEventListener: (t, fn, cap) => { (docListeners[t] = docListeners[t] || []).push({ fn, capture: !!cap }); },
    removeEventListener() {}
  };
  const sandbox = {
    document, navigator: { clipboard: null }, devicePixelRatio: 1,
    performance: { now: clock.now }, Date: Object.assign(Object.create(Date), { now: clock.now }),
    setTimeout: (fn, ms) => (opts.clock ? clock.setTimeout(fn, ms) : 0),
    clearTimeout: id => (opts.clock ? clock.clearTimeout(id) : undefined),
    requestAnimationFrame: fn => (opts.clock ? clock.setTimeout(() => fn(clock.now()), 16) : 0),
    cancelAnimationFrame: id => (opts.clock ? clock.clearTimeout(id) : undefined),
    matchMedia: () => ({ matches: !!opts.reduce }),
    addEventListener() {}, removeEventListener() {},
    console: { log() {}, warn() {}, error() {} }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: path.basename(htmlPath) + ':model' });
  const T = sandbox.__airbossTest;
  if (!T || typeof T.evalWing !== 'function') throw new Error('engine export missing in ' + htmlPath);
  // Dispatch a synthetic event through the document's capture-phase listeners (the shipped takeover rules).
  function dispatch(type, e) {
    const ev = Object.assign({ type, defaultPrevented: false, preventDefault() { ev.defaultPrevented = true; } }, e || {});
    (docListeners[type] || []).filter(l => l.capture).forEach(l => l.fn(ev));
    return ev;
  }
  return { T, clock, el: byId, dispatch, source, html };
}

// A fake event target. inside: 'panel' | 'explainer' | null; tag: element tag name.
function target(inside, tag, extra) {
  return Object.assign({ tagName: tag || 'DIV', closest: sel => {
    if (inside === 'panel' && sel === '#watch-panel') return {};
    if (inside === 'explainer' && sel === '#watch-explainer') return {};
    if (inside === 'deck' && /#deckpick button/.test(sel)) return {};
    return null; } }, extra || {});
}

function suite(name) {
  let checks = 0; const failures = [];
  return {
    ok(cond, msg) { checks++; if (cond) console.log('  PASS  ' + msg); else { console.log('  FAIL  ' + msg); failures.push(msg); } },
    near: (a, b, t) => typeof a === 'number' && Math.abs(a - b) <= t,
    group(title, fn) { console.log('-- ' + title); try { fn(); } catch (e) { checks++; failures.push(title + ' threw: ' + e.message); console.log('  FAIL  ' + title + ' threw: ' + (e && e.stack || e)); } },
    done(label) { console.log(name + ' ' + label + ': ' + checks + ' checks, ' + failures.length + ' failures'); return failures.length; },
    get checks() { return checks; }, failures
  };
}

module.exports = { builds, loadEngine, target, suite, stub };
