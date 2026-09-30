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
ok(mq.transfer===750&&mq.offload===9750&&mq.feasible,'MQ consolidation conservation');
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
// recovery tanker, and the yo-yo region starts at 720 nm (at 700 the balanced plan now fully supplies 12 F-35C).
var tacticRegions=[['recovery',300,'fa18',16,1,'horn5'],['strike',500,'fa18',12,0,'horn5'],['yoyo',720,'f35c',12,1,'horn5']];
tacticRegions.forEach(function(c){setup();T.st.targetPosture='fleeting';T.st.tempo=c[4];var a={cap:6,isr:2};a[c[2]]=c[3];a[c[5]]=4;
 var values=Object.keys(T.TACTIC_PLANS).map(p=>[p,ev(c[1],a,p,150).effects]);values.sort((a,b)=>b[1]-a[1]);
 console.log('Tactic region '+c[0]+': '+values.map(v=>v[0]+'='+r3(v[1])).join(', '));
 ok(values[0][0]===c[0]&&values[0][1]>values[1][1],c[0]+' strict win region');
});
setup();var tn={fa18:12,mq25:4,cap:6,isr:2};
// v3.1 re-base: organic gas now fully supports this wing at 580 nm (no theater gas accepted); the friction region starts at 600.
var of=T.evalWing(600,tn,{strikeOrbit:150}),tf=T.evalWing(600,tn,{strikeOrbit:150,tankerMode:'theater'});
ok(of.score>tf.score&&tf.theaterAccepted>0,'organic has a strict score win where theater friction exceeds benefit');
var od=T.evalWing(900,tn,{strikeOrbit:150}),td=T.evalWing(900,tn,{strikeOrbit:150,tankerMode:'theater'});
ok(td.effects>od.effects&&td.score>od.score,'theater has a deep-range win region');
setup();T.st.rankBy='gas';var g1=T.evalWing(600,tn),g2=T.evalWing(800,tn);
ok(T.objVal(g1,24)===-T.gasPerEffect(g1)&&T.objVal(g2,24)===-T.gasPerEffect(g2),'gas objective retains shared displayed metric');
setup();T.st.rankBy='cliff';ok(T.autoSearch().length>0,'cliff eligibility does not produce vacuous empty success');
setup();var before=JSON.stringify(T.st);T.evalWing(800,{f35c:24,mq25:12},{tankerTactics:T.TACTIC_PLANS.yoyo,tankerMode:'theater'});T.organicCliff({f35c:12});ok(JSON.stringify(T.st)===before,'candidate evaluation and cliff search do not mutate UI state');
setup();var customWing={custom:12,mq25:4,cap:6,isr:2};T.st.custom={pay:20000,surv:95,size:20};var penalized=T.evalWing(300,customWing);ok(penalized.byType[0].pen<1,'retained custom-design budget penalty');
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
ok(T.tankerLedger('mq25',1450,false).maxReach===1400&&!T.tankerLedger('mq25',1450,false).feasible,'MQ single reach derived as1400');
ok(T.tankerLedger('mq25',1450,true).maxReach===1475&&T.tankerLedger('mq25',1450,true).offload===250,'MQ relay extends reach to1475 with bounded250lb at1450');
ok(!T.tankerLedger('horn5',275,true).feasible&&!T.tankerLedger('mq25',1500,true).feasible,'beyond consolidated reach rejected');
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

console.log('checks run: '+checks+' failures: '+failures.length);if(failures.length){console.log(failures.join('\n'));process.exitCode=1;}
