/* RockWorx Air Boss v3.5 specification checks and discriminating mutants. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {loadEngine,builds}=require('./air_boss_test_loader.cjs');
const tests={
 'T-CLF-01':T=>{const L=T.logistics;assert.equal(L.C.vTransit,20);assert.equal(L.CLF.kaiser.name,'T-AO 187 Henry J. Kaiser');assert.equal(L.CLF.lewis.fuelBbl,162000);assert.equal(L.CLF.clark.speed,20);assert.equal(L.CLF.supply.speed,25);},
 'T-CLF-02':T=>{assert.ok(Math.abs(T.logistics.shuttleCycle(1000)-23/3)<1e-12);assert.ok(Math.abs(T.logistics.shuttleCycle(1000,'supply')-41/6)<1e-12);},
 'T-UNIT-01':T=>{T.st.wing=2;for(const n of [1,2,3,4,7,12]){const r=T.evalWing(200,{fa18:n,f35c:n,cap:n,isr:1},{overhead:false,sortiesPerJet:1});assert.equal(r.byKey.fa18%2,0);assert.equal(r.byKey.f35c%2,0);assert.equal(r.capSorties%2,0);assert.equal(r.reserveSlack,3*(n%2));}
  T.st.strike='direct';const r=T.evalWing(600,{fa18:4,mq25:12},{sortiesPerJet:1,primaryStock:6,fallbackStock:0,overhead:false,tankerTactics:T.TACTIC_PLANS.strike});assert.equal(r.strikeSorties,2);assert.equal(r.gasDemand,2*r.byType[0].dP);assert.equal(r.support,1);},
 'T-AEW-01':T=>{assert.equal(T.logistics.aewRelief(false).sorties,7);assert.equal(T.logistics.aewRelief(true).sorties,4);},
 'T-AEW-02':T=>{T.st.wing=2;T.st.aewRefueled=true;const a={fa18:12,mq25:6,isr:2},r=T.evalWing(700,a,{tankerTactics:T.TACTIC_PLANS.strike});T.st.aewRefueled=false;const b=T.evalWing(700,a,{tankerTactics:T.TACTIC_PLANS.strike});assert.equal(r.aewGasDemand,22000);assert.equal(r.aewGasDelivered,22000);assert.equal(b.organicOffload-r.organicOffload,22000);assert.equal(T.logistics.dailyBill(60,200,true).aewGasLb,22000);},
 'T-AEW-03':T=>{const L=T.logistics;assert.equal(L.allocate(60).aew,7);assert.equal(L.allocate(115).aew,9);assert.equal(L.allocate(83).aew,7);assert.equal(L.allocate(84).aew,7);assert.equal(L.allocate(0).aew,0);},
 'T-HELO-01':T=>{assert.equal(T.DECKS.nimitz.spots,41);assert.equal(T.DECKS.ford.spots,45);assert.equal(T.DECKS.nimitz.spotsHelo,3);},
 'T-HELO-02':(T,E)=>{for(const d of ['nimitz','ford']){T.setDeck(d);T.render();assert.equal(T.getPool(),T.DECKS[d].spots);assert.equal(+E.el('s-spots').max,T.DECKS[d].spots);}},
 'T-COD-01':T=>{const L=T.logistics;assert.equal(L.codLink(1150).active,true);assert.equal(L.codLink(1150.01).active,false);assert.equal(L.solve({transit:1200}).pipe.cod.active,false);assert.equal(L.codLink(1000).latencyDays,2);},
 'T-COD-02':T=>{assert.equal(T.CAT.cmv22.stowedFootprint,'63.0 x 18.4 ft');assert.equal(T.CAT.cmv22.spots,1);assert.equal(T.CAT.cmv22.rotorsTurningWidth,84.6);}
};
const mutants=[
 ['M-CLF-01','vTransit:20','vTransit:18','T-CLF-01'],
 ['M-CLF-02','return C.tLoad+2*D/(24*v)+C.tUnrep+C.tBuffer','return 1+2*D/(24*v)','T-CLF-02'],
 ['M-UNIT-01','return 2*Math.floor(Math.max(0,n)/2+1e-9)','return Math.max(0,n)','T-UNIT-01'],
 ['M-AEW-01','overlap=.5,sorties=','overlap=0,sorties=','T-AEW-01'],
 ['M-AEW-02','enroute-=aewGasDelivered','enroute-=0','T-AEW-02'],
 ['M-AEW-03','o.aew=Math.max(o.aew,aewRelief(!!refueled).sorties)','o.aew=o.aew','T-AEW-03'],
 ['M-HELO-01','spotsHelo:3,spots:41','spotsHelo:3,spots:44','T-HELO-01'],
 ['M-HELO-02','el("s-spots").max=DECKS[DECK].spots','el("s-spots").max=44','T-HELO-02'],
 ['M-COD-01','active=D<=a.range','active=D<=1200','T-COD-01'],
 ['M-COD-02',"range:1150,spots:1,","range:1150,spots:.65,",'T-COD-02']
];
const targets=process.argv[2]?[path.resolve(process.argv[2])]:builds();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'airboss-v35-'));
try{for(const file of targets){const src=fs.readFileSync(file,'utf8');
 for(const [id,test] of Object.entries(tests)){const E=loadEngine(file);test(E.T,E);console.log('PASS '+id+' '+path.basename(file));}
 const readme=fs.readFileSync(path.join(path.dirname(file),'README.md'),'utf8');
 const wordCheck=x=>assert.ok(!/\bhonest(?:y)?\b/i.test(x));wordCheck(readme);console.log('PASS T-WORD-01 '+path.basename(file));assert.throws(()=>wordCheck(readme+' Model Honesty'),{code:'ERR_ASSERTION'});console.log('KILLED M-WORD-01 by T-WORD-01');
 for(const [id,old,rep,test] of mutants){assert.ok(src.includes(old),'mutant anchor '+id);const p=path.join(dir,id+'.html');fs.writeFileSync(p,src.replace(old,rep));const E=loadEngine(p);
  let caught=false;try{tests[test](E.T,E);}catch(e){if(e.code!=='ERR_ASSERTION')throw e;caught=true;}assert.ok(caught,id+' must fail '+test);console.log('KILLED '+id+' by '+test+' '+path.basename(file));}
}}finally{for(const name of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,name));fs.rmdirSync(dir);}
