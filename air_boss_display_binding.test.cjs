/* Display regression controls, plus v3.1 engine mutation controls (M3-M9), v3.2 logistics controls (M10-M21) and
 * v3.3 designer / doctrine / pacing controls (M22-M46, each run against its own suite: D = designer, G = closure gates,
 * P = tour pacing), v3.3.2 content / version-consistency controls (M65-M68, C = content suite) and v3.4 model-honesty controls
 * (M69-M83; H = model-honesty suite): each restores the v3.3.2 behaviour of one fix and must fail its named discriminator;
 * M84-M90 restore one overclaim found by the second independent review each; M91-M93 restore one cost-check defect each;
 * M94-M96 (round 3) drop the real MQ-25 name, restore the 36-44%-low ledger, or drop the not-demonstrated qualifier.
 * M97-M99 (round 4) put the F-35C back at the unsourced 650 nm, drop the 667-nm demonstrated label, or fly 667 in the engine.
 * Run: node air_boss_display_binding.test.cjs
 * Uses temporary copies only; public artifacts and sealed review packets are untouched.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'airboss-display-'));
const rows=[];
try {
  for(const f of ['air_boss_accept.test.js','air_boss_test_loader.cjs','air_boss_designer.test.cjs','air_boss_tour_pacing.test.cjs','air_boss_discriminatory_gates.test.cjs','air_boss_content.test.cjs','air_boss_model_honesty.test.cjs','README.md','air_boss_gouge.html','gouge.html'])fs.copyFileSync(path.join(__dirname,f),path.join(tmp,f));
  const SUITE={A:'air_boss_accept.test.js',D:'air_boss_designer.test.cjs',G:'air_boss_discriminatory_gates.test.cjs',P:'air_boss_tour_pacing.test.cjs',C:'air_boss_content.test.cjs',H:'air_boss_model_honesty.test.cjs'};
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
      ['M21 solver ignores the player ratio','s.mumt,win.shifts,s.ctrlRatio)','s.mumt,win.shifts)',1,'L12 tempo table at R_ctrl 2'],
      // v3.3 designer closure engine (spec 3-8, 10): each wrong physics / economics / adapter line fails its named check.
      ['M22 engine NRE folded into recurring flyaway','flyaway=airframe+avionics+e.price,','flyaway=airframe+avionics+e.price+e.nre/s.buyQty,',1,'D2 NRE moves PAUC (v3.4), never APUC or recurring flyaway','D'],
      ['M23 approach bound ignores the coupled wing mass','sMinApp=w.landFixed/(C.wlandPerS-C.wingAreal)','sMinApp=w.landFixed/C.wlandPerS',1,'D5 S_min,app','D'],
      ['M24 thrust lapse rewards Mach','(1-C.lapseSlope*M)*C.etaInstall','(1+C.lapseSlope*M)*C.etaInstall',1,'D1 Mid T_avail','D'],
      ['M25 wave drag dropped from the build-up','cd=cd0+cdi+cdw,','cd=cd0+cdi,',1,'D4 ingress drag','D'],
      ['M26 early launch ignores the loiter-gas shortfall','if(spare>=req){row.status=eff;','if(true){row.status=eff;',1,'D6 0 spare -> Event 1 WITHHELD','D'],
      ['M27 loiter offload hard-coded 12,000 lb',"function tankerOffload(){return tankerLedger('mq25',C.tankerOrbitNm,false).offload;}",'function tankerOffload(){return 12000;}',1,'D6 loiter tanker offload is the shipped MQ-25 ledger','D'],
      ['M28 no deferred re-entry after a withhold',"if(eff==='early_launch'&&e>1){row.status='early_launch';row.feint=true;}",'if(false){}',1,'D6 0 spare: withheld CCA re-enters at Event 2','D'],
      ['M29 unclosed design still generates sorties (evaluator, doctrine and scheduler guards removed)',[['var ss=a.custom&&!a.doesClose?0:(pinned','var ss=(pinned'],['var keep=cd.doesClose?doctrine.flyFraction:0','var keep=doctrine.flyFraction'],['active=(o.nCustom||0)>0&&o.doesClose!==false','active=(o.nCustom||0)>0']],null,1,'rate path and pinned path','D'],   // three evaluator guards removed; the rate path keeps CAT.custom.rate=0
      ['M30 Auto-Boss fitness ignores closure','    if(r.customExcluded)return -Infinity;','',1,'Auto-Boss fitness -Infinity','D'],
      ['M31 spot-ceiling branch removed','spanOk&&spotOk,sp,C.spotMax','spanOk,sp,C.spotMax',1,'FAIL injected spot 0.800','G'],
      ['M32 legacy point-buy state not migrated',"if(!c||typeof c!=='object'||('size' in c)||('pay' in c))return","if(!c||typeof c!=='object')return",1,'legacy {pay, surv, size} -> unified closing defaults','D'],
      ['M33 binding gate is the first failure, not the worst ratio','g[k].deficitRatio>worst','worst<0',1,'D10 argmax by deficit / threshold','D'],
      ['M43 slower-package survival penalty not applied','.02,.995)*pkgFactor;','.02,.995);',1,'Option C in evalWing','D'],
      ['M44 feint discount applied to loiter too',"effectiveSurv:eff==='early_launch'?","effectiveSurv:eff!=='keep_up'?",1,'D7 feint discount applies to early launch only','D'],
      ['M45 readout shows APUC as unit flyaway',"'Unit recurring flyaway cost: $'+fmt(c.flyaway,2)","'Unit recurring flyaway cost: $'+fmt(c.apuc,2)",1,'readout shows $18.94M','D'],
      ['M46 burn rate counts one way only','burnRate:ae.D*e.tsfc*2/V','burnRate:ae.D*e.tsfc/V',1,'D9 wireframe Breguet radius','D'],
      // v3.3 Watch the Air Boss pacing contract (spec 9.2, D13).
      ['M34 6-second dwell floor removed','Math.max(WATCH_FLOOR_S,watchWords(t)/WATCH_WPS+WATCH_LOOK_S)','(watchWords(t)/WATCH_WPS+WATCH_LOOK_S)',1,'D13 6-s floor holds for short or empty explainers','P'],
      ['M35 pause does not freeze the dwell','function watchPauseChanged(){if(watchPaused())watchFreeze();','function watchPauseChanged(){if(watchPaused()){}',1,'no step transition while paused','P'],
      ['M36 dwell timer skips its generation-token and serial checks','watchCtx.dwellTimer=setTimeout(function(){if(token!==watchCtx.token||serial!==watchCtx.dwellSerial||!watchState.active)return;','watchCtx.dwellTimer=setTimeout(function(){if(!watchState.active)return;',1,'superseded scenario timer fires','P'],
      ['M37 mouseleave clears the focus lock','function watchHover(on){watchCtx.hoverPause=!!on&&watchState.active;','function watchHover(on){watchCtx.hoverPause=!!on&&watchState.active;if(!on)watchCtx.focusPause=false;',1,'mouseleave does not unpause while keyboard focus remains','P'],
      ['M38 explainer interaction stops the tour',"(t.closest('#watch-panel')||t.closest('#watch-explainer'))","(t.closest('#watch-panel'))",1,'interaction inside #watch-explainer','P'],
      ['M39 reduced motion ignored',"tip.scrollIntoView({block:'start',behavior:reduce?'instant':'smooth'})","tip.scrollIntoView({block:'start',behavior:'smooth'})",1,'prefers-reduced-motion: explainer jumps instantly','P'],
      ['M40 dwell starts before the card settles','if(reduce||(t-t0>=WATCH_SETTLE_MS&&still>=3)||','if(true||',1,'dwell not started while the card is still scrolling','P'],
      ['M41 Next skips two steps',"if(phase==='scenario')watchStepRoster();","if(phase==='scenario')watchStepLoadout();",1,'Next: scenario -> wing immediately','P'],
      ['M42 auto-repeat Space toggles','if(e.repeat)return true;','',1,'auto-repeat Space is suppressed','P'],
      // "With CCAs" Watch toggle (spec 9.3, D14).
      ['M47 CCAs OFF also changes the tempo','st.tempo=q.tempo;st.alloc=tour.alloc;','st.tempo=watchState.withCCAs?q.tempo:1-q.tempo;st.alloc=tour.alloc;',1,'D14.4 OFF keeps the same scenario, seed','P'],
      ['M48 CCA toggle not locked during a tour','function watchSetMode(m){if(watchState.active){watchTransport();return false;}','function watchSetMode(m){',1,'D14.2 a change while the tour runs is rejected','P'],
      ['M49 CCAs OFF keeps the Your Design CCA',"','custom','ccxcap'],watchCompare=","','ccxcap'],watchCompare=",1,'D14 CCA set: CCX-1 (strike and on CAP), the two CCA concepts and Your Design','P'],
      ['M50 CCAs OFF also moves the target range','DECK=q.deck;POOL=DECKS[DECK].spots;st.rng=q.range;st.tempo=q.tempo;st.alloc=tour.alloc','DECK=q.deck;POOL=DECKS[DECK].spots;st.rng=watchState.withCCAs?q.range:q.range+50;st.tempo=q.tempo;st.alloc=tour.alloc',1,'D14.4 OFF keeps the same scenario, seed','P'],
      // Tour CAP: With CCAs ON, CCX-1 fly CAP in the CAP fighter spots.
      ['M51 ON also hands the E-2 / EA-18G spots to CCAs','if(m>0){a.cap=0;','if(m>0){a.cap=0;a.isr=0;',1,'E-2 / EA-18G unchanged','P'],
      ['M52 OFF leaves the tour CCAs in',"if(mode==='off')return {alloc:watchCCAAlloc(a,false)",'if(false)return {alloc:watchCCAAlloc(a,false)',1,'Tour CAP OFF tour wing is the v3.2 wing exactly','P'],
      ['M53 ON re-roles a crewed CAP fighter to strike','if(m>0){a.cap=0;','if(m>0){a.cap=0;a.fa18=(a.fa18||0)+1;',1,'no crewed fighter re-roled','P'],
      ['M54 CAP CCAs counted as crewed in the summary','capCrewed=r.capSorties-(r.capCCASorties||0);','capCrewed=r.capSorties;',1,'summary counts the CCAs and their CAP sorties as uncrewed','P'],
      ['M55 CAP CCAs give no CAP escort','{nCAP+=n;if(a.tour)nCAPcca+=n;}','{if(!a.tour)nCAP+=n;if(a.tour)nCAPcca+=n;}',1,'deliver exactly the existing CAP model','P'],
      ['M56 ON changes the F-35C count','if(m>0){a.cap=0;','if(m>0){a.f35c=(a.f35c||0)-1;a.cap=0;',1,'F-35C, F/A-18E/F, MQ-25 and buddy tankers unchanged','P'],
      // Tour CAP display: the roster step the tour shows must carry the fielded CCAs on screen.
      ['M57 roster buries the CCAs on CAP (no top group)','if(ks.length)out.push({role:role,tour:1','if(false)out.push({role:role,tour:1',1,'opens with the CCAs-on-CAP group','P'],
      ['M58 spot bar omits the CCAs on CAP','if(tn>0)sb+=','if(false)sb+=',1,'the spot bar shades the CCAs on CAP','P'],
      ['M59 roster explainer omits the swap',"if(tour&&tour.fielded>0&&tour.mode==='cap'&&(a.ccxcap||0)>0)lead=",'if(false)lead=',1,'the roster explainer names them','P'],
      // CCA tour modes (Off / CAP / Strike).
      ['M60 Strike displaces F-35C instead of F/A-18E/F','if(r>0){a.fa18=f-r;a.ccx=','if(r>0){a.f35c=(a.f35c||0)-r;a.ccx=',1,'F-35C, tankers, CAP and E-2 / EA-18G untouched','P'],
      ['M61 CAP mode also fields strikers','if(m>0){a.cap=0;','if(m>0){a.ccx=(a.ccx||0)+1;a.cap=0;',1,'CAP mode fields no strikers','P'],
      ['M62 Strike tour buries the strikers in the roster',"if(typeof watchState!=='undefined'&&watchState&&watchState.active&&watchState.mode==='strike'","if(false&&typeof watchState!=='undefined'&&watchState&&watchState.active&&watchState.mode==='strike'",1,'opens with the CCAs-as-strikers group','P'],
      ['M63 comparison drops the crewed losses per 100 effect row',"['Crewed losses per 100 effect','per100',2,per100],",'',1,'crewed losses per 100 effect row is engine-derived','P'],
      ['M64 Strike explainer omits the swap',"else if(tour&&tour.fielded>0&&tour.mode==='strike'&&(a.ccx||0)>0)lead=",'else if(false)lead=',1,'the explainer opens with the deck summary and names the swap','P'],
      ['M65 field-guide label left at an older version','<summary>Field guide - v3.4.1</summary>','<summary>Field guide - v3.1</summary>',1,'field-guide label version equals the newest README','C'],
      ['M66 field guide drops the v3.3.1 tour and CCA-mode section','<p><b>v3.3.1 Guided Tour &amp; CCA Force-Mix Modes:</b>','<p><b>Guided Tour:</b>',1,'section: v3.3.1 Guided Tour','C'],
      ['M67 field guide restores the imprecise sag figure','sag by 37.5% (from 120 down to 75','sag by up to 40% (from 120 down to 75',1,'sortie sag','C'],
      ['M68 field guide restores the unqualified 6-s reading-time promise',"pacing scaled to each explainer's word count (holding at least 6 s on Relaxed, 3.6 s on Normal, 2.1 s on Brisk, longer for longer explanations)","pacing (&ge; 6 s scaled to explainer word count)",1,'Field Guide makes no unqualified','C'],
      // v3.4 model honesty (H): each mutant restores the v3.3.2 behaviour of one fix and must fail that fix's discriminator.
      ['M69 fuel per sortie ignores the radius','gps=galPerSortie(R),gal=a.total*gps','gps=galPerSortie(),gal=a.total*gps',1,'DISCRIMINATOR: at a fixed 120 sorties/day the fuel bill rises','H'],
      ['M70 per-sortie base back at 1,250 gal','galBase:1550','galBase:1250',1,'positive: 120 sorties at 200 nm = 186,000 gal/day','H'],
      ['M71 vignette fuel per sortie fixed at the 200-nm base','fuelLbPerSortie:bill.galPerSortie*C.rho','fuelLbPerSortie:C.galBase*C.rho',1,'Card E vignette uses the same radius-scaled fuel per sortie','H'],
      ['M72 APUC includes development again','apuc=flyaway*(1+C.supportFrac),','apuc=flyaway+(C.airframeDev+e.nre)/s.buyQty,',1,'DISCRIMINATOR: APUC does not move with the buy quantity','H'],
      ['M73 cost per effect on APUC, not PAUC','DESIGNER.costPerEffect(syncCustom().costs.pauc,','DESIGNER.costPerEffect(syncCustom().costs.apuc,',1,'cost per effect uses the all-in unit cost (PAUC)','H'],
      ['M74 MQ-25 back on weapon-system scope','CAT.mq25.cost=112;','CAT.mq25.cost=184;',1,'DISCRIMINATOR: catalog per the cost check','H'],
      ['M75 approach lift back to C_L 1.30','clApp:1.10,','clApp:1.30,',1,'DISCRIMINATOR: 15,000 lb on 200 sq ft approaches','H'],
      ['M76 deck reset not debited against the fly day',"rc=s.posture==='beast'?reconfigDay(R,prof):{active:false};",'rc={active:false};',1,'DISCRIMINATOR: Beast Mode on a 14-hour fly day leaves 2 flying hours','H'],
      ['M77 horizon ledger ignores the transition day','var limits={deck:rc.active?rc.ceilingAvg:sag.ceiling,','var limits={deck:sag.ceiling,',1,'DISCRIMINATOR: 7-day surge horizon carries one transition day','H'],
      ['M78 spot ceiling back to 1.60','spanMax:38.0,spotMax:.75,','spanMax:38.0,spotMax:1.60,',1,'DISCRIMINATOR: heavy core on a 450-sq-ft wing fails GATE_DECK','H'],
      ['M79 spot back to the span-only proxy','function spotFactor(e,S,fold){return overallLength(e,S)*foldedSpan(S,fold)/C.spotRef;}','function spotFactor(e,S,fold){return .01978*foldedSpan(S,fold)+.2;}',1,'45.55 ft x 31.26 ft / 1,792 sq ft','H'],
      ['M80 replenishment caveat restores the withdrawn halt claim','alongside connected replenishment (fueling and highline cargo) can be conducted concurrently with flight operations when sea state and wind alignment permit','alongside connected replenishment (fueling and highline cargo) halts flight operations for 3 to 4 hours',1,'no text claims replenishment halts flight operations','H'],
      ['M81 CAP-equivalence caveat dropped from the comparison',"var notes=(c.cap?cv('cap-equivalence',","var notes=(false?cv('cap-equivalence',",1,'caveat "cap-equivalence" shown','H'],
      ['M82 adverse-thrust result relabeled a hot-day prediction',"'ROBUST CLOSURE: All gates pass the x0.88 thrust-sensitivity check'","'ROBUST CLOSURE: All gates pass under Adverse / Hot-Day Thrust'",1,'the adverse-thrust result is labeled a thrust-sensitivity check','H'],
      ['M83 field guide restores the halving claim','incurs a mandatory 12-hour deck reset debited against the fly day: on a 14-hour fly day the reset day keeps 2 flying hours (1 event, 15 of 120 sorties); the return to Stealth is not charged in this model.','incurs a mandatory 12-hour deck reset, realistically halving daily launch capacity during transition.',1,'beast-mode reset on the fly-day ledger','C'],
      // Second review (independent): each mutant restores one overclaim the review found and must fail its discriminator.
      ['M84 fuel caveat restores the rising-daily-bill promise','The daily fuel bill is fuel per sortie times sorties flown, so it can fall as the sortie ceiling sags','Expanding the daily fuel bill even as flight deck launch cycles stretch, so it can fall as the sortie ceiling sags',1,'no page, Gouge or README sentence promises a daily fuel bill that rises','H'],
      ['M85 a pending return to Stealth is promised as a fly-day debit',"(lst.pendingPosture==='beast'?'entering Beast Mode is debited against the fly day':'the return to Stealth is not charged in this model')","'debited against the fly day'",1,'a pending return to Stealth is not promised as a fly-day debit','H'],
      ['M86 footprint caveat restores the elevator / handling claim','It does not establish elevator or deck-handling compatibility.','Aircraft length and folded wingspan are evaluated against deck handling and elevator limits.',1,'the footprint caveat claims no elevator / handling check','H'],
      ['M87 aircrew flag restores the fatigue diagnosis','<b class="lwarn">Flight-hour guideline exceeded:</b>','<b class="lwarn">Human exhaustion:</b>',1,'the aircrew flag is a guideline exceedance','H'],
      ['M88 callout restores the necessary deck ceiling',"under this example cycle schedule each event stretches and the fly day plans '+s.sag.ceiling+' sorties (double-cycling long sorties is another policy).","each event stretches, and the deck can launch only '+s.sag.ceiling+' sorties in this fly day.",1,'call the ceiling this example cycle schedule','H'],
      ['M89 field guide drops the CAP-equivalence qualifier on the cockpit hours',' if one CCA on CAP counts as one crewed CAP fighter, an illustrative assumption)',')',1,'Field Guide qualifies the CAP hours','H'],
      ['M90 fuel caveat calls the anchor empirical surge consumption','a rough anchor from a published carrier surge record of about 1,590 gal per fixed-wing sortie, whose fuel total also includes helicopters','re-anchored to empirical carrier combat surge data',1,'no text calls the 1,550-gal anchor empirical','H'],
      ['M91 controls note restores the stale $184M tanker price',"MQ-25 $112M (illustrative, derived from the program's published average procurement unit cost).",'MQ-25 ~$184M (FY25).',1,'every player-facing tanker price equals the catalog','H'],
      ['M92 cost caveat claims PAUC is always at least APUC','It excludes facilities and assumes no separate development articles.','It excludes facilities and assumes no separate development articles. By definition PAUC is always at least APUC.',1,'no page, Gouge or README text claims PAUC is always at least APUC','H'],
      ['M93 comparison drops its cost basis',"['Wing recurring flyaway $ per effect point','dollarsPerEffect',0]","['Wing flyaway $ per effect point','dollarsPerEffect',0]",1,'the comparison labels its basis','H'],
      // Round 3 (real names, sourced numbers): dropping the real name or restoring the 36-44%-low ledger must each fail.
      ['M94 the real tanker loses its name again (catalog)','mq25: {name:"MQ-25 Stingray"','mq25: {name:"Carrier Tanker Drone"',1,'DISCRIMINATOR: the real tanker keeps its real name','H'],
      ['M94b the real tanker loses its name again (reference wing text)','6 MQ-25, 6 CAP','6 Tanker Drone, 6 CAP',1,'DISCRIMINATOR: the real tanker keeps its real name','H'],
      ['M95 MQ-25 ledger restored to the round-2 values (9,000 lb at 500 nm, 36% below the threshold)','capacity:21000,burn:10,reserve:2000,near:14000,recovery:14000','capacity:16000,burn:10,reserve:2000,near:14000,recovery:12000',1,'DISCRIMINATOR: MQ-25 ledger anchored','H'],
      ['M95b MQ-25 recovery sortie credited below the threshold again','capacity:21000,burn:10,reserve:2000,near:14000,recovery:14000','capacity:21000,burn:10,reserve:2000,near:14000,recovery:12000',1,'DISCRIMINATOR: MQ-25 ledger anchored','H'],
      ['M96 tanker caveat drops the not-demonstrated qualifier','That is a requirement and an estimate, not demonstrated performance: the same published table lists demonstrated performance as TBD. Give at other stations','Give at other stations',1,'DISCRIMINATOR: caveat, Field Guide, Gouge and README call 14,000 lb at 500 nm a requirement','H'],
      // Round 4 (F-35C 600 nm current estimate flown; 667 nm demonstrated shown, labelled, never flown): each must fail.
      ['M97 F-35C back at the unsourced 650 nm','CAT.f35c.clean=600;','CAT.f35c.clean=650;',1,'DISCRIMINATOR: F-35C flies the published 600-nm current estimate','H'],
      ['M98 F-35C roster row drops the 667-nm demonstrated label','Combat radius 600 nm (program current estimate = threshold); 667 nm demonstrated.','Combat radius 600 nm (program current estimate = threshold).',1,'DISCRIMINATOR: the F-35C roster row, its description','H'],
      ['M98b F-35C description drops the demonstrated label','; 667 nm is demonstrated performance, shown for reference only and not used in the model','',1,'DISCRIMINATOR: the F-35C roster row, its description','H'],
      ['M99 F-35C flies the 667-nm demonstrated value in the engine','CAT.f35c.clean=600;','CAT.f35c.clean=667;',1,'DISCRIMINATOR: F-35C flies the published 600-nm current estimate','H']
    ];
    for(const [name,needle,replacement,expected,mustFail,suiteKey] of cases) {
      const pairs=!needle?[]:Array.isArray(needle)?needle:[[needle,replacement]];   // a multi-line mutant lists [needle, replacement] pairs
      for(const [n] of pairs)assert.equal(source.split(n).length,2,'unique mutation '+name);
      fs.writeFileSync(path.join(tmp,'air_boss.html'),pairs.reduce((t,[n,r])=>t.replace(n,()=>r),source));
      const suite=SUITE[suiteKey||'A'];
      const run=cp.spawnSync(process.execPath,[suite],{cwd:tmp,env:{...process.env,AIR_BOSS_HTML:'air_boss.html'},encoding:'utf8'});
      if(run.error)throw run.error;
      const failed=(run.stdout.match(/^\s*FAIL .*$/gm)||[]).map(s=>s.trim());
      assert.equal(run.status,expected,build+' '+name+'\n'+run.stdout+'\n'+run.stderr);
      if(name==='M1'||name==='M1b label-kept'||name==='M2')assert(failed.some(s=>s.includes('display-binding')&&s.includes('headline')),'must fail a display assertion, not crash');
      if(mustFail)assert(failed.some(s=>s.includes(mustFail)),build+' '+name+' must fail the named campaign control, not crash');
      rows.push({build,case:name,suite,exitCode:run.status,checksPassed:(run.stdout.match(/^\s*PASS /gm)||[]).length,failed});
    }
    // The unmutated build must pass every v3.3 suite too.
    fs.writeFileSync(path.join(tmp,'air_boss.html'),source);
    for(const key of ['D','G','P','C','H']){const run=cp.spawnSync(process.execPath,[SUITE[key]],{cwd:tmp,env:{...process.env,AIR_BOSS_HTML:'air_boss.html'},encoding:'utf8'});
      assert.equal(run.status,0,build+' unchanged '+SUITE[key]+'\n'+run.stdout);rows.push({build,case:'unchanged',suite:SUITE[key],exitCode:0,checksPassed:(run.stdout.match(/^\s*PASS /gm)||[]).length,failed:[]});}
  }
  console.log(JSON.stringify(rows,null,2));
} finally { assert.equal(path.dirname(path.resolve(tmp)),path.resolve(os.tmpdir())); assert(path.basename(tmp).startsWith('airboss-display-')); fs.rmSync(tmp,{recursive:true,force:true}); }
