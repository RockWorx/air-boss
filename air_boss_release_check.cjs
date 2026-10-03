/* RockWorx Air Boss local release validation. Does not publish. */
'use strict';
const cp = require('node:child_process');
function run(suite, html) {
  console.log('RELEASE CHECK: ' + suite + (html ? ' / ' + html : ''));
  const result = cp.spawnSync(process.execPath, [suite], {
    cwd: __dirname, stdio: 'inherit',
    env: {...process.env, AIR_BOSS_HTML: html || 'air_boss.html'}
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error('RELEASE BLOCKED: ' + suite);
    process.exit(result.status || 1);
  }
}
run('air_boss_accept.test.js', 'air_boss.html');
run('air_boss_accept.test.js', 'air_boss_public.html');
run('air_boss_display_binding.test.cjs');
console.log('RELEASE CHECK PASSED: engine and display suites. Other release approvals still required.');
