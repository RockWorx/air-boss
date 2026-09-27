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
ok(near(e.strikeSorties,30.1438141336,1e-8),'unchanged v2 cyclic sortie control at625');
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
  for(var x of r.byType)if(!near(x.primary+x.fallback+x.unarmed,x.ss,1e-8)||x.topoff>x.climbCap+1e-8)throw Error('per-type caps');grid++;
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
var weaponRegions=[['mace',300,'fleeting',4,0],['direct',300,'fleeting',24,0],['standoff',300,'hardened',4,0],['mixed',500,'hardened',24,1]];
weaponRegions.forEach(function(c){setup();T.st.targetPosture=c[2];T.st.tempo=c[4];T.st.tankerTactics=T.TACTIC_PLANS.balanced;
 var values=Object.keys(T.STRIKES).map(function(w){T.st.strike=w;return [w,T.evalWing(c[1],{fa18:c[3],mq25:4,cap:6,isr:2}).effects];});values.sort((a,b)=>b[1]-a[1]);
 console.log('Weapon region '+c[0]+': '+values.map(v=>v[0]+'='+r3(v[1])).join(', '));
 ok(values[0][0]===c[0]&&values[0][1]>values[1][1],c[0]+' strict win region; alternatives have counter-region');
});
var tacticRegions=[['recovery',300,'fa18',12,1,'horn5'],['strike',500,'fa18',12,0,'horn5'],['yoyo',700,'f35c',12,1,'horn5']];
tacticRegions.forEach(function(c){setup();T.st.targetPosture='fleeting';T.st.tempo=c[4];var a={cap:6,isr:2};a[c[2]]=c[3];a[c[5]]=4;
 var values=Object.keys(T.TACTIC_PLANS).map(p=>[p,ev(c[1],a,p,150).effects]);values.sort((a,b)=>b[1]-a[1]);
 console.log('Tactic region '+c[0]+': '+values.map(v=>v[0]+'='+r3(v[1])).join(', '));
 ok(values[0][0]===c[0]&&values[0][1]>values[1][1],c[0]+' strict win region');
});
setup();var tn={fa18:12,mq25:4,cap:6,isr:2};
var of=T.evalWing(580,tn,{strikeOrbit:150}),tf=T.evalWing(580,tn,{strikeOrbit:150,tankerMode:'theater'});
ok(of.score>tf.score&&tf.theaterAccepted>0,'organic has a strict score win where theater friction exceeds benefit');
var od=T.evalWing(900,tn,{strikeOrbit:150}),td=T.evalWing(900,tn,{strikeOrbit:150,tankerMode:'theater'});
ok(td.effects>od.effects&&td.score>od.score,'theater has a deep-range win region');
setup();T.st.rankBy='gas';var g1=T.evalWing(600,tn),g2=T.evalWing(800,tn);
ok(T.objVal(g1,24)===-T.gasPerEffect(g1)&&T.objVal(g2,24)===-T.gasPerEffect(g2),'gas objective retains shared displayed metric');
setup();T.st.rankBy='cliff';ok(T.autoSearch().length>0,'cliff eligibility does not produce vacuous empty success');
setup();var before=JSON.stringify(T.st);T.evalWing(800,{f35c:24,mq25:12},{tankerTactics:T.TACTIC_PLANS.yoyo,tankerMode:'theater'});T.organicCliff({f35c:12});ok(JSON.stringify(T.st)===before,'candidate evaluation and cliff search do not mutate UI state');
setup();var customWing={custom:12,mq25:4,cap:6,isr:2};T.st.custom={pay:20000,surv:95,size:20};var penalized=T.evalWing(300,customWing);ok(penalized.byType[0].pen<1,'retained custom-design budget penalty');
setup();T.st.strike='direct';T.st.tankerTactics=T.TACTIC_PLANS.recovery;var censored=T.organicCliff({f35c:24,mq25:4});ok(censored.rows.length===61,'cliff always scans the prescribed finite domain');


