/* Air Boss v3.2 logistics suite (normative tests L1-L12 plus the Logistics view binding checks).
 * The checks live in air_boss_accept.test.js so the release check runs them on both builds; this entry point runs
 * that suite against the SHIPPED engine and fails unless every L1-L12 group is present and green.
 * Run: node air_boss_logistics.test.cjs [air_boss_public.html]     (exit 0 = PASS)
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=process.argv[2]||process.env.AIR_BOSS_HTML||'air_boss.html';
const lines=[];
const context={require,__dirname,console:{log(s){lines.push(String(s));}},process:{env:{AIR_BOSS_HTML:html},exitCode:0}};
vm.createContext(context);
const harness=path.join(__dirname,'air_boss_accept.test.js');
vm.runInContext(fs.readFileSync(harness,'utf8'),context,{filename:harness});
const rows=lines.map(s=>s.match(/^\s*(PASS|FAIL)\s+(L(\d+|\s?UI)\b.*)$/)).filter(Boolean);
let bad=0;
for(let n=1;n<=12;n++){
  const group=rows.filter(m=>m[3]===String(n));
  const pass=group.filter(m=>m[1]==='PASS').length,fail=group.length-pass;
  console.log(('L'+n).padEnd(4)+(fail||!pass?'FAIL':'PASS')+'  '+pass+' passed, '+fail+' failed');
  if(fail||!pass)bad++;
}
const ui=rows.filter(m=>/^\s?UI$/.test(m[3])),uiFail=ui.filter(m=>m[1]==='FAIL').length;
console.log('L UI '+(uiFail||!ui.length?'FAIL':'PASS')+'  '+(ui.length-uiFail)+' passed, '+uiFail+' failed');
if(uiFail||!ui.length)bad++;
console.log('engine suite ('+html+'): '+context.checks+' checks, '+context.failures.length+' failures');
if(context.failures.length)bad++;
console.log(bad?'LOGISTICS SUITE FAILED':'LOGISTICS SUITE PASSED: L1-L12 and Logistics view binding');
process.exitCode=bad?1:0;
