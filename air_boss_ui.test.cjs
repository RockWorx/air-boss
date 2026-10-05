/* Live offline UI acceptance. Start an isolated Chromium/Edge with --remote-debugging-port=9336.
 * Run: node air_boss_ui.test.cjs [path-to-game.html] [screenshot-directory]
 * CDP_ENDPOINT may override the local endpoint. No browser packages or network assets required.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
(async()=>{
 const endpoint=process.env.CDP_ENDPOINT||'http://127.0.0.1:9336';
 const tabs=await(await fetch(endpoint+'/json')).json(),tab=tabs.find(t=>t.type==='page');assert(tab,'browser page target');
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let seq=0,pending=new Map(),errors=[],requests=[],checks=0;
 ws.addEventListener('message',e=>{let m=JSON.parse(e.data);if(m.id){let p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}
   else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
   else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push('console.error');
   else if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url))requests.push(m.params.request.url);});
 function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},120000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
 async function js(expression){let r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
 async function check(expression,label){assert(await js(expression),label);console.log('PASS '+label);checks++;}
 async function click(selector){await js('document.querySelector('+JSON.stringify(selector)+').click()');}
 async function change(id,value,event='change'){await js(`(()=>{let n=document.getElementById(${JSON.stringify(id)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);}
 async function agreement(label){await check(`(()=>{const a=__airbossTest,r=a.evalWing(a.st.rng),text=id=>document.getElementById(id).textContent,number=s=>Number(s.replace(/,/g,'')),raw=text('mission-ledger').match(/Raw effect ([\\d,.]+)/),read=text('trade').match(/effect index ([\\d,.]+)/),ref={};Object.entries({f35c:4,fa18:14,mq25:6,cap:6,isr:2}).forEach(([k,v])=>ref[k]=Math.round(v*a.getPool()/32));const bench=a.evalWing(a.st.rng,ref).effects,rank=Number(text('rank').match(/([+-]?[\\d,.]+)%/)[1]);return number(text('score'))===Math.round(r.effects)&&raw&&Math.abs(number(raw[1])-r.effects)<=.051&&read&&number(read[1])===Math.round(r.effects)&&rank===Math.round((r.effects-bench)/Math.max(bench,1)*100)&&!text('trade').includes('ating.');})()`,label+' effect/readout/reference agreement');}
 async function shot(name){if(!process.argv[3])return;await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const png=await send('Page.captureScreenshot',{format:'png'});fs.mkdirSync(process.argv[3],{recursive:true});fs.writeFileSync(path.join(process.argv[3],name+'.png'),Buffer.from(png.data,'base64'));}
 try{
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await send('Page.enable');await send('Page.navigate',{url:'about:blank'});await send('Emulation.setFocusEmulationEnabled',{enabled:true});await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(path.resolve(process.argv[2]||path.join(__dirname,'air_boss_public.html'))).href});
  await js("new Promise(r=>document.readyState==='complete'?r():addEventListener('load',r,{once:true}))");
  await check('!!window.__airbossTest','real model initialized');
  await agreement('default immediate');
  await check("document.getElementById('trade').textContent.includes('100% fuel-demand coverage.')",'default coverage sentence is complete');
  // ---- v3.2 Logistics Pipeline & Bill view: every card and the callout read the SHIPPED solver ----
  const deckState=await js('JSON.stringify(__airbossTest.st)');
  const bound=label=>check(`(()=>{const L=__airbossTest.logistics,s=L.solve(),t=document.createElement('div');t.innerHTML=L.cardsHTML(s);return document.getElementById('logi-cards').textContent===t.textContent&&document.getElementById('logi-gouge').textContent===L.gougeText(s)&&!/NaN|Infinity|undefined/.test(document.getElementById('logistics').textContent);})()`,'v3.2 cards and Gouge callout bound to solver: '+label);
  const cards=()=>"document.getElementById('logi-cards').textContent";
  await check('document.getElementById("view-deck").getAttribute("aria-pressed")==="true"&&document.getElementById("logistics").getClientRects().length===0','v3.2 opens on Flight Deck Operations with the Logistics view hidden');
  await click('#view-logistics');
  await check('document.body.classList.contains("view-logistics")&&document.getElementById("view-logistics").getAttribute("aria-pressed")==="true"&&document.getElementById("logistics").getClientRects().length>0&&document.querySelector(".console").getClientRects().length===0&&document.getElementById("viewtabs").getClientRects().length>0','v3.2 Logistics tab shows the logistics view and hides the deck console');
  await bound('default 115/day');
  await check(cards()+'.includes("178,250 gal/day")&&'+cards()+'.includes("1,550 gal per sortie at 200 nm")&&'+cards()+'.includes("6 sorties/day (3 FCF + 3 CQ)")&&'+cards()+'.includes("1 Fleet Oiler + 1 Ammunition Ship")','v3.4 default bill: 178,250 gal/day (1,550 gal per sortie at 200 nm), 3 FCF + 3 CQ, 1 oiler + 1 ammunition ship');
  await check(cards()+'.includes("30-Day Sustained horizon")&&'+cards()+'.includes("101 of 115 sorties / day")&&'+cards()+'.includes("Aircrew Fatigue (30-Day Limit)")&&document.getElementById("logi-h30").getAttribute("aria-pressed")==="true"','v3.2 default headline: 30-day sustained horizon, 101 of 115, the 30-day aircrew limit binds');
  await click('#logi-h7');
  await check('__airbossTest.logistics.getState().horizon==="7"&&document.getElementById("logi-h7").getAttribute("aria-pressed")==="true"&&'+cards()+'.includes("7-Day Surge horizon")&&'+cards()+'.includes("115 of 115 sorties / day")&&document.getElementById("logi-gouge").textContent.includes("7-day surge")','v3.2 horizon toggle: a 7-day surge sustains 115 of 115');await bound('7-day surge horizon');
  await click('#logi-h30');await check('__airbossTest.logistics.getState().horizon==="30"&&'+cards()+'.includes("101 of 115 sorties / day")','v3.2 horizon toggle back to 30-day sustained');
  for(const [id,v] of [['logi-t60',60],['logi-t115',115],['logi-t180',180],['logi-t240',240]]){await click('#'+id);
    await check(`__airbossTest.logistics.getState().tempo===${v}&&+document.getElementById('logi-tempo').value===${v}&&document.getElementById('${id}').getAttribute('aria-pressed')==='true'&&document.getElementById('logi-tempo-v').textContent==='${v} sorties/day'`,'v3.2 tempo snap '+v);}
  await click('#logi-t180');await change('logi-transit',1500,'input');
  await check(cards()+'.includes("2 Fleet Oilers + 1 Ammunition Ship")&&'+cards()+'.includes("1 Oiler every 8.1 days")','v3.4 surge at 1,500 nm: reserve-safe cadence 8.1 days, 2 oilers + 1 ammunition ship');await bound('surge 1,500 nm');
  await change('logi-transit',1800,'input');
  await check('__airbossTest.logistics.getState().transit===1800&&'+cards()+'.includes("2 Fleet Oilers + 2 Ammunition Ships")&&document.getElementById("logi-gouge").textContent.includes("Distance multiplies the pipeline")','v3.2 transit slider: surge at 1,800 nm doubles the pipeline to 4 ships');await bound('surge 1,800 nm');
  await change('logi-radius',500,'input');
  await check('__airbossTest.logistics.getState().radius===500&&'+cards()+'.includes("2.75 hours (2+45 cycle)")&&'+cards()+'.includes("75 sorties / day")&&document.getElementById("logi-radius-v").textContent.includes("500 nm")','v3.2 radius slider: 500 nm stretches events to 2+45 and sags the ceiling to 75');await bound('500 nm');
  await click('#logi-beast');
  await check('__airbossTest.logistics.getState().posture==="stealth"&&__airbossTest.logistics.getState().pendingPosture==="beast"&&document.getElementById("logi-lock").textContent.includes("Current Posture: Stealth Ingress")&&document.getElementById("logi-lock").textContent.includes("Pending Posture: Beast Mode (requested; locked until the 12-hour deck reset; entering Beast Mode is debited against the fly day)")&&!document.getElementById("logi-reset").disabled&&document.getElementById("logi-beast").getAttribute("aria-pressed")==="true"&&document.getElementById("logi-reset").textContent==="Deck reset (12 hr)"&&!/12-hour deck reset \(transition day\)/.test('+cards()+')','v3.4 posture request is locked until the 12-hour deck reset; no transition day charged yet');await bound('beast pending');
  await click('#logi-reset');
  await check('__airbossTest.logistics.getState().posture==="beast"&&document.getElementById("logi-reset").disabled&&document.getElementById("logi-lock").textContent.includes("Current Posture: Beast Mode")&&document.getElementById("logi-lock").textContent.includes("Pending Posture: none")&&'+cards()+'.includes("Beast Mode")&&'+cards()+'.includes("12-hour deck reset (transition day)")','v3.4 deck reset applies Beast Mode and Card B charges the transition day');await bound('beast');
  await click('#logi-sls');await click('#logi-collab');await click('#logi-shipboard');
  await check('__airbossTest.logistics.getState().doctrine==="sls"&&'+cards()+'.includes("Re-attack sortie tail")&&'+cards()+'.includes("54 assigned (18 on watch, 3 shifts)")','v3.2 doctrine, wing and MUMT toggles: re-attack tail and 54 assigned (18 on watch, 3 shifts) shown');await bound('shoot-look-shoot, collaborative, shipboard');
  await click('#logi-delegated');await check(cards()+'.includes("15 assigned (5 on watch, 3 shifts)")&&'+cards()+'.includes("0 en route")','v3.2 airborne quarterback handoff at surge, default R_ctrl 4: 15 assigned (5 on watch, 3 shifts), 0 en route');
  await click('#logi-t115');await check(cards()+'.includes("10 assigned (5 on watch, 2 shifts)")','v3.2 normal 115/day, default R_ctrl 4: 10 assigned (5 on watch, 2 shifts)');await bound('collaborative 115/day');
  await check('+document.getElementById("logi-ratio").value===4&&document.getElementById("logi-ratio").min==="1"&&document.getElementById("logi-ratio").max==="8"&&document.getElementById("logi-ratio-v").textContent.includes("4 CCAs per operator")&&document.getElementById("logi-ratio-l").textContent.includes("[teaching assumption]")','v3.2 CCA control ratio control: 1..8, default 4 CCAs per operator, labelled a teaching assumption');
  await change('logi-ratio',2,'input');await check('__airbossTest.logistics.getState().ctrlRatio===2&&document.getElementById("logi-ratio-v").textContent.includes("2 CCAs per operator")&&'+cards()+'.includes("18 assigned (9 on watch, 2 shifts)")&&'+cards()+'.includes("1 operator per 2 CCAs")','v3.2 control ratio 2: 18 assigned (9 on watch, 2 shifts)');await bound('control ratio 2');
  await change('logi-ratio',8,'input');await check('__airbossTest.logistics.getState().ctrlRatio===8&&'+cards()+'.includes("6 assigned (3 on watch, 2 shifts)")','v3.2 control ratio 8: 6 assigned (3 on watch, 2 shifts)');await bound('control ratio 8');
  await click('#logi-shipboard');await check(cards()+'.includes("36 assigned (18 on watch, 2 shifts)")','v3.2 control ratio does not change shipboard control: 36 assigned (18 on watch, 2 shifts) at ratio 8');await click('#logi-delegated');
  await change('logi-ratio',4,'input');await check('__airbossTest.logistics.getState().ctrlRatio===4&&'+cards()+'.includes("10 assigned (5 on watch, 2 shifts)")','v3.2 control ratio back to the default 4: 10 assigned');
  await change('logi-tempo',50,'input');await bound('minimum tempo 50');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await js('document.getElementById("logistics").scrollIntoView()');await shot('logistics-mobile');
  await check('document.documentElement.scrollWidth<=innerWidth+1','v3.2 Logistics view has no horizontal overflow at phone width');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await js('__airbossTest.logistics.setState(__airbossTest.logistics.DEFAULT_STATE);__airbossTest.logistics.render();document.getElementById("logi-cards").scrollIntoView()');await shot('logistics-desktop');await js('scrollTo(0,0)');
  await click('#view-deck');
  await check('!document.body.classList.contains("view-logistics")&&document.querySelector(".console").getClientRects().length>0&&document.getElementById("logistics").getClientRects().length===0&&JSON.stringify(__airbossTest.st)==='+JSON.stringify(deckState),'v3.2 back to Flight Deck Operations: the v3.1 state is untouched');
  await agreement('after Logistics view');
  // ---- v3.3 Your Design closure panel: every label and the readout read the SHIPPED designer engine ----
  const dzBound=label=>check(`(()=>{const a=__airbossTest,D=a.designer,d=a.syncCustom(),v=D.valuesText(d),t=document.createElement('div');t.innerHTML=D.panelHTML(d,a.designerContext(a.evalWing(a.st.rng)));return Object.keys(v).every(id=>document.getElementById(id).textContent===v[id])&&document.getElementById('c-readout').textContent===t.textContent&&document.getElementById('c-readout').textContent.length>200&&!/NaN|undefined/.test(document.getElementById('c-designer').textContent);})()`,'v3.3 designer labels and readout bound to the engine: '+label);
  const dz=()=>"document.getElementById('c-readout').textContent";
  await check('!!document.getElementById("c-designer")&&document.getElementById("c-engine-mid").getAttribute("aria-pressed")==="true"&&+document.getElementById("c-wing").value===285&&+document.getElementById("c-qty").value===150&&+document.getElementById("c-mach").value===0.8&&+document.getElementById("c-fuel").value===5620','v3.3 Your Design panel present with the closing defaults (Mid, 285 sq ft, Mach 0.80, 5,620 lb, 150 a/c)');
  await dzBound('defaults');
  await check(dz()+'.includes("[ PASS ] CARRIER APPROACH SPEED : 107.5 kt <= 135.0 kt limit (margin +27.5 kt)")&&'+dz()+'.includes("D/T 0.48 <= 0.85")&&'+dz()+'.includes("ROBUST CLOSURE")&&'+dz()+'.includes("$18.94M")&&'+dz()+'.includes("$21.78M")&&'+dz()+'.includes("$25.78M")&&'+dz()+'.includes("APUC-style")&&'+dz()+'.includes("PAUC-style")&&'+dz()+'.includes("1,005 nm")&&!'+dz()+'.includes("Program APUC")&&document.getElementById("cv-wing").textContent==="285 sq ft (V_PA 107.5 kt | margin +27.5 kt)"','v3.4 default design closes: 107.5 kt, D/T 0.48, robust, $18.94M flyaway / $21.78M APUC / $25.78M PAUC, 1,005 nm');
  await change('c-wing',150,'input');
  await check('__airbossTest.st.custom.wingArea===150&&'+dz()+'.includes("[ FAIL ]")&&'+dz()+'.includes("INFEASIBLE: Nominal gate violation (GATE_")&&!__airbossTest.CAT.custom.doesClose','v3.3 wing slider to 150 sq ft: a gate fails, status names the binding gate');await dzBound('150 sq ft');
  await click('#c-engine-light');
  await check('__airbossTest.st.custom.engineClass==="light"&&document.getElementById("c-engine-light").getAttribute("aria-pressed")==="true"&&document.getElementById("cv-engine").textContent.startsWith("Class 1 Light Turbofan")','v3.3 engine picker: Light selected');await dzBound('light engine');
  await click('#c-engine-heavy');await change('c-qty',50,'input');await change('c-wing',285,'input');
  await check('__airbossTest.st.custom.buyQty===50&&document.getElementById("cv-qty").textContent==="50 a/c (amortized engine dev +$12.00M/unit)"','v3.3 heavy core at a buy of 50: +$12.00M per aircraft of engine development');await dzBound('heavy at 50');
  await click('#c-engine-mid');await change('c-qty',150,'input');
  await js('__airbossTest.st.alloc={fa18:26,custom:6,cap:6}');await change('s-rng',500,'input');await change('c-mach',0.66,'input');await click('#c-doctrine-early_launch');
  await check('(()=>{const r=__airbossTest.evalWing(__airbossTest.st.rng),t=document.getElementById("c-readout").textContent;return r.doctrine.rows[0].status==="withheld"&&/^early launch needs [0-9]+ tanker sorties? of loiter gas; 0 available$/.test(r.doctrine.reason)&&t.includes(r.doctrine.reason)&&t.includes("Crewed strike fighters push on schedule; the CCA joins at Event 2.");})()','v3.3 fielded Mach 0.66 CCA (slider step 0.02), early launch, no MQ-25: withheld from Event 1 with the deterministic reason, re-enters at Event 2');
  await dzBound('Event-1 withhold');await agreement('Event-1 withhold');
  await click('#c-doctrine-slow_package');await check('__airbossTest.evalWing(__airbossTest.st.rng).packageFactor<1&&'+dz()+'.includes("Slower Package Speed")','v3.3 slower package: every strike sortie exposed longer');await dzBound('slow package');
  await click('#c-doctrine-keep_up');await change('c-mach',0.8,'input');
  await check('document.getElementById("v-ccustom").textContent===("$"+__airbossTest.fmt(__airbossTest.syncCustom().costs.flyaway,1)+"M recurring flyaway")&&!document.getElementById("s-ccustom")','v3.3 Auto-Boss price of Your Design comes from the designer (cost slider retired)');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await js('document.getElementById("c-designer").scrollIntoView()');await shot('designer-mobile');
  await check('document.documentElement.scrollWidth<=innerWidth+1','v3.3 designer panel has no horizontal overflow at phone width');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await js('document.getElementById("c-designer").scrollIntoView()');await shot('designer-desktop');await js('scrollTo(0,0)');
  await check("document.getElementById('local-guide').textContent.includes('Buddy relay is the teaching case')",'field guide explains reachable relay case');
  // v3.3.2 Field guide: the label tracks the newest release notes and the body covers v3.1 to v3.3.1; readable when open at
  // desktop and phone width (no horizontal overflow).
  await check(`document.querySelector('#local-guide summary').textContent==='Field guide - v3.4'`,'field guide label reads Field guide - v3.4');
  await check(`(()=>{const t=document.getElementById('local-guide').textContent;return ['v3.2/v3.4 Logistics Pipeline','v3.3/v3.4 "Your Design" Conceptual Aircraft Closure','v3.3.1 Guided Tour & CCA Force-Mix Modes','Off flies the pure crewed baseline','fewer crew at risk','C_L,app = 1.10'].every(s=>t.includes(s))&&!/\\bv3\\.1:/.test(t);})()`,'field guide covers v3.2 to v3.4 (Off / CAP / Strike) without the v3.1 prefix');
  for(const [vw,vh,tag] of [[1440,1000,'desktop'],[390,844,'phone']]){
    await send('Emulation.setDeviceMetricsOverride',{width:vw,height:vh,deviceScaleFactor:1,mobile:tag==='phone'});
    await js(`(()=>{const d=document.getElementById('local-guide');d.open=true;d.scrollIntoView({block:'start'});return true;})()`);
    await check(`(()=>{const d=document.getElementById('local-guide'),r=d.getBoundingClientRect(),ps=[...d.querySelectorAll('p')];return d.open&&ps.length===7&&ps.every(p=>{const b=p.getBoundingClientRect();return b.height>0&&b.left>=0&&b.right<=innerWidth+1;})&&r.left>=0&&r.right<=innerWidth+1&&document.documentElement.scrollWidth<=innerWidth+1;})()`,'field guide open: 7 sections laid out, no horizontal overflow '+tag);
    await shot('field-guide-'+tag);
  }
  await js(`document.getElementById('local-guide').open=false;scrollTo(0,0);true`);
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await click('[data-scenario="strait_defense"]');await check('__airbossTest.st.rng===500&&__airbossTest.st.threat===.85&&__airbossTest.st.alloc.cap===10&&__airbossTest.st.strike==="standoff"','Contested Strait applies state');await agreement('Contested Strait');
  await check('__airbossTest.st.rankBy==="surv"&&!document.getElementById("scenario-objective").hidden&&document.getElementById("scenario-objective").textContent.includes((__airbossTest.evalWing(__airbossTest.st.rng).objScore*100).toFixed(1))&&document.querySelector("[data-r=surv]").getAttribute("aria-pressed")==="true"','Strait defaults to visible selected Survivability objective');
  await js('document.getElementById("scenario-objective").focus({preventScroll:true})');
  await check('!document.getElementById("control-help").hidden&&document.getElementById("control-help").textContent.includes("fuel support times mean survivability")','Strait objective help defines protection score');
  await js('__airbossTest.st.rankBy="effect"');await click('#scenario-objective');
  await check('__airbossTest.st.rankBy==="surv"&&document.getElementById("mission-ledger").textContent.includes("survivability "+(__airbossTest.evalWing(__airbossTest.st.rng).objScore*100).toFixed(1))','Strait objective control restores scoring and readout');
  await check('(()=>{const r=__airbossTest.evalWing(__airbossTest.st.rng),t=id=>document.getElementById(id).textContent,f=(n)=>Math.round(n).toLocaleString();return t("launchline").includes(f(r.strikeSorties)+" Flown / "+f(r.strikeHeld)+" Held")&&t("launchline").includes("Binding: "+r.binding)&&t("overhead").includes("Overhead sorties "+f(r.overheadSorties)+" ("+f(r.fcfSorties)+" FCF, "+f(r.qualSorties)+" Qual)")&&t("deckcap").includes("ceiling "+f(r.deckCeiling))&&document.getElementById("campaign").hidden;})()','v3.1 launch, overhead and deck readouts bound to engine');
  await click('[data-scenario="strait_defense_3day"]');
  await check('__airbossTest.st.scenario==="strait_defense_3day"&&__airbossTest.getDeck()==="ford"&&__airbossTest.st.tempo===1&&__airbossTest.st.alloc.ccx===8&&document.querySelector("[data-scenario=strait_defense_3day]").getAttribute("aria-pressed")==="true"','3-day Strait card applies campaign state');
  await check('(()=>{const a=__airbossTest,c=a.evalCampaign(a.st.rng,a.st.alloc),e=document.getElementById("campaign");return !e.hidden&&e.textContent.includes("Daily Tempo: "+Math.round(c.windowedAverageSorties).toLocaleString()+" sorties/day avg (Target: 120 sustained")&&e.textContent.includes("Day 3:")&&document.getElementById("pool").textContent.includes("48 assigned");})()','3-day campaign windowed readout bound to engine; weighted spots 48');
  await click('[data-scenario="war_at_sea"]');await check('__airbossTest.st.rng===600&&__airbossTest.st.strike==="mace"&&__airbossTest.st.alloc.isr===2','War at Sea applies state');
  await agreement('War at Sea');
  await check('__airbossTest.st.rankBy==="effect"&&document.getElementById("scenario-objective").hidden','War at Sea restores raw-effect objective');
  await click('[data-scenario="deep_strike"]');await check('__airbossTest.st.rng===800&&__airbossTest.st.targetPosture==="hardened"&&__airbossTest.getDeck()==="nimitz"&&__airbossTest.st.tempo===0','Deep Strike applies state (and resets campaign deck/tempo)');
  await check('(()=>{const b=[...document.querySelectorAll("#roster .ac")].find(n=>n.textContent.includes("CCX-1"));if(!b)return false;const used=()=>__airbossTest.usedSpots(__airbossTest.st.alloc),u0=used(),before=__airbossTest.st.alloc.ccx||0;b.querySelectorAll(".stepper button")[1].click();if(u0+0.75<=__airbossTest.getPool()||(__airbossTest.st.alloc.ccx||0)!==before)return false;const row=()=>[...document.querySelectorAll("#roster .ac")],f35=row().find(n=>n.textContent.startsWith("F-35C"));f35.querySelectorAll(".stepper button")[0].click();const u1=used();row().find(n=>n.textContent.includes("CCX-1")).querySelectorAll(".stepper button")[1].click();return __airbossTest.st.alloc.ccx===before+1&&Math.abs(used()-u1-0.75)<1e-9&&document.getElementById("pool").textContent.includes("43.75 assigned");})()','CCX-1 stepper: full deck refuses, freed spot takes 0.75 weighted spot');
  await agreement('Deep Strike');
  await change('target-posture','fleeting');await change('tanker-mode','theater');await change('threat-level','0.85');
  await check('__airbossTest.st.targetPosture==="fleeting"&&__airbossTest.st.tankerMode==="theater"&&__airbossTest.st.threat===.85','posture/theater/threat controls');
  await agreement('theater');
  for(const p of ['yoyo','strike','consolidation','recovery','balanced']){await change('tanker-plan',p);await check(`JSON.stringify(__airbossTest.st.tankerTactics)===JSON.stringify(__airbossTest.TACTIC_PLANS[${JSON.stringify(p)}])`,'plan '+p);}
  for(const [id,v] of [['tactic-yoyo',30],['tactic-consolidation',20],['tactic-recovery',10]])await change(id,v);
  await check('__airbossTest.st.tankerTactics.strike===40','custom percentages leave strike residual');
  await change('strike-orbit',150,'input');await check('__airbossTest.st.strikeOrbit===150&&document.getElementById("orbit-value").textContent==="150 nm"','orbit input updates model and label');
  await change('relay-orbit',250,'input');await check('__airbossTest.st.relayOrbit===250&&document.getElementById("relay-value").textContent==="250 nm"','relay orbit control updates model and label');
  await check('document.getElementById("tanker-reach").textContent.includes("274.2")','derived reach help is visible');
  for(const key of ['direct','mixed','mace','standoff']){await click('[data-s="'+key+'"]');await check('__airbossTest.st.strike==='+JSON.stringify(key),'strike button '+key);}
  for(const key of ['amraam','malice','gunslinger']){await click('[data-m="'+key+'"]');await check('__airbossTest.st.weapon==='+JSON.stringify(key),'A2A button '+key);}
  await click('[data-d="ford"]');await click('[data-o="1"]');await change('s-rng',700,'input');
  await check('__airbossTest.getDeck()==="ford"&&__airbossTest.st.tempo===1&&__airbossTest.st.rng===700','deck/tempo/range controls');
  await click('[data-scenario="war_at_sea"]');await click('[data-p="2"]');await click('[data-r="cliff"]');
  await check('document.querySelectorAll(".lb-load").length>0','cliff search populates leaderboard');await click('.lb-load');
  await check('__airbossTest.st.play===0&&__airbossTest.st.tankerMode==="organic"','load cliff candidate restores planner and plan');
  await click('[data-scenario="war_at_sea"]');await click('[data-p="1"]');
  await js('document.getElementById("deck").scrollIntoView({block:"center"})');await shot('deck-desktop');
  await click('#launch');await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await agreement('during day');await change('s-rng',700,'input');await agreement('range changed during day');await js('new Promise((resolve,reject)=>{const stop=Date.now()+12000;function frame(){if(!document.getElementById("launch").disabled)return resolve();if(Date.now()>stop)return reject(Error("run timeout"));requestAnimationFrame(frame)}frame()})');
  await agreement('after day');
  await check('!document.getElementById("daytally").classList.contains("hide")','live run completes and renders tally');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await js('document.getElementById("v3controls").scrollIntoView()');await shot('controls-mobile');
  await check('document.documentElement.scrollWidth<=innerWidth+1','mobile has no horizontal overflow');
  await click('[data-scenario="deep_strike"]');await check('__airbossTest.st.rng===800','scenario still works at phone width');
  await click('[data-p="1"]');await js('document.getElementById("deck").scrollIntoView({block:"center"})');await shot('deck-mobile');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await js('scrollTo(0,0)');await shot('overview-desktop');

  await click('[data-scenario="war_at_sea"]');
  await check('document.querySelector("[data-scenario=war_at_sea]").getAttribute("aria-pressed")==="true"&&document.getElementById("scenarios").compareDocumentPosition(document.querySelector(".console"))&Node.DOCUMENT_POSITION_FOLLOWING','scenario cards are prominent and pressed');
  await check('document.getElementById("tactic-strike").readOnly&&+document.getElementById("tactic-strike").value===__airbossTest.st.tankerTactics.strike','strike remainder is visible and read-only');
  await change('tanker-plan','consolidation');
  await check('document.getElementById("relay-warning").textContent.includes("274.2")&&document.getElementById("relay-warning").textContent.includes("250 nm")','infeasible buddy relay has an actionable inline warning');
  await change('relay-orbit',250,'input');await check('document.getElementById("relay-warning").textContent===""','relay warning clears at feasible orbit');
  await click('#watch-deck');await check('__airbossTest.st.play===1&&!document.getElementById("deckwrap").classList.contains("hide")','watch deck call-to-action reveals simulation');
  for(const width of [1440,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
    await js('scrollTo({top:0,behavior:"instant"})');
    await check(`(()=>{const a=document.querySelector('header .gouge'),b=document.querySelector('header .illus'),r=a.getBoundingClientRect(),s=b.getBoundingClientRect();return !!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING)&&parseFloat(getComputedStyle(a).fontSize)>=14&&a.dataset.help&&r.left>=0&&s.right<=innerWidth&&s.bottom<=innerHeight&&(innerWidth>600?r.right<=s.left:r.bottom<=s.top)&&b.textContent.includes('not operational analysis');})()`,'Gouge larger and before fully visible disclaimer '+width);
    await shot('gouge-header-'+width);
    for(const mode of [0,1,2]){
      await click('[data-w="2"]');await click('[data-p="'+mode+'"]');
      const report=await js(`(()=>{let count=0;const controls=[...document.querySelectorAll('button,select,input,a[href],summary')],tip=document.getElementById('control-help'),esc=()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        for(const n of controls){const desc=document.getElementById(n.getAttribute('aria-describedby'));if(!desc||!desc.textContent||!n.dataset.help)throw Error('Missing help '+n.outerHTML.slice(0,100));
          if(n.disabled||!n.getClientRects().length)continue;
          n.scrollIntoView({block:'center',behavior:'instant'});
          const box=n.getBoundingClientRect();
          for(const how of ['focus','tap']){esc();n.blur();
            if(how==='hover')n.dispatchEvent(new PointerEvent('pointerover',{pointerType:'mouse',bubbles:true}));
            else if(how==='focus')n.focus({preventScroll:true});
            else{n.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',bubbles:true,cancelable:true}));n.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));}
            const r=tip.getBoundingClientRect();if(tip.hidden||!tip.textContent.includes(n.dataset.help)||r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1)throw Error('Help missing or overflowing: '+how+' '+n.outerHTML.slice(0,100));
            const after=n.getBoundingClientRect();if(Math.abs(after.top-box.top)>1)throw Error('Help shifted layout');
          }esc();if(!tip.hidden)throw Error('Escape did not dismiss');count++;
        }return {count,all:controls.length};})()`);
      assert(report.count>20,'all visible controls exercised');checks++;console.log('PASS help focus/tap '+width+'px mode '+mode+': '+report.count+' visible / '+report.all+' described');
    }
  }
  await js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));document.querySelector("[data-scenario=war_at_sea]").scrollIntoView({block:"center",behavior:"instant"})');
  const tap=await js('(()=>{const r=document.querySelector("[data-scenario=war_at_sea]").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()');
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[tap]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await check('!document.getElementById("control-help").hidden','real phone tap opens help');
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[tap]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await check('__airbossTest.st.play===0&&__airbossTest.st.scenario==="war_at_sea"','second phone tap activates scenario');
  await js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');

  // Real mouse input: intent, jitter, hover bridge, grace, adjacent switches and scroll.
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await js('document.getElementById("watch-start").scrollIntoView({block:"center",behavior:"instant"});document.activeElement.blur()');
  await js('new Promise(r=>setTimeout(r,500))');
  const hover=await js('(()=>{const r=document.getElementById("watch-start").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:hover.x,y:hover.y});
  await check('document.getElementById("control-help").hidden','hover does not open before intent delay');
  await js('new Promise(r=>setTimeout(r,420))');
  await check('!document.getElementById("control-help").hidden','hover opens after intent delay');
  for(let i=0;i<10;i++){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:hover.x+(i%2),y:hover.y+(i%2)});await js('new Promise(r=>setTimeout(r,220))');await check('!document.getElementById("control-help").hidden','help persists through jitter '+i);}
  const bridge=await js('(()=>{const r=document.getElementById("control-help").getBoundingClientRect();return {x:r.left+20,y:r.top+20}})()');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:bridge.x,y:bridge.y});await js('new Promise(r=>setTimeout(r,450))');
  await check('!document.getElementById("control-help").hidden&&document.querySelectorAll("#control-help:not([hidden])").length===1','control to bubble bridge retains one help bubble');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await js('new Promise(r=>setTimeout(r,120))');
  await check('!document.getElementById("control-help").hidden','leave grace keeps bubble briefly');await js('new Promise(r=>setTimeout(r,300))');
  await check('document.getElementById("control-help").hidden','leave closes after grace');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:hover.x,y:hover.y});await js('new Promise(r=>setTimeout(r,420))');
  const adjacent=await js('(()=>{const r=document.getElementById("watch-replay").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:adjacent.x,y:adjacent.y});
  await check('!document.getElementById("control-help").hidden','adjacent switch keeps existing help during intent');await js('new Promise(r=>setTimeout(r,420))');
  await check('document.getElementById("control-help").textContent.includes(document.getElementById("watch-replay").dataset.help)&&document.querySelectorAll("#control-help:not([hidden])").length===1','adjacent switch updates one bubble');
  await js('scrollBy(0,40);new Promise(r=>setTimeout(r,550))');
  await check('document.getElementById("control-help").hidden','scroll closes without retriggering help');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});

  // Observe every actual phase after scroll settles, not just the presence of markup. (v3.3: Brisk pace, >= 2.1 s per card.)
  await change('watch-pace','brisk');
  for(const width of [1440,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
    await js('__airbossTest.startWatch("explainer-461")');
    const phases=await js(`new Promise((resolve,reject)=>{let last='',seen=[],limit=Date.now()+90000;function frame(){const phase=__airbossTest.watchState.phase;if(phase!==last){last=phase;(function wait(){if(__airbossTest.watchState.phase!==phase)return reject(Error('phase left before its dwell started '+phase));if(!__airbossTest.watchPacing.ctx.running)return setTimeout(wait,40);try{const tip=document.getElementById('watch-explainer'),target=document.querySelector('.watch-highlight'),r=tip.getBoundingClientRect(),t=target.getBoundingClientRect();if(document.querySelectorAll('#watch-explainer:not([hidden])').length!==1||tip.dataset.anchor!==target.id||tip.nextElementSibling!==target)throw Error('unanchored '+phase);if(r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1||r.bottom>t.top+1)throw Error('callout obscured '+phase+' '+JSON.stringify({r:r.toJSON(),t:t.toJSON()}));if(!tip.textContent.trim())throw Error('empty '+phase);seen.push(phase);if(phase==='result')resolve(seen);}catch(e){reject(e);}})();}if(phase!=='result'&&Date.now()<limit)requestAnimationFrame(frame);else if(Date.now()>=limit)reject(Error('explainer timeout'));}frame()})`);
    assert.deepEqual(phases,['scenario','wing','weapons','tankers','launch','result']);checks++;console.log('PASS six anchored unobstructed Watch explainers (checked when the dwell starts, after the scroll settles) at '+width+'px');
    await shot('watch-explainer-'+width);
    await send('Emulation.setDeviceMetricsOverride',{width:width===390?1440:390,height:900,deviceScaleFactor:1,mobile:width!==390});
    await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    await check('(()=>{const r=document.getElementById("watch-explainer").getBoundingClientRect(),t=document.querySelector(".watch-highlight").getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&r.bottom<=t.top+1})()','Watch explanation repositions on viewport resize '+width);
    await js('__airbossTest.stopWatch()');
    await check('document.getElementById("watch-explainer").hidden','takeover dismisses explainer '+width);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  const gameURL=await js('location.href');
  await check('document.querySelector("a.gouge").getAttribute("href")==="gouge.html"','Gouge uses portable relative link');
  await click('a.gouge');
  await js("new Promise(r=>document.readyState==='complete'?r():addEventListener('load',r,{once:true}))");
  await check('location.pathname.endsWith("/gouge.html")&&document.title.includes("Gouge")&&!!document.querySelector(".scene")','Gouge opens offline');
  await check('document.body.textContent.includes("War at Sea")&&document.body.textContent.includes("Deep Strike")&&document.body.textContent.includes("78.5 versus 57.8")&&document.body.textContent.includes("458.4 versus 826.9")','Gouge includes scenarios and honest Strait objective/output comparison');
  // Raised Strait floor (350): the Gouge explains the requirement in player terms.
  await check('document.body.textContent.includes("min(1, effect / 350)")&&document.body.textContent.includes("scores 59.9")&&!document.body.textContent.includes("effect / 200")','Gouge explains the 350 Strait effect requirement');
  await check('document.body.textContent.includes("Tempo is a logistics bill.")&&document.body.textContent.includes("178,250 gal")&&document.body.textContent.includes("doubles to 4 ships")&&document.body.textContent.includes("36 to 54")&&document.body.textContent.includes("5 operators on watch")&&document.body.textContent.includes("teaching assumption")&&document.body.textContent.includes("second oiler must be staggered in: 3 ships")','Gouge explains the v3.2 logistics bill');
  await check('document.body.textContent.includes("An unclosed airplane flies only in PowerPoint.")&&document.body.textContent.includes("13,210 lb of loiter gas, 1 MQ-25 sortie (17,500 lb at the 150-nm station)")&&document.body.textContent.includes("approach 107.5 kt")&&document.querySelectorAll(".scene").length===13','Gouge explains the v3.3 designer closure, the keep-up withhold and pacing (13 events)');
  // v3.3.2 Gouge notes: no stale v3.1 label; v3.2 / v3.3 / v3.3.1 notes in Events 02, 09 and 12.
  await check(`(()=>{const t=document.body.textContent;return !/\\bv3\\.1(?![\\d.]*\\d)/.test(t)&&t.includes('Carrier CCAs:')&&t.includes('New in v3.4:')&&t.includes('Air Boss v3.4 Educational Visual Tour')&&!t.includes('launches nearly stop')&&t.includes('Mission-governed launch:')&&t.includes('New in v3.2 \u2014 tempo is a logistics bill:')&&t.includes('New in v3.3 / v3.3.1 \u2014 guided tour comparison:')&&t.includes('Watch the Air Boss (v3.3.1):');})()`,'Gouge carries the v3.2 / v3.3 / v3.3.1 notes and no stale v3.1 label');
  await click('.play-cta');
  await js("new Promise(r=>document.readyState==='complete'?r():addEventListener('load',r,{once:true}))");
  // The generated Gouge is shared: from the internal dev file it returns to the public build (pre-existing design);
  // the UI suite then re-opens the build under test so every later check still exercises it (v3.1: both builds run).
  const expectReturn=gameURL.endsWith('/air_boss.html')?gameURL.replace(/air_boss\.html$/,'air_boss_public.html'):gameURL;
  await check('location.href==='+JSON.stringify(expectReturn)+'&&!!window.__airbossTest','Gouge returns to playable offline game');
  if(expectReturn!==gameURL){await send('Page.navigate',{url:gameURL});await js("new Promise(r=>document.readyState==='complete'?r():addEventListener('load',r,{once:true}))");await check('location.href==='+JSON.stringify(gameURL)+'&&!!window.__airbossTest','build under test re-opened after Gouge');}

  await click('[data-d="ford"]');await click('[data-o="1"]');
  await click('#watch-start');await check('__airbossTest.watchState.active&&!!__airbossTest.watchState.seed','Watch button starts with a displayed seed');
  await check('__airbossTest.getDeck()==="ford"&&__airbossTest.st.tempo===0&&__airbossTest.evalWing(__airbossTest.st.rng).events===8','Watch starts sustained on selected Ford despite prior surge selection');
  await click('#watch-stop');await check('!__airbossTest.watchState.active','Stop returns control');
  await change('watch-pace','brisk');   // v3.3: the reloaded page starts Relaxed; Brisk keeps this cycle short
  await js('__airbossTest.startWatch("ui-seed")');
  await js('new Promise((resolve,reject)=>{const end=Date.now()+90000;window.watchSeen=[];let last="";function frame(){const w=__airbossTest.watchState;if(w.phase!==last){last=w.phase;watchSeen.push(last);if(last==="launch"){document.querySelectorAll("#tempopick button")[1].click();document.querySelector("#deckpick button").click();}if(last==="wing")setTimeout(()=>{const row=document.getElementById("roster").getBoundingClientRect(),caption=document.getElementById("watch-panel").getBoundingClientRect();window.watchWingVisible=row.top>=caption.bottom&&row.top<innerHeight-100;},800);if(__airbossTest.evalWing(__airbossTest.st.rng).infeasible.length)return reject(Error("infeasible Watch step"));}if(w.phase==="result")return resolve();if(Date.now()>end)return reject(Error("Watch cycle timeout"));requestAnimationFrame(frame)}frame()})');
  await check('["scenario","wing","weapons","tankers","launch","result"].every(p=>watchSeen.includes(p))&&document.getElementById("watch-result").textContent.includes("organic cliff")','Watch narrates setup, launches and displays result');
  await check('__airbossTest.watchState.active&&__airbossTest.st.tempo===0&&__airbossTest.getDeck()==="ford"&&document.getElementById("watch-result").textContent.includes("Sustained ops: 8 cycles")&&document.getElementById("watch-caption").textContent.includes("Next cycle: surge ops on Nimitz-class")','mid-watch choices queue without changing current sustained result');
  await check('window.watchWingVisible===true','Watch roster starts below the caption panel');
  await check('document.documentElement.scrollWidth<=innerWidth+1&&document.getElementById("watch-caption").getBoundingClientRect().width<=innerWidth','Watch captions fit phone viewport');
  await js('new Promise((resolve,reject)=>{const end=Date.now()+30000;function frame(){if(__airbossTest.watchState.cycle===1)return resolve();if(Date.now()>end)return reject(Error("next cycle timeout"));requestAnimationFrame(frame)}frame()})');
  await check('JSON.stringify(__airbossTest.watchState.input)===JSON.stringify(__airbossTest.watchCycle("ui-seed",1))','Watch advances to next seeded cycle');
  await check('__airbossTest.st.tempo===1&&__airbossTest.getDeck()==="nimitz"&&__airbossTest.evalWing(__airbossTest.st.rng).events===10&&document.getElementById("watch-caption").textContent.includes("Surge: 10 cycles")','queued deck and tempo apply at next cycle start');
  await click('#watch-replay');await check('__airbossTest.watchState.cycle===0&&__airbossTest.watchState.seed==="ui-seed"','Replay restarts the displayed seed');
  await js('new Promise((resolve,reject)=>{const end=Date.now()+60000;function frame(){if(__airbossTest.watchState.phase==="launch")return resolve();if(Date.now()>end)return reject(Error("launch timeout"));requestAnimationFrame(frame)}frame()})');
  await check('document.getElementById("watch-teaser").textContent==="Do you want to see the air wing surge?"&&!document.getElementById("watch-teaser").hidden','Surge invitation is exact and visible');
  await click('#watch-surge');await js('new Promise((resolve,reject)=>{const end=Date.now()+15000;function f(){if(__airbossTest.dayRunning())return resolve();if(Date.now()>end)return reject(Error("day start timeout"));requestAnimationFrame(f)}f()})');await check('__airbossTest.watchState.active&&__airbossTest.st.tempo===1&&__airbossTest.evalWing(__airbossTest.st.rng).events===10&&Number(document.getElementById("deck").dataset.playbackRate)>1','Surge button keeps Watch running with faster deck playback');
  await js('new Promise((resolve,reject)=>{const end=Date.now()+30000;function frame(){if(__airbossTest.watchState.phase==="result")return resolve();if(Date.now()>end)return reject(Error("surge timeout"));requestAnimationFrame(frame)}frame()})');
  await check('document.getElementById("watch-caption").textContent.includes("SURGE: 10 cycles vs 8 sustained")&&document.getElementById("watch-caption").textContent.includes("sorties")&&document.getElementById("watch-caption").textContent.includes("hold it forever")','Surge result shows model delta and endurance caveat');
  await click('#watch-surge');await js('new Promise((resolve,reject)=>{const end=Date.now()+15000;function f(){if(__airbossTest.dayRunning())return resolve();if(Date.now()>end)return reject(Error("day start timeout"));requestAnimationFrame(f)}f()})');await check('__airbossTest.watchState.active&&__airbossTest.st.tempo===0&&__airbossTest.evalWing(__airbossTest.st.rng).events===8&&Number(document.getElementById("deck").dataset.playbackRate)===1','Surge toggles back to eight sustained cycles');
  const takeover=await js('JSON.stringify(__airbossTest.st)');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await check('!__airbossTest.watchState.active&&!document.getElementById("launch").disabled&&JSON.stringify(__airbossTest.st)==='+JSON.stringify(takeover),'keyboard takeover cancels Watch and preserves current inputs');
  const stoppedClock=await js('document.getElementById("clock").textContent');await js('new Promise(r=>setTimeout(r,2400))');
  await check('document.getElementById("clock").textContent==='+JSON.stringify(stoppedClock)+'&&!__airbossTest.watchState.active','takeover cancels queued steps and animation frames');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:gameURL+'#watch'});
  await js("new Promise(r=>document.readyState==='complete'?r():addEventListener('load',r,{once:true}))");
  await check('__airbossTest.watchState.active&&matchMedia("(prefers-reduced-motion:reduce)").matches','bare Watch anchor auto-starts with reduced motion');
  await change('watch-pace','brisk');await check('__airbossTest.watchState.active&&__airbossTest.watchPacing.ctx.pace==="brisk"','pace change from the panel keeps the tour running');
  await js('new Promise((resolve,reject)=>{const end=Date.now()+90000;function frame(){if(__airbossTest.watchState.phase==="result")return resolve();if(Date.now()>end)return reject(Error("reduced motion timeout"));requestAnimationFrame(frame)}frame()})');
  await check('!document.getElementById("daytally").classList.contains("hide")','reduced-motion Watch completes without flight animation');
  await click('#watch-surge');await js('new Promise((resolve,reject)=>{const end=Date.now()+30000;function f(){if(__airbossTest.watchState.phase==="result")return resolve();if(Date.now()>end)return reject(Error("result timeout"));requestAnimationFrame(f)}f()})');
  await check('__airbossTest.watchState.active&&__airbossTest.st.tempo===1&&document.getElementById("watch-caption").textContent.includes("SURGE: 10 cycles vs 8 sustained")','reduced-motion Surge conveys the delta without animation');
  await click('#watch-surge');await js('new Promise((resolve,reject)=>{const end=Date.now()+30000;function f(){if(__airbossTest.watchState.phase==="result")return resolve();if(Date.now()>end)return reject(Error("result timeout"));requestAnimationFrame(f)}f()})');
  await check('__airbossTest.st.tempo===0&&document.getElementById("watch-result").textContent.includes("Sustained ops: 8 cycles")','reduced-motion toggle returns to Sustained');
  await click('#watch-stop');
  await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:gameURL+'#watch=replay-42'});
  await js("new Promise(r=>document.readyState==='complete'?r():addEventListener('load',r,{once:true}))");
  await check('__airbossTest.watchState.seed==="replay-42"&&__airbossTest.watchState.active','explicit Watch seed anchor is reproducible');await click('#watch-stop');
  await change('watch-pace','brisk');
  await js('(()=>{let seed;for(let i=0;i<100;i++){seed="strait-ui-"+i;if(__airbossTest.watchCycle(seed,0).scenario==="strait_defense")break;}__airbossTest.startWatch(seed);})()');
  await js('new Promise((resolve,reject)=>{const end=Date.now()+90000;function frame(){if(__airbossTest.watchState.phase==="result")return resolve();if(Date.now()>end)return reject(Error("Strait Watch timeout"));requestAnimationFrame(frame)}frame()})');
  await check('(()=>{const expected=(__airbossTest.evalWing(__airbossTest.st.rng).objScore*100).toFixed(1);return __airbossTest.st.rankBy==="surv"&&["watch-caption","watch-result","daytally","mission-ledger"].every(id=>document.getElementById(id).textContent.includes("survivability "+expected+" / 100"))})()','Strait Watch and day results display the same existing objective');
  await shot('strait-objective-phone');await js('__airbossTest.stopWatch()');
  // ---- v3.3 Watch the Air Boss pacing contract, live (Relaxed default, transport, keys, hover, Next in the day run) ----
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url:gameURL.replace(/#.*$/,'')});
  await js("new Promise(r=>document.readyState==='complete'?r():addEventListener('load',r,{once:true}))");
  await check('document.getElementById("watch-pace").value==="relaxed"&&__airbossTest.watchPacing.ctx.pace==="relaxed"&&document.getElementById("watch-pause").hidden&&document.getElementById("watch-next").hidden','v3.3 pace selector defaults to Relaxed; transport hidden until the tour runs');
  const live=await js(`new Promise((resolve,reject)=>{const a=__airbossTest,w=a.watchState,P=a.watchPacing;a.startWatch('pace-live');const t0=performance.now(),text0=()=>document.getElementById('watch-explainer').textContent;let text='',end=t0+45000;
    function f(){if(!text&&document.getElementById('watch-explainer')&&!document.getElementById('watch-explainer').hidden)text=text0();if(w.phase!=='scenario'){const log=P.ctx.log.find(x=>x.phase==='scenario');return resolve({elapsed:performance.now()-t0,armedAfter:log.at-t0,dwell:log.dwell,words:P.words(text)});}if(performance.now()>end)return reject(Error('live dwell timeout'));requestAnimationFrame(f);}f();})`);
  assert(live.dwell===Math.ceil(Math.max(6,live.words/3+2)*1000)&&live.dwell>=6000&&live.elapsed>=live.dwell+live.armedAfter-30&&live.armedAfter>=400,'live Relaxed dwell '+JSON.stringify(live));checks++;
  console.log('PASS v3.3 live Relaxed step: '+live.words+' words -> '+live.dwell+' ms dwell, armed '+Math.round(live.armedAfter)+' ms after reveal, step held '+Math.round(live.elapsed)+' ms');
  await check('!document.getElementById("watch-pause").hidden&&document.getElementById("watch-pause").textContent==="Pause"&&!document.getElementById("watch-next").hidden&&__airbossTest.watchState.phase==="wing"','v3.3 Pause and Next visible while watching; the tour reached the roster step');
  await js('new Promise((resolve,reject)=>{const end=Date.now()+5000;function f(){if(__airbossTest.watchPacing.ctx.running)return resolve();if(Date.now()>end)return reject(Error("dwell not armed"));requestAnimationFrame(f)}f()})');
  await click('#watch-pause');const frozen=await js('__airbossTest.watchPacing.ctx.remaining');await js('new Promise(r=>setTimeout(r,2500))');
  await check('__airbossTest.watchState.active&&__airbossTest.watchState.phase==="wing"&&document.getElementById("watch-pause").textContent==="Resume"&&__airbossTest.watchPacing.ctx.remaining==='+frozen+'&&document.getElementById("watch-status").textContent.includes("paused")','v3.3 Pause: no step transition and the remaining dwell is frozen for 2.5 s; button reads Resume');
  const keySpace=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' '});await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});};
  await js('document.getElementById("watch-pause").focus()');await keySpace();await js('new Promise(r=>setTimeout(r,150))');
  await check('document.activeElement.id==="watch-pause"&&__airbossTest.watchState.active&&!__airbossTest.watchPacing.ctx.manualPause&&document.getElementById("watch-pause").textContent==="Pause"','v3.3 Space with the Pause button focused resumes exactly once (no double toggle)');
  await js('document.activeElement.blur()');await keySpace();
  await check('__airbossTest.watchState.active&&__airbossTest.watchPacing.ctx.manualPause','v3.3 Space on the page pauses (tour keeps running)');await keySpace();
  await check('__airbossTest.watchState.active&&!__airbossTest.watchPacing.ctx.manualPause','v3.3 Space again resumes');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await check('__airbossTest.watchState.active&&__airbossTest.watchState.phase==="weapons"','v3.3 Right arrow advances exactly one step (roster -> loadout)');
  await js('new Promise(r=>setTimeout(r,900))');
  const tipAt=await js('(()=>{const r=document.getElementById("watch-explainer").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:tipAt.x,y:tipAt.y});await js('new Promise(r=>setTimeout(r,200))');
  await check('__airbossTest.watchPacing.ctx.hoverPause&&__airbossTest.watchPacing.isPaused()&&document.getElementById("watch-status").textContent.includes("paused while you read")&&__airbossTest.watchState.active','v3.3 hovering the explainer pauses the tour (reading lock)');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});await js('new Promise(r=>setTimeout(r,200))');
  await check('!__airbossTest.watchPacing.ctx.hoverPause&&!__airbossTest.watchPacing.isPaused()&&__airbossTest.watchState.active','v3.3 leaving the explainer resumes');
  await click('#watch-next');await check('__airbossTest.watchState.phase==="tankers"&&__airbossTest.watchState.active','v3.3 Next button advances one step (loadout -> tanker plan)');
  await click('#watch-next');await js('new Promise((resolve,reject)=>{const end=Date.now()+5000;function f(){if(__airbossTest.dayRunning())return resolve();if(Date.now()>end)return reject(Error("day did not start"));requestAnimationFrame(f)}f()})');
  await check('__airbossTest.watchState.phase==="launch"&&__airbossTest.dayRunning()','v3.3 Day Flight Operations step runs the day animation');
  await click('#watch-next');
  await check('__airbossTest.watchState.phase==="result"&&!__airbossTest.dayRunning()&&!document.getElementById("daytally").classList.contains("hide")&&!document.getElementById("launch").disabled','v3.3 Next during the day run: animation cancelled, results shown at once');
  await change('watch-pace','normal');await check('__airbossTest.watchState.active&&__airbossTest.watchPacing.ctx.pace==="normal"','v3.3 pace change while running keeps the tour');
  await click('[data-scenario="war_at_sea"]');await check('!__airbossTest.watchState.active','v3.3 a click on an unrelated game card is still a manual takeover');
  // ---- CCAs in the tour (Off / CAP / Strike), live: lock, same-seed runs of each mode, engine-bound comparison ----
  const grp='document.getElementById("watch-cca-mode")',mb=m=>'#watch-cca-mode button[data-mode='+m+']',btns='[...'+grp+'.querySelectorAll("button[data-mode]")]';
  await check('(()=>{const g='+grp+',b='+btns+';return g.getAttribute("role")==="radiogroup"&&b.map(x=>x.dataset.mode).join()==="off,cap,strike"&&b.map(x=>x.textContent).join()==="Off,CAP,Strike"&&b.every(x=>x.getAttribute("role")==="radio"&&!x.disabled)&&g.querySelector("[data-mode=cap]").getAttribute("aria-checked")==="true"&&b.filter(x=>x.getAttribute("aria-checked")==="true").length===1&&g.dataset.help.startsWith("Choose how the tour fields CCAs")&&document.getElementById("watch-start").parentElement===g.parentElement;})()','D14.1 CCA mode control (Off / CAP / Strike) beside Watch the Air Boss: a radio group, CAP by default, described');
  await click(mb('off'));await check('__airbossTest.watchState.mode==="off"&&document.querySelector("'+mb('off')+'").getAttribute("aria-checked")==="true"&&'+btns+'.filter(x=>x.getAttribute("aria-checked")==="true").length===1','D14 mode switches to Off while stopped (real click)');
  await js('document.querySelector("'+mb('off')+'").focus();document.querySelector("'+mb('off')+'").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));true');
  await check('__airbossTest.watchState.mode==="cap"&&document.activeElement===document.querySelector("'+mb('cap')+'")','D14.1 keyboard: the Right arrow moves the selection and focus Off -> CAP');
  await click(mb('off'));
  const toResult=async()=>{for(let i=0;i<6&&await js('__airbossTest.watchState.phase')!=='result';i++){await js('new Promise((resolve,reject)=>{const end=Date.now()+8000;function f(){const P=__airbossTest.watchPacing.ctx;if(P.running||__airbossTest.dayRunning())return resolve();if(Date.now()>end)return reject(Error("arm timeout"));requestAnimationFrame(f)}f()})');await click('#watch-next');}};
  await js('__airbossTest.startWatch("co1-live")');
  await check(btns+'.every(b=>b.disabled)&&__airbossTest.watchState.active','D14.2 mode buttons disabled while the tour runs');
  await js('document.querySelector("'+mb('strike')+'").click()');await check('__airbossTest.watchState.mode==="off"&&__airbossTest.watchState.active','D14.2 a click on a locked mode changes nothing and does not stop the tour');
  await click('#watch-pause');await check(btns+'.every(b=>b.disabled)','D14.2 Pause does not unlock the mode control');await click('#watch-pause');
  await toResult();
  await check('__airbossTest.watchState.phase==="result"&&(()=>{const a=__airbossTest,c=a.watchCompareStore(),t=document.createElement("div");t.innerHTML=a.watchCompareHTML(c);return !!c.off&&JSON.stringify(c.off.summary)===JSON.stringify(a.watchSummary(a.evalWing(a.st.rng),a.st.alloc))&&document.getElementById("watch-compare").textContent===t.textContent&&!/-0/.test(t.textContent);})()&&Object.keys(__airbossTest.st.alloc).every(k=>__airbossTest.CCA_KEYS.indexOf(k)<0||!__airbossTest.st.alloc[k])','D14.3 OFF run flies no CCAs; its comparison entry is the engine summary (table or prompt rendered from the store)');
  await click('#watch-stop');await check('!'+btns+'.some(b=>b.disabled)','D14.2 Stop re-enables the mode control');await click(mb('cap'));await click('#watch-replay');await toResult();
  await check('(()=>{const a=__airbossTest,c=a.watchCompareStore(),t=document.createElement("div");t.innerHTML=a.watchCompareHTML(c);return !!(c.cap&&c.off)&&document.getElementById("watch-compare").textContent===t.textContent&&t.textContent.includes("With vs without CCAs")&&t.textContent.includes("Now try Strike")&&JSON.stringify(c.cap.summary)===JSON.stringify(a.watchSummary(a.evalWing(a.st.rng),a.st.alloc))&&a.watchState.seed==="co1-live";})()','D14.5 replay of the same seed with CCAs on CAP: comparison bound to the engine for both runs; prompts for Strike');
  await check('(()=>{const a=__airbossTest,t=a.watchTourAlloc(a.watchState.input,"cap");const i=a.watchState.input.alloc,s=a.st.alloc;return t.fielded>0&&document.getElementById("watch-result").textContent.includes(t.label)&&a.usedSpots(s)<=a.usedSpots(i)+1e-9&&(s.ccxcap||0)===t.fielded&&!s.cap&&s.isr===i.isr&&s.f35c===i.f35c&&(s.fa18||0)===(i.fa18||0)&&!/strike/.test(t.label.replace("same strike wing",""));})()','Tour CAP ON run: CCX-1 fly CAP in the CAP fighter spots on the same deck; E-2 / EA-18G and strike fighters unchanged; label on the watch panel');
  await click('#watch-stop');await click(mb('strike'));await click('#watch-replay');await toResult();
  await check('(()=>{const a=__airbossTest,c=a.watchCompareStore(),t=document.createElement("div");t.innerHTML=a.watchCompareHTML(c);const x=t.textContent;return !!(c.off&&c.cap&&c.strike)&&document.getElementById("watch-compare").textContent===x&&["Crewed only","CCAs on CAP","CCAs as strikers","Delta CAP","Delta strike","Crewed losses per 100 effect"].every(s=>x.includes(s))&&JSON.stringify(c.strike.summary)===JSON.stringify(a.watchSummary(a.evalWing(a.st.rng),a.st.alloc))&&!/Now try/.test(x)&&!/<td>-0(\\.0+)?<\\/td>/.test(t.innerHTML);})()','Three-way comparison after Off, CAP and Strike runs of the same seed: engine values, deltas vs crewed only, no prompt left');
  await check('(()=>{const a=__airbossTest,t=a.watchTourAlloc(a.watchState.input,"strike"),i=a.watchState.input.alloc,s=a.st.alloc;return document.getElementById("watch-result").textContent.includes(t.label)&&Math.abs(a.usedSpots(s)-a.usedSpots(i))<1e-9&&(s.ccx||0)===t.fielded&&(s.fa18||0)===(i.fa18||0)-t.replaced&&s.f35c===i.f35c&&s.cap===i.cap&&s.isr===i.isr&&!s.ccxcap;})()','Tour Strike run: CCX-1 strikers replace F/A-18E/F on the same deck; F-35C, CAP and E-2 / EA-18G unchanged; label on the watch panel');
  // ---- v3.4 model caveats: each one visible on screen where the player reads it, desktop 1440 x 1000 and phone 390 x 844 ----
  const VIS=key=>`(async()=>{const el=document.querySelector('[data-caveat="${key}"]');if(!el)return 'missing';el.scrollIntoView({block:'center',behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const r=el.getBoundingClientRect(),cs=getComputedStyle(el);if(!(r.width>40&&r.height>8))return 'zero size';if(cs.visibility!=='visible'||cs.display==='none'||+cs.opacity<0.9)return 'hidden style';if(r.top<0||r.bottom>innerHeight+1||r.left<0||r.right>innerWidth+1)return 'outside viewport '+JSON.stringify([r.top,r.bottom,r.left,r.right,innerWidth,innerHeight]);for(const fy of [0.15,0.5,0.85]){const h=document.elementFromPoint((r.left+r.right)/2,r.top+fy*r.height);if(!h||!(h===el||el.contains(h)))return 'covered at '+fy+' by '+(h&&(h.id||h.className||h.tagName));}if(document.documentElement.scrollWidth>innerWidth+1)return 'page overflows horizontally';if(parseFloat(cs.fontSize)<10)return 'font '+cs.fontSize;return 'ok';})()`;
  async function visible(key,where,tag){const v=await js(VIS(key));assert.equal(v,'ok','v3.4 caveat "'+key+'" visible on screen in '+where+' ('+tag+'): '+v);console.log('PASS v3.4 caveat "'+key+'" visible on screen in '+where+' ('+tag+')');checks++;await shot('v34-caveat-'+key+'-'+tag);}
  const CV={compare:['cap-equivalence','cap-attrition','exposure-index'],logistics:['fuel-scaling','sortie-generation','reconfig-penalty','ordnance-throughput','replenishment','aircrew-endurance','c2-capacity'],
    designer:['approach-lift','deck-footprint','thrust-sensitivity','mission-timing','tanker-archetype','cost-breakdown','calibration']};
  for(const [vw,vh,tag] of [[1440,1000,'desktop'],[390,844,'phone']]){
    await send('Emulation.setDeviceMetricsOverride',{width:vw,height:vh,deviceScaleFactor:1,mobile:tag==='phone'});
    for(const k of CV.compare)await visible(k,'the Off / CAP / Strike comparison (result step, tour still running)',tag);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await js('document.getElementById("watch-compare").scrollIntoView()');await shot('watch-compare');await js('__airbossTest.stopWatch()');
  for(const [vw,vh,tag] of [[1440,1000,'desktop'],[390,844,'phone']]){
    await send('Emulation.setDeviceMetricsOverride',{width:vw,height:vh,deviceScaleFactor:1,mobile:tag==='phone'});
    for(const k of CV.compare)await visible(k,'the comparison after Stop',tag+'-stopped');
    await click('#view-logistics');
    for(const k of CV.logistics)await visible(k,'the Logistics view',tag);
    await click('#view-deck');
    for(const k of CV.designer)await visible(k,'the Your Design readout',tag);
    // v3.4 round 3: real aircraft keep their real names. The MQ-25 Stingray roster row is on screen, and no generic
    // stand-in tanker name is anywhere on the page.
    const row=await js(VIS('__ROW__').replace(`document.querySelector('[data-caveat="__ROW__"]')`,`[...document.querySelectorAll("#roster .ac")].find(n=>n.textContent.includes("MQ-25 Stingray"))`));
    assert.equal(row,'ok','MQ-25 Stingray roster row visible on screen ('+tag+'): '+row);
    assert.equal(await js('!/Tanker Drone/i.test(document.body.innerText)&&document.body.innerText.includes("MQ-25")'),true,'no generic tanker name on the page ('+tag+')');
    console.log('PASS v3.4 MQ-25 Stingray roster row visible on screen; no generic tanker name ('+tag+')');checks+=2;await shot('v34-roster-mq25-'+tag);
    // v3.4 round 4: the F-35C roster row is on screen with its labelled radius: 600 nm program current estimate = threshold,
    // 667 nm demonstrated (display only).
    const f35=await js(VIS('__ROW__').replace(`document.querySelector('[data-caveat="__ROW__"]')`,`[...document.querySelectorAll("#roster .ac")].find(n=>n.querySelector(".ac-nm").textContent.startsWith("F-35C"))`));
    assert.equal(f35,'ok','F-35C roster row visible on screen ('+tag+'): '+f35);
    assert.equal(await js('(()=>{const n=[...document.querySelectorAll("#roster .ac")].find(n=>n.querySelector(".ac-nm").textContent.startsWith("F-35C")),t=n&&n.querySelector(".ac-note"),r=t&&t.getBoundingClientRect(),cs=t&&getComputedStyle(t);return !!t&&t.innerText.includes("Combat radius 600 nm (program current estimate = threshold); 667 nm demonstrated.")&&r.width>40&&r.height>8&&r.top>=0&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1&&cs.visibility==="visible"&&cs.display!=="none";})()'),true,'F-35C demonstrated label visible in the roster row ('+tag+')');
    console.log('PASS v3.4 F-35C roster row visible on screen with "600 nm (program current estimate = threshold); 667 nm demonstrated" ('+tag+')');checks+=2;await shot('v34-roster-f35c-'+tag);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await js('scrollTo(0,0)');
  // Deck-load step (v3.3.1): with a CCA mode on, the tour's CCX-1 row is ON SCREEN (below the sticky watch panel, inside the
  // viewport) when the dwell arms, desktop and 390-px phone; the spot bar carries their segment; the explainer opens with the deck
  // summary and names the swap. Off: none of it.
  const toWing='new Promise((resolve,reject)=>{const end=Date.now()+15000;function f(){const a=__airbossTest;if(a.watchState.phase==="scenario"&&a.watchPacing.ctx.running)a.watchPacing.next();if(a.watchState.phase==="wing"&&a.watchPacing.ctx.running)return resolve();if(Date.now()>end)return reject(Error("wing timeout"));setTimeout(f,50)}f()})';
  for(const [vw,vh,tag] of [[1440,1000,'desktop'],[390,844,'phone']]){
    await send('Emulation.setDeviceMetricsOverride',{width:vw,height:vh,deviceScaleFactor:1,mobile:tag==='phone'});
    for(const [mode,key,rx,say] of [['cap','ccxcap','CCX-1 on CAP',' CCX-1 CCAs fly CAP'],['strike','ccx','CCX-1 Carrier CCA',' CCX-1 CCAs fly strike']])
      for(const seed of ['tour-0-11491','tour-1-13234','tour-10-6114']){
        await js('__airbossTest.stopWatch();__airbossTest.watchSetMode("'+mode+'");__airbossTest.watchPacing.setPace("relaxed");__airbossTest.startWatch('+JSON.stringify(seed)+');true');
        await js(toWing);
        await check('(()=>{const a=__airbossTest,n=a.st.alloc.'+key+'||0,P=document.getElementById("watch-panel"),p=P.getBoundingClientRect(),top=getComputedStyle(P).position==="sticky"?Math.max(0,p.bottom):0;const row=[...document.querySelectorAll("#roster .ac")].find(r=>r.querySelector(".ac-nm").textContent.startsWith("'+rx+'"));if(!row||n<=0)return false;const b=row.getBoundingClientRect(),x=document.getElementById("watch-explainer");return b.top>=top-1&&b.bottom<=innerHeight+1&&row.querySelector(".n").textContent===String(n)&&x.textContent.startsWith("Deck: ")&&x.textContent.includes(n+"'+say+'")&&!!document.querySelector("#spotbar i[title^=CCX-1]");})()','Deck-load step '+mode+' '+seed+' ('+tag+'): the CCX-1 row is on screen with its count, the explainer opens with the deck summary and names the swap, the spot bar shades them');
        if(seed==='tour-0-11491')await shot('watch-roster-'+mode+'-'+tag);
      }
  }
  await js('__airbossTest.stopWatch();__airbossTest.watchSetMode("off");__airbossTest.watchPacing.setPace("relaxed");__airbossTest.startWatch("tour-0-11491");true');
  await js(toWing);
  await check('![...document.querySelectorAll("#roster .grp.tour-cca")].length&&!document.querySelector("#spotbar i[title^=CCX-1]")&&!/CCX-1|^Deck: /.test(document.getElementById("watch-explainer").textContent)','Deck-load step Off: no CCA group, segment or explainer mention');
  await js('__airbossTest.stopWatch();__airbossTest.watchSetMode("cap");true');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await shot('watch-transport-desktop');
  assert.deepEqual(errors,[],'zero console/page errors');assert.deepEqual(requests,[],'zero network dependencies');
  console.log('LIVE UI PASS: '+checks+' checks; zero console/page errors; zero HTTP requests');
 }finally{for(const p of pending.values())clearTimeout(p.timer);ws.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