// Captain-ratified reach extension: fixed capacities/burn/reserve/transfer, no tuned coefficients.
setup();var relayWing={fa18:12,horn5:2,cap:6,isr:2};
function relayPair(orbit){return ['strike','consolidation'].map(p=>T.evalWing(500,relayWing,{tankerTactics:T.TACTIC_PLANS[p],strikeOrbit:orbit,relayOrbit:orbit}));}
var outside=relayPair(250),inside=relayPair(150);
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
ok(new Set(sequenceA.map(r=>r.input.scenario)).size===Object.keys(T.SCENARIOS).length&&new Set(sequenceA.map(r=>r.input.plan)).size===5,'Watch sequence covers scenarios and tanker plans');
ok(sequenceA.every(r=>r.input.range>=({war_at_sea:500,deep_strike:700,strait_defense:400}[r.input.scenario])&&r.input.range<=({war_at_sea:700,deep_strike:900,strait_defense:600}[r.input.scenario])),'Watch ranges stay inside illustrative scenario bands');
for(const deck of ['nimitz','ford'])for(const tempo of [0,1]){
 var settings={deck,tempo},rows=Array.from({length:20},(_,i)=>watchResult('player-settings',i,settings));
 ok(rows.every(r=>r.input.deck===deck&&r.input.tempo===tempo&&Math.floor(r.events)===(tempo?12:8)&&near(r.events,tempo?16/1.3:8,1e-10)),'Watch honors '+deck+' '+(tempo?'surge 12':'sustained 8')+' on every cycle');
 ok(JSON.stringify(rows)===JSON.stringify(Array.from({length:20},(_,i)=>watchResult('player-settings',i,settings))),'Watch same seed and player settings repeat '+deck+'/'+tempo);
}
var tempoSaved=JSON.stringify(T.st),pair=T.watchTempoComparison();
ok(JSON.stringify(T.st)===tempoSaved&&pair.sustained.events===8&&near(pair.surge.events,16/1.3,1e-10),'Watch tempo comparison uses unchanged evaluator and restores state');
var watchBefore=JSON.stringify(T.st);T.watchCycle('pure',12);ok(JSON.stringify(T.st)===watchBefore,'Watch input generator does not mutate engine state');

setup();T.applyScenario('strait_defense');
var defense=T.evalWing(T.st.rng);
ok(T.st.rng===500&&T.st.threat===.85&&T.st.targetPosture==='integrated'&&T.st.weapon==='amraam'&&T.st.strike==='standoff'&&T.st.alloc.cap===10&&T.st.alloc.isr===4&&T.st.tankerTactics.recovery===30&&Object.values(T.st.alloc).reduce((a,b)=>a+b,0)===44&&defense.infeasible.length===0,'Contested Strait preset uses 44 spots and reachable organic tankers');
T.st.strike='direct';T.st.tankerTactics={yoyo:30,strike:70,consolidation:0,recovery:0};
var greedy=T.evalWing(500,{fa18:28,f35c:6,mq25:6,cap:2,isr:2});
// Captain #463 replaces raw-effect dominance with the existing objective.
ok(T.st.rankBy==='surv','Strait preset defaults to the existing Survivability objective');
var defenseObjective=T.objVal(defense,44),baselineObjective=T.objVal(greedy,44);
console.log('Strait objective: '+defenseObjective+' vs '+baselineObjective+'; raw effect '+r3(defense.effects)+' vs '+r3(greedy.effects));
ok(baselineObjective>0&&defenseObjective>baselineObjective,'Contested Strait balanced defense beats positive baseline on existing Survivability objective');
ok(defenseObjective===defense.survScore&&defenseObjective===defense.support*defense.meanSurv&&baselineObjective===greedy.support*greedy.meanSurv,'Strait objective uses unchanged support-weighted survival, not a new effect formula');
ok(defense.effects<greedy.effects&&greedy.effects>0,'Strait still discloses protection versus raw-output trade');
T.applyScenario('war_at_sea');ok(T.st.rankBy==='effect','Other scenarios restore effect objective');

console.log('checks run: '+checks+' failures: '+failures.length);if(failures.length){console.log(failures.join('\n'));process.exitCode=1;}
