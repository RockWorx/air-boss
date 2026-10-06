/* Verify fail-closed release sequencing, using isolated suite stand-ins. */
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const cp = require('node:child_process'), assert = require('node:assert/strict');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'airboss-release-'));
try {
  fs.copyFileSync(path.join(__dirname, 'air_boss_release_check.cjs'), path.join(tmp, 'air_boss_release_check.cjs'));
  const stub = "const fs=require('node:fs'),path=require('node:path'); const key=path.basename(process.argv[1]).split('.')[0]+':'+(process.env.AIR_BOSS_HTML||'both'); fs.appendFileSync('calls',key+String.fromCharCode(10)); if(process.env.FAIL_STEP===key)process.exit(7);";
  const suites = ['air_boss_accept.test.js', 'air_boss_logistics.test.cjs', 'air_boss_designer.test.cjs', 'air_boss_display_binding.test.cjs', 'air_boss_tour_pacing.test.cjs', 'air_boss_discriminatory_gates.test.cjs', 'air_boss_content.test.cjs', 'air_boss_model_honesty.test.cjs', 'air_boss_v35.test.cjs'];
  for (const file of suites) fs.writeFileSync(path.join(tmp, file), stub);
  const steps = ['air_boss_accept:air_boss.html', 'air_boss_accept:air_boss_public.html', 'air_boss_logistics:air_boss.html', 'air_boss_logistics:air_boss_public.html',
    'air_boss_designer:air_boss.html', 'air_boss_designer:air_boss_public.html', 'air_boss_display_binding:both', 'air_boss_tour_pacing:both', 'air_boss_discriminatory_gates:both', 'air_boss_content:both', 'air_boss_model_honesty:both', 'air_boss_v35:both'];
  for (const fail of ['', ...steps]) {
    fs.writeFileSync(path.join(tmp, 'calls'), '');
    const r = cp.spawnSync(process.execPath, ['air_boss_release_check.cjs'], {cwd: tmp, encoding: 'utf8', env: {...process.env, FAIL_STEP: fail, AIR_BOSS_HTML: 'wrong-parent-value'}});
    if (r.error) throw r.error;
    assert.equal(r.status, fail ? 7 : 0, r.stderr);
    assert.equal(r.stdout.includes('RELEASE CHECK PASSED'), !fail);
    assert.deepEqual(fs.readFileSync(path.join(tmp, 'calls'), 'utf8').trim().split('\n'), fail ? steps.slice(0, steps.indexOf(fail) + 1) : steps);
  }
  for (const gone of suites) {
    fs.writeFileSync(path.join(tmp, 'calls'), '');
    fs.renameSync(path.join(tmp, gone), path.join(tmp, gone + '.off'));
    const missing = cp.spawnSync(process.execPath, ['air_boss_release_check.cjs'], {cwd: tmp, encoding: 'utf8'});
    assert.equal(missing.status, 1, 'missing ' + gone);
    assert(!missing.stdout.includes('RELEASE CHECK PASSED') && missing.stderr.includes('missing suite ' + gone));
    fs.renameSync(path.join(tmp, gone + '.off'), path.join(tmp, gone));
  }
  console.log('PASS: success, each of 12 red steps, each of 9 missing suites, inherited build override.');
} finally {
  assert.equal(path.dirname(tmp), os.tmpdir());
  assert(path.basename(tmp).startsWith('airboss-release-'));
  fs.rmSync(tmp, {recursive: true, force: true});
}
