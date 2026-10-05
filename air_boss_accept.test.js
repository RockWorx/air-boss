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
var HTML_CANDIDATES = [process.env.AIR_BOSS_HTML || "air_boss.html","air_boss.html", "air-boss-offline.html", "index.html"];
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
  // Capture the actual rendered leaderboard; leave unrelated DOM behavior stubbed.
  var leaderboardHTML = '';
  var leaderboard = new Proxy(makeNode(), {
    set: function (t, key, value) { if (key === 'innerHTML') leaderboardHTML = value; return true; }
  });
  sandbox.document = new Proxy(domNode, {
    get: function (t, key) {
      if (key === 'getElementById') return function (id) { return id === 'leaderboard' ? leaderboard : domNode; };
      return domNode[key];
    }
  });               // document.getElementById/createElement/querySelectorAll -> stub node
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

  // Test-only access to existing shipped functions: no copied renderer or scoring math.
  var hook = 'window.__airbossTest={';
  if (source.split(hook).length !== 2) throw Error('expected one shipped test export');
  source = source.replace(hook, hook + 'buildLeaderboard:buildLeaderboard,fmt:fmt,renderCandidates:function(rows){var saved=autoSearch;try{autoSearch=function(){return rows;};buildLeaderboard();}finally{autoSearch=saved;}},');
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "air_boss_model.js" });

  if (!sandbox.__airbossTest || typeof sandbox.__airbossTest.evalWing !== "function") {
    throw new Error("model loaded but window.__airbossTest.evalWing is missing -- the export hook did not run");
  }
  sandbox.__airbossTest.leaderboardHTML = function () { return leaderboardHTML; };
  return sandbox.__airbossTest;
}

