/* Verify fail-closed release sequencing, using isolated suite stand-ins. */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const cp = require('node:child_process'), assert = require('node:assert/strict');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'airboss-release-'));
try {
  fs.copyFileSync(path.join(__dirname, 'air_boss_release_check.cjs'), path.join(tmp, 'air_boss_release_check.cjs'));
  const stub = "const fs=require('node:fs'); const key=process.argv[1].endsWith('.test.js')?process.env.AIR_BOSS_HTML:'display'; fs.appendFileSync('calls',key+String.fromCharCode(10)); if(process.env.FAIL_STEP===key)process.exit(7);";
  for (const file of ['air_boss_accept.test.js', 'air_boss_display_binding.test.cjs']) fs.writeFileSync(path.join(tmp,file),stub);
  const steps = ['air_boss.html','air_boss_public.html','display'];
  for (const fail of ['', ...steps]) {
    fs.writeFileSync(path.join(tmp,'calls'),'');
    const r = cp.spawnSync(process.execPath,['air_boss_release_check.cjs'],{cwd:tmp,encoding:'utf8',env:{...process.env,FAIL_STEP:fail,AIR_BOSS_HTML:'wrong-parent-value'}});
    if(r.error)throw r.error;
    assert.equal(r.status, fail ? 7 : 0, r.stderr);
    assert.equal(r.stdout.includes('RELEASE CHECK PASSED'),!fail);
    assert.deepEqual(fs.readFileSync(path.join(tmp,'calls'),'utf8').trim().split('\n'),fail?steps.slice(0,steps.indexOf(fail)+1):steps);
  }
  fs.unlinkSync(path.join(tmp,'air_boss_accept.test.js'));
  const missing=cp.spawnSync(process.execPath,['air_boss_release_check.cjs'],{cwd:tmp,encoding:'utf8'});
  assert.notEqual(missing.status,0);
  assert(!missing.stdout.includes('RELEASE CHECK PASSED'));
  console.log('PASS: success, each red step, missing suite, inherited build override.');
} finally {
  assert.equal(path.dirname(tmp),os.tmpdir());
  assert(path.basename(tmp).startsWith('airboss-release-'));
  fs.rmSync(tmp,{recursive:true,force:true});
}
