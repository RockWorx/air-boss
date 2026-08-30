/*
 * air_boss_accept.test.js -- deterministic regression test for the Air Boss
 * teaching game (air_boss.html).
 *
 * This test BINDS TO THE SHIPPED CODE: it reads air_boss.html, extracts the
 * inline model <script>, and evaluates it inside a Node `vm` context behind a
 * minimal DOM shim so the game's IIFE runs to completion and exposes
 * window.__airbossTest. Every number below is produced by the REAL model
 * function evalWing(range, alloc) / objVal(r, spots) that ships in the page --
 * nothing is re-implemented or hand-copied here. If the model math changes,
 * this test moves.
 *
 * Run:   node air_boss_accept.test.js      (exit 0 = PASS, non-zero = FAIL)
 * Check: node --check air_boss_accept.test.js
 *
 * Pure Node: only built-in `fs`, `path`, and `vm`. No npm dependencies.
 * ASCII only. No protected brand literals -- the grid uses only the fa18 and
 * f35c airframe keys.
 */
"use strict";
var fs = require("fs");
var path = require("path");
var vm = require("vm");

// Resolve the shipped game HTML across contexts: the monorepo dev file (air_boss.html)
// and the public repo (air-boss-offline.html, or index.html). Whichever exists carries the
// SAME model script, so the test binds to shipped code in either location.
var HTML_CANDIDATES = ["air_boss.html", "air-boss-offline.html", "index.html"];
var HTML_PATH = (function () {
  for (var i = 0; i < HTML_CANDIDATES.length; i++) {
    var p = path.join(__dirname, HTML_CANDIDATES[i]);
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Air Boss game HTML not found (looked for: " + HTML_CANDIDATES.join(", ") + ")");
})();
var EPS = 0.05;   // fixture tolerance (spec: match to within 0.05)

var failures = [];
var checks = 0;
function ok(cond, msg) {
  checks++;
  if (cond) {
    console.log("  PASS  " + msg);
  } else {
    console.log("  FAIL  " + msg);
    failures.push(msg);
  }
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }
function r3(x) { return Math.round(x * 1000) / 1000; }

/* -------------------------------------------------------------------------
 * 1. Universal DOM node shim.
 *
 * A single Proxy answers every property read with itself (so method chains and
 * property walks never throw), swallows every write, and is callable/newable.
 * Symbol.toPrimitive returns 0 so arithmetic on a stubbed node (e.g. a canvas
 * width) yields a number instead of throwing. This is enough for the game's
 * load-time path (buildRoster + render + drawCurve + applyModes) to run
 * without a real DOM.
 * ------------------------------------------------------------------------- */
function makeNode() {
  var target = function () {};
  var proxy = new Proxy(target, {
    get: function (t, prop) {
      if (prop === Symbol.toPrimitive) return function () { return 0; };
      if (prop === Symbol.toStringTag) return "Node";
      if (typeof prop === "symbol") return undefined;
      if (prop === "length") return 0;
      return proxy;
    },
    set: function () { return true; },
    apply: function () { return proxy; },
    construct: function () { return proxy; },
    has: function () { return true; }
  });
  return proxy;
}

/* -------------------------------------------------------------------------
 * 2. Load the shipped model into a vm sandbox and hand back __airbossTest.
 * ------------------------------------------------------------------------- */
function loadModel() {
  var html = fs.readFileSync(HTML_PATH, "utf8");
  // Extract the inline <script> that defines the model (the one with evalWing).
  var re = /<script>([\s\S]*?)<\/script>/g;
  var m, source = null;
  while ((m = re.exec(html)) !== null) {
    if (m[1].indexOf("function evalWing") >= 0) { source = m[1]; break; }
  }
  if (source === null) {
    throw new Error("could not find the model <script> (no 'function evalWing' block) in air_boss.html");
  }

  var domNode = makeNode();
  var sandbox = {};
  sandbox.window = sandbox;                 // window === global, so window.__airbossTest is readable back
  sandbox.document = domNode;               // document.getElementById/createElement/querySelectorAll -> stub node
  sandbox.navigator = { clipboard: null };
  sandbox.performance = { now: function () { return 0; } };
  sandbox.requestAnimationFrame = function () { return 0; };
  sandbox.cancelAnimationFrame = function () {};
  sandbox.setTimeout = function () { return 0; };
  sandbox.clearTimeout = function () {};
  sandbox.matchMedia = function () { return { matches: true }; };  // reduced-motion -> no rAF at load
  sandbox.devicePixelRatio = 1;
  sandbox.addEventListener = function () {};
  sandbox.removeEventListener = function () {};
  sandbox.console = { log: function () {}, warn: function () {}, error: function () {} };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "air_boss_model.js" });

  if (!sandbox.__airbossTest || typeof sandbox.__airbossTest.evalWing !== "function") {
    throw new Error("model loaded but window.__airbossTest.evalWing is missing -- the export hook did not run");
  }
  return sandbox.__airbossTest;
}

