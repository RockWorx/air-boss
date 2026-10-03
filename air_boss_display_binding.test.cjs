/* Display regression controls, plus v3.1 engine mutation controls (M3-M9) and v3.2 logistics controls (M10-M21).
 * Run: node air_boss_display_binding.test.cjs
 * Uses temporary copies only; public artifacts and sealed review packets are untouched.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'airboss-display-'));
const rows=[];
try {
  fs.copyFileSync(path.join(__dirname,'air_boss_accept.test.js'),path.join(tmp,'air_boss_accept.test.js'));
  for(const build of ['air_boss.html','air_boss_public.html']) {
    const source=fs.readFileSync(path.join(__dirname,build),'utf8');
    const cases=[
      ['unchanged',null,null,0],
      ['M1',"fmt(gasPerEffect(r),0)+' <small>lb gas / effect</small>'","fmt(r.gasDemand/1000,0)+' <small>lb gas / day</small>'",1],
      ['M1b label-kept',"fmt(gasPerEffect(r),0)+' <small>lb gas / effect</small>'","fmt(r.gasDemand/1000,0)+' <small>lb gas / effect</small>'",1],
      ['M2',"fmt(objVal(r,t.spots)*100,0)+' <small>surv score</small>'","fmt(r.meanSurv*100,0)+' <small>surv score</small>'",1],
      ['positive control','(.35+.65*surv)','(1)',1],
      // v3.1 engine mutation controls: each wrong input must fail its named control.
      ['M3 raw CAT survivability','rate=.30*(1-x.surv)','rate=.30*(1-x.s.surv/100)',1,'D3 campaign control CAP-only: strike losses fall'],
      ['M4 CAP coverage for recovery coverage','C=r.recoveryCoverage','C=r.coverage',1,'D3 campaign control recovery-only: strike losses fall'],
      ['M5 one recovery risk for all types','.95*recoveryRisk(k,false,C).pLoss+.05*recoveryRisk(k,true,C).pLoss',".95*recoveryRisk('fa18',false,C).pLoss+.05*recoveryRisk('fa18',true,C).pLoss",1,'D3 campaign control base: day-1 losses'],
      ['M6 day-3 fatigue never triggers','fatigue.availMult=.95;','fatigue.availMult=1;',1,'S2 day-3 fatigue control'],
      ['M7 fractional overhead','Math.floor(eligible+1e-9)','eligible',1,'S3 integer overhead'],
      ['M8 no bring-back share in campaign losses','+.05*recoveryRisk(k,true,C).pLoss','+0*recoveryRisk(k,true,C).pLoss',1,'D3 campaign control base: day-1 losses'],
      // Reverting the Strait effect requirement to 200 must fail the raised-floor ranking pins.
      ['M9 Strait effect requirement reverted to 200','effectFloor:350,range:500','effectFloor:200,range:500',1,'S4 raised floor: minimalist strike wing 59.91'],
      // v3.2 logistics mutation controls: each must fail its named L-test control.
      ['M10 Card A shows lb under the gal/day label',"f(b.fuelGalDay,0)+' gal/day","f(b.fuelLbDay,0)+' gal/day",1,'L UI Card A fuel gal/day'],
      ['M11 supply ships rounded instead of ceiling','no=fin(cf)?Math.ceil(cyc/cf-1e-9):0','no=fin(cf)?Math.round(cyc/cf):0',1,'L3 pipeline doubles'],
      ['M12 med-down grounding ignored','ready=Math.round(pilots*(1-o.medDown))','ready=pilots',1,'L11 44 x 1.48 = 65 pilots'],
      ['M13 posture changes mid-day','lst.pendingPosture=p===lst.posture?null:p;','lst.posture=p;lst.pendingPosture=null;',1,'L10 posture request mid-day is locked'],
      ['M14 logistics solver writes flight-deck state','function setState(o){','function setState(o){if(o&&o.radius)st.rng=+o.radius;',1,'L6 768 logistics solves'],
      // v3.2 round-2 controls (spec 3.7.5): reserve-safe cadence, computed operator bill, horizon-governed headline.
      ['M15 oilers sized on ship cargo, not usable stores','cf=Math.min(kf,dos.fuel),cm=Math.min(km,dos.mag)','cf=kf,cm=km',1,'L3 reserve-safe matrix'],
      ['M16 handoff operators ignore shifts','operators:w*k}','operators:ship?w*k:w}',1,'L12 normal 115/day'],
      ['M17 headline drops the 30-day limit',"if(H==='30')limits.aircrew30=scale(crew.ceil30);",'',1,'L11 default 115/day'],
      ['M18 operator shifts fixed at 3','shifts:Math.min(3,Math.max(1,Math.ceil(h/C.shiftHours-1e-9)))','shifts:3',1,'L12 normal 115/day'],
      // v3.2 round-3 controls (spec 3.7.8): player-tunable CCA control ratio, integer watchstanders.
      ['M19 control ratio ignored (fixed 2 CCAs per console)','n/(ship?1:R)','n/(ship?1:2)',1,'L12 continuous 24-hr fixture, handoff at default R_ctrl 4'],
      ['M20 on-watch operators not rounded up','w=Math.ceil(consoles*C.relief-1e-9)','w=consoles*C.relief',1,'L12 continuous 24-hr fixture, handoff at default R_ctrl 4'],
      ['M21 solver ignores the player ratio','s.mumt,win.shifts,s.ctrlRatio)','s.mumt,win.shifts)',1,'L12 tempo table at R_ctrl 2']
    ];
    for(const [name,needle,replacement,expected,mustFail] of cases) {
      if(needle)assert.equal(source.split(needle).length,2,'unique mutation '+name);
      fs.writeFileSync(path.join(tmp,'air_boss.html'),needle?source.replace(needle,replacement):source);
      const run=cp.spawnSync(process.execPath,['air_boss_accept.test.js'],{cwd:tmp,env:{...process.env,AIR_BOSS_HTML:'air_boss.html'},encoding:'utf8'});
      if(run.error)throw run.error;
      const failed=(run.stdout.match(/^\s*FAIL .*$/gm)||[]).map(s=>s.trim());
      assert.equal(run.status,expected,build+' '+name+'\n'+run.stdout+'\n'+run.stderr);
      if(name==='M1'||name==='M1b label-kept'||name==='M2')assert(failed.some(s=>s.includes('display-binding')&&s.includes('headline')),'must fail a display assertion, not crash');
      if(mustFail)assert(failed.some(s=>s.includes(mustFail)),build+' '+name+' must fail the named campaign control, not crash');
      rows.push({build,case:name,exitCode:run.status,checksPassed:(run.stdout.match(/^\s*PASS /gm)||[]).length,failed});
    }
  }
  console.log(JSON.stringify(rows,null,2));
} finally { assert.equal(path.dirname(path.resolve(tmp)),path.resolve(os.tmpdir())); assert(path.basename(tmp).startsWith('airboss-display-')); fs.rmSync(tmp,{recursive:true,force:true}); }
