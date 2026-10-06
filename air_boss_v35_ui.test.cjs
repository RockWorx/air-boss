/* RockWorx Air Boss v3.5 live Chromium viewport and negative controls. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
 const endpoint=process.env.CDP_ENDPOINT||'http://127.0.0.1:9347',tabs=await(await fetch(endpoint+'/json')).json(),tab=tabs.find(t=>t.type==='page');assert(tab);
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let seq=0,pending=new Map(),errors=[],requests=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push('console.error');else if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url))requests.push(m.params.request.url);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const file=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['http://*','https://*']});
 function visible(id){return `(()=>{const n=document.getElementById(${JSON.stringify(id)}),r=n.getBoundingClientRect(),c=getComputedStyle(n);return r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&c.display!=='none'&&c.visibility!=='hidden'&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===n;})()`;}
 for(const [width,height] of [[1440,1000],[390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await send('Page.navigate',{url:pathToFileURL(file).href});await new Promise(r=>setTimeout(r,600));assert(await js('!!window.__airbossTest'));
  await js("__airbossTest.startWatch('tour-0-11491');__airbossTest.watchPacing.togglePause()");await new Promise(r=>setTimeout(r,150));
  for(const id of ['deck-helo-badge','aew-relief-status','formation-slack']){assert(await js(visible(id)),id+' visible '+width);console.log('PASS visible '+id+' '+width);}
  const pic=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,path.basename(file)+'-'+width+'-deck.png'),Buffer.from(pic.data,'base64'));
  for(let step=0;step<3;step++){await js('__airbossTest.watchPacing.next()');await new Promise(r=>setTimeout(r,150));for(const id of ['deck-helo-badge','aew-relief-status','formation-slack'])assert(await js(visible(id)),id+' visible at tour step '+(step+2)+' / '+width);}
  await js("document.getElementById('deck-helo-badge').style.display='none'");assert.equal(await js(visible('deck-helo-badge')),false);console.log('KILLED M-UI-01 '+width);
  await js("document.getElementById('aew-relief-status').style.transform='translateX(5000px)'");assert.equal(await js(visible('aew-relief-status')),false);console.log('KILLED M-UI-02 '+width);
  await js("__airbossTest.stopWatch();__airbossTest.logistics.setView('logistics');document.getElementById('cod-status-row').scrollIntoView({block:'center'})");
  assert(await js(visible('cod-status-row')),'COD visible '+width);assert(await js("document.getElementById('cod-status-row').textContent.includes('air link active')"));
  await js("const n=document.getElementById('logi-transit');n.value=1200;n.dispatchEvent(new Event('input',{bubbles:true}))");
  assert(await js("document.getElementById('cod-status-row').textContent.includes('air link severed')"),'COD control binding');
  const cod=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,path.basename(file)+'-'+width+'-cod.png'),Buffer.from(cod.data,'base64'));
  await js("document.getElementById('aew-refueled').click()");assert(await js("__airbossTest.st.aewRefueled&&__airbossTest.logistics.getState().aewRefueled&&__airbossTest.logistics.solve().bill.aewGasLb===22000"),'AEW checkbox wires both ledgers');
  await js("const s=document.getElementById('logi-clf');s.value='supply';s.dispatchEvent(new Event('change',{bubbles:true}))");assert(await js("__airbossTest.logistics.solve().pipe.speed===25&&document.getElementById('logi-cards').textContent.includes('T-AOE 6 Supply')"),'fast CLF selector wires solver and display');
  await js("document.getElementById('cod-status-row').style.display='none'");assert.equal(await js(visible('cod-status-row')),false);console.log('KILLED COD-hidden control '+width);
  console.log('PASS COD viewport/control '+width);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await send('Network.setBlockedURLs',{urls:[]});ws.close();console.log('V35 UI PASS '+path.basename(file));
})().catch(e=>{console.error(e);process.exit(1);});
