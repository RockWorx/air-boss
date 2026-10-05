/* Air Boss v3.3 / v3.4 discriminatory closure-gate suite (v3.4: C_L,app 1.10; length-augmented spot <= 0.75) (spec 4.4, 7.1, 10.4, 13 Gate 6): PASS and FAIL fixtures for every
 * gate (each failure isolated from the other three), the injected spot-ceiling branch, non-finite input guards and
 * unclosed-airframe zero-effect assertions. Executes the SHIPPED engine via window.__airbossTest.
 * Run: node air_boss_discriminatory_gates.test.cjs [build.html]   (no argument: every build present; exit 0 = PASS)
 */
'use strict';
const path = require('node:path');
const { builds, loadEngine, suite } = require('./air_boss_test_loader.cjs');
let bad = 0;
for (const html of builds()) {
  const S = suite('GATE SUITE'), ok = S.ok, near = S.near, group = S.group;
  const { T } = loadEngine(html, { reduce: true });
  const D = T.designer, def = () => JSON.parse(JSON.stringify(D.DEFAULTS));
  const design = (o, opt) => D.evaluate(Object.assign(def(), o || {}), opt);
  const failing = g => ['approach', 'thrust', 'volume', 'deck'].filter(k => !g[k].pass);
  console.log('== ' + path.basename(html));

  group('GATE_APPROACH', () => {
    const pass = D.evaluateGates({ vpa: D.vpa(12272.1, 285), dt: .5, fuel: 5000, fuelMax: 5620, bFolded: 25.5, spot: .7 });
    ok(near(D.vpa(12272.1, 285), 107.48, .05) && pass.approach.pass && near(pass.approach.margin, 27.5, .05), 'PASS W_land 12,272.1 lb at 285 sq ft: 107.5 kt (+27.5)');
    const fail = D.evaluateGates({ vpa: D.vpa(14000, 150), dt: .5, fuel: 5000, fuelMax: 5620, bFolded: 25.5, spot: .7 });
    ok(!fail.approach.pass && near(fail.approach.value - 135, 23.31, .005) && JSON.stringify(failing(fail)) === '["approach"]' && fail.bindingGate === 'GATE_APPROACH', 'FAIL W_land 14,000 lb at 150 sq ft: 158.31 kt (+23.31), only GATE_APPROACH fails');
    const b = D.evaluateGates({ vpa: 135, dt: .5, fuel: 1, fuelMax: 1, bFolded: 38, spot: .75 });
    ok(b.doesClose, 'equality on every limit closes (135.0 kt, D/T 0.85-, fuel = capacity, 38.0 ft, 0.75 spots)');
    const phys = design({ engineClass: 'light', wingArea: 150, payload: 6000, fuel: 4000, ingressMach: .60 });
    ok(!phys.gates.approach.pass && phys.gates.volume.pass && phys.gates.deck.pass, 'reachable design fails approach while volume and deck pass');
  });

  group('GATE_THRUST', () => {
    const pass = design({ engineClass: 'mid', wingArea: 285, ingressMach: .80 });
    ok(pass.gates.thrust.pass && near(pass.DT, .482, .001) && near((.85 - pass.DT) * 100, 36.8, .05), 'PASS Mid / 285 sq ft / M0.80: D/T 0.482 (+36.8%)');
    const fail = design({ engineClass: 'light', wingArea: 380, payload: 2000, fuel: 4560, ingressMach: .82 });
    ok(!fail.gates.thrust.pass && near(fail.DT, 1.397, .002) && near((fail.DT - .85) * 100, 54.7, .1) && JSON.stringify(failing(fail.gates)) === '["thrust"]', 'FAIL Light / 380 sq ft / M0.82: D/T 1.397 (+54.7%), only GATE_THRUST fails');
    ok(D.evaluateGates({ vpa: 100, dt: .8500001, fuel: 1, fuelMax: 2, bFolded: 30, spot: .8 }).thrust.pass === false && D.evaluateGates({ vpa: 100, dt: .85, fuel: 1, fuelMax: 2, bFolded: 30, spot: .8 }).thrust.pass, 'D/T boundary: 0.85 passes, 0.8500001 fails');
  });

  group('GATE_VOLUME', () => {
    const pass = design({ wingArea: 285, fuel: 5620 });
    ok(pass.gates.volume.pass && pass.fuelMax === 5620 && pass.doesClose, 'PASS 285 sq ft, 5,620 lb = 5,620 lb capacity (100% full, closed)');
    const fail = design({ wingArea: 285, fuel: 8000 }, { raw: true });
    ok(!fail.gates.volume.pass && near(fail.gates.volume.value - fail.gates.volume.limit, 2380, 1e-9) && fail.gates.approach.pass && fail.gates.thrust.pass && JSON.stringify(failing(fail.gates)) === '["volume"]', 'FAIL 285 sq ft, 8,000 lb: -2,380 lb deficit; approach and thrust pass, volume strictly fails');
    const slider = design({ wingArea: 285, fuel: 8000 });
    ok(slider.W_fuel === 7600 && !slider.gates.volume.pass, 'slider domain clamps fuel to 7,600 lb, still a volume failure at 285 sq ft');
    ok(near(design({ fuel: 7600 }).sMinVol, 450, 1e-9) && design({ wingArea: 450, fuel: 7600 }).gates.volume.pass, 'fuel slider max 7,600 lb = capacity of the 450-sq-ft wing');
  });

  group('GATE_DECK', () => {
    const pass = design({ engineClass: 'light', wingArea: 450 });
    ok(pass.gates.deck.pass && near(pass.bFolded, 31.26, .01) && near(pass.deckSpotFactor, 42.7 * pass.bFolded / 1792, 1e-9) && near(pass.deckSpotFactor, .745, .001), 'PASS light engine at the 450-sq-ft slider max: 42.7 ft x 31.26 ft folded = 0.745 spots');
    const heavy = design({ engineClass: 'heavy', wingArea: 450 });
    ok(!heavy.gates.deck.pass && near(heavy.deckSpotFactor, .795, .001) && JSON.stringify(failing(heavy.gates)) === '["deck"]' && heavy.bindingGate === 'GATE_DECK', 'FAIL heavy core at 450 sq ft: 0.795 spots > 0.75, only GATE_DECK fails (reachable inside the sliders)');
    const span = design({ wingArea: 450 }, { fold: false });
    ok(!span.gates.deck.pass && near(span.bFolded, 43.47, .01) && span.gates.deck.message === 'GATE_DECK: Span 43.5 ft exceeds 38.0 ft elevator limit' && JSON.stringify(failing(span.gates)) === '["deck"]', 'FAIL no-fold malfunction at 450 sq ft: "' + span.gates.deck.message + '"');
    const spot = D.evaluateGates({ vpa: 100, dt: .5, fuel: 1, fuelMax: 2, bFolded: 30.0, spot: .800 });
    ok(!spot.deck.pass && spot.deck.message === 'GATE_DECK: Spot factor 0.800 exceeds 0.75 limit (30.0 ft folded span; 4 CCAs must fit in 3 spots)' && !spot.doesClose && spot.bindingGate === 'GATE_DECK', 'FAIL injected spot 0.800 with compliant 30.0-ft span: spot branch live and independent');
    const giant = design({ wingArea: 650 }, { raw: true, fold: false });
    ok(!giant.gates.deck.pass && near(giant.bFolded, 52.25, .01) && giant.gates.deck.message === 'GATE_DECK: Span 52.2 ft exceeds 38.0 ft elevator limit' && giant.deckSpotFactor > .75, 'FAIL out-of-domain 650 sq ft unfolded: span 52.25 ft fails first (spot ' + giant.deckSpotFactor.toFixed(3) + ' is also over)');
    const spanArea = Math.pow((38 - 3) / .65, 2) / 4.2;
    ok(['light', 'mid', 'heavy'].every(e => D.deckMaxArea(e) < spanArea && near(D.spotFactor(e, D.deckMaxArea(e)), .75, 1e-9)), 'with folding wings the spot ceiling, not the 38-ft span (' + spanArea.toFixed(0) + ' sq ft), sets the largest deck-legal wing for every engine');
  });

  group('non-finite input guards (fail closed)', () => {
    [['vpa', NaN], ['dt', Infinity], ['fuel', NaN], ['fuelMax', undefined], ['bFolded', -Infinity], ['spot', NaN]].forEach(([k, v]) => {
      const m = { vpa: 100, dt: .5, fuel: 1, fuelMax: 2, bFolded: 30, spot: .8 }; m[k] = v;
      const g = D.evaluateGates(m);
      ok(!g.doesClose && typeof g.bindingGate === 'string', 'non-finite ' + k + ' fails closed (binding ' + g.bindingGate + ')');
    });
    const d = design({ wingArea: NaN, fuel: 'lots', ingressMach: Infinity, payload: null });
    ok(d.doesClose && d.S === 285 && d.W_fuel === 5620 && d.M === .8 && d.W_payload === 2000, 'non-finite designer inputs sanitized to the closing defaults');
    ok(D.costPerEffect(NaN, 800, 1, true) === Infinity && D.costPerEffect(20, NaN, 1, true) === Infinity && D.costPerEffect(20, 800, 0, true) === Infinity, 'cost per effect with non-finite or zero inputs is infinite, never a number');
    T.st.custom = { engineClass: 'mid', wingArea: 'x', ingressMach: NaN, payload: -5, fuel: 1e9, buyQty: Infinity, surv: NaN, doctrine: 7 };
    const r = T.evalWing(500, { fa18: 12, custom: 4, mq25: 4 });
    ok(Number.isFinite(r.effects) && r.effects >= 0 && Number.isFinite(r.cost) && T.st.custom.wingArea === 285 && T.st.custom.fuel === 7600 && T.st.custom.payload === 1000 && T.CAT.custom.doesClose === T.syncCustom().doesClose, 'evalWing with a malformed saved design stays finite (migrated: defaults + clamps)');
    T.st.custom = def();
  });

  group('unclosed airframe zero effect (every gate)', () => {
    const cases = [
      ['approach', { engineClass: 'light', wingArea: 150, payload: 6000, fuel: 4000, ingressMach: .60 }],
      ['thrust', { engineClass: 'light', wingArea: 380, payload: 2000, fuel: 4560, ingressMach: .82 }],
      ['volume', { wingArea: 285, fuel: 7600 }]
    ];
    cases.forEach(([gate, p]) => {
      T.st.custom = Object.assign(def(), p);
      const d = T.syncCustom(), r = T.evalWing(500, { fa18: 10, custom: 8, mq25: 4, cap: 4 }), x = r.byType.filter(y => y.key === 'custom')[0];
      ok(!d.doesClose && !d.gates[gate].pass && x.ss === 0 && x.primaryEffect + x.fallbackEffect === 0 && r.customEffect === 0 && r.customCostPerEffect === Infinity && T.objVal(r, 30) === -Infinity, 'unclosed by ' + gate + ': 0 sorties, 0 effect, infinite cost per effect, fitness -Infinity');
    });
    T.st.custom = def();
  });
  bad += S.done(path.basename(html));
}
console.log(bad ? 'GATE SUITE FAILED' : 'GATE SUITE PASSED: four discriminatory closure gates, guards and zero-effect');
process.exitCode = bad ? 1 : 0;