// v3 changes target flight distance, surface mitigation, strike magazines and recovery.
// v2 effect snapshots/grid winners are intentionally superseded, not silently rebaselined.
var T=loadModel();
function setup(){Object.assign(T.st,{wing:2,tempo:0,strike:'direct',weapon:'amraam',targetPosture:'integrated',threat:null,tankerMode:'organic',strikeOrbit:350,relayOrbit:500,tankerTactics:T.TACTIC_PLANS.strike});T.setDeck('nimitz');}
function ev(r,a,p,orbit){return T.evalWing(r,a,{tankerTactics:T.TACTIC_PLANS[p||'strike'],strikeOrbit:orbit==null?350:orbit});}
function positivePair(label,a,b,factor){console.log(label+': '+r3(a.effects)+' vs '+r3(b.effects));ok(b.effects>0&&a.effects>=b.effects*factor,label+' positive-baseline dominance');}
setup();
var a={fa18:12,mq25:4,cap:6,isr:2};
var push=ev(550,a,'strike',200),yo=ev(550,a,'yoyo',200);
console.log('Abort boundary: '+r3(push.effects)+' vs '+r3(yo.effects));ok(push.effects>0&&yo.effects===0&&yo.gas.primarySupport===0,'550-nm abort boundary');
positivePair('Reachable MQ/buddy',ev(500,a,'strike',150),ev(500,{fa18:12,horn5:4,cap:6,isr:2},'strike',150),1.5);
var recover=ev(400,{f35c:12,mq25:1,cap:6,isr:2},'recovery'),yorec=ev(400,{f35c:12,mq25:1,cap:6,isr:2},'yoyo');
positivePair('Recovery/yoyo',recover,yorec,1.17);
T.applyScenario('war_at_sea');var war=T.evalWing(600);ok(war.infeasible.length===0&&T.st.strikeOrbit===150,'War at Sea default tanker tracks are reachable');T.st.strike='standoff';positivePair('War MACE/standoff',war,T.evalWing(600),1.25);
T.applyScenario('deep_strike');var deep=T.evalWing(800);ok(deep.infeasible.length===0&&T.st.strikeOrbit===350,'Deep Strike default tanker tracks are reachable');T.st.strike='mace';positivePair('Deep standoff/MACE',deep,T.evalWing(800),1.3);
T.st.strike='standoff';positivePair('Deep push/yoyo',deep,ev(800,T.st.alloc,'yoyo'),1.001);
ok(deep.gas.primarySupport===1&&deep.primaryDemand===0,'zero-demand primary preserved');
setup();
var e=T.evalWing(625,{fa18:12,horn5:4,cap:6,isr:2});
// v3.1 S1: strikeSorties is now FLOWN combat sorties; the unchanged v2 cyclic generation is strikeDemand.
ok(near(e.strikeDemand,30.1438141336,1e-8),'unchanged v2 cyclic sortie control at625 (strike demand)');
ok(T.WEAPONS.amraam.leth===1.06&&T.WEAPONS.malice.mag===64&&T.DECKS.ford.ordMult===2.2,'retained A2A/deck controls');
var mq=T.tankerLedger('mq25',500,true),buddy=T.tankerLedger('horn5',500,true);
// v3.4 round 3: MQ-25 ledger re-anchored to the published 14,000 lb at 500 nm threshold (ledger fuel term 16,000 -> 21,000 lb):
// every feasible MQ-25 offload rises by exactly 5,000 lb and every MQ-25 reach by 500 nm; the buddy ledger is unchanged.
ok(mq.transfer===750&&mq.offload===14750&&mq.feasible&&T.tankerLedger('mq25',500,false).offload===14000,'MQ consolidation conservation (relay 14,750 lb; single 14,000 lb at 500 nm = published threshold)');
ok(buddy.transfer===1025&&buddy.post===4787.5&&!buddy.feasible&&buddy.offload===0,'buddy partial refill and infeasibility');
ok(!T.tankerLedger('horn5',350,false).feasible,'reject unreachable buddy strike orbit');
var audit=T.returnLegAudit(10000,1000,1500,300,10);
ok(audit.finalFuel===1500&&audit.landedWeight===12500&&audit.entryFuel===3000,'linear return leg terminal reserve and mass audit');
var allocCases=0;
for(var m=0;m<=24;m++)for(var b=0;b<=24;b++)for(var c=0;c<=100;c+=20)for(var y=0;y<=100-c;y+=20)for(var q=0;q<=100-c-y;q+=20){
  var plan=T.resolveTankerTacticsByType({mq25:m,horn5:b},{consolidation:c,yoyo:y,recovery:q});
  for(var type of ['mq25','horn5']){var sum=Object.values(plan).reduce((s,v)=>s+v[type],0);if(sum!==(type==='mq25'?m:b)||plan.consolidation[type]%2||Object.values(plan).some(v=>!Number.isInteger(v[type])||v[type]<0))throw Error('allocator invariant');}allocCases++;
}
ok(allocCases===35000,'35000 per-type allocator invariant states');
for(var p of [0,10,100])for(var f of [0,10,100])for(var g of [0,5,50,300]){var gas=T.debitGas(p,f,g);ok(gas.total<=g&&gas.primary<=p&&gas.fallback<=f&&gas.support>=0&&gas.support<=1&&(!p?gas.primarySupport===1:true)&&(!f?gas.fallbackSupport===1:true),'finite gas '+[p,f,g].join('/'));}
var grid=0;for(var deck of ['nimitz','ford'])for(var posture of ['integrated','fleeting','hardened'])for(var strike of ['direct','mixed','mace','standoff'])for(var range of [300,600,900])for(var planName of ['yoyo','strike','consolidation','recovery']){
  setup();T.setDeck(deck);T.st.targetPosture=posture;T.st.strike=strike;
  var r=ev(range,{f35c:12,fa18:12,mq25:6,horn5:2,cap:6,isr:2},planName);
  if(!Number.isFinite(r.effects)||r.effects<0||r.support<0||r.support>1||r.gas.total>r.tankerOffload+1e-6||r.primaryUsed>r.primaryAvail+1e-6||r.fallbackUsed>r.fallbackAvail+1e-6||r.topoffDelivered>r.topoffAvailable+1e-6)throw Error('resource grid');
  for(var x of r.byType)if(!near(x.primary+x.fallback+x.held,x.ss,1e-8)||x.topoff>x.climbCap+1e-8)throw Error('per-type caps');grid++;
}
ok(grid===288,'288 mixed-weapon/deck/posture/tactic resource states');
setup();T.st.targetPosture='fleeting';T.st.strike='mace';T.st.alloc={isr:9};
var noISR=ev(600,{fa18:12,mq25:4,isr:0},'strike',150),yesISR=ev(600,{fa18:12,mq25:4,isr:1},'strike',150);
ok(yesISR.effects>noISR.effects,'candidate ISR used instead of displayed allocation');
T.st.threat=.3;var low=ev(600,a,'strike',150);T.st.threat=.85;var high=ev(600,a,'strike',150);ok(high.effects<low.effects&&high.a2aDemand>low.a2aDemand,'threat consumes independent air and surface channels');
setup();var nearAlloc={f35c:12,mq25:4,cap:6,isr:2};var organic=ev(400,nearAlloc),theater=T.evalWing(400,nearAlloc,{tankerMode:'theater'});
ok(theater.effects===organic.effects&&theater.score===organic.score&&theater.theaterAccepted===0,'no accepted gas means no theater charge');
var far=T.evalWing(900,{fa18:24},{tankerMode:'theater'});ok(far.theaterAccepted>0&&far.theaterAccepted<=150000&&far.dogleg===.9&&near(far.score,far.effects*.82,1e-8),'accepted theater gas charged separately');
var empty=T.organicCliff({});ok(empty.range===0&&!empty.eligible&&empty.rows.length===61,'empty wing ineligible; finite 61-point grid');
var cliff=T.organicCliff({f35c:24,mq25:12,cap:6,isr:2});
var first=cliff.rows.find(x=>x.effect<cliff.peak*.5||x.effect<100||x.support<.9);ok(cliff.range===(first?first.range:null),'cliff is first gas/effect crossing');
ok(T.compareCliffs({range:null,peak:400,fuel:10},{range:900,peak:900,fuel:1})<0,'censored ranks above numeric900');
ok(T.compareCliffs({range:500,peak:500,fuel:10},{range:500,peak:400,fuel:1})<0,'peak breaks equal cliff tie');
ok(T.compareCliffs({range:500,peak:500,fuel:1},{range:500,peak:500,fuel:10})<0,'fuel breaks equal cliff/peak tie');
setup();T.st.rankBy='cliff';T.st.target=0;var search=T.autoSearch(),again=T.autoSearch();ok(JSON.stringify(search)===JSON.stringify(again),'deterministic cliff search');ok(search.every(x=>x.r.cliff.eligible),'Auto-Boss enforces peak>=400');
// Static cross-reference covers literal el() calls and dynamic control IDs.
var html=fs.readFileSync(HTML_PATH,'utf8'),ids=new Set(Array.from(html.matchAll(/id=["']([^"']+)["']/g),m=>m[1]));
var missing=Array.from(html.matchAll(/\bel\(["']([^"']+)["']\)/g),m=>m[1]).filter(id=>!ids.has(id));
ok(missing.length===0,'literal UI ID cross-reference: '+missing.join(','));
ok(!/<script\b[^>]*src=|<link\b[^>]*href=["']https?:/i.test(html),'offline scripts/styles embedded');

// Named win/counter-regions execute the actual model, not an independent scoring copy.
// v3.1 re-base (normative S1/S2 change: whole-sortie gas, 10-event surge, overhead): mixed region moves 500 -> 550 nm.
var weaponRegions=[['mace',300,'fleeting',4,0],['direct',300,'fleeting',24,0],['standoff',300,'hardened',4,0],['mixed',550,'hardened',24,1]];
weaponRegions.forEach(function(c){setup();T.st.targetPosture=c[2];T.st.tempo=c[4];T.st.tankerTactics=T.TACTIC_PLANS.balanced;
 var values=Object.keys(T.STRIKES).map(function(w){T.st.strike=w;return [w,T.evalWing(c[1],{fa18:c[3],mq25:4,cap:6,isr:2}).effects];});values.sort((a,b)=>b[1]-a[1]);
 console.log('Weapon region '+c[0]+': '+values.map(v=>v[0]+'='+r3(v[1])).join(', '));
 ok(values[0][0]===c[0]&&values[0][1]>values[1][1],c[0]+' strict win region; alternatives have counter-region');
});
// v3.1 re-base: the 10-event surge generates fewer sorties, so recovery needs 16 strikers to out-demand one balanced
// recovery tanker, and the yo-yo region started at 720 nm (at 700 the balanced plan fully supplied 12 F-35C).
// v3.4 round 4 re-base: the F-35C clean radius goes 650 -> 600 nm (published current estimate), so its AMRAAM-loaded clean
// reach falls by 50 x (1 - 0.01) = 49.5 nm and the yo-yo win region moves inward on the 10-nm grid from 710-760 nm to
// 660-710 nm (upper edge 25 + 594 + 1,300 / 13.5 = 715.3 nm, was 764.8). Tested at 670 nm (at 650 balanced still supplies).
var tacticRegions=[['recovery',300,'fa18',16,1,'horn5'],['strike',500,'fa18',12,0,'horn5'],['yoyo',670,'f35c',12,1,'horn5']];
tacticRegions.forEach(function(c){setup();T.st.targetPosture='fleeting';T.st.tempo=c[4];var a={cap:6,isr:2};a[c[2]]=c[3];a[c[5]]=4;
 var values=Object.keys(T.TACTIC_PLANS).map(p=>[p,ev(c[1],a,p,150).effects]);values.sort((a,b)=>b[1]-a[1]);
 console.log('Tactic region '+c[0]+': '+values.map(v=>v[0]+'='+r3(v[1])).join(', '));
 ok(values[0][0]===c[0]&&values[0][1]>values[1][1],c[0]+' strict win region');
});
setup();var tn={fa18:12,mq25:4,cap:6,isr:2};
// v3.1 re-base: organic gas now fully supports this wing at 580 nm (no theater gas accepted); the friction region starts at 600.
// v3.4 round 3: 4 MQ-25 strike tankers at 150 nm give 6 x 5,000 = 30,000 lb/day more, so theater gas accepted falls by exactly
// 30,000 lb (700 nm: 39,321 -> 9,321) and the friction region moves out to about 680-780 nm; the check moves from 600 to 700.
var of=T.evalWing(700,tn,{strikeOrbit:150}),tf=T.evalWing(700,tn,{strikeOrbit:150,tankerMode:'theater'});
ok(of.score>tf.score&&tf.theaterAccepted>0,'organic has a strict score win where theater friction exceeds benefit');
var od=T.evalWing(900,tn,{strikeOrbit:150}),td=T.evalWing(900,tn,{strikeOrbit:150,tankerMode:'theater'});
ok(td.effects>od.effects&&td.score>od.score,'theater has a deep-range win region');
setup();T.st.rankBy='gas';var g1=T.evalWing(600,tn),g2=T.evalWing(800,tn);
ok(T.objVal(g1,24)===-T.gasPerEffect(g1)&&T.objVal(g2,24)===-T.gasPerEffect(g2),'gas objective retains shared displayed metric');
setup();T.st.rankBy='cliff';ok(T.autoSearch().length>0,'cliff eligibility does not produce vacuous empty success');
setup();var before=JSON.stringify(T.st);T.evalWing(800,{f35c:24,mq25:12},{tankerTactics:T.TACTIC_PLANS.yoyo,tankerMode:'theater'});T.organicCliff({f35c:12});ok(JSON.stringify(T.st)===before,'candidate evaluation and cliff search do not mutate UI state');
setup();var customWing={custom:12,mq25:4,cap:6,isr:2};T.st.custom={pay:20000,surv:95,size:20};var penalized=T.evalWing(300,customWing);ok(penalized.byType[0].pen===1&&T.st.custom.engineClass==='mid'&&!('size' in T.st.custom)&&!('pay' in T.st.custom),'v3.3 re-pin: a legacy point-buy design migrates to the closing defaults; the budget penalty is retired (closure gates replace it)');
setup();T.st.strike='direct';T.st.tankerTactics=T.TACTIC_PLANS.recovery;var censored=T.organicCliff({f35c:24,mq25:4});ok(censored.rows.length===61,'cliff always scans the prescribed finite domain');


// Reach extension: fixed capacities/burn/reserve/transfer, no tuned coefficients.
setup();var relayWing={fa18:12,horn5:2,cap:6,isr:2};
function relayPair(orbit,range){return ['strike','consolidation'].map(p=>T.evalWing(range,relayWing,{tankerTactics:T.TACTIC_PLANS[p],strikeOrbit:orbit,relayOrbit:orbit}));}
// v3.1 re-base: S1 launches only whole gas-supported sorties; the 400-lb relay offload supports whole sorties at 430 nm
// (at 500 nm it supported only a fraction of one sortie, which v3.0 credited as partial effect).
var outside=relayPair(250,430),inside=relayPair(150,500);
console.log('Relay outside single reach: '+r3(outside[1].effects)+' vs '+r3(outside[0].effects));
ok(outside[1].effects>0&&outside[0].effects===0&&outside[1].infeasible.length===0,'consolidation wins beyond single reach (absolute abort boundary)');
positivePair('Single/relay inside reach',inside[0],inside[1],1.001);
var bs=T.tankerLedger('horn5',250,false),br=T.tankerLedger('horn5',250,true);
ok(near(bs.maxReach,212.121212121,1e-8)&&near(br.maxReach,274.242424242,1e-8),'buddy single and relay limits derived from ledger');
ok(br.transfer===1025&&br.offload===400&&br.donorFinal===1500&&br.receiverFinal===1500,'relay accepted transfer and both terminal reserves conserved');
ok(T.tankerLedger('mq25',1950,false).maxReach===1900&&!T.tankerLedger('mq25',1950,false).feasible,'MQ single reach derived as1900');
ok(T.tankerLedger('mq25',1950,true).maxReach===1975&&T.tankerLedger('mq25',1950,true).offload===250,'MQ relay extends reach to1975 with bounded250lb at1950');
ok(!T.tankerLedger('horn5',275,true).feasible&&!T.tankerLedger('mq25',2000,true).feasible,'beyond consolidated reach rejected');
ok(!T.tankerLedger('horn5',149,true).feasible,'relay cannot occur before150nm transfer station');


function watchResult(seed,index,settings){var q=T.watchCycle(seed,index,settings||{deck:"nimitz",tempo:0});T.applyScenario(q.scenario);T.setDeck(q.deck);
 Object.assign(T.st,{rng:q.range,tempo:q.tempo,strike:q.strike,weapon:q.weapon,alloc:q.alloc,strikeOrbit:q.strikeOrbit,relayOrbit:q.relayOrbit,tankerTactics:T.TACTIC_PLANS[q.plan]});
 var r=T.evalWing(q.range);return {input:q,events:r.events,effect:r.effects,score:r.score,infeasible:r.infeasible,spots:Object.values(q.alloc).reduce((a,b)=>a+b,0),pool:T.getPool()};}
var sequenceA=Array.from({length:40},(_,i)=>watchResult('watch-acceptance',i));
var sequenceB=Array.from({length:40},(_,i)=>watchResult('watch-acceptance',i));
ok(JSON.stringify(sequenceA)===JSON.stringify(sequenceB),'Watch seed repeats inputs and evaluator outcomes exactly');
ok(JSON.stringify(T.watchCycle('seed-a',0))!==JSON.stringify(T.watchCycle('seed-b',0)),'Watch different seeds choose different inputs');
ok(sequenceA.every(r=>r.infeasible.length===0&&r.spots<=r.pool&&Object.values(r.input.alloc).every(n=>Number.isInteger(n)&&n>=0)&&Number.isFinite(r.effect)),'Watch generated wings fit the deck and all tanker tracks are feasible');
ok(new Set(sequenceA.map(r=>r.input.scenario)).size===Object.keys(T.SCENARIOS).filter(k=>!T.SCENARIOS[k].days).length&&new Set(sequenceA.map(r=>r.input.plan)).size===5,'Watch sequence covers scenarios and tanker plans');
ok(sequenceA.every(r=>r.input.range>=({war_at_sea:500,deep_strike:700,strait_defense:400}[r.input.scenario])&&r.input.range<=({war_at_sea:700,deep_strike:900,strait_defense:600}[r.input.scenario])),'Watch ranges stay inside illustrative scenario bands');
for(const deck of ['nimitz','ford'])for(const tempo of [0,1]){
 var settings={deck,tempo},rows=Array.from({length:20},(_,i)=>watchResult('player-settings',i,settings));
 // v3.1 S2: integer event schedule -- sustained 8, surge 10 (was 16/1.3).
 ok(rows.every(r=>r.input.deck===deck&&r.input.tempo===tempo&&r.events===(tempo?10:8)),'Watch honors '+deck+' '+(tempo?'surge 10':'sustained 8')+' on every cycle');
 ok(JSON.stringify(rows)===JSON.stringify(Array.from({length:20},(_,i)=>watchResult('player-settings',i,settings))),'Watch same seed and player settings repeat '+deck+'/'+tempo);
}
var tempoSaved=JSON.stringify(T.st),pair=T.watchTempoComparison();
ok(JSON.stringify(T.st)===tempoSaved&&pair.sustained.events===8&&pair.surge.events===10,'Watch tempo comparison uses unchanged evaluator and restores state');
var watchBefore=JSON.stringify(T.st);T.watchCycle('pure',12);ok(JSON.stringify(T.st)===watchBefore,'Watch input generator does not mutate engine state');

setup();T.applyScenario('strait_defense');
var defense=T.evalWing(T.st.rng);
ok(T.st.rng===500&&T.st.threat===.85&&T.st.targetPosture==='integrated'&&T.st.weapon==='amraam'&&T.st.strike==='standoff'&&T.st.alloc.cap===10&&T.st.alloc.isr===4&&T.st.tankerTactics.recovery===30&&Object.values(T.st.alloc).reduce((a,b)=>a+b,0)===44&&defense.infeasible.length===0,'Contested Strait preset uses 44 spots and reachable organic tankers');
T.st.strike='direct';T.st.tankerTactics={yoyo:30,strike:70,consolidation:0,recovery:0};
var greedy=T.evalWing(500,{fa18:28,f35c:6,mq25:6,cap:2,isr:2});
// The Strait objective replaces raw-effect dominance with the existing objective.
ok(T.st.rankBy==='surv','Strait preset defaults to the existing Survivability objective');
var defenseObjective=T.objVal(defense,44),baselineObjective=T.objVal(greedy,44);
console.log('Strait objective: '+defenseObjective+' vs '+baselineObjective+'; raw effect '+r3(defense.effects)+' vs '+r3(greedy.effects));
ok(baselineObjective>0&&defenseObjective>baselineObjective,'Contested Strait balanced defense beats positive baseline on existing Survivability objective');
// v3.1 S4 (normative): the Strait objective is support-weighted survival times the mission-effect floor.
ok(defenseObjective===defense.support*defense.meanSurv*defense.effFloorFactor&&baselineObjective===greedy.support*greedy.meanSurv*greedy.effFloorFactor,'Strait objective = support x mean survival x effect floor');
ok(defense.effects<greedy.effects&&greedy.effects>0,'Strait still discloses protection versus raw-output trade');
T.applyScenario('war_at_sea');ok(T.st.rankBy==='effect','Other scenarios restore effect objective');


// Display binding: execute shipped renderer and compare every headline with shipped ranking.
// Keep discriminating partial-support cases: meanSurv and survScore may coincide
// at full support, allowing a display-only mutation to pass a weak fixture.
var discriminatingSurvival = false;
for (var mode of ['gas', 'surv']) for (var range of [400, 500, 600, 700, 800]) {
  setup(); T.applyScenario('strait_defense'); T.st.rankBy = mode; T.st.rng = range;
  var top = T.autoSearch();
  T.buildLeaderboard();
  var headlines = Array.from(T.leaderboardHTML().matchAll(/<span class="lb-metric">([\s\S]*?)<\/span>/g), m => m[1]);
  ok(top.length > 0 && headlines.length === top.length, 'display-binding populated ' + mode + '/' + range);
  ok(top.every(function (t, i) {
    var value = mode === 'gas' ? T.gasPerEffect(t.r) : T.objVal(t.r, t.spots) * 100;
    var unit = mode === 'gas' ? 'lb gas / effect' : 'surv score';
    if (mode === 'surv' && T.fmt(t.r.meanSurv * 100, 0) !== T.fmt(value, 0)) discriminatingSurvival = true;
    return headlines[i] === T.fmt(value, 0) + ' <small>' + unit + '</small>' &&
      (mode !== 'gas' || T.objVal(t.r, t.spots) === -T.gasPerEffect(t.r));
  }), 'display-binding headline equals shared objective ' + mode + '/' + range);
}
// A value-discriminating gas case must survive a wrong value with the correct label.
// Direct strikes at 700 nm require gas; theater support preserves positive effects.
setup(); T.applyScenario('war_at_sea'); T.st.rankBy = 'gas';
T.st.strike = 'direct'; T.st.rng = 700; T.st.tankerMode = 'theater';
var gasTop = T.autoSearch();
T.buildLeaderboard();
var gasHeadlines = Array.from(T.leaderboardHTML().matchAll(/<span class="lb-metric">([\s\S]*?)<\/span>/g), m => m[1]);
ok(gasTop.length > 0 && gasHeadlines.length === gasTop.length, 'display-binding nonzero-gas leaderboard populated');
ok(gasTop.length > 0 && gasTop.some(t => t.r.gasDemand > 0 && t.r.effects > 0 &&
  T.fmt(T.gasPerEffect(t.r),0) !== T.fmt(t.r.gasDemand/1000,0)),
  'display-binding gas fixture distinguishes formatted per-effect from raw gas');
ok(gasTop.every((t,i) => gasHeadlines[i] === T.fmt(T.gasPerEffect(t.r),0) + ' <small>lb gas / effect</small>'),
  'display-binding nonzero-gas headline equals shipped gasPerEffect');
console.log('Gas display fixture: '+JSON.stringify(gasTop.map(t => ({gasDemand:t.r.gasDemand,effects:t.r.effects,
  perEffect:T.fmt(T.gasPerEffect(t.r),0),rawGas:T.fmt(t.r.gasDemand/1000,0)}))));

// Isolate the renderer boundary with a real evaluator result under fuel shortage.
// Search normally selects full-support winners; those cannot distinguish M2.
setup(); T.applyScenario('strait_defense'); T.st.rankBy = 'surv';
var shortageAlloc = {fa18:24, mq25:1, cap:6, isr:2};
var shortage = T.evalWing(700, shortageAlloc);
T.renderCandidates([{r:shortage, alloc:shortageAlloc, spots:33}]);
var shortageValue = T.fmt(T.objVal(shortage,33)*100,0);
ok(T.fmt(shortage.meanSurv*100,0) !== shortageValue, 'display-binding fuel-shortage fixture distinguishes mean from score');
ok(T.leaderboardHTML().includes('<span class="lb-metric">'+shortageValue+' <small>surv score</small></span>'), 'display-binding fuel-shortage headline uses ranked score');
discriminatingSurvival = discriminatingSurvival || T.fmt(shortage.meanSurv*100,0) !== shortageValue;
ok(discriminatingSurvival, 'display-binding includes survival score distinct from mean survival');

/* =========================================================================
 * v3.1 NORMATIVE BUILD (AIR_BOSS_V3_SPEC.md Part II): joint launch feasibility,
 * overhead reserved before combat, and attrition by flown exposure. Every value is
 * produced by the SHIPPED engine through window.__airbossTest.
 * ========================================================================= */
function v31(){setup();T.st.scenario=null;T.st.rankBy='effect';T.st.threat=null;T.setPool(T.DECKS[T.getDeck()].spots);}
// ---- S1 / Test 1: mission-governed launch, isolated weapons-bound fixture (fallback stock 0, rate pinned) ----
v31();T.st.strike='direct';
var t1=T.evalWing(300,{fa18:24,mq25:6},{sortiesPerJet:2,primaryStock:20,fallbackStock:0,overhead:false,tankerTactics:T.TACTIC_PLANS.strike,strikeOrbit:150});
console.log('S1 test 1: demand '+t1.strikeDemand+' flown '+t1.strikeSorties+' held '+t1.strikeHeld+' binding '+t1.binding);
ok(t1.strikeDemand===48,'S1 T1 demand = 24 aircraft x 2 pinned sorties = 48');
ok(t1.strikeSorties===10,'S1 T1 flown = 10, bounded by 20 weapons at 2/sortie');
ok(t1.strikeHeld===38,'S1 T1 held = 48 - 10 = 38');
ok(t1.binding==='weapons','S1 T1 binding resource = weapons');
ok(t1.weaponCapacity===10&&t1.fuelCapacity>=48,'S1 T1 spec ceilings S_wpn=10 <= S_fuel');
ok(t1.primaryUsed===20&&t1.fallbackUsed===0,'S1 T1 only launched sorties debit weapons');
// Integrated fixture: the FULL Test 1 fixture pinned -- 300 nm, direct attack, 24 F/A-18 at a pinned
// 2 sorties/jet, 20 primary rounds, fallback stock 0, 6 MQ-25 on the strike plan at a 150-nm orbit, S3 overhead ON.
// Scheduled wing flights = 48 strike + 9 tanker = 57, so the declared 3% FCF / 2% qual split is 2 FCF + 1 qual (not 1 + 2).
// S3 overhead is reserved from the same crewed strike budget before combat: 10 flown + 35 held + 3 overhead = 48.
var t1b=T.evalWing(300,{fa18:24,mq25:6},{sortiesPerJet:2,primaryStock:20,fallbackStock:0,tankerTactics:T.TACTIC_PLANS.strike,strikeOrbit:150});
console.log('S1 test 1 integrated: scheduled '+t1b.scheduledSorties+' ('+t1b.strikeDemand+' strike + '+t1b.tankerSorties+' tanker) FCF '+t1b.fcfSorties+' qual '+t1b.qualSorties+' flown '+t1b.strikeSorties+' held '+t1b.strikeHeld);
ok(t1b.strikeDemand===48&&t1b.tankerSorties===9&&t1b.scheduledSorties===57,'S1 T1 integrated: scheduled = 48 strike + 9 tanker = 57');
ok(t1b.fcfSorties===2&&t1b.qualSorties===1&&t1b.overheadSorties===3,'S1 T1 integrated: overhead = 2 FCF + 1 qual = 3 (of 57 scheduled)');
ok(t1b.strikeSorties===10&&t1b.strikeHeld===35&&t1b.combatStrikeDemand===45&&t1b.binding==='weapons'&&t1b.heldBy.weapons===35,'S1 T1 integrated: flown 10, held 35 (weapons), combat demand 48 - 3 = 45');
ok(t1b.strikeSorties+t1b.strikeHeld+t1b.overheadSorties===48&&t1b.totalLaunches===22,'S1+S3 conservation: flown 10 + held 35 + overhead 3 = 48 strike; launches 10 + 9 + 3 = 22');
// Same fixture without the tankers: 48 scheduled -> 1 FCF + 1 qual; flown 10, held 36 (the split is of ALL scheduled flights).
var t1c=T.evalWing(300,{fa18:24},{sortiesPerJet:2,primaryStock:20,fallbackStock:0});
ok(t1c.scheduledSorties===48&&t1c.fcfSorties===1&&t1c.qualSorties===1&&t1c.strikeSorties===10&&t1c.strikeHeld===36&&t1c.binding==='weapons','S1 T1 no-tanker control: 48 scheduled -> 1 FCF + 1 qual, flown 10, held 36');
// S1 joint feasibility counterexample: primary needs no gas but has no rounds; fallback has rounds but needs gas; no tankers.
v31();T.st.strike='standoff';
var r1=T.evalWing(500,{fa18:4},{primaryStock:0,fallbackStock:200,overhead:false});
console.log('S1 joint joint: fuelCap '+r1.fuelCapacity+' wpnCap '+r1.weaponCapacity+' flown '+r1.strikeSorties+' binding '+r1.binding);
ok(r1.fuelCapacity>0&&r1.weaponCapacity>0,'S1 joint control: separate fuel and weapon ceilings are both positive');
ok(r1.strikeSorties===0&&r1.effects===0&&r1.binding==='fuel','S1 joint jointly infeasible sorties are held (0 flown), binding fuel');
ok(r1.fallbackUsed===0&&r1.gas.total===0,'S1 joint held sorties debit no weapons and no gas');
// Fuel-bound: an unsupported deficit sortie is held, not flown for zero effect.
v31();T.st.strike='direct';
var fb=T.evalWing(700,{fa18:12},{overhead:false});
ok(fb.strikeSorties===0&&fb.strikeHeld>0&&fb.binding==='fuel'&&fb.effects===0&&fb.fuelBurned===0,'S1 no gas at 700 nm: every strike sortie held, binding fuel, no fuel burned');
var fbT=T.evalWing(700,{fa18:12,mq25:6},{overhead:false,tankerTactics:T.TACTIC_PLANS.strike});
ok(fbT.strikeSorties>0&&fbT.gas.total<=fbT.tankerOffload+1e-6&&near(fbT.byType.reduce(function(s,x){return s+x.primary*x.dP+x.fallback*x.dF;},0),fbT.gas.total,1e-6),'S1 tanked sorties fly only on debited tanker gas');
// Priority order F-35C, F/A-18, CCX-1, custom for scarce weapons and gas.
v31();T.st.wing=2;var pri=T.evalWing(300,{fa18:10,f35c:10,ccx:8},{sortiesPerJet:2,primaryStock:20,fallbackStock:0,overhead:false});
ok(pri.byType.map(function(x){return x.key;}).join(',')==='f35c,fa18,ccx'&&pri.byType[0].primary===10&&pri.byType[1].primary===0,'S1 priority F-35C, F/A-18, CCX-1');
// Per-type invariants across a state grid (launch, held, weapons, gas, deck).
var g31=0;
for(var deck of ['nimitz','ford'])for(var tempo of [0,1])for(var strike of ['direct','mixed','mace','standoff'])for(var range of [250,500,800])for(var planName of ['strike','yoyo','recovery']){
  v31();T.st.wing=2;T.setDeck(deck);T.st.tempo=tempo;T.st.strike=strike;
  var r=ev(range,{f35c:10,fa18:14,ccx:8,mq25:6,horn5:2,cap:6,isr:2},planName);
  var bad=!(r.strikeSorties>=0&&r.strikeHeld>=-1e-9&&near(r.strikeSorties+r.strikeHeld+r.overheadSorties,r.strikeDemand,1e-6)&&
    r.totalLaunches<=r.deckCeiling+1e-6&&near(r.totalLaunches,r.strikeSorties+r.tankerSorties+r.capSorties+r.isrSorties+r.overheadSorties,1e-6)&&
    r.gas.total<=r.tankerOffload+1e-6&&r.primaryUsed<=r.primaryAvail+1e-6&&r.fallbackUsed<=r.fallbackAvail+1e-6&&
    near(r.heldBy.weapons+r.heldBy.fuel+r.heldBy.deck,r.strikeHeld,1e-6)&&['none','weapons','fuel','deck'].indexOf(r.binding)>=0&&
    (r.strikeHeld>1e-6?r.binding!=='none':r.binding==='none'));
  for(var x of r.byType)if(!near(x.primary+x.fallback+x.held,x.ss,1e-8)||x.primary<0||x.fallback<0||x.held<-1e-9)bad=true;
  if(bad)throw Error('v3.1 resource grid '+[deck,tempo,strike,range,planName].join('/'));g31++;
}
ok(g31===144,'144 v3.1 launch/held/deck/gas/weapon conservation states');

// ---- S2 / Test 2: per-event recovery physics, no daily wall, windowed campaign average ----
v31();T.st.tempo=0;var sus=T.evalWing(500);T.st.tempo=1;var sur=T.evalWing(500);
ok(sus.events===8&&sus.recPerEvent===16&&sus.deckCeiling===128,'S2 sustained: 8 events x 16 per 12-min window = 128');
ok(sur.events===10&&sur.recPerEvent===29&&sur.deckCeiling===290,'S2 surge: 10 events x 29 per 22-min window = 290');
v31();T.setDeck('ford');T.st.tempo=1;T.st.strike='direct';
var surge=T.evalWing(250,{f35c:20,fa18:24,mq25:4},{tankerTactics:T.TACTIC_PLANS.balanced});
console.log('S2 surge day launches: '+r3(surge.totalLaunches));
ok(surge.totalLaunches>120&&surge.totalLaunches<=surge.deckCeiling,'S2 single-day surge exceeds 120 launches (no 112/120 daily cap) within the per-event ceiling');
v31();T.setDeck('ford');T.st.tempo=1;T.st.strike='direct';
var sat=T.evalWing(250,{fa18:40,cap:8},{sortiesPerJet:7});
ok(sat.binding==='deck'&&near(sat.totalLaunches,sat.deckCeiling,1e-6)&&sat.heldBy.deck>0,'S2 strike demand above the deck ceiling is held with binding deck');
v31();T.applyScenario('strait_defense_3day');
var sc3=T.SCENARIOS.strait_defense_3day;
ok(T.getDeck()==='ford'&&T.st.tempo===1&&sc3.days===3&&T.st.rng===500&&T.st.rankBy==='surv'&&T.st.strike==='mace'&&T.st.weapon==='malice'&&T.usedSpots(T.st.alloc)===48,'D3 3-day Strait preset: Ford, surge, 500 nm, MACE/MALICE, 48.0/48 weighted spots');
var stBefore=JSON.stringify(T.st),allocBefore=JSON.stringify(T.st.alloc);
var camp=T.evalCampaign(500,T.st.alloc,{events:8});
console.log('D3 campaign: '+camp.dailyHistory.map(function(d){return r3(d.sortiesFlown)+'/'+r3(d.effects);}).join(' | ')+' avg '+r3(camp.windowedAverageSorties));
ok(camp.windowedAverageSorties>0,'S2 T2 windowed average positive');
ok(Math.abs(camp.windowedAverageSorties-camp.totalSorties/3)<1e-6,'S2 T2 windowed average = 3-day mean');
ok(camp.dailyHistory[0].deckCeiling===8*29,'S2 T2 single-day deck ceiling = 8 x 29 = 232');
ok(camp.dailyHistory.length===3&&near(camp.totalSorties,camp.dailyHistory.reduce(function(s,d){return s+d.sortiesFlown;},0),1e-9)&&near(camp.cumulativeEffect,camp.dailyHistory.reduce(function(s,d){return s+d.effects;},0),1e-9),'D3 totals are the sums of daily results');
ok(JSON.stringify(T.st)===stBefore&&JSON.stringify(T.st.alloc)===allocBefore,'D3 campaign is pure: no UI-state or input mutation');
ok(JSON.stringify(T.evalCampaign(500,T.st.alloc,{events:8}))===JSON.stringify(camp),'D3 repeated evaluation is identical');
var expended=camp.dailyHistory.reduce(function(s,d){return s+d.strikeExpended;},0);
ok(near(camp.finalMagStrike,T.STRIKES.mace.mag-expended,1e-9)&&camp.finalMagStrike>=0&&camp.dailyHistory.every(function(d){return d.strikeExpended<=d.primaryAvail+1e-9;}),'D3 finite strike magazine conserved across days, per-day feed respected');
var a2aSpent=camp.dailyHistory.reduce(function(s,d){return s+d.a2aExpended;},0);
ok(near(camp.finalMagA2A,T.WEAPONS.malice.mag-a2aSpent,1e-9)&&camp.finalMagA2A>=0,'D3 finite A2A magazine conserved');
ok(near(camp.finalFallback,200-camp.dailyHistory.reduce(function(s,d){return s+d.fallbackExpended;},0),1e-9)&&camp.finalFallback>=0,'D3 finite fallback stock conserved');
ok(Object.keys(camp.survivingAirframes).every(function(k){return Number.isInteger(camp.survivingAirframes[k])&&camp.survivingAirframes[k]>=0&&camp.survivingAirframes[k]<=(T.st.alloc[k]||0);}),'D3 surviving airframes are integer, non-negative and never exceed the start');
ok(camp.dailyHistory.every(function(d){return Object.keys(d.losses).every(function(k){return d.losses[k]<=d.aircraftStart[k]&&((d.flownByKey[k]||0)>0||d.losses[k]===0);});}),'D3 losses capped by aircraft and zero without flights');
ok(camp.dailyHistory[0].fatigue.turnMult===1&&camp.dailyHistory[0].fatigue.availMult===1,'S2 day 1 baseline, no fatigue');
var d1=camp.dailyHistory[0].sortiesFlown,d2=camp.dailyHistory[1].sortiesFlown;
ok(camp.dailyHistory[1].fatigue.turnMult===(d1>1.3*120?1.02:1)&&camp.dailyHistory[2].fatigue.availMult===((d1+d2)/2>1.3*120?0.95:1),'S2 fatigue uses only completed prior days (causal)');
var hot=T.evalCampaign(250,{f35c:20,fa18:24,mq25:4},{});
ok(hot.dailyHistory[0].sortiesFlown>156&&hot.dailyHistory[1].fatigue.turnMult===1.02,'S2 fatigue control: a >130%-of-target day 1 triggers the day-2 turn penalty');
// Day-3 control on the 3-day preset state: a support-heavy 46-spot wing launches 171.0 then 166.3 (CAP/ISR/tanker flights do
// not depend on the strike magazine), so the two-day average exceeds 1.30 x 120 = 156 and day 3 loses 5% availability.
var susA={f35c:12,mq25:6,cap:20,isr:8},sus=T.evalCampaign(500,susA,{}),sus1=sus.dailyHistory[0].sortiesFlown,sus2=sus.dailyHistory[1].sortiesFlown;
console.log('S2 day-3 fatigue control: '+sus.dailyHistory.map(function(d){return r3(d.sortiesFlown);}).join(' | '));
ok(T.usedSpots(susA)<=48&&(sus1+sus2)/2>1.3*120&&sus.dailyHistory[1].fatigue.turnMult===1.02&&sus.dailyHistory[2].fatigue.turnMult===1&&sus.dailyHistory[2].fatigue.availMult===0.95,'S2 day-3 fatigue control: a two-day average above 156 triggers the day-3 -5% availability penalty');
var base=T.evalWing(500,T.st.alloc),fat=T.evalWing(500,T.st.alloc,{fatigue:{turnMult:1.02,availMult:1}}),fat2=T.evalWing(500,T.st.alloc,{fatigue:{turnMult:1,availMult:.95}});
ok(fat.strikeDemand<base.strikeDemand&&near(fat2.strikeDemand,base.strikeDemand*.95,1e-9),'S2 fatigue: +2% turn time and -5% availability reduce generation');
var held3=T.evalCampaign(500,{f35c:4,fa18:4,mq25:2},{primaryStock:0,fallbackStock:0});
ok(held3.dailyHistory.every(function(d){return d.strikeSorties===0;})&&held3.survivingAirframes.f35c===4&&held3.survivingAirframes.fa18===4,'D3 no-weapons campaign: held strike aircraft all survive');
var nogas3=T.evalCampaign(900,{fa18:6},{});
ok(nogas3.dailyHistory.every(function(d){return d.strikeSorties===0;})&&nogas3.survivingAirframes.fa18===6,'D3 no-gas campaign: held strike aircraft all survive');
// ---- D3 campaign survivability inputs: discriminating CAP-only and recovery-only controls ----
// The shipped recurrence prices strike losses on the flown type's ADJUSTED survivability (byType surv, which CAP escort
// raises) plus per-type expended / bring-back recovery risk at the day's RECOVERY-tanker coverage; support roles on that
// same recovery coverage. CAP protection and recovery-tanker coverage are different resources. Fixture: surge, 300 nm,
// direct, pinned 2 sorties/jet, 5,000-round stocks, overhead off, so day-1 strike flights are identical (40/40/80) across
// the three wings and only the named resource changes. Day-1 losses are pinned exactly from the shipped engine.
v31();T.st.strike='direct';T.st.tempo=1;
var cOpt={overhead:false,sortiesPerJet:2,primaryStock:5000,fallbackStock:5000},cRec=Object.assign({tankerTactics:T.TACTIC_PLANS.recovery},cOpt);
var cBaseA={fa18:20,f35c:20,ccx:40},cCapA={fa18:20,f35c:20,ccx:40,cap:20},cRecA={fa18:20,f35c:20,ccx:40,mq25:12};
var cB=T.evalCampaign(300,cBaseA,cOpt).dailyHistory[0],cC=T.evalCampaign(300,cCapA,cOpt).dailyHistory[0],cR=T.evalCampaign(300,cRecA,cRec).dailyHistory[0];
var wB=T.evalWing(300,cBaseA,cOpt),wC=T.evalWing(300,cCapA,cOpt),wR=T.evalWing(300,cRecA,cRec);
function survOf(w,k){return w.byType.filter(function(x){return x.key===k;})[0].surv;}
console.log('D3 campaign-input controls day-1 losses: base '+JSON.stringify(cB.losses)+' CAP-only '+JSON.stringify(cC.losses)+' recovery-only '+JSON.stringify(cR.losses));
var sameFlown=['fa18','f35c','ccx'].every(function(k){return cB.flownByKey[k]===cC.flownByKey[k]&&cB.flownByKey[k]===cR.flownByKey[k];});
ok(sameFlown&&cB.flownByKey.fa18===40&&cB.flownByKey.f35c===40&&cB.flownByKey.ccx===80&&wB.binding==='none'&&wC.binding==='none'&&wR.binding==='none','D3 campaign control fixture: identical day-1 strike flights 40/40/80 in all three wings, nothing binding');
ok(cB.losses.fa18===9&&cB.losses.f35c===3&&cB.losses.ccx===6,'D3 campaign control base: day-1 losses F/A-18 9, F-35C 3, CCX-1 6 (per-type recovery risk, no CAP, no recovery gas)');
ok(wB.recoveryCoverage===0&&wC.recoveryCoverage===0&&wC.coverage===1&&['fa18','f35c','ccx'].every(function(k){return survOf(wC,k)>survOf(wB,k);}),'D3 campaign control CAP-only: CAP raises adjusted type survivability, recovery coverage stays 0');
ok(cC.losses.fa18===7&&cC.losses.f35c===3&&cC.losses.ccx===5&&cC.losses.fa18<cB.losses.fa18&&cC.losses.ccx<cB.losses.ccx,'D3 campaign control CAP-only: strike losses fall (F/A-18 9 -> 7, CCX-1 6 -> 5) via adjusted survivability');
ok(cC.flownByKey.cap>80&&cC.losses.cap===2,'D3 campaign control CAP-only: CAP support losses 2 priced on recovery coverage 0, not on full CAP coverage');
ok(wR.recoveryCoverage===1&&['fa18','f35c','ccx'].every(function(k){return survOf(wR,k)===survOf(wB,k);}),'D3 campaign control recovery-only: recovery coverage 0 -> 1, adjusted type survivability unchanged');
ok(cR.losses.fa18===8&&cR.losses.f35c===2&&cR.losses.ccx===4&&cR.losses.mq25===0&&cR.losses.fa18<cB.losses.fa18&&cR.losses.ccx<cB.losses.ccx,'D3 campaign control recovery-only: strike losses fall (F/A-18 9 -> 8, F-35C 3 -> 2, CCX-1 6 -> 4) via recovery coverage');
var none3=T.evalCampaign(500,{},{});
ok(none3.totalSorties===0&&none3.cumulativeEffect===0&&none3.windowedAverageSorties===0&&none3.dailyHistory.length===3,'D3 empty wing: zero sorties, zero effect, inactive days in the denominator');

// ---- S3 / Test 3: non-effect overhead sorties ----
v31();T.st.strike='direct';
var t3=T.evalWing(300,{fa18:25,f35c:25},{sortiesPerJet:2});
console.log('S3 test 3: scheduled '+t3.scheduledSorties+' overhead '+t3.overheadSorties+' combat '+t3.combatSorties);
ok(t3.scheduledSorties===100,'S3 T3 fixture schedules 100 deck sorties');
ok(t3.overheadSorties===5&&t3.fcfSorties===3&&t3.qualSorties===2,'S3 T3 5 overhead = 3 FCF + 2 qual');
ok(t3.combatSorties===95&&t3.totalLaunches===100,'S3 T3 combat = flown 100 - overhead 5 = 95');
var t3e=T.evalWing(300,{},{});
ok(t3e.overheadSorties===0&&t3e.fcfSorties===0&&t3e.qualSorties===0&&t3e.totalLaunches===0,'S3 T3 empty wing yields 0 overhead');
v31();T.st.wing=2;var cca=T.evalWing(300,{ccx:16,mq25:6,cap:6,isr:2});
ok(cca.scheduledSorties>0&&cca.overheadSorties===0,'S3 all-CCA/tanker wing: no eligible crewed fighter, 0 overhead');
var cap3=T.evalWing(300,{mq25:6,cap:8});ok(cap3.overheadSorties===0&&cap3.totalLaunches>0,'S3 tanker/CAP wing: 0 overhead');
v31();T.st.wing=2;var ns=T.evalWing(250,{fa18:4,cap:30,isr:20,mq25:20},{events:2});
ok(ns.binding==='deck'&&ns.totalLaunches<=ns.deckCeiling+1e-6&&ns.capSorties+ns.isrSorties+ns.tankerSorties+ns.overheadSorties<=ns.deckCeiling+1e-6&&ns.deckScale<1,'S3 non-strike deck saturation is bounded across all roles');
// Overhead is whole sorties: when the crewed-fighter budget is fractional and short of FCF + qual, the reservation is capped at
// the integer budget (FCF first, qual gets the remainder); the fractional remainder stays in combat strike demand.
v31();var e1=T.evalWing(500,{fa18:1,mq25:6,cap:10,isr:4}),e1b=e1.byType.reduce(function(s,x){return s+x.ss+x.overhead;},0);
console.log('S3 integer overhead: crewed budget '+r3(e1b)+' -> '+e1.fcfSorties+' FCF + '+e1.qualSorties+' qual');
ok(e1b>2&&e1b<3&&e1.fcfSorties===2&&e1.qualSorties===0&&e1.overheadSorties===2,'S3 integer overhead: crewed budget 2.86 -> 2 FCF + 0 qual (whole sorties, FCF first)');
var intGrid=true;[{fa18:1,mq25:6,cap:10,isr:4},{f35c:1,cap:12},{fa18:2,mq25:8,cap:20,isr:8},{fa18:1,f35c:1,cap:30}].forEach(function(a){[300,500,700,850].forEach(function(r){
  var w=T.evalWing(r,a),b=w.byType.reduce(function(s,x){return s+x.ss+x.overhead;},0);
  if(!Number.isInteger(w.fcfSorties)||!Number.isInteger(w.qualSorties)||w.overheadSorties>Math.floor(b+1e-9))intGrid=false;});});
ok(intGrid,'S3 overhead FCF and qual are integers within the whole crewed budget (16-state grid)');
v31();T.st.strike='direct';var eff0=T.evalWing(300,{fa18:25,f35c:25},{sortiesPerJet:2,overhead:false}),eff1=T.evalWing(300,{fa18:25,f35c:25},{sortiesPerJet:2});
ok(eff1.effects<eff0.effects&&near(eff1.overheadFuel,800*eff1.overheadSorties,1e-9),'S3 overhead delivers 0 effect (combat sorties replaced) and burns 800 lb each from ship fuel');
ok(eff1.a2aDemand<eff0.a2aDemand,'S3 overhead adds no air-defense demand');

// ---- S4 / Test 4: Contested Strait effect floor ----
v31();T.applyScenario('strait_defense');
var cand=T.evalWing(500,{f35c:12,fa18:12,mq25:6,horn5:0,cap:10,isr:4});
var deg=T.evalWing(500,{f35c:2,mq25:6,cap:28,isr:8});
var degT=T.evalWing(500,{f35c:2,cap:34,isr:8});
T.st.strike='direct';T.st.tankerTactics={yoyo:30,strike:70,consolidation:0,recovery:0};
var bas=T.evalWing(500,{fa18:28,f35c:6,mq25:6,cap:2,isr:2});
T.applyScenario('strait_defense');
function S(r){return T.objVal(r,44)*100;}
console.log('S4 StraitScore: candidate '+r3(S(cand))+' (E '+r3(cand.effects)+') baseline '+r3(S(bas))+' (E '+r3(bas.effects)+') 2-striker '+r3(S(deg))+' (E '+r3(deg.effects)+') zero-tanker '+r3(S(degT)));
ok(S(cand)>=75,'S4 T4 balanced candidate StraitScore >= 75.0');
ok(S(deg)<=18,'S4 T4 2-striker wing collapses to <= 18.0');
ok(S(cand)>S(deg)&&S(cand)>S(bas)&&S(bas)>0,'S4 T4 candidate beats degenerate and positive baseline');
// Re-based for the raised floor: the Strait effect requirement is now 350 (was 200).
ok(deg.effectFloor===350&&near(T.objVal(deg,44),deg.support*deg.meanSurv*Math.min(1,deg.effects/350),1e-12)&&deg.effFloorFactor<1&&cand.effFloorFactor===1,'S4 StraitScore = fuel support x mean survivability x min(1, E/350)');
var mid=T.evalWing(500,{f35c:8,mq25:6,cap:22,isr:8});
console.log('S4 discriminating token wing: E '+r3(mid.effects)+' protection '+r3(mid.survScore)+' score '+r3(mid.objScore));
ok(mid.effects>0&&mid.effFloorFactor>0&&mid.effFloorFactor<1&&mid.survScore>cand.survScore&&S(mid)<S(cand)&&near(T.objVal(mid,44),mid.survScore*mid.effects/350,1e-12),'S4 token-wing control: a positive-effect token wing out-protects the candidate but the floor ranks it below');
// Re-based for the raised floor (E_req 350, was 200).
ok(mid.effects<=350*cand.objScore,'S4 bound is claimed only for E <= E_req x candidate score (narrowed bound)');
// ---- S4 raised floor: E_req 350; pinned from the shipped engine (tolerance 0.05) ----
v31();T.applyScenario('strait_defense');
var f3={balanced:T.evalWing(500,{f35c:12,fa18:12,mq25:6,cap:10,isr:4}),minimalist:T.evalWing(500,{f35c:12,fa18:2,mq25:2,cap:20,isr:8}),
  subthreshold:T.evalWing(500,{f35c:12,mq25:2,cap:8,isr:8}),token:T.evalWing(500,{f35c:2,mq25:6,cap:28,isr:8})};
console.log('S4 raised floor: '+Object.keys(f3).map(function(k){return k+' '+r3(S(f3[k]))+' (E '+r3(f3[k].effects)+')';}).join(', '));
ok(T.SCENARIOS.strait_defense.effectFloor===350&&T.SCENARIOS.strait_defense_3day.effectFloor===350,'S4 raised floor: both Strait presets require 350 effect');
ok(near(S(f3.balanced),78.50,EPS)&&f3.balanced.effFloorFactor===1,'S4 raised floor: balanced wing 78.50, full floor credit');
// Engine value; an earlier spec draft printed 59.8 from rounded inputs (224.0 x 0.934).
ok(near(S(f3.minimalist),59.91,EPS)&&f3.minimalist.effFloorFactor<1,'S4 raised floor: minimalist strike wing 59.91');
ok(near(S(f3.subthreshold),52.81,EPS)&&f3.subthreshold.effects<200,'S4 raised floor: sub-threshold wing (E below 200) 52.81');
// Engine value; an earlier spec draft printed 10.1 from a pre-v3.1 effect (37.7) for this wing.
ok(near(S(f3.token),0.73,EPS),'S4 raised floor: 2-striker token wing 0.73');
ok(S(f3.balanced)>S(f3.minimalist)&&S(f3.minimalist)>S(f3.subthreshold)&&S(f3.subthreshold)>S(f3.token),'S4 raised floor: balanced wing wins; ranking balanced > minimalist > sub-threshold > token');
T.applyScenario('war_at_sea');T.st.rankBy='surv';var ws=T.evalWing(600,{f35c:2,cap:20});
ok(ws.effFloorFactor===1&&T.objVal(ws,22)===ws.survScore,'S4 floor applies only to the Contested Strait objective');

// ---- S6 / Test 6: CCX-1 archetype ----
v31();T.st.wing=2;
ok(T.usedSpots({ccx:48,cap:6,isr:2})===44,'S6 T6 48 CCX-1 x 0.75 + 6 CAP + 2 ISR = 44.0 spots');
ok(T.CAT.ccx.clean===420&&T.CAT.ccx.spots===.75&&T.CAT.ccx.role==='strike','S6 CCX-1 archetype registered as a strike type');
ok(Math.round(1.10*T.CAT.ccx.pay+40*T.CAT.ccx.burn)===3640&&3640+2000+Math.round(.40*T.CAT.ccx.pay)===6840,'S6 empty weight and MALW reproduce from the public formula');
var rrE=T.recoveryRisk('ccx',false,0),rrB=T.recoveryRisk('ccx',true,0),rrC=T.recoveryRisk('ccx',true,1);
ok(rrE.wTrap===5340&&rrB.wTrap===8140&&near(rrB.pBolter,.15,1e-12)&&rrE.pBolter===.02,'S6 recovery squeeze: 5,340 lb expended vs 8,140 lb bring-back, bolter 2% vs 15%');
ok(rrB.pBolter>rrE.pBolter,'S6 T6 overweight bring-back raises bolter risk');
ok(near(rrC.pLoss,.015,1e-12)&&near(rrB.pLoss,.15,1e-12)&&near(rrB.vpaRatio,Math.sqrt(8140/6840),1e-12),'S6 recovery tanker relief and approach-speed ratio');
v31();T.st.wing=2;T.st.rankBy='effect';var srch=T.autoSearch();
ok(srch.length>0&&srch.every(function(t){return near(t.spots,T.usedSpots(t.alloc),1e-9)&&t.spots<=T.getPool()+1e-9;}),'S6 Auto-Boss uses weighted spot accounting');
v31();T.st.wing=2;var cc4=T.evalWing(400,{ccx:16,mq25:4}),cc7=T.evalWing(700,{ccx:16});
ok(cc4.strikeSorties>0&&cc7.strikeSorties===0&&cc7.binding==='fuel','S6 CCX-1 organic reach limited: deep without tanker gas it is held');


// ---- v3.2 Logistics Pipeline: normative tests L1-L12 (AIR_BOSS_V32_LOGISTICS_SPEC.md section 11) ----
// Every value is produced by the SHIPPED logistics solver (window.__airbossTest.logistics); nothing is re-implemented here.
// "+/- 1%" and "approximately" are both checked at +/- 1% of the spec value; integers are checked exactly.
var L=T.logistics;
function pct1(a,b){return Number.isFinite(a)&&Math.abs(a-b)<=Math.abs(b)*0.01;}
function lgroup(name,fn){try{fn();}catch(e){ok(false,name+' (threw: '+e.message+')');}}
function lreset(){L.setState(L.DEFAULT_STATE);}
lgroup('L1 normal tempo 115/day',function(){lreset();
  var b=L.dailyBill(115),d=L.daysOfSupply(b),p=L.pipeline(b,750);
  ok(pct1(b.fuelGalDay,178250),'L1 fuel 178,250 gal/day +/- 1% (v3.4: 115 x 1,550 gal at the 200-nm reference) ('+r3(b.fuelGalDay)+')');
  ok(pct1(b.ordTonsDay,85.6),'L1 ordnance 85.6 short tons/day +/- 1% ('+r3(b.ordTonsDay)+')');
  ok(b.alloc.overhead===6&&b.alloc.fcf===3&&b.alloc.cq===3,'L1 overhead 6 sorties/day = 3 FCF + 3 CQ');
  ok(pct1(d.fuel,12.62)&&pct1(d.mag,19.6),'L1 fuel DOS ~12.6 days (2.25M / 178,250), magazine DOS ~19.6 days ('+r3(d.fuel)+' / '+r3(d.mag)+')');
  ok(near(p.cycleDays,6.97,0.005),'L1 shuttle cycle 6.97 days at 750 nm ('+r3(p.cycleDays)+')');
  ok(p.oilers===1&&p.ammo===1&&p.total===2,'L1 pipeline 1 oiler + 1 ammunition ship = 2 ships');
});
lgroup('L2 surge tempo 180/day',function(){lreset();
  var b=L.dailyBill(180),d=L.daysOfSupply(b),p=L.pipeline(b,750);
  ok(pct1(b.fuelGalDay,279000),'L2 fuel 279,000 gal/day +/- 1% (v3.4: 180 x 1,550)');
  ok(pct1(b.ordTonsDay,141.5),'L2 ordnance 141.5 short tons/day +/- 1% ('+r3(b.ordTonsDay)+')');
  ok(pct1(d.fuel,8.06)&&pct1(d.mag,11.9),'L2 fuel DOS ~8.06 days, magazine DOS ~11.9 days ('+r3(d.fuel)+' / '+r3(d.mag)+')');
  ok(pct1(p.cargoDaysFuel,8.96)&&pct1(p.cargoDaysMag,10.6),'L2 one ship cargo lasts: fuel ~8.96 days, magazine ~10.6 days ('+r3(p.cargoDaysFuel)+' / '+r3(p.cargoDaysMag)+')');
  ok(near(p.cadenceFuel,2250000/279000,1e-9)&&p.cadenceFuel===d.fuel&&near(p.cadenceMag,1500/b.ordTonsDay,1e-9)&&pct1(p.cadenceMag,10.60),'L2 reserve-safe cadence: fuel 8.06 days (usable stores bind, not the 8.96-day cargo), magazine 10.60 days ('+r3(p.cadenceFuel)+' / '+r3(p.cadenceMag)+')');
  ok(p.oilers===1&&p.ammo===1&&p.total===2,'L2 pipeline 1 oiler + 1 ammunition ship = 2 ships');
});
lgroup('L3 fleet doubling at 1,800 nm',function(){lreset();
  var b=L.dailyBill(180),p=L.pipeline(b,1800);
  ok(near(p.cycleDays,3.5+1800/216,1e-9)&&near(p.cycleDays,11.83,0.005),'L3 cycle 3.5 + 1,800/216 = 11.83 days');
  ok(p.cycleDays>p.cadenceFuel&&p.cycleDays>p.cadenceMag,'L3 cycle exceeds both replenishment cadences');
  ok(p.oilers===2&&p.ammo===2&&p.total===4,'L3 pipeline doubles: 2 oilers + 2 ammunition ships = 4 ships');
});
lgroup('L4 overhead inclusion',function(){lreset();
  var b=L.dailyBill(115);
  ok(b.alloc.mission===109&&b.alloc.overhead===6&&b.alloc.mission+b.alloc.overhead===115,'L4 115/day = 109 mission + 6 overhead sorties');
  ok(near(b.overheadFuelGal,6*0.75*7000/6.8,1e-9)&&Math.round(b.overheadFuelGal)===4632,'L4 overhead fuel 6 x 0.75 hr x 7,000 lb/hr / 6.8 = 4,632 gal');
  ok(near(b.missionFuelGal+b.overheadFuelGal,b.fuelGalDay,1e-9)&&b.overheadFuelGal<b.fuelGalDay,'L4 overhead fuel is debited inside the daily fuel bill');
  ok(b.overheadWeapons===0,'L4 overhead weapons = 0 (FCF and CQ carry no ordnance)');
});
lgroup('L5 inactive wing guard',function(){lreset();
  var b=L.dailyBill(0),p=L.pipeline(b,750),d=L.daysOfSupply(b);
  ok(b.fuelGalDay===0&&b.ordTonsDay===0&&b.alloc.overhead===0&&p.total===0,'L5 zero tempo: fuel 0, ordnance 0, overhead 0, ships 0');
  ok(!Number.isNaN(d.fuel)&&!Number.isNaN(d.mag)&&!Number.isNaN(p.cadenceFuel)&&!Number.isNaN(p.cadenceMag),'L5 zero tempo: no NaN in supply or cadence');
  var s=L.solve(Object.assign({},L.DEFAULT_STATE,{tempo:0})),html=L.cardsHTML(s);
  ok(!/NaN|Infinity|undefined/.test(html)&&html.length>0,'L5 zero tempo: cards render with no NaN, Infinity or undefined');
});
lgroup('L6 upstream isolation',function(){
  v31();T.applyScenario('strait_defense');
  var snap=function(){return JSON.stringify({st:T.st,deck:T.getDeck(),pool:T.getPool(),wing:T.evalWing(500),camp:T.evalCampaign(500,T.st.alloc,{events:8}),
    scen:T.SCENARIOS,cat:T.CAT,weap:T.WEAPONS,decks:T.DECKS,obj:T.objVal(T.evalWing(500),44)});};
  var before=snap(),runs=0;
  [0,50,60,115,180,240].forEach(function(S){[150,200,500,800].forEach(function(R){[200,750,1800,2500].forEach(function(D){
    ['salvo','sls'].forEach(function(doc){['standard','collaborative'].forEach(function(w){['delegated','shipboard'].forEach(function(m){
      L.setState({tempo:S,radius:R,transit:D,doctrine:doc,wing:w,mumt:m});L.cardsHTML(L.solve());runs++;});});});});});});
  L.requestPosture('beast');L.overnightReset(12);L.render();L.setView('logistics');L.setView('deck');
  ok(runs===768&&snap()===before,'L6 768 logistics solves, posture reset, render and view switch leave v3.1 state, deck, Strait score and campaign unchanged');
  lreset();
  ok(failures.filter(function(f){return !/^L\d+ /.test(f);}).length===0,'L6 every v3.1 regression check in this suite passes');
});
lgroup('L7 weapon demand',function(){
  var w=L.weaponsRequired({targets:50,hits:1,pk:0.80,pSurv:0.95,pValid:0.90});
  ok(near(w.divisor,0.684,1e-12),'L7 chain divisor 0.80 x 0.95 x 0.90 = 0.684');
  ok(w.weapons===74,'L7 weapons required = ceil(50 / 0.684) = 74');
  ok(near(w.ratio,1.48,1e-12),'L7 weapon-to-effect ratio 74 / 50 = 1.48');
});
lgroup('L8 salvo vs shoot-look-shoot',function(){
  var o={targets:50,pHit:0.72,perSortie:2,fuelLbPerSortie:8500},sv=L.strikeDoctrine('salvo',o),sl=L.strikeDoctrine('sls',o);
  ok(sv.weapons===100&&sv.kills===46&&sv.sorties===50&&sv.reattackSorties===0,'L8 salvo: 100 weapons, 46 kills, 50 sorties, 0 re-attack');
  ok(near(sv.fuelPerTarget,9239,1),'L8 salvo: 9,239 lb JP-5 per target ('+r3(sv.fuelPerTarget)+')');
  var w1=sl.waves[0],w2=sl.waves[1];
  ok(w1.weapons===50&&w1.kills===36&&w1.targets-w1.kills===14,'L8 shoot-look-shoot wave 1: 50 bombs, 36 kills, 14 survive');
  ok(w2&&w2.sorties===7&&w2.weapons===14&&near(w2.fuelGal,8750,1e-9)&&sl.reattackSorties===7,'L8 re-attack wave 2: ceil(14 / 2) = 7 sorties, 14 weapons, +8,750 gal');
  ok(sl.kills===46&&sl.waves.length===2&&sl.weapons===64&&sl.sorties===32,'L8 shoot-look-shoot totals: 46 kills (92%), 64 weapons, 32 sorties');
  ok(near(1-sl.weapons/sv.weapons,0.36,1e-12),'L8 shoot-look-shoot saves 36% of weapons vs salvo');
});
lgroup('L9 sortie sag with distance',function(){
  var g=L.sortieSag(500,{hours:14,spot:15}),base=L.sortieSag(200,{hours:14,spot:15});
  ok(near(g.tSortie,2*500/450+0.50+0.35,1e-12)&&near(g.tSortie,3.07,0.005),'L9 sortie duration 2 x 500/450 + 0.50 + 0.35 = 3.07 hr');
  ok(g.tEvent===2.75,'L9 scheduled cyclic event stretches to 2.75 hr');
  ok(g.events===5&&g.ceiling===75,'L9 floor(14.0 / 2.75) = 5 events; ceiling 5 x 15 = 75 sorties/day');
  ok(base.ceiling===120&&near(1-g.ceiling/base.ceiling,0.375,1e-12),'L9 a 37.5% reduction from 120/day at 200 nm');
});
lgroup('L10 day-level posture',function(){lreset();
  var s=L.postureWave('stealth',50),b=L.postureWave('beast',50);
  ok(s.bombs===100&&b.bombs===300,'L10 50-sortie wave: stealth 100 bombs, beast 300 bombs (3x)');
  ok(s.burnLbHr===7000&&near(b.burnLbHr,8400,1e-9)&&near(b.burnLbHr/s.burnLbHr,1.20,1e-12),'L10 beast fuel burn +20%: 7,000 -> 8,400 lb/hr');
  ok(s.pSurv===0.95&&b.pSurv===0.78,'L10 penetration survivability 0.95 -> 0.78');
  var s60=L.postureWave('stealth',30),b60=L.postureWave('beast',10);
  ok(s60.bombs===60&&b60.bombs===60&&near(s60.expectedLosses,1.5,1e-9)&&near(b60.expectedLosses,2.2,1e-9),'L10 60 bombs: 30 vs 10 sorties, expected losses 1.5 vs 2.2 jets');
  var r=L.requestPosture('beast');
  ok(L.getState().posture==='stealth'&&L.getState().pendingPosture==='beast'&&r.applied===false&&r.leadHours===12,'L10 posture request mid-day is locked: still stealth, beast pending 12 hr');
  var short=L.overnightReset(6);
  ok(!short.applied&&L.getState().posture==='stealth','L10 a reset shorter than 12 hr does not reconfigure');
  var full=L.overnightReset(12);
  ok(full.applied&&L.getState().posture==='beast'&&L.getState().pendingPosture===null,'L10 12-hr overnight deck reset applies beast mode');
  lreset();
});
lgroup('L11 aircrew limits',function(){
  var c=L.aircrew({fighters:44,crewRatio:1.48,medDown:0.05,tSortie:2.5,hrs7:30,hrs30:65});
  ok(c.pilots===65&&c.ready===62&&c.medDowned===3,'L11 44 x 1.48 = 65 pilots; 5% med-down -> 62 ready');
  ok(c.perWeek===12&&c.perMonth===26,'L11 floor(30.0 / 2.50) = 12 sorties/week; floor(65.0 / 2.50) = 26 sorties/month');
  ok(near(c.ceil7,106.3,0.05)&&near(c.ceil30,53.7,0.05),'L11 ceilings: 62 x 12 / 7 = 106.3/day; 62 x 26 / 30 = 53.7/day');
  ok(c.ceil7<180&&c.ceil30<c.ceil7,'L11 aircrew limits bind well before a 180-sortie surge deck');
});
lgroup('L12 CCA operators and MUMT handoff',function(){lreset();
  // Spec 3.7.8 sec 6.5 / L12: consoles = ceil(N_cca / R_ctrl) with an airborne quarterback (1:1 without);
  // on watch = ceil(consoles x 1.5) integer watchstanders; 0 charged en route; assigned = on watch x shifts (8-hr, 1..3).
  // R_ctrl is player-tunable in [1, 8]; its default is ONE named constant (placeholder value 4).
  ok(L.CCA_CONTROL_RATIO_DEFAULT===4&&L.C.ctrlRatio===4&&L.DEFAULT_STATE.ctrlRatio===4&&L.getState().ctrlRatio===4,'L12 default control ratio R_ctrl = 4 CCAs per operator, one named constant (placeholder)');
  var a=L.ccaOperators(12,'delegated',3),bb=L.ccaOperators(12,'shipboard',3);
  ok(a.ratio===4&&a.consoles===3&&a.onWatch===5&&a.enRoute===0&&a.shifts===3&&a.operators===15,'L12 continuous 24-hr fixture, handoff at default R_ctrl 4: ceil(12/4) = 3 consoles, ceil(3 x 1.5) = 5 on watch, 0 en route, 5 x 3 shifts = 15 assigned');
  ok(bb.consoles===12&&bb.onWatch===18&&bb.operators===54,'L12 continuous 24-hr fixture, no handoff (1:1): 12 consoles, 18 on watch, 18 x 3 = 54 assigned');
  var FIX={2:[6,9,27],4:[3,5,15],8:[2,3,9]},fixOk=true,bOk=true;
  Object.keys(FIX).forEach(function(R){var x=L.ccaOperators(12,'delegated',3,+R),y=L.ccaOperators(12,'shipboard',3,+R),e=FIX[R];
    if(!(x.consoles===e[0]&&x.onWatch===e[1]&&x.operators===e[2]&&x.enRoute===0&&x.ratio===+R))fixOk=false;
    if(!(y.consoles===12&&y.onWatch===18&&y.operators===54))bOk=false;});
  ok(fixOk,'L12 24-hr fixture at R_ctrl 2 / 4 / 8: 6 / 3 / 2 consoles, 9 / 5 / 3 on watch, 27 / 15 / 9 assigned');
  ok(bOk,'L12 no handoff is 1:1 at every R_ctrl: 12 consoles, 18 on watch, 54 assigned');
  var w115=L.flightOpsWindow(115,200),w180=L.flightOpsWindow(180,200),w240=L.flightOpsWindow(240,200),w60=L.flightOpsWindow(60,200);
  ok(w115.hours===14&&w115.shifts===2&&w180.hours===18&&w180.shifts===3&&w240.hours===24&&w240.shifts===3&&w60.hours===8&&w60.shifts===1,
    'L12 flight-ops window -> shifts = min(3, max(1, ceil(W / 8))): 115/day 14 hr -> 2; 180/day 18 hr -> 3; 240/day 24 hr -> 3; 60/day 8 hr -> 1');
  function ops(S,m,R){var o={tempo:S,radius:200,wing:'collaborative',mumt:m};if(R!=null)o.ctrlRatio=R;return L.solve(Object.assign({},L.DEFAULT_STATE,o)).cca;}
  var n1=ops(115,'delegated'),n2=ops(115,'shipboard'),s1=ops(180,'delegated'),s2=ops(180,'shipboard'),f1=ops(60,'delegated'),f2=ops(60,'shipboard');
  ok(n1.operators===10&&n1.onWatch===5&&n1.shifts===2&&n2.operators===36&&n2.onWatch===18,'L12 normal 115/day (14-hr window, 2 shifts), R_ctrl 4: handoff 10 assigned (5 on watch) vs no handoff 36 (18 on watch)');
  ok(s1.operators===15&&s1.onWatch===5&&s1.shifts===3&&s2.operators===54&&s2.onWatch===18,'L12 surge 180/day (18-hr window, 3 shifts), R_ctrl 4: handoff 15 assigned (5 on watch) vs no handoff 54 (18 on watch)');
  ok(f1.operators===5&&f1.onWatch===5&&f1.shifts===1&&f2.operators===18,'L12 short day 60/day (8-hr window, 1 shift), R_ctrl 4: handoff 5 assigned (the 5 floor) vs no handoff 18');
  var TT={2:[18,27,9],8:[6,9,3]},tOk=true;Object.keys(TT).forEach(function(R){var e=TT[R];
    if(!(ops(115,'delegated',+R).operators===e[0]&&ops(180,'delegated',+R).operators===e[1]&&ops(60,'delegated',+R).operators===e[2]&&ops(115,'shipboard',+R).operators===36&&ops(180,'shipboard',+R).operators===54&&ops(60,'shipboard',+R).operators===18))tOk=false;});
  ok(tOk,'L12 tempo table at R_ctrl 2: 18 / 27 / 9 assigned (9 on watch); at R_ctrl 8: 6 / 9 / 3 (3 on watch); no handoff 36 / 54 / 18 at both');
  var inRange=true,mb=true;[50,60,61,90,115,120,121,150,180,200,201,240].forEach(function(S){[150,200,350,500,800].forEach(function(R){[1,2,3,4,5,6,7,8].forEach(function(K){
    var A=ops(S,'delegated',K),B=ops(S,'shipboard',K),w=Math.ceil(Math.ceil(12/K)*1.5);
    if(!(A.onWatch===w&&Number.isInteger(A.onWatch)&&A.operators===w*A.shifts&&A.shifts>=1&&A.shifts<=3&&A.enRoute===0&&A.operators<=B.operators))inRange=false;
    if(!(B.onWatch===18&&B.operators===18*B.shifts&&B.shifts===A.shifts))mb=false;if(K===1&&A.operators!==B.operators)inRange=false;});});});
  ok(inRange&&mb,'L12 the operator bill is computed: handoff on watch = ceil(ceil(12 / R_ctrl) x 1.5), an integer, x shifts, never above no handoff (equal at 1:1); no handoff fixed 18 on watch, at every tempo, radius and R_ctrl 1..8');
  var cl=L.ccaOperators(12,'delegated',3,100),c0=L.ccaOperators(12,'delegated',3,0.5),cn=L.ccaOperators(12,'delegated',3,NaN);
  ok(cl.ratio===8&&cl.consoles===2&&c0.ratio===1&&c0.consoles===12&&cn.ratio===4&&cn.operators===15,'L12 R_ctrl is held to its [1, 8] range; a non-number falls back to the default 4');
  var h=L.cardsHTML(L.solve(Object.assign({},L.DEFAULT_STATE,{tempo:115,wing:'collaborative',mumt:'delegated'})));
  ok(h.indexOf('10 assigned (5 on watch, 2 shifts)')>=0&&h.indexOf('0 en route')>=0&&h.indexOf('1 operator per 4 CCAs')>=0&&h.indexOf('[teaching assumption]')>=0,'L12 Card F shows the computed bill at default: 10 assigned (5 on watch, 2 shifts), 0 en route, 1 operator per 4 CCAs [teaching assumption]');
  var h2=L.cardsHTML(L.solve(Object.assign({},L.DEFAULT_STATE,{tempo:115,wing:'collaborative',mumt:'delegated',ctrlRatio:2}))),h8=L.cardsHTML(L.solve(Object.assign({},L.DEFAULT_STATE,{tempo:115,wing:'collaborative',mumt:'delegated',ctrlRatio:8})));
  ok(h2.indexOf('18 assigned (9 on watch, 2 shifts)')>=0&&h8.indexOf('6 assigned (3 on watch, 2 shifts)')>=0,'L12 Card F at R_ctrl 2: 18 assigned (9 on watch, 2 shifts); at R_ctrl 8: 6 assigned (3 on watch, 2 shifts)');
  var zOk=true;[1,2,4,8].forEach(function(K){['delegated','shipboard'].forEach(function(m){var z=L.ccaOperators(0,m,3,K);if(z.consoles!==0||z.onWatch!==0||z.operators!==0)zOk=false;});
    var sw=L.solve(Object.assign({},L.DEFAULT_STATE,{tempo:115,wing:'standard',ctrlRatio:K})).cca;if(sw.operators!==0||sw.onWatch!==0)zOk=false;});
  ok(zOk,'L12 no CCAs, no consoles, no one on watch and no console operators, in both modes at every R_ctrl');
  var sv=JSON.stringify(T.st);L.setState({ctrlRatio:8});var g8=L.solve();L.setState({ctrlRatio:2});var g2=L.solve();lreset();
  ok(g8.state.ctrlRatio===8&&g2.state.ctrlRatio===2&&L.getState().ctrlRatio===4&&JSON.stringify(T.st)===sv,'L12 R_ctrl is logistics state: set, solved, reset to the default, flight-deck state untouched');
  lreset();
});
// ---- v3.2 round 2 (spec 3.7.5): numeric reconciliation, reserve-safe pipeline, horizon-governed headline, posture scoping ----
lgroup('L1 overhead and weapon reconciliation',function(){lreset();
  var b=L.dailyBill(115),a=b.alloc;
  ok(b.fuelGalDay===178250&&Math.round(b.missionFuelGal)===173618&&Math.round(b.overheadFuelGal)===4632,'L1 overhead inside the bill: 173,618 gal mission + 4,632 gal overhead = 178,250 gal (not added on top)');
  ok(Math.round(a.strike*L.C.strikeWpnPerSortie)===168&&Math.round(a.cap*L.C.capWpnPerSortie)===14&&Math.round(b.weaponsDay)===182&&pct1(b.weaponsWeek,1274),'L1 weapons: 70 x 2.4 = 168 strike + 16 x 0.85 = 14 AAM = 182/day; ~1,274/week ('+r3(b.weaponsWeek)+')');
  var h=L.cardsHTML(L.solve(Object.assign({},L.DEFAULT_STATE)));
  ok(h.indexOf('182 weapons/day')>=0&&h.indexOf(T.fmt(Math.round(b.weaponsWeek),0)+' weapons/week')>=0,'L1 Card A shows weapons per day and per week');
});
lgroup('L2 surge and max-effort reconciliation',function(){lreset();
  var b=L.dailyBill(180),m=L.dailyBill(240),dm=L.daysOfSupply(m);
  ok(Math.round(b.weaponsDay)===299&&pct1(b.weaponsWeek,2092),'L2 surge weapons: 278.4 strike + 20.4 AAM = ~299/day; ~2,092/week');
  ok(pct1(m.ordTonsDay,195.4)&&pct1(dm.mag,8.6)&&pct1(dm.fuel,6.05)&&dm.binding==='fuel','L2 max effort 240/day: 195.4 short tons/day, magazine DOS ~8.6 days, fuel DOS 6.05 days binds ('+r3(m.ordTonsDay)+' / '+r3(dm.mag)+' / '+r3(dm.fuel)+')');
  ok(L.sortieSag(750,{hours:14,spot:15}).ceiling===60,'L2 deep standoff 750 nm: 4 events x 15 = 60 sorties/day');
});
lgroup('L3 reserve-safe pipeline',function(){lreset();
  var b=L.dailyBill(180),rows=[[300,1,1],[750,1,1],[1000,2,1],[1200,2,1],[1500,2,1],[1800,2,2],[2400,2,2]],okRows=true;
  rows.forEach(function(r){var p=L.pipeline(b,r[0]);if(!(p.oilers===r[1]&&p.ammo===r[2]&&p.total===r[1]+r[2]&&near(p.cycleDays,3.5+r[0]/216,1e-9)))okRows=false;});
  ok(okRows,'L3 reserve-safe matrix at 180/day (v3.4 fuel bill): 300 / 750 nm 1 + 1; 1,000 nm (8.13-d cycle: above the 8.06-d usable fuel, inside one 8.96-d oiler cargo) / 1,200 / 1,500 nm 2 + 1 = 3; 1,800 / 2,400 nm 2 + 2 = 4');
  var p15=L.pipeline(b,1500),d15=L.daysOfSupply(b);
  ok(near(p15.cycleDays,10.444,0.0005)&&p15.cycleDays>d15.fuel&&p15.oilers===2&&p15.cadenceFuel<=d15.fuel&&p15.arrivalFuel<=d15.fuel,'L3 surge at 1,500 nm: cycle 10.444 d exceeds 8.06 d usable fuel -> 2 oilers, never 1; cadence and staggered arrival within usable stores');
  var s=L.solve(Object.assign({},L.DEFAULT_STATE,{tempo:175,radius:200,transit:1700})),gap=s.pipe.cycleDays-L.C.tUnrep;
  ok(near(gap,10.370370,1e-5)&&near(s.dos.fuel,2250000/(175*1550),1e-9)&&near(s.dos.fuel,8.294931,1e-5)&&gap>s.dos.fuel&&s.pipe.oilers===2&&s.pipe.arrivalFuel<=s.dos.fuel,'L3 transfer-window control 175/day at 1,700 nm: one oiler leaves a 10.370 d no-transfer gap > 8.295 d usable -> 2 staggered oilers');
  var e1=L.pipeline(b,985),e2=L.pipeline(b,986),u=2250000/279000;
  ok(e1.cycleDays<=u&&e2.cycleDays>u&&e1.oilers===1&&e2.oilers===2,'L3 boundary at 180/day (v3.4 usable fuel 8.065 d): 985 nm cycle '+r3(e1.cycleDays)+' d <= usable -> 1 oiler; 986 nm '+r3(e2.cycleDays)+' d -> 2');
  var c=L.pipeline(b,300);ok(c.oilers===1&&c.ammo===1&&c.cadenceFuel>=c.cycleDays,'L3 short-transit positive control 180/day at 300 nm: 1 oiler + 1 ammunition ship');
  var safe=true,n=0;[0,60,115,175,180,200,240].forEach(function(S){var bb=L.dailyBill(S),dd=L.daysOfSupply(bb);for(var D=200;D<=2500;D+=50){var p=L.pipeline(bb,D);n++;
    if(S===0){if(p.total!==0)safe=false;continue;}
    if(!(p.cadenceFuel<=dd.fuel+1e-9&&p.cadenceMag<=dd.mag+1e-9&&p.arrivalFuel<=p.cadenceFuel+1e-9&&p.arrivalMag<=p.cadenceMag+1e-9&&p.cadenceFuel<=p.cargoDaysFuel+1e-9&&p.cadenceMag<=p.cargoDaysMag+1e-9))safe=false;}});
  ok(safe&&n===329,'L3 '+n+' tempo x transit cases: every recommended cadence and staggered arrival is within usable stores and one ship\'s cargo');
  var h=L.cardsHTML(L.solve(Object.assign({},L.DEFAULT_STATE,{tempo:180,transit:1500})));
  ok(h.indexOf('1 Oiler every 8.1 days')>=0&&h.indexOf('2 Fleet Oilers + 1 Ammunition Ship')>=0&&h.indexOf('9.0 days')>=0,'L3 Card D shows the reserve-safe cadence with the ship count (1,500 nm surge: 1 Oiler every 8.1 days; 2 Fleet Oilers + 1 Ammunition Ship)');
});
lgroup('L10 posture state and vignette scope',function(){lreset();
  ok(/Current Posture: Stealth Ingress/.test(L.postureStatus())&&/Pending Posture: none/.test(L.postureStatus()),'L10 status shows Current Posture and no pending change');
  L.requestPosture('beast');
  ok(/Current Posture: Stealth Ingress/.test(L.postureStatus())&&/Pending Posture: Beast Mode/.test(L.postureStatus())&&/locked until the 12-hour deck reset; entering Beast Mode is debited against the fly day/.test(L.postureStatus()),'L10 mid-day request: Current Posture Stealth Ingress, Pending Posture Beast Mode, locked until the 12-hour deck reset (entering Beast Mode is debited against the fly day)');
  lreset();
  var a=L.solve(Object.assign({},L.DEFAULT_STATE,{posture:'stealth'})),b=L.solve(Object.assign({},L.DEFAULT_STATE,{posture:'beast'}));
  ok(a.bill.fuelGalDay===178250&&b.bill.fuelGalDay===178250&&a.effects.pSurv>b.effects.pSurv,'L10 posture is scoped to the Card E vignette: the 178,250 gal/day fleet bill is identical across postures');
  var ha=L.cardsHTML(a),hb=L.cardsHTML(b);
  ok(ha.indexOf('vignette')>=0&&ha.indexOf('apart from the daily fleet bill')>=0,'L10 Card E is labelled a strike vignette, scoped apart from the daily fleet bill');
  ok(ha.indexOf('60-bomb strike task')>=0&&ha.indexOf('30 sorties')>=0&&ha.indexOf('1.5 jets lost')>=0&&hb.indexOf('10 sorties')>=0&&hb.indexOf('2.2 jets lost')>=0,'L10 Card E fixed 60-bomb task: stealth 30 sorties / 1.5 jets lost; beast 10 sorties / 2.2 jets lost');
});
lgroup('L11 horizon-governed headline',function(){lreset();
  var c=L.aircrew({tSortie:1.74});
  ok(c.perWeek===17&&c.perMonth===37&&near(c.ceil7,150.6,0.05)&&near(c.ceil30,76.5,0.05)&&c.ceilDay===186,'L11 ceilings at 1.74 hr: daily 62 x 3 = 186; 7-day 62 x 17 / 7 = 150.6; 30-day 62 x 37 / 30 = 76.5');
  var s30=L.solve(Object.assign({},L.DEFAULT_STATE,{horizon:'30'})),s7=L.solve(Object.assign({},L.DEFAULT_STATE,{horizon:'7'}));
  ok(L.DEFAULT_STATE.horizon==='30','L11 the default horizon is the 30-day sustained line period');
  ok(near(s30.mannedSorties,92,1e-9)&&near(s30.crew.ceil30,80.6,0.05)&&s30.mannedSorties>s30.crew.ceil30&&s30.binding==='aircrew-30'&&near(s30.sustainable,115*s30.crew.ceil30/92,1e-9)&&s30.sustainable<115,
    'L11 default 115/day, 200 nm, 30-day horizon: 92 manned > 80.6 -> sustainable '+r3(s30.sustainable)+' of 115, Aircrew Fatigue (30-Day Limit) binds');
  ok(s7.sustainable===115&&s7.binding==='none'&&s7.mannedSorties<s7.crew.ceil7,'L11 the same day on a 7-day surge horizon: 92 manned < '+r3(s7.crew.ceil7)+' -> 115 of 115, nothing binds (passes weekly, fails monthly)');
  var h30=L.cardsHTML(s30),h7=L.cardsHTML(s7),g30=L.gougeText(s30),g7=L.gougeText(s7);
  ok(h30.indexOf('30-Day Sustained')>=0&&h30.indexOf('Aircrew Fatigue (30-Day Limit)')>=0&&h7.indexOf('7-Day Surge')>=0&&g30.indexOf('30-day sustained')>=0&&g7.indexOf('7-day surge')>=0,'L11 headline and Gouge state the horizon and name the binding resource');
  ok(h30.indexOf('7-Day Limit: '+T.fmt(s30.crew.ceil7,1)+' sorties/day')>=0&&h30.indexOf('30-Day Limit: '+T.fmt(s30.crew.ceil30,1)+' sorties/day')>=0,'L11 Card F shows both the 7-day and 30-day aircrew limits');
  var d=L.solve(Object.assign({},L.DEFAULT_STATE,{radius:500,horizon:'7'}));
  ok(d.sustainable===75&&d.binding==='deck'&&L.cardsHTML(d).indexOf('Flight Deck Events')>=0,'L11 deck-bound control: 115/day at 500 nm, 7-day horizon -> 75 of 115, Flight Deck Events binds');
  var good=true,cnt=0;[0,50,60,115,150,180,240].forEach(function(S){[150,200,350,500,800].forEach(function(R){['30','7'].forEach(function(H){['standard','collaborative'].forEach(function(w){
    var q=L.solve(Object.assign({},L.DEFAULT_STATE,{tempo:S,radius:R,horizon:H,wing:w})),lim=q.limits,keys=Object.keys(lim),m=S;cnt++;
    keys.forEach(function(k){if(lim[k]<m)m=lim[k];});
    if(!(Math.abs(q.sustainable-m)<1e-9&&keys.indexOf('aircrew30')>=0===(H==='30')&&keys.every(function(k){return q.sustainable<=lim[k]+1e-9;})))good=false;
    if(S>0&&q.sustainable<S&&!(q.binding!=='none'&&Math.abs(lim[{deck:'deck','aircrew-day':'aircrewDay','aircrew-7':'aircrew7','aircrew-30':'aircrew30'}[q.binding]]-q.sustainable)<1e-9))good=false;
    if(q.sustainable===S&&q.binding!=='none')good=false;});});});});
  ok(good&&cnt===140,'L11 '+cnt+' cases: the headline is the lowest applicable limit under the horizon and names the limit that binds');
  var ex=true;[60,115,180].forEach(function(S){[200,500].forEach(function(R){var q=L.solve(Object.assign({},L.DEFAULT_STATE,{tempo:S,radius:R}));
    if(q.exhausted!==(q.mannedSorties>q.crew.ceil7||q.mannedSorties>q.crew.ceil30)||(L.cardsHTML(q).indexOf('Flight-hour guideline exceeded')>=0)!==q.exhausted)ex=false;});});
  ok(ex&&s30.exhausted,'L11 flight-hour guideline flag shown exactly when manned sorties exceed the 7-day or 30-day guideline (default day: 30-day exceeded)');
  lreset();
});
// ---- v3.2 section 10: display binding of the Logistics view (cards read the shipped solver) ----
lgroup('L UI cards bound to solver',function(){
  var f=T.fmt;
  L.setState(Object.assign({},L.DEFAULT_STATE,{tempo:115,radius:500,transit:1800}));
  var s=L.solve(),h=L.cardsHTML(s);
  ok(h.indexOf(f(s.bill.fuelGalDay,0)+' gal/day')>=0&&h.indexOf(f(s.bill.fuelLbDay/1e6,2)+' million lb/day')>=0,'L UI Card A fuel gal/day and million lb/day bound to solver');
  ok(h.indexOf(f(s.bill.ordTonsDay,1)+' short tons/day')>=0&&h.indexOf(f(Math.round(s.bill.weaponsDay),0)+' weapons/day')>=0,'L UI Card A ordnance tons and weapons bound to solver');
  ok(h.indexOf(s.bill.alloc.overhead+' sorties/day ('+s.bill.alloc.fcf+' FCF + '+s.bill.alloc.cq+' CQ)')>=0,'L UI Card A overhead bound to solver');
  ok(h.indexOf('500 nm')>=0&&h.indexOf('2.75 hours (2+45 cycle)')>=0&&h.indexOf(s.sagStd.events+' events / day')>=0&&h.indexOf(s.sagStd.ceiling+' sorties / day')>=0,'L UI Card B radius, event length, events and distance ceiling bound to solver');
  ok(h.indexOf(f(s.dos.fuel,1)+' days')>=0&&h.indexOf(f(s.dos.mag,1)+' days')>=0&&h.indexOf(s.dos.binding==='fuel'?'Fuel binds first':'Magazine binds first')>=0,'L UI Card C days of supply and first bottleneck bound to solver');
  ok(h.indexOf(f(s.pipe.cycleDays,1)+' days')>=0&&h.indexOf(s.pipe.oilers+' Fleet Oiler')>=0&&h.indexOf(s.pipe.ammo+' Ammunition Ship')>=0&&h.indexOf(f(s.pipe.cadenceFuel,1))>=0,'L UI Card D cycle, cadence and ships bound to solver');
  ok(h.indexOf(s.effects.kills+' targets')>=0&&h.indexOf(f(s.effects.fuelPerTarget,0)+' lb JP-5 / target')>=0&&h.indexOf(f(s.effects.weaponsPerTarget,2)+' weapons / target')>=0&&h.indexOf(f(s.effects.sortiesPerTarget,2)+' sorties / target')>=0&&h.indexOf(f(s.effects.shipDaysPer100,1)+' ship-days')>=0,'L UI Card E effects and tail ratios bound to solver');
  ok(h.indexOf(s.crew.ready+' / '+s.crew.pilots+' Ready ('+s.crew.medDowned+' Med-Down)')>=0&&h.indexOf('7-Day Limit: '+f(s.crew.ceil7,1)+' sorties/day')>=0&&h.indexOf('30-Day Limit: '+f(s.crew.ceil30,1)+' sorties/day')>=0&&h.indexOf(s.cca.operators+' assigned ('+s.cca.onWatch+' on watch')>=0,'L UI Card F pilot pool, 7-day and 30-day limits and operators bound to solver');
  ok(h.indexOf(f(s.sustainable,0)+' of '+s.tempo+' sorties / day')>=0&&h.indexOf(s.bindingLabel)>=0&&h.indexOf(s.horizonLabel)>=0,'L UI summary: sustainable tempo, horizon and binding limit bound to solver');
  L.setState({tempo:180,radius:350,transit:1800,wing:'collaborative',mumt:'shipboard',doctrine:'sls'});
  var s2=L.solve(),h2=L.cardsHTML(s2);
  ok(s2.pipe.total===4&&h2.indexOf('2 Fleet Oilers + 2 Ammunition Ships')>=0&&s2.cca.operators===54&&h2.indexOf('54 assigned (18 on watch, 3 shifts)')>=0&&h2.indexOf('Re-attack sortie tail')>=0,'L UI surge at 1,800 nm: 4 ships, 54 assigned operators (18 on watch, 3 shifts), re-attack tail shown');
  ok(s2.exhausted===(s2.mannedSorties>s2.crew.ceil7||s2.mannedSorties>s2.crew.ceil30)&&(h2.indexOf('Flight-hour guideline exceeded')>=0)===s2.exhausted,'L UI flight-hour guideline flag shown exactly when manned sorties exceed the 7-day or 30-day aircrew guideline');
  ok(!/\bT-AO\b|\bT-AKE\b|C-2A|CMV-22|MH-60|\bSDB\b/.test(h+h2+L.gougeText(s)+L.gougeText(s2)),'L UI public boundary: generic logistics archetypes only');
  lreset();
});
console.log('checks run: '+checks+' failures: '+failures.length);if(failures.length){console.log(failures.join('\n'));process.exitCode=1;}
