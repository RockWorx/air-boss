/* Reproduce the Strait survivability-objective reconciliation on the shipped evaluator.
 * This is a review diagnostic, NOT a replacement acceptance test.
 * Exit 0 means the diagnostic ran; inspect acceptancePassed for the claim.
 * Usage: node air_boss_strait_review.cjs [air_boss_public.html]
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const html=process.argv[2]||'air_boss.html';
const harness=path.join(__dirname,'air_boss_accept.test.js');
const context={require,__dirname,console:{log(){}},process:{env:{AIR_BOSS_HTML:html}}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(harness,'utf8'),context,{filename:harness});
assert.equal(context.failures.length,0,'Existing engine regression suite must pass before review');
const T=context.T;
T.setDeck('nimitz');
Object.assign(T.st,{rankBy:"surv",wing:2,rng:500,tempo:0,targetPosture:'integrated',threat:.85,
  tankerMode:'organic',strikeOrbit:350,relayOrbit:500,weapon:'amraam',strike:'standoff',
  tankerTactics:{yoyo:20,strike:50,consolidation:0,recovery:30}});
const candidateAlloc={f35c:12,fa18:12,mq25:6,horn5:0,cap:10,isr:4};
const baselineAlloc={fa18:28,f35c:6,mq25:6,cap:2,isr:2};
const candidate=T.evalWing(500,candidateAlloc);
Object.assign(T.st,{strike:'direct',tankerTactics:{yoyo:30,strike:70,consolidation:0,recovery:0}});
const baseline=T.evalWing(500,baselineAlloc);
for(const r of [candidate,baseline]){
  assert(Number.isFinite(r.effects)&&r.effects>0,'Positive finite comparison');
  assert.equal(r.infeasible.length,0,'All assigned tanker tracks reachable');
}
for(const a of [candidateAlloc,baselineAlloc])assert.equal(Object.values(a).reduce((x,y)=>x+y,0),44,'Equal full decks');
function evidence(r){return {objective:T.objVal(r,44),effects:r.effects,support:r.support,meanSurvivability:r.meanSurv,
  strikeSorties:r.strikeSorties,primaryRounds:r.primaryUsed,fallbackRounds:r.fallbackUsed,recoveryCoverage:r.recoveryCoverage};}
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
const passed=T.objVal(baseline,44)>0&&T.objVal(candidate,44)>T.objVal(baseline,44);
console.log(JSON.stringify({artifact:html,artifactSha256:hash(context.HTML_PATH),specSha256:hash(path.join(__dirname,'AIR_BOSS_V3_SPEC.md')),
  regressionChecks:context.checks,claim:'Candidate existing Survivability objective > positive baseline objective; raw effect reported separately',
  acceptancePassed:passed,status:passed?'CLAIM_SUPPORTED':'CLAIM_NOT_SUPPORTED',
  conditions:{rangeNm:500,strikeOrbitNm:350,relayOrbitNm:500,threat:.85,targetPosture:'integrated',fuel:'organic',deck:'nimitz',tempo:'sustained'},
  candidate:evidence(candidate),baseline:evidence(baseline),objectiveRelativeGain:T.objVal(candidate,44)/T.objVal(baseline,44)-1,rawEffectRelativeGain:candidate.effects/baseline.effects-1},null,2));