/* -------------------------------------------------------------------------
 * 3. State helpers -- configure the shared `st` object + deck, then call the
 *    SHIPPED evalWing. Escort/tempo/strike/weapon go through st; DECK via the
 *    exported setter; striker count + tankers + escort go in the alloc arg.
 * ------------------------------------------------------------------------- */
function configure(T, opts) {
  var st = T.st;
  st.wing = 2;                              // full wing so strike/tanker/cap/isr are all active roles
  st.tempo = 1;                             // surge
  st.strike = opts.strike || "mixed";
  st.weapon = opts.weapon;
  T.setDeck(opts.deck || "nimitz");
}
function alloc(airframe, size, escort) {
  var a = { fa18: 0, f35c: 0, mq25: 8, cap: 0, isr: 0 };
  a[airframe] = size;
  if (escort) { a.cap = 6; a.isr = 3; }
  return a;
}
// Total mission effect for a fully-specified state, via the shipped model.
function effectOf(T, opts) {
  configure(T, opts);
  var r = T.evalWing(opts.range, alloc(opts.airframe, opts.size, opts.escort));
  return r;
}

/* ========================================================================= */
var T = loadModel();
console.log("Air Boss regression test -- bound to shipped model in air_boss.html");
console.log("");

/* -------------------------------------------------------------------------
 * FIXTURE 1: AMRAAM @ 400 nm, 4x F/A-18 strikers, unescorted, Nimitz, 8 MQ-25,
 *            surge, mixed. effect ~= 210.991 (MALICE 202.150, GUNSLINGER 198.428)
 * ------------------------------------------------------------------------- */
console.log("[fixtures] unescorted / Nimitz / 8 MQ-25 / surge / mixed");
var base1 = { range: 400, airframe: "fa18", size: 4, escort: false, deck: "nimitz" };
var f1_amraam = effectOf(T, { range: 400, airframe: "fa18", size: 4, escort: false, weapon: "amraam" }).effects;
var f1_malice = effectOf(T, { range: 400, airframe: "fa18", size: 4, escort: false, weapon: "malice" }).effects;
var f1_guns   = effectOf(T, { range: 400, airframe: "fa18", size: 4, escort: false, weapon: "gunslinger" }).effects;
console.log("  AMRAAM @400/4xFA18     effect = " + r3(f1_amraam) + "   (expect 210.991)");
console.log("  MALICE @400/4xFA18     effect = " + r3(f1_malice) + "   (expect 202.150)");
console.log("  GUNSLINGER @400/4xFA18 effect = " + r3(f1_guns)   + "   (expect 198.428)");
ok(near(f1_amraam, 210.991, EPS), "fixture: AMRAAM @400nm/4xFA18 effect ~= 210.991");
ok(near(f1_malice, 202.150, EPS), "fixture: MALICE @400nm/4xFA18 effect ~= 202.150");
ok(near(f1_guns,   198.428, EPS), "fixture: GUNSLINGER @400nm/4xFA18 effect ~= 198.428");
ok(f1_amraam > f1_malice && f1_malice > f1_guns, "fixture: @400nm AMRAAM > MALICE > GUNSLINGER");

/* -------------------------------------------------------------------------
 * FIXTURE 2: GUNSLINGER @ 600 nm, 4x F/A-18 strikers -> 173.709
 *            (AMRAAM 172.870, MALICE 169.804)
 * ------------------------------------------------------------------------- */
