/* RockWorx Air Boss local release validation. Does not publish.
 * Runs every suite against BOTH distributions (air_boss.html and air_boss_public.html); halts on the first missing or
 * red suite with exit status 1 (fail-closed). Suites run without a named build test every build present.
 */
'use strict';
const cp = require('node:child_process'), fs = require('node:fs'), path = require('node:path');
function run(suite, html) {
  console.log('RELEASE CHECK: ' + suite + (html ? ' / ' + html : ' / both builds'));
  if (!fs.existsSync(path.join(__dirname, suite))) { console.error('RELEASE BLOCKED: missing suite ' + suite); process.exit(1); }
  const result = cp.spawnSync(process.execPath, [suite], {
    cwd: __dirname, stdio: 'inherit',
    env: {...process.env, AIR_BOSS_HTML: html || ''}
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error('RELEASE BLOCKED: ' + suite + (html ? ' / ' + html : ''));
    process.exit(result.status || 1);
  }
}
// 1. Acceptance baseline (crewed + logistics)
run('air_boss_accept.test.js', 'air_boss.html');
run('air_boss_accept.test.js', 'air_boss_public.html');
// 2. Logistics & tempo suite (Tests L1-L12)
run('air_boss_logistics.test.cjs', 'air_boss.html');
run('air_boss_logistics.test.cjs', 'air_boss_public.html');
// 3. CCA Designer physics & economics (Tests D1-D12 + engine integration)
run('air_boss_designer.test.cjs', 'air_boss.html');
run('air_boss_designer.test.cjs', 'air_boss_public.html');
// 4. Display binding & mutation controls (both builds inside)
run('air_boss_display_binding.test.cjs');
// 5. Guided tour adaptive pacing & transport controls (Test D13; both builds)
run('air_boss_tour_pacing.test.cjs');
// 6. Discriminatory physical closure gates (both builds)
run('air_boss_discriminatory_gates.test.cjs');
console.log('RELEASE CHECK PASSED: acceptance, logistics, designer, display / mutation, tour pacing and closure-gate suites on both builds. Other release approvals still required.');
