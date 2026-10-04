/* Air Boss v3.3 "Your Design" CCA designer suite -- normative tests D1-D12 plus engine-integration checks
 * (doctrine scheduler with finite tanker sorties and deferred re-entry, CAT adapters, state migration, fail-closed
 * exclusion, Auto-Boss, price vs value, display binding, Gouge figures). Every value is produced by the SHIPPED
 * engine through window.__airbossTest; nothing is re-implemented here.
 * Run: node air_boss_designer.test.cjs [air_boss_public.html]   (no argument: every build present; exit 0 = PASS)
 */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { builds, loadEngine, suite } = require('./air_boss_test_loader.cjs');
let bad = 0;
for (const html of builds()) {
  const S = suite('DESIGNER SUITE'), ok = S.ok, near = S.near, group = S.group;
  const { T, el, source } = loadEngine(html, { reduce: true });
  const D = T.designer, def = () => JSON.parse(JSON.stringify(D.DEFAULTS));
  const design = o => D.evaluate(Object.assign(def(), o || {}));
  const raw = (o, opt) => D.evaluate(Object.assign(def(), o || {}), Object.assign({ raw: true }, opt || {}));
  console.log('== ' + path.basename(html));

  group('D1 engine class and installed lapse', () => {
    const sig = D.densityRatio(30000);
    ok(near(sig, .3741, .005), 'D1 density ratio at 30,000 ft ' + sig.toFixed(5) + ' = 0.3741 +/- 0.005');
    ok(near(Math.pow(sig, .85), .4320, .005), 'D1 density lapse term ' + Math.pow(sig, .85).toFixed(5) + ' = 0.4320 +/- 0.005');
    ok(near(1 - .20 * .75, .85, 1e-12) && D.C.etaInstall === .92 && D.C.lapseSlope === .20, 'D1 Mach momentum lapse 0.85 at M0.75; installation efficiency 0.92');
    const t = D.thrustAvail('mid', 30000, .75);
    ok(Math.abs(t - 2872) / 2872 <= .015 && near(t, 2881.9, 1), 'D1 Mid T_avail ' + t.toFixed(1) + ' lbf = 2,872 +/- 1.5% (exact 2,881.9)');
    ok(D.ENGINES.light.tsls === 4200 && D.ENGINES.mid.tsls === 8500 && D.ENGINES.heavy.tsls === 16500 &&
      D.ENGINES.light.weight === 850 && D.ENGINES.mid.weight === 1650 && D.ENGINES.heavy.weight === 2750 &&
      D.ENGINES.light.tsfc === .64 && D.ENGINES.mid.tsfc === .72 && D.ENGINES.heavy.tsfc === .82, 'D1 three generic dry engine classes: thrust, weight, TSFC per table 3.1');
    ok(D.thrustAvail('light', 30000, .88) < D.thrustAvail('light', 30000, .60), 'D1 net thrust falls as Mach rises (inlet momentum drag)');
  });

  group('D2 discrete engine pricing and NRE amortization', () => {
    [[50, 8.60], [150, 5.27], [500, 4.10]].forEach(([q, v]) => {
      const u = D.engineUnitCost('mid', q);
      ok(near(u, v, .005), 'D2 Mid engine unit cost at Q=' + q + ': $' + u.toFixed(4) + 'M = $' + v.toFixed(2) + 'M');
    });
    ok(D.ENGINES.light.price === 1.80 && D.ENGINES.mid.price === 3.60 && D.ENGINES.heavy.price === 6.80 &&
      D.ENGINES.light.nre === 120 && D.ENGINES.mid.nre === 250 && D.ENGINES.heavy.nre === 600, 'D2 hardware price and NRE per table 3.1');
    ok(near(D.engineUnitCost('heavy', 50) - 6.80, 12.0, 1e-9) && near(D.engineUnitCost('heavy', 300) - 6.80, 2.0, 1e-9), 'D2 heavy core: +$12.0M per aircraft at 50, +$2.0M at 300');
    const d = design({ buyQty: 50 }), d2 = design({ buyQty: 500 });
    ok(near(d.costs.flyaway, d2.costs.flyaway, 1e-12) && d.costs.apuc > d2.costs.apuc, 'D2 NRE moves APUC, never recurring flyaway');
  });

  group('D3 carrier approach speed limit', () => {
    [[150, 145.62, false], [220, 120.24, true], [280, 106.58, true]].forEach(([s, v, pass]) => {
      const x = D.vpa(14000, s);
      ok(near(x, v, .01) && (x <= 135) === pass, 'D3 W_land 14,000 lb at ' + s + ' sq ft: V_PA ' + x.toFixed(3) + ' kt = ' + v + (pass ? ' PASS (margin ' + (135 - x).toFixed(2) + ')' : ' FAIL'));
    });
    ok(near(D.sMinLanding(14000), 174.53, .1), 'D3 minimum closing wing area ' + D.sMinLanding(14000).toFixed(3) + ' = 174.53 +/- 0.1 sq ft');
    ok(near(D.C.wlandPerS, 80.2144, 1e-4), 'D3 coupled approach coefficient 80.2144 lb per sq ft');
  });

  group('D4 high-speed ingress drag and thrust margin', () => {
    const d = raw({ engineClass: 'light', wingArea: 380, payload: 2000, fuel: 4560, ingressMach: .82 });
    ok(Math.abs(d.T - 1401) / 1401 <= .015 && near(d.T, 1400.6, 1), 'D4 T_avail ' + d.T.toFixed(1) + ' = 1,401 +/- 1.5%');
    ok(Math.abs(d.D - 1956) / 1956 <= .015 && near(d.D, 1956.4, 1), 'D4 ingress drag ' + d.D.toFixed(1) + ' = 1,956 +/- 1.5%');
    ok(near(d.DT, 1.397, .002) && !d.gates.thrust.pass && d.gates.thrust.code === 'GATE_THRUST', 'D4 D/T ' + d.DT.toFixed(4) + ' = 1.397 > 0.85 FAIL (GATE_THRUST)');
    ok(near(d.CD0 + d.CDi + d.CDwave, d.CD, 1e-15) && d.CDwave > 0 && d.CDi > 0 && d.CD0 > 0, 'D4 drag built up term by term: CD0 + CDi + wave');
    ok(near(D.waveDrag(.78), .00125, 1e-9) && near(D.waveDrag(.80), .0029630, 1e-6) && near(D.waveDrag(.82), .0057870, 1e-6) && near(D.waveDrag(.88), .0237037, 1e-6) && D.waveDrag(.72) === 0, 'D4 wave drag 12.5 / 29.6 / 57.9 / 237.0 counts at M .78 / .80 / .82 / .88; zero at M_crit');
    ok(near(D.C.K, 1 / (Math.PI * 4.2 * .82), 1e-15) && near(D.C.K, .09242, 1e-5), 'D4 induced factor K = 1 / (pi AR e) = 0.09242');
  });

  group('D5 pinch detection (infeasible envelope)', () => {
    const p = { engineClass: 'light', payload: 4000, fuel: 4500, ingressMach: .82 };
    const d = design(Object.assign({ wingArea: 285 }, p));
    ok(near(d.sMinApp, 143, .3), 'D5 S_min,app ' + d.sMinApp.toFixed(2) + ' = 143 sq ft');
    let minDT = Infinity; for (let s = 150; s <= 450; s += .5) minDT = Math.min(minDT, raw(Object.assign({ wingArea: s }, p)).DT);
    ok(minDT >= .926 - 5e-4 && minDT > .85, 'D5 thrust fails across 150-450 sq ft: min D/T ' + minDT.toFixed(4) + ' >= 0.926');
    ok(near(raw(Object.assign({ wingArea: 120 }, p)).DT, .887040, 5e-6), 'D5 at 120 sq ft D/T ' + raw(Object.assign({ wingArea: 120 }, p)).DT.toFixed(6) + ' = 0.887040 > 0.85');
    ok(d.thrustWindow === null && d.sMaxThrust === null && d.pinchedOut && !d.doesClose && d.feasible === null, 'D5 thrust set empty, S_max,thrust empty, PINCHED OUT, does not close');
    ok(d.statusText.indexOf('PINCHED OUT: No feasible wing area satisfies approach speed and high-speed thrust simultaneously') >= 0, 'D5 pinched-out message');
  });

  group('D6 keep-up vs early launch offset; Event-1 withhold fixture', () => {
    ok(D.launchOffsetMin(500, .80) === 0, 'D6 M0.80: 0.0 min offset (simultaneous push)');
    const dt = D.launchOffsetMin(500, .65);
    ok(near(dt, 14.677486692, 5e-9), 'D6 M0.65 at 500 nm: launch ' + dt.toFixed(9) + ' min early');
    ok(near(D.loiterFuel(12, dt), 13209.738023, 5e-7), 'D6 12 fighters loiter fuel ' + D.loiterFuel(12, dt).toFixed(6) + ' lb');
    const off = T.tankerLedger('mq25', 150, false).offload;
    ok(off === 12500 && D.tankerOffload() === off, 'D6 loiter tanker offload is the shipped MQ-25 ledger at 150 nm: ' + off + ' lb');
    ok(D.tankersRequired(D.loiterFuel(12, dt)) === 2 && D.tankersRequired(D.loiterFuel(11, dt)) === 1, 'D6 required tanker sorties: 12 fighters -> 2; 11 fighters (12,108.9 lb) -> 1');
    const sch = n => D.doctrineSchedule({ events: 5, doctrine: 'early_launch', mach: .65, range: 500, fightersPerEvent: 12, spareTankers: n, nCustom: 4, doesClose: true });
    [0, 1].forEach(n => {
      const s = sch(n), e1 = s.rows[0];
      ok(e1.status === 'withheld' && !e1.customFlies && e1.reason === 'early launch needs 2 tanker sorties of loiter gas; ' + n + ' available', 'D6 ' + n + ' spare -> Event 1 WITHHELD: "' + e1.reason + '"');
      ok(e1.fighterDelayMin === 0 && e1.tankersUsed === 0 && e1.packageFactor === 1 && e1.fighterSurvFactor === 1, 'D6 ' + n + ' spare: crewed fighters push on baseline (0 delay, 0 tanker draw, baseline survivability)');
      ok(s.rows[1].customFlies && s.rows[1].status === 'early_launch' && e1.rejoinEvent === 2 && s.rows[1].tankersUsed === 0, 'D6 ' + n + ' spare: withheld CCA re-enters at Event 2 (early launch in the Event-1 window, no loiter)');
      ok(s.flownEvents === 4 && s.withheldEvents === 1 && near(s.flyFraction, .8, 1e-12), 'D6 ' + n + ' spare: 4 of 5 events flown');
    });
    [2, 3].forEach(n => {
      const s = sch(n), e1 = s.rows[0];
      ok(e1.status === 'early_launch' && e1.customFlies && e1.tankersUsed === 2 && near(e1.fighterDelayMin, dt, 1e-12) && e1.reason === '', 'D6 ' + n + ' spare -> supported: 2 tanker sorties used, fighters hold ' + dt.toFixed(3) + ' min with tanker cover');
      ok(s.flownEvents === 5 && s.tankersUsed === 2, 'D6 ' + n + ' spare: all events flown, finite draw 2');
    });
    const lo = D.doctrineSchedule({ events: 5, doctrine: 'loiter', mach: .65, range: 500, fightersPerEvent: 12, spareTankers: 2, nCustom: 4, doesClose: true });
    const lo0 = D.doctrineSchedule({ events: 5, doctrine: 'loiter', mach: .65, range: 500, fightersPerEvent: 12, spareTankers: 1, nCustom: 4, doesClose: true });
    ok(lo.rows.every(r => r.status === 'loiter' && r.tankersUsed === 2) && lo.tankersUsed === 10 && lo0.flownEvents === 0 && lo0.rows.every(r => r.status === 'withheld' && r.reason === 'push-point loiter needs 2 tanker sorties of loiter gas; 1 available'), 'D6 Option B: 2 tanker sorties every event (10/day); short of gas -> withheld every event');
    const sp = D.doctrineSchedule({ events: 5, doctrine: 'slow_package', mach: .65, range: 500, fightersPerEvent: 12, spareTankers: 0, nCustom: 4, doesClose: true });
    ok(sp.flownEvents === 5 && sp.tankersUsed === 0 && sp.rows.every(r => near(r.packageFactor, 1 - .25 * .15 / .20, 1e-12)), 'D6 Option C: common launch, no tanker draw, package survival x' + (1 - .25 * .15 / .2).toFixed(4));
    ok(D.effectiveDoctrine('keep_up', .65) === 'early_launch' && D.effectiveDoctrine('loiter', .80) === 'keep_up' && D.effectiveDoctrine('slow_package', .86) === 'keep_up', 'D6 doctrine normalization: keep_up below M0.80 -> early_launch; at or above M0.80 -> keep_up');
    const none = D.doctrineSchedule({ events: 5, doctrine: 'early_launch', mach: .65, range: 500, fightersPerEvent: 12, spareTankers: 0, nCustom: 0, doesClose: true });
    const shut = D.doctrineSchedule({ events: 5, doctrine: 'early_launch', mach: .65, range: 500, fightersPerEvent: 12, spareTankers: 0, nCustom: 4, doesClose: false });
    ok([none, shut].every(s => s.rows.every(r => r.fighterDelayMin === 0 && r.tankersUsed === 0 && r.packageFactor === 1 && !r.customFlies)), 'D6 zero participation (no CCAs / unclosed): doctrine has zero effect on the strike package');
  });

  group('D6 actual scheduler in evalWing: withhold, finite tankers, deferred re-entry, both paths', () => {
    function setup() { Object.assign(T.st, { wing: 2, tempo: 0, strike: 'standoff', weapon: 'amraam', targetPosture: 'integrated', threat: null, tankerMode: 'organic', strikeOrbit: 350, relayOrbit: 500, tankerTactics: T.TACTIC_PLANS.balanced, scenario: null }); T.setDeck('nimitz'); }
    setup(); T.st.custom = Object.assign(def(), { ingressMach: .65, doctrine: 'early_launch' });
    const wing = { fa18: 12, f35c: 4, custom: 6, mq25: 4, cap: 6, isr: 2 };
    const run = n => T.evalWing(500, wing, { doctrineFixture: { fightersPerEvent: 12, spareTankers: n } });
    const r0 = run(0), r2 = run(2), r1 = run(1), r3 = run(3), cx = r => r.byType.filter(x => x.key === 'custom')[0];
    const E = r0.events;
    ok(r0.doctrine && r0.doctrine.rows[0].status === 'withheld' && r0.doctrine.reason === 'early launch needs 2 tanker sorties of loiter gas; 0 available', 'D6 evalWing Event 1 / M0.65 / 500 nm / 12 fighters / 0 spare: withheld with the UI reason');
    ok(r1.doctrine.rows[0].status === 'withheld' && r2.doctrine.rows[0].status === 'early_launch' && r3.doctrine.rows[0].status === 'early_launch', 'D6 evalWing availability 0/1 -> withheld; 2/3 -> supported');
    ok(near(cx(r0).ss, cx(r0).ssScheduled * (E - 1) / E, 1e-9) && near(cx(r2).ss, cx(r2).ssScheduled, 1e-9) && cx(r0).ssScheduled > 0, 'D6 evalWing: withheld event removes exactly 1/' + E + ' of the CCA sorties (' + cx(r0).ssScheduled.toFixed(3) + ' -> ' + cx(r0).ss.toFixed(3) + '); re-entry from Event 2 keeps the rest');
    ok(r0.loiterTankerSorties === 0 && r2.loiterTankerSorties === 2 && r3.loiterTankerSorties === 2 && near(r2.tankerSorties - r0.tankerSorties, 2, 1e-9), 'D6 evalWing finite draw: 0 extra tanker sorties when withheld, exactly 2 when supported (counted in deck launches)');
    ok(r0.doctrine.rows[0].fighterDelayMin === 0 && r0.packageFactor === 1 && near(r2.doctrine.rows[0].fighterDelayMin, 14.677486692, 1e-8), 'D6 evalWing: withheld -> crewed push without delay; supported -> fighters hold 14.68 min under tanker cover');
    const f0 = r0.byType.filter(x => x.key === 'fa18')[0], fk = T.evalWing(500, Object.assign({}, wing, { custom: 0 })).byType.filter(x => x.key === 'fa18')[0];
    ok(near(f0.ssScheduled, fk.ssScheduled, 1e-9), 'D6 evalWing: crewed fighter schedule identical to the wing without CCAs (no silent change)');
    // Pinned sortie path (sortiesPerJet) uses the same scheduler.
    const p0 = T.evalWing(500, wing, { sortiesPerJet: 1.5, doctrineFixture: { fightersPerEvent: 12, spareTankers: 0 } });
    ok(near(cx(p0).ss, 6 * 1.5 * (E - 1) / E, 1e-9) && p0.doctrine.rows[0].status === 'withheld', 'D6 pinned path: 9 scheduled -> ' + cx(p0).ss.toFixed(3) + ' (Event 1 withheld)');
    // Finite resources derived from the wing itself (no fixture): idle MQ-25 airframes and deck slack per event.
    setup(); T.st.custom = Object.assign(def(), { ingressMach: .65, doctrine: 'early_launch' });
    const dry = T.evalWing(500, { fa18: 12, custom: 6, cap: 6 });
    ok(dry.doctrine.spareTankers === 0 && dry.doctrine.rows[0].status === 'withheld' && /; 0 available$/.test(dry.doctrine.reason), 'D6 wing with no MQ-25: 0 spare -> Event 1 withheld ("' + dry.doctrine.reason + '")');
    T.st.tankerTactics = T.TACTIC_PLANS.recovery;
    const wet = T.evalWing(500, { fa18: 12, custom: 6, mq25: 6, cap: 6 }), dd = wet.doctrine;
    ok(dd.idleTankers === Math.max(0, Math.floor(6 - dd.mq25PerEvent + 1e-9)) && dd.spareTankers === Math.min(dd.idleTankers, dd.deckSlack), 'D6 spare tanker sorties per event = min(idle MQ-25 ' + dd.idleTankers + ', deck slack ' + dd.deckSlack + ') = ' + dd.spareTankers);
    ok(dd.fightersPerEvent === Math.ceil(dd.crewedPerEvent - 1e-9) && (dd.rows[0].status === 'withheld') === (dd.spareTankers < dd.rows[0].tankersRequired), 'D6 participating fighters per event ' + dd.fightersPerEvent + '; withheld iff spare < required (' + dd.rows[0].tankersRequired + ')');
    // Option B and C through evalWing.
    T.st.custom.doctrine = 'loiter';
    const lb = T.evalWing(500, wing, { doctrineFixture: { fightersPerEvent: 12, spareTankers: 2 } }), lb1 = T.evalWing(500, wing, { doctrineFixture: { fightersPerEvent: 12, spareTankers: 1 } });
    ok(lb.loiterTankerSorties === 2 * E && cx(lb1).ss === 0 && lb1.doctrine.withheldEvents === E && lb1.loiterTankerSorties === 0, 'Option B in evalWing: ' + 2 * E + ' loiter tanker sorties/day; short of gas -> CCA withheld every event, 0 drawn');
    T.st.custom.doctrine = 'slow_package';
    const sp = T.evalWing(500, wing), lbF = lb.byType.filter(x => x.key === 'f35c')[0], spF = sp.byType.filter(x => x.key === 'f35c')[0];
    ok(near(sp.packageFactor, .8125, 1e-12) && near(spF.surv / lbF.surv, .8125, 1e-9) && sp.loiterTankerSorties === 0, 'Option C in evalWing: every strike sortie survival x0.8125, no tanker draw');
    T.st.custom.doctrine = 'keep_up'; T.st.custom.ingressMach = .80;
    const ku = T.evalWing(500, wing);
    ok(ku.doctrine.rows.every(r => r.status === 'keep_up') && ku.packageFactor === 1 && ku.loiterTankerSorties === 0 && near(cx(ku).ss, cx(ku).ssScheduled, 1e-12), 'Keep-up M0.80: every event joint push, no draw, no penalty');
    T.st.custom = def();
  });

  group('D7 adversary feint survivability discount', () => {
    [[.80, .850], [.71, .697], [.60, .510], [.88, .850]].forEach(([m, v]) => {
      const p = .85 * D.feintFactor(m);
      ok(near(p, v, 5e-4) && p <= .85, 'D7 M' + m.toFixed(2) + ': P_surv ' + p.toFixed(4) + ' = ' + v.toFixed(3));
    });
    const d = design({ ingressMach: .70, doctrine: 'early_launch' }), k = design({ ingressMach: .70, doctrine: 'loiter' });
    ok(near(d.effectiveSurv, .85 * (1 - .4 * .5), 1e-12) && k.effectiveSurv === .85, 'D7 feint discount applies to early launch only: ' + d.effectiveSurv.toFixed(3) + ' vs loiter 0.850');
  });

  group('D8 Breguet clean combat radius', () => {
    const b = D.breguet({ wTO: 18000, wFuel: 5500, tsfc: .72, ld: 11.5, v: 450 });
    ok(b.climb === 275 && b.reserve === 840 && b.loiter === 330 && b.cruise === 4055, 'D8 fuel partition 275 / 840 / 330 -> cruise 4,055 lb');
    ok(b.wStart === 17725 && b.wEnd === 13670 && near(Math.log(b.wStart / b.wEnd), .2598, 5e-5), 'D8 W_start 17,725, W_end 13,670, ln ratio 0.2598');
    ok(Math.abs(b.radius - 933.7) / 933.7 <= .015, 'D8 R_clean ' + b.radius.toFixed(2) + ' nm = 933.7 +/- 1.5%');
  });

  group('D9 Breguet radius wired to v3.2 sortie sag', () => {
    ok(D.carrierEvent(200) === 1.75 && T.logistics.sortieSag(200).events === 8 && D.carrierEvent(500) === 2.75 && T.logistics.sortieSag(500).events === 5, 'D9 v3.2 table 3.3.3 governs: 200 nm 1.75 hr (8 events), 500 nm 2.75 hr (5 events)');
    const t = D.sortieHours(650, 450);
    ok(near(t, 3.74, .005) && D.stagingCycle(t) === 3.75 && t > D.carrierEvent(650) && D.eventsSpanned(650, 450) === 2, 'D9 isolated sortie at 650 nm: ' + t.toFixed(3) + ' hr, staged 3.75 hr, longer than the ' + D.carrierEvent(650) + '-hr event -> recovers in Event N+2');
    const d = design();
    ok(near(d.R_clean, 1004.599, .01) && near(d.burnRate, 4.19197333, 1e-7), 'D9 wireframe Breguet radius ' + d.R_clean.toFixed(3) + ' nm and cruise burn ' + d.burnRate.toFixed(8) + ' lb/nm');
    T.st.custom = def(); T.syncCustom();
    ok(T.CAT.custom.clean === d.R_clean && T.CAT.custom.burn === d.burnRate, 'D9 CAT.custom.clean / burn are the designer radius and burn rate');
    T.st.strike = 'direct'; T.st.custom = Object.assign(def(), { fuel: 2200, wingArea: 300 });
    const short = T.syncCustom(), r = T.evalWing(700, { custom: 6 }), x = r.byType.filter(y => y.key === 'custom')[0];
    ok(short.R_clean < 700 && x.dP > 0 && r.gasDemand > 0, 'D9 R_clean ' + short.R_clean.toFixed(0) + ' nm < 700 nm mission: the CCA draws tanker gas (' + x.dP.toFixed(0) + ' lb/sortie), it does not vanish');
    T.st.custom = def();
    const r2 = T.evalWing(500, { custom: 6 }), x2 = r2.byType.filter(y => y.key === 'custom')[0];
    ok(x2.dP === 0, 'D9 default design reaches 500 nm organically (no tanker gas)');
  });

  group('D10 "Does it close?" binding bottleneck', () => {
    const g = D.evaluateGates({ vpa: 148, dt: .92, fuel: 5000, fuelMax: 6000, bFolded: 25, spot: .70 });
    ok(near(g.approach.deficitRatio, 13 / 135, 1e-12) && near(g.thrust.deficitRatio, .07 / .85, 1e-12) && near(g.approach.deficitRatio * 100, 9.6, .05) && near(g.thrust.deficitRatio * 100, 8.2, .05), 'D10 deficits: approach +9.6%, thrust +8.2%');
    ok(!g.doesClose && g.bindingGate === 'GATE_APPROACH' && g.approach.name === 'Carrier Approach Speed Exceeded', 'D10 doesClose = false; binding GATE_APPROACH (Carrier Approach Speed Exceeded)');
    const g2 = D.evaluateGates({ vpa: 136, dt: 1.0, fuel: 5000, fuelMax: 6000, bFolded: 25, spot: .70 });
    ok(g2.bindingGate === 'GATE_THRUST', 'D10 argmax by deficit / threshold: a 0.7% approach miss loses to a 17.6% thrust miss');
    const d = design({ engineClass: 'light', wingArea: 150, payload: 6000, fuel: 4000, ingressMach: .60 });
    ok(!d.doesClose && d.statusText.indexOf('DESIGN FAILS TO CLOSE: Carrier approach speed ' + T.fmt(d.vpa, 1) + ' kt exceeds 135.0 kt limit (+' + T.fmt(d.vpa - 135, 1) + ' kt deficit). Enlarge wing area S_wing or reduce payload.') >= 0, 'D10 UI status names the binder: "' + d.bindingMessage + '"');
  });

  group('D11 discrete thrust scenarios', () => {
    const r = D.robustness(true, .81);
    ok(near(r.dtLow, .81 / .88, 1e-12) && near(r.dtLow, .920, 5e-4) && r.category === 'marginal' && r.text === 'MARGINAL CLOSURE: High vulnerability to hot-day aborts (D/T_low > 0.85)', 'D11 D/T_nom 0.81 -> D/T_low ' + r.dtLow.toFixed(4) + ' > 0.85: Marginal Closure with the UI warning');
    ok(D.robustness(true, .70).category === 'robust' && D.robustness(false, .70).category === 'infeasible', 'D11 robust when D/T_low <= 0.85; infeasible on any nominal gate failure');
    const d = design();
    ok(near(d.T_low, .88 * d.T, 1e-9) && near(d.T_high, 1.08 * d.T, 1e-9) && d.robustness === 'robust' && d.statusText.indexOf('ROBUST CLOSURE: All gates pass under Adverse / Hot-Day Thrust') >= 0, 'D11 wireframe: adverse x0.88 / favorable x1.08 band, robust closure');
  });

  group('D12 cost per combat effect', () => {
    ok(near(D.costPerEffect(20, 800, 1, true), 25000, 1e-6) && near(D.costPerEffect(10, 120, 1, true), 83333.33, .01), 'D12 A $25,000 / point; B $83,333 / point');
    ok(D.costPerEffect(10, 0, 1, true) === Infinity && D.costPerEffect(10, 500, 1, false) === Infinity, 'D12 C unclosed or zero effect: infinite');
    ok(near(D.costPerEffect(10, 120, 1, true) / D.costPerEffect(20, 800, 1, true), 3.333, .001), 'D12 cheap compromised drone 3.3x worse');
    ok(near(D.costPerEffect(22.940625, 800, 1, true), D.costPerEffect(22.940625, 9600, 12, true), 1e-9), 'D12 normalized by airframe count: N=1 and N=12 agree');
  });

  group('Section 9.1 unified wireframe and 4.5 lower-root fixture', () => {
    const d = design();
    ok(near(d.vpa, 98.9, .05) && near(135 - d.vpa, 36.1, .05) && near(d.DT, .482, .001) && near((.85 - d.DT) * 100, 36.8, .05), 'W V_PA 98.9 kt (+36.1), D/T 0.48 (+36.8%)');
    ok(d.W_fuel === 5620 && d.fuelMax === 5620 && near(d.bFolded, 25.5, .05) && near(d.deckSpotFactor, .704, .001), 'W fuel 5,620 / 5,620 lb; folded span 25.5 ft; 0.70 spots');
    ok(near(d.costs.flyaway, 18.940625, 1e-9) && near(d.costs.apuc, 22.940625, 1e-9) && near(d.costs.program, 3441.09375, 1e-6) && near(d.costs.engineNrePerUnit, 1.6667, 1e-4), 'W flyaway $18.94M, APUC $22.94M, program $3,441M, amortized engine dev +$1.67M/unit');
    ok(near(D.costPerEffect(d.costs.apuc, 800, 1, true), 28675.78, .01) && d.doesClose && d.robustness === 'robust', 'W $28,676 / effect point at E=800, N=1; robust closure');
    const p = { engineClass: 'light', payload: 6000, fuel: 4000, ingressMach: .60 }, sApp = design(Object.assign({ wingArea: 285 }, p)).sMinApp;
    ok(near(sApp, 185.85630356, 5e-8), 'Sec 4.5 S_min,app ' + sApp.toFixed(8));
    const lo = raw(Object.assign({ wingArea: sApp }, p));
    ok(near(lo.w.cruise, 16588.341616, 5e-7) && near(lo.q, 158.6736, 5e-7) && near(lo.CL, .562498023, 5e-10) && near(lo.CDi, .029243475, 5e-10) && near(lo.CD, .042506164, 5e-10) && near(lo.D, 1253.527565, 5e-7) && near(lo.T, 1474.280268, 5e-7) && near(lo.DT, .850264086, 5e-10), 'Sec 4.5 intermediates at the approach bound: D/T 0.850264086 FAILS');
    const w = design(Object.assign({ wingArea: 285 }, p));
    ok(near(w.sMinThrust, 186.09275292, 5e-8) && raw(Object.assign({ wingArea: w.sMinThrust - .01 }, p)).DT > .85 && raw(Object.assign({ wingArea: w.sMinThrust + .01 }, p)).DT <= .85 && raw(Object.assign({ wingArea: 187 }, p)).DT <= .85, 'Sec 4.5 lower thrust root ' + w.sMinThrust.toFixed(8) + ' sq ft bracketed by +/-0.01');
    ok(w.feasible && near(w.feasible[0], w.sMinThrust, 1e-12) && w.feasible[0] > sApp, 'Sec 4.5 feasible interval starts at the thrust root, not the approach bound');
    const at = design(Object.assign({ wingArea: 185.85630356 }, p)), at187 = design(Object.assign({ wingArea: 187 }, p));
    ok(!at.doesClose && at.bindingGate === 'GATE_THRUST' && at187.doesClose, 'Sec 4.5 at 185.86 sq ft: does not close (thrust); at 187 sq ft: closes');
  });

  group('Section 10.2 state migration and sanitization', () => {
    const legacy = D.migrate({ pay: 20000, surv: 95, size: 20 });
    ok(legacy.migrated && legacy.legacy && JSON.stringify(legacy.state) === JSON.stringify(D.DEFAULTS), 'legacy {pay, surv, size} -> unified closing defaults');
    ok(JSON.stringify(D.DEFAULTS) === JSON.stringify({ engineClass: 'mid', wingArea: 285, ingressMach: .80, payload: 2000, fuel: 5620, buyQty: 150, surv: .85, doctrine: 'keep_up' }), 'defaults per spec 10.2');
    ok(D.migrate({ engineClass: 'mid', wingArea: 285, ingressMach: .8, payload: 2000, fuel: 5620, buyQty: 150, surv: .85, doctrine: 'keep_up', pay: 1 }).legacy, 'any legacy pay key marks a legacy record');
    const m = D.migrate({ engineClass: 'turbojet', wingArea: NaN, ingressMach: '0.7', payload: Infinity, fuel: 99999, buyQty: 10, surv: -1, doctrine: 'ram' });
    ok(m.migrated && m.state.engineClass === 'mid' && m.state.wingArea === 285 && m.state.ingressMach === .8 && m.state.payload === 2000 && m.state.fuel === 7600 && m.state.buyQty === 50 && m.state.surv === .5 && m.state.doctrine === 'keep_up', 'malformed keys -> defaults; out-of-range numbers clamped (fuel 7,600, Q 50, surv 0.50)');
    const part = D.migrate({ engineClass: 'heavy', wingArea: 400 });
    ok(part.state.engineClass === 'heavy' && part.state.wingArea === 400 && part.state.fuel === 5620 && part.state.doctrine === 'keep_up', 'missing keys filled with defaults, valid keys kept');
    ok(D.migrate(null).legacy && D.migrate('x').legacy && !D.migrate(def()).migrated, 'non-object state -> defaults; a clean record is untouched');
    T.st.custom = { pay: 6000, surv: 60, size: 55 }; T.syncCustom();
    ok(JSON.stringify(T.st.custom) === JSON.stringify(D.DEFAULTS), 'saved legacy st.custom migrates in place on load');
    const round = JSON.parse(JSON.stringify(T.st.custom)); T.st.custom = round; T.syncCustom();
    ok(JSON.stringify(T.st.custom) === JSON.stringify(round), 'serialized state round-trips unchanged');
  });

  group('Section 10.3 CAT adapters and legacy consumer retirement', () => {
    T.st.custom = Object.assign(def(), { ingressMach: .70, doctrine: 'early_launch' });
    const d = T.syncCustom(), c = T.CAT.custom;
    ok(c.clean === d.R_clean && c.burn === d.burnRate && c.cost === d.costs.flyaway && T.costFor('custom') === d.costs.flyaway, 'clean / burn / cost adapters read the designer');
    ok(c.pay === d.W_payload && c.pay === 2000 && near(c.surv, d.effectiveSurv * 100, 1e-12) && c.spots === d.deckSpotFactor && c.rate === 1 && c.doesClose === true && c.bindingGate === null, 'legacy pay key maps to W_payload; surv in percentage points; spots = deck spot factor; rate = 1.00 (dimensionless)');
    ok(T.statsFor('custom').pay === 2000 && T.statsFor('custom').rate === 1, 'statsFor("custom") reads the adapter');
    const rr = T.recoveryRisk('custom', true, 0), re = T.recoveryRisk('custom', false, 0);
    ok(near(rr.malw, 80.2144 * 285, .05) && near(rr.malw, d.malw, 1e-9) && near(rr.wTrap, d.W_empty + 2000 + .08 * 5620 + 400, 1e-9) && near(re.wTrap, d.W_empty + 200 + .08 * 5620 + 400, 1e-9) && rr.pBolter === .02, 'recovery: MALW 80.2144 x S, trap weight with / without bring-back, bolter 2%');
    T.st.custom = Object.assign(def(), { payload: 6000, wingArea: 150, fuel: 3800 });
    const heavy = T.syncCustom(), hb = T.recoveryRisk('custom', true, 0);
    ok(hb.overweight > 0 && near(hb.pBolter, Math.min(.25, .02 + .10 * hb.overweight / 1000), 1e-12), 'recovery: overweight bring-back raises bolter risk (' + hb.overweight.toFixed(0) + ' lb over)');
    ok(!/function customClean|function customBurn|function designCost|function designPenalty|function sizeRate/.test(source) && !/custom:20000|custom:25000/.test(source), 'legacy customClean / customBurn / point-buy / penalty / static custom EMPTY_WT and MALW retired');
    T.st.custom = def(); T.syncCustom();
  });

  group('Section 10.4 fail-closed exclusion, Auto-Boss and zero-effect guards', () => {
    T.st.custom = Object.assign(def(), { engineClass: 'light', wingArea: 150, payload: 6000, fuel: 4000, ingressMach: .82 });
    const d = T.syncCustom();
    ok(!d.doesClose && T.CAT.custom.rate === 0 && T.CAT.custom.doesClose === false && typeof T.CAT.custom.bindingGate === 'string', 'unclosed: CAT.custom.rate 0, doesClose false, binding ' + T.CAT.custom.bindingGate);
    const wing = { fa18: 12, f35c: 4, custom: 8, mq25: 4, cap: 6 }, base = Object.assign({}, wing, { custom: 0 });
    const r = T.evalWing(500, wing), p = T.evalWing(500, wing, { sortiesPerJet: 1.5 }), x = r.byType.filter(y => y.key === 'custom')[0], xp = p.byType.filter(y => y.key === 'custom')[0];
    ok(x.ss === 0 && x.demand === 0 && xp.ss === 0 && xp.demand === 0 && r.customEffect === 0 && r.customExcluded, 'rate path and pinned path: unclosed custom demand 0, effect 0');
    const b = T.evalWing(500, base);
    ok(r.strikeSorties === b.strikeSorties && near(r.effects, b.effects, 1e-9) && r.tankerSorties === b.tankerSorties, 'manned air wing preserved: crewed strikes and tankers evaluate as without the CCA');
    ok(T.objVal(r, 34) === -Infinity && r.customCostPerEffect === Infinity, 'Auto-Boss fitness -Infinity; cost per effect infinite');
    const c = T.evalCampaign(500, wing, { days: 3 });
    ok(c.dailyHistory.every(h => (h.flownByKey.custom || 0) === 0 && h.losses.custom === 0), '3-day campaign: unclosed CCA never flies, never lost');
    Object.assign(T.st, { wing: 2, rankBy: 'effect', target: 0, rng: 500 });
    const top = T.autoSearch();
    ok(top.length > 0 && top.every(t => !(t.alloc.custom > 0)), 'Auto-Boss never ranks an unclosed custom design (' + top.length + ' candidates)');
    T.st.custom = def(); T.syncCustom();
    const top2 = T.autoSearch();
    ok(top2.length > 0, 'Auto-Boss still searches with a closed design');
  });

  group('Section 8 price vs value wired to the campaign evaluator', () => {
    T.st.custom = def(); const d = T.syncCustom();
    const r = T.evalWing(500, { fa18: 12, custom: 6, mq25: 4, cap: 6 }), x = r.byType.filter(y => y.key === 'custom')[0];
    ok(r.customEffect > 0 && near(r.customEffect, x.primaryEffect + x.fallbackEffect, 1e-12), 'custom delivered effect read from the shipped evaluator: ' + r.customEffect.toFixed(2));
    ok(near(r.customCostPerEffect, 6 * d.costs.apuc * 1e6 / r.customEffect, 1e-6), 'cost per effect = N x APUC / E_custom = $' + T.fmt(r.customCostPerEffect, 0));
    ok(near(r.cost, 12 * 67 + 6 * d.costs.flyaway + 4 * 184 + 6 * 70, 1e-9), 'wing cost uses the designer flyaway for the custom airframe');
    const none = T.evalWing(500, { fa18: 12, mq25: 4 });
    ok(none.customEffect === 0 && none.customCostPerEffect === null, 'no custom airframes fielded: no cost-per-effect claim');
  });

  group('Section 9.1 display binding (fake DOM reads the engine)', () => {
    T.st.custom = def(); Object.assign(T.st, { rng: 500, play: 0 }); T.st.alloc.custom = 4; T.render();
    const d = T.syncCustom(), r = T.evalWing(T.st.rng), html = el('c-readout').innerHTML, text = html.replace(/<[^>]+>/g, '');
    ok(html === D.panelHTML(d, T.designerContext(r)) && html.length > 200, 'designer readout equals panelHTML(engine)');
    const v = D.valuesText(d);
    ok(['cv-engine', 'cv-qty', 'cv-wing', 'cv-mach', 'cv-payload', 'cv-fuel', 'cv-surv', 'cv-doctrine'].every(id => el(id).textContent === v[id]), 'every designer value label is bound to the engine');
    ok(v['cv-wing'] === '285 sq ft (V_PA 98.9 kt | margin +36.1 kt)' && v['cv-mach'] === 'Mach 0.80 (D/T 0.48 | margin +36.8%)' && v['cv-fuel'] === '5,620 lb (max 5,620 lb | 100% full)' && v['cv-qty'] === '150 a/c (amortized engine dev +$1.67M/unit)', 'wireframe value labels');
    ['[ PASS ] CARRIER APPROACH SPEED', '98.9 kt &lt;= 135.0 kt', 'D/T 0.48 &lt;= 0.85', '5,620 lb &lt;= 5,620 lb', '0.70 spots (25.5 ft span folded', 'ROBUST CLOSURE', '$18.94M', '$22.94M', '$3,441M', '1,005 nm'].forEach(s => ok(text.indexOf(s) >= 0, 'readout shows ' + s));
    ok(!/NaN|undefined|Infinity/.test(html), 'readout has no NaN / undefined / Infinity');
    T.st.custom = Object.assign(def(), { ingressMach: .65, doctrine: 'early_launch' }); T.st.alloc = { fa18: 26, custom: 6, cap: 6 }; T.render();
    const h2 = el('c-readout').innerHTML, r2 = T.evalWing(T.st.rng);
    ok(r2.doctrine.rows[0].status === 'withheld' && h2.indexOf(r2.doctrine.reason) >= 0 && h2.indexOf('early launch needs ') >= 0, 'withhold reason shown in the UI: "' + r2.doctrine.reason + '"');
    T.st.custom = Object.assign(def(), { engineClass: 'light', wingArea: 150, payload: 6000, fuel: 4000 }); T.render();
    const h3 = el('c-readout').innerHTML;
    ok(h3.replace(/<[^>]+>/g, '').indexOf('[ FAIL ]') >= 0 && h3.indexOf('INFEASIBLE: Nominal gate violation (GATE_') >= 0 && h3.indexOf('unclosed design delivers zero effect') >= 0, 'unclosed design: FAIL rows, infeasible status, zero-effect value line');
    T.st.custom = def(); T.st.alloc.custom = 0; T.render();
  });

  group('Gouge figures quoted from the engine', () => {
    const g = (/public|index|offline/.test(path.basename(html)) ? ['gouge.html', 'air_boss_gouge.html'] : ['air_boss_gouge.html', 'gouge.html']).map(f => path.join(path.dirname(html), f)).find(f => fs.existsSync(f));
    if (!g) { ok(true, 'no Gouge file next to this build (skipped)'); return; }
    const text = fs.readFileSync(g, 'utf8'), d = design(), pinch = design({ engineClass: 'light', payload: 4000, fuel: 4500, ingressMach: .82 });
    ok(text.indexOf('flies only in PowerPoint') >= 0, 'Gouge v3.3 event present');
    [T.fmt(d.vpa, 1) + ' kt', 'D/T ' + T.fmt(d.DT, 2), T.fmt(d.R_clean, 0) + ' nm', '$' + T.fmt(d.costs.flyaway, 2) + 'M', '$' + T.fmt(d.costs.apuc, 2) + 'M', T.fmt(pinch.sMinApp, 0) + ' sq ft', '13,210 lb', '2 tanker sorties', '6 seconds'].forEach(s => ok(text.indexOf(s) >= 0, 'Gouge quotes engine figure "' + s + '"'));
  });
  bad += S.done(path.basename(html));
}
console.log(bad ? 'DESIGNER SUITE FAILED' : 'DESIGNER SUITE PASSED: D1-D12 and engine integration');
process.exitCode = bad ? 1 : 0;