var f2_amraam = effectOf(T, { range: 600, airframe: "fa18", size: 4, escort: false, weapon: "amraam" }).effects;
var f2_malice = effectOf(T, { range: 600, airframe: "fa18", size: 4, escort: false, weapon: "malice" }).effects;
var f2_guns   = effectOf(T, { range: 600, airframe: "fa18", size: 4, escort: false, weapon: "gunslinger" }).effects;
console.log("  GUNSLINGER @600/4xFA18 effect = " + r3(f2_guns)   + "   (expect 173.709)");
console.log("  AMRAAM @600/4xFA18     effect = " + r3(f2_amraam) + "   (expect 172.870)");
console.log("  MALICE @600/4xFA18     effect = " + r3(f2_malice) + "   (expect 169.804)");
ok(near(f2_guns,   173.709, EPS), "fixture: GUNSLINGER @600nm/4xFA18 effect ~= 173.709");
ok(near(f2_amraam, 172.870, EPS), "fixture: AMRAAM @600nm/4xFA18 effect ~= 172.870");
ok(near(f2_malice, 169.804, EPS), "fixture: MALICE @600nm/4xFA18 effect ~= 169.804");
ok(f2_guns > f2_amraam && f2_amraam > f2_malice, "fixture: @600nm GUNSLINGER > AMRAAM > MALICE (weapon crossover)");

/* -------------------------------------------------------------------------
 * FIXTURE 3: MALICE @ 800 nm, 8x F/A-18 strikers -> 286.833
 *            (AMRAAM 284.999, GUNSLINGER 280.459)
 *            MALICE coverage == 1.0 and GUNSLINGER coverage ~= 0.533
 * ------------------------------------------------------------------------- */
var f3_amraam = effectOf(T, { range: 800, airframe: "fa18", size: 8, escort: false, weapon: "amraam" });
var f3_malice = effectOf(T, { range: 800, airframe: "fa18", size: 8, escort: false, weapon: "malice" });
var f3_guns   = effectOf(T, { range: 800, airframe: "fa18", size: 8, escort: false, weapon: "gunslinger" });
console.log("  MALICE @800/8xFA18     effect = " + r3(f3_malice.effects) + "   (expect 286.833)  coverage = " + r3(f3_malice.coverage));
console.log("  AMRAAM @800/8xFA18     effect = " + r3(f3_amraam.effects) + "   (expect 284.999)");
console.log("  GUNSLINGER @800/8xFA18 effect = " + r3(f3_guns.effects)   + "   (expect 280.459)  coverage = " + r3(f3_guns.coverage));
ok(near(f3_malice.effects, 286.833, EPS), "fixture: MALICE @800nm/8xFA18 effect ~= 286.833");
ok(near(f3_amraam.effects, 284.999, EPS), "fixture: AMRAAM @800nm/8xFA18 effect ~= 284.999");
ok(near(f3_guns.effects,   280.459, EPS), "fixture: GUNSLINGER @800nm/8xFA18 effect ~= 280.459");
ok(f3_malice.effects > f3_amraam.effects && f3_amraam.effects > f3_guns.effects, "fixture: @800nm/8xFA18 MALICE > AMRAAM > GUNSLINGER");
ok(near(f3_malice.coverage, 1.0, 1e-6), "fixture: MALICE @800nm/8xFA18 coverage == 1.0");
ok(near(f3_guns.coverage, 0.533, 0.01), "fixture: GUNSLINGER @800nm/8xFA18 coverage ~= 0.533 (Winchester)");
console.log("");

/* -------------------------------------------------------------------------
 * GRID: 72 states -> per-state weapon winner. Expect AMRAAM 64, MALICE 2,
 *       GUNSLINGER 6, ties 0.
 * ------------------------------------------------------------------------- */
console.log("[grid] 72 states -- weapon that maximizes total effect");
var RANGES = [400, 600, 800];
var SIZES = [4, 8, 36];
var FRAMES = ["fa18", "f35c"];
var DECKS_G = ["nimitz", "ford"];
var ESCORTS = [false, true];
var WEAPONS_G = ["amraam", "malice", "gunslinger"];

var wins = { amraam: 0, malice: 0, gunslinger: 0 };
var ties = 0;
var nStates = 0;
var covMin = Infinity, covMax = -Infinity;
for (var ri = 0; ri < RANGES.length; ri++)
for (var si = 0; si < SIZES.length; si++)
for (var fi = 0; fi < FRAMES.length; fi++)
for (var di = 0; di < DECKS_G.length; di++)
for (var ei = 0; ei < ESCORTS.length; ei++) {
  nStates++;
  var best = null, bestEff = -Infinity, second = -Infinity;
  for (var wi = 0; wi < WEAPONS_G.length; wi++) {
    var res = effectOf(T, {
      range: RANGES[ri], airframe: FRAMES[fi], size: SIZES[si],
      escort: ESCORTS[ei], deck: DECKS_G[di], weapon: WEAPONS_G[wi]
    });
    if (res.coverage < covMin) covMin = res.coverage;
    if (res.coverage > covMax) covMax = res.coverage;
    if (res.effects > bestEff) { second = bestEff; bestEff = res.effects; best = WEAPONS_G[wi]; }
    else if (res.effects > second) { second = res.effects; }
  }
  if (Math.abs(bestEff - second) < 1e-9) ties++;
  wins[best]++;
}
console.log("  states = " + nStates + "   AMRAAM = " + wins.amraam +
            "   MALICE = " + wins.malice + "   GUNSLINGER = " + wins.gunslinger + "   ties = " + ties);
ok(nStates === 72, "grid: enumerated exactly 72 states");
ok(wins.amraam === 64, "grid: AMRAAM wins 64 states (got " + wins.amraam + ")");
ok(wins.malice === 2, "grid: MALICE wins 2 states (got " + wins.malice + ")");
ok(wins.gunslinger === 6, "grid: GUNSLINGER wins 6 states (got " + wins.gunslinger + ")");
ok(ties === 0, "grid: 0 ties (got " + ties + ")");
console.log("");

/* -------------------------------------------------------------------------
 * DISPLAY/OBJECTIVE ORDERING: the leaderboard headline shows
 * gasDemand/max(1,effects) as "lb gas / effect"; objVal in gas mode returns
 * -(gasDemand/max(1,effects)). The order the displayed quantity implies (lower
 * is better) must equal the objVal order (higher is better). 0 failures.
 * ------------------------------------------------------------------------- */
console.log("[gas-order] displayed gas metric vs objVal(gas) ordering");
T.st.rankBy = "gas";
var cands = [];
var ordRanges = [400, 500, 600, 700, 800];
var ordWeapons = ["amraam", "malice", "gunslinger"];
var ordSizes = [4, 8, 16];
for (var oi = 0; oi < ordRanges.length; oi++)
for (var oj = 0; oj < ordWeapons.length; oj++)
for (var okk = 0; okk < ordSizes.length; okk++) {
  configure(T, { range: ordRanges[oi], weapon: ordWeapons[oj], strike: "mixed", deck: "nimitz" });
  var a = alloc("fa18", ordSizes[okk], false);
  var spots = 0; for (var kk in a) spots += a[kk];
  var rr = T.evalWing(ordRanges[oi], a);
  cands.push({
    display: T.gasPerEffect(rr),   // the SHIPPED gas metric (same helper the leaderboard headline + objVal call)
    obj: T.objVal(rr, spots)       // exactly what the optimizer ranks by
  });
}
var orderFailures = 0;
for (var p = 0; p < cands.length; p++)
for (var q = p + 1; q < cands.length; q++) {
  var dObj = cands[p].obj - cands[q].obj;              // >0 => p ranks better by objVal
  var dDisp = cands[q].display - cands[p].display;      // >0 => p ranks better by displayed (lower gas/effect)
  // must agree in sign (a mismatch means the number the player sees disagrees with the ranking)
  if ((dObj > 1e-12 && dDisp < -1e-12) || (dObj < -1e-12 && dDisp > 1e-12)) orderFailures++;
}
console.log("  candidates = " + cands.length + "   ordering failures = " + orderFailures);
ok(orderFailures === 0, "gas-order: displayed metric ordering == objVal ordering (0 failures)");

// FAIL-CLOSED wiring: the leaderboard headline AND objVal must both route through the shipped gasPerEffect()
// helper. If a UI-only or objective-only regression swaps in raw gas (gasDemand/1000 or gasDemand/effects
// inline), the branch stops calling gasPerEffect and these assertions fail -- catching what a recomputed
// numeric check cannot (codex #126).
var SRC = fs.readFileSync(HTML_PATH, "utf8");
var dispLine = SRC.split("\n").filter(function (l) { return l.indexOf("lb gas / effect") >= 0; })[0] || "";
ok(/gasPerEffect\s*\(/.test(dispLine) && !/gasDemand\s*\/\s*1000/.test(dispLine),
   "gas-wiring: leaderboard headline formats gasPerEffect(r), not raw gas");
var objGasBranch = (SRC.match(/rankBy\s*===\s*"gas"\s*\)\s*return[^;\n]*/) || [""])[0];
ok(/gasPerEffect\s*\(/.test(objGasBranch),
   "gas-wiring: objVal gas branch ranks by gasPerEffect(r)");
console.log("  leaderboard branch: " + dispLine.trim().slice(0, 70));
console.log("  objVal gas branch : " + objGasBranch.trim().slice(0, 70));

T.st.rankBy = "effect";
console.log("");

/* -------------------------------------------------------------------------
 * INVARIANTS
 * ------------------------------------------------------------------------- */
console.log("[invariants]");

// INV1 -- each weapon is non-dominated (wins at least one grid state).
ok(wins.amraam >= 1 && wins.malice >= 1 && wins.gunslinger >= 1,
   "inv: every weapon wins >= 1 state (non-dominated)");

// INV2 -- magazine coverage = min(inventory, deckFeed)/demand, bounded to <= 1.
ok(covMin >= 0 && covMax <= 1 + 1e-12,
   "inv: coverage bounded to [0,1] across all grid states (min=" + r3(covMin) + ", max=" + r3(covMax) + ")");
// A Winchester case (coverage < 1) exists AND a fully-covered case (==1) exists,
// so the bound is a real min(), not a constant.
ok(covMin < 0.999, "inv: at least one Winchester state (coverage < 1) exists (min=" + r3(covMin) + ")");
ok(near(covMax, 1.0, 1e-9), "inv: at least one fully-covered state (coverage == 1) exists");

// INV3 -- survivability combines multiplicatively across the surface channel:
// (1 - surv) must factor as (1-base)*(1-airMit)*(1-surfMit). Switching only the
// strike ordnance (mixed -> standoff) changes ONLY the surface factor, so the
// ratio (1 - survStandoff)/(1 - survMixed) is identical regardless of the air
// channel (escort/weapon). If survivability were a single flat cap, that ratio
// would drift with the air state. meanSurv over a single striker type == that
// type's surv, so we read it straight off evalWing.
var sMix_bare = effectOf(T, { range: 800, airframe: "fa18", size: 8, escort: false, weapon: "amraam",     strike: "mixed" }).meanSurv;
var sStd_bare = effectOf(T, { range: 800, airframe: "fa18", size: 8, escort: false, weapon: "amraam",     strike: "standoff" }).meanSurv;
var sMix_air  = effectOf(T, { range: 800, airframe: "fa18", size: 8, escort: true,  weapon: "gunslinger", strike: "mixed" }).meanSurv;
var sStd_air  = effectOf(T, { range: 800, airframe: "fa18", size: 8, escort: true,  weapon: "gunslinger", strike: "standoff" }).meanSurv;
var ratioBare = (1 - sStd_bare) / (1 - sMix_bare);
var ratioAir  = (1 - sStd_air)  / (1 - sMix_air);
console.log("  surface-channel factor (1-survStandoff)/(1-survMixed): bare=" + r3(ratioBare) + " escort+gun=" + r3(ratioAir));
ok(ratioBare < 1 - 1e-9, "inv: standoff ordnance improves survivability (surface factor < 1)");
ok(near(ratioBare, ratioAir, 1e-9),
   "inv: surface survivability factor is independent of the air channel (multiplicative, no single flat cap)");
// And the air channel stacks on top of escort rather than being pinned: adding a
// survivable weapon on top of escort strictly improves mean survivability.
var sEscortOnly = effectOf(T, { range: 800, airframe: "fa18", size: 8, escort: true, weapon: "amraam",     strike: "mixed" }).meanSurv;
var sEscortGun  = effectOf(T, { range: 800, airframe: "fa18", size: 8, escort: true, weapon: "gunslinger", strike: "mixed" }).meanSurv;
ok(sEscortGun > sEscortOnly + 1e-9,
   "inv: a survivable weapon stacks on top of escort (air channel not flat-capped): " +
   r3(sEscortOnly) + " -> " + r3(sEscortGun));
console.log("");

/* ========================================================================= */
console.log("checks run: " + checks + "   failures: " + failures.length);
if (failures.length) {
  console.log("");
  console.log("FAILED:");
  for (var z = 0; z < failures.length; z++) console.log("  - " + failures[z]);
  process.exit(1);
}
console.log("ALL CHECKS PASS");
process.exit(0);
