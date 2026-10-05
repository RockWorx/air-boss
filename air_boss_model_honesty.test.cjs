/* Air Boss v3.4 "model honesty" suite. Five model fixes and the public caveats, each with a discriminating check that
 * FAILS on the v3.3.2 engine and PASSES on v3.4. Expected values are the v3.4 specification formulas evaluated HERE from
 * their published constants (sortie time 2R/450 + 0.85 hr, 1,550 gal base, 30% fixed share; APUC = flyaway x 1.15;
 * C_L,app 1.10; spot = length x folded span / (56 x 32)); every observed value is read from the SHIPPED engine through
 * window.__airbossTest (shared loader). No model code is copied here.
 *   F1 fuel per sortie scales with radius   F2 cost terms           F3 approach lift
 *   F4 deck reset on the fly-day ledger     F5 deck footprint gate  CV public caveats (text, placement, boundary)
 * Run: node air_boss_model_honesty.test.cjs [build.html]   (no argument: every build present; exit 0 = PASS)
 * Pure Node built-ins only. ASCII only.
 */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { builds, loadEngine, suite } = require('./air_boss_test_loader.cjs');

// Spec constants (v3.4 sections 3.1-3.5), used only to state expectations.
const SPEC = {
  tSortie: R => 2 * R / 450 + 0.50 + 0.35,
  galBase: 1550, fFixed: 0.30, rho: 6.8,
  supportFrac: 0.15, airframeDev: 350,
  rhoSL: 0.002377, ktFps: 1.6878, clApp: 1.10, vpaMax: 135,
  spotMax: 0.75, spotRef: 56 * 32, length: (S, dn) => 28 + 0.025 * S + 1.5 * dn, folded: S => 0.65 * Math.sqrt(4.2 * S) + 3.0
};
SPEC.gal = R => SPEC.galBase * (SPEC.fFixed + (1 - SPEC.fFixed) * SPEC.tSortie(R) / SPEC.tSortie(200));
SPEC.vpa = (W, S) => Math.sqrt(2 * W / (SPEC.rhoSL * S * SPEC.clApp)) / SPEC.ktFps;
SPEC.spot = (S, dn) => SPEC.length(S, dn) * SPEC.folded(S) / SPEC.spotRef;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', le: '<=', ge: '>=', mdash: '--', ndash: '-', middot: '.', times: 'x', rarr: '->' };
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/&(#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCharCode(+e.slice(1)) : (e in ENT ? ENT[e] : m)).replace(/\s+/g, ' ').trim();
function caveat(html, key) {
  const m = String(html).match(new RegExp('<p[^>]*data-caveat="' + key + '"[^>]*>([\\s\\S]*?)</p>'));
  return m ? text(m[1]) : null;
}
const CAVEATS = {   // key -> where it is shown and the phrases its public text must carry (spec 3.x / 4.x)
  'fuel-scaling': ['logistics', ['Fuel per sortie rises with sortie flight duration and standoff radius', 'illustrative scaling law', 'gal per sortie']],
  'reconfig-penalty': ['logistics', ['12-hour flight deck and hangar reset', 'debited against the fly day']],
  'sortie-generation': ['logistics', ['double-cycle', 'launching in Event 1', 'recovering in Event 3']],
  'replenishment': ['logistics', ['alongside connected replenishment (fueling and highline cargo) can be conducted concurrently with flight operations when sea state and wind alignment permit', 'vertical replenishment (VERTREP) is suspended during active launch and recovery', 'Adverse weather or tactical course restrictions can delay replenishment']],
  'ordnance-throughput': ['logistics', ['weapons build rates', 'elevator transfer capacity']],
  'c2-capacity': ['logistics', ['4:1 supervisory ratio', 'command console availability', 'datalink bandwidth']],
  'aircrew-endurance': ['logistics', ['flight hour ceilings reflect standard naval aviation safety guidelines', 'waiver authority', 'circadian disruption']],
  'cost-breakdown': ['designer', ['Recurring flyaway:', 'APUC-style', 'PAUC-style', 'not normalized to one dollar year', 'about 15-25% in one published program']],
  'approach-lift': ['designer', ['C_L,app = 1.10', 'pitch-up and stall-onset', 'larger wing area']],
  'deck-footprint': ['designer', ['Spot <= 0.75', '4 aircraft in 3 spots', 'illustrative rectangular footprint']],
  'mission-timing': ['designer', ['cannot launch prior to scheduled flight quarters', 'simulation modeling boundary']],
  'thrust-sensitivity': ['designer', ['adverse thrust condition (x0.88)', 'deterministic stress check', 'rather than a full thermodynamic hot-day']],
  'calibration': ['designer', ['classical aeronautical scaling relationships', 'rather than proprietary wind-tunnel or flight-test data']],
  'tanker-archetype': ['designer', ['MQ-25 Stingray offload is anchored', 'at least 14,000 lb of fuel given at 500 nm from the carrier', 'objective 16,000 lb', 'current estimate at least 14,000 lb', 'demonstrated performance as TBD', 'illustrative game law', 'the source gives no curve']],
  'cap-equivalence': ['compare-cap', ['one uncrewed aircraft provides the defensive coverage of one crewed fighter airframe', 'may carry fewer air-to-air missiles', 'offboard sensor cueing']],
  'cap-attrition': ['compare', ['modeled without attrition for both crewed and uncrewed aircraft', 'remain exposed']],
  'exposure-index': ['compare', ['comparative tactical exposure index', 'rather than an empirical casualty forecast']]
};
// Public boundary for every new caveat: no decision / finding identifiers and no numbered notes. (The release's added-line
// boundary scan, run outside the public set, also covers people, nations and weapon designations.)
// Real aircraft designations the game names on purpose (the notional CCX-1 and the real MQ-25 tanker) are not identifiers.
const DENY = /\b(?!CCX-1\b|MQ-25\b)[A-Z]{1,3}-\d{1,3}\b|#\d{3}\b/;

let bad = 0;
for (const html of builds()) {
  const S = suite('MODEL HONESTY SUITE'), ok = S.ok, near = S.near, group = S.group;
  const { T } = loadEngine(html, { reduce: true });
  const L = T.logistics, D = T.designer, def = () => JSON.parse(JSON.stringify(D.DEFAULTS));
  const design = (o, opt) => D.evaluate(Object.assign(def(), o || {}), opt);
  const page = fs.readFileSync(html, 'utf8');
  const solve = o => L.solve(Object.assign({}, L.DEFAULT_STATE, o || {}));
  console.log('== ' + path.basename(html));

  group('F1 fuel per sortie scales with sortie duration and radius (re-anchored 1,550 gal at 200 nm)', () => {
    const a = L.dailyBill(120, 200), b = L.dailyBill(120, 500);
    ok(b.fuelGalDay > a.fuelGalDay, 'DISCRIMINATOR: at a fixed 120 sorties/day the fuel bill rises from 200 to 500 nm (' + Math.round(a.fuelGalDay) + ' -> ' + Math.round(b.fuelGalDay) + ' gal/day)');
    ok(b.fuelGalDay / 120 > a.fuelGalDay / 120 && b.galPerSortie > 2000, 'DISCRIMINATOR: fuel per sortie rises with radius and exceeds 2,000 gal at 500 nm (' + (b.fuelGalDay / 120).toFixed(1) + ' gal)');
    ok(near(a.fuelGalDay, 186000, 1e-6) && near(a.galPerSortie, SPEC.gal(200), 1e-9) && near(SPEC.gal(200), 1550, 1e-9), 'positive: 120 sorties at 200 nm = 186,000 gal/day (1,550 gal/sortie base)');
    ok(near(b.galPerSortie, SPEC.gal(500), 1e-9) && near(b.galPerSortie, 2382, 0.5) && near(b.fuelGalDay, 120 * SPEC.gal(500), 1e-6) && near(b.fuelGalDay, 285840, 10), 'positive: 500 nm = ' + b.galPerSortie.toFixed(2) + ' gal/sortie (spec 2,382), ' + Math.round(b.fuelGalDay) + ' gal/day (spec 285,840 with the rounded give)');
    let mono = true, prev = -1;
    for (let R = 150; R <= 900; R += 10) { const g = L.galPerSortie(R); if (!(g > prev) || !near(g, SPEC.gal(R), 1e-9)) mono = false; prev = g; }
    ok(mono, 'fuel per sortie is the spec formula and strictly increasing from 150 to 900 nm');
    ok(near(L.dailyBill(115).fuelGalDay, 115 * 1550, 1e-9) && near(L.dailyBill(115).fuelGalDay, L.dailyBill(115, 200).fuelGalDay, 1e-12), 'no radius given = the 200-nm reference (115 x 1,550 = 178,250 gal/day)');
    const s2 = solve({ tempo: 115, radius: 200 }), s5 = solve({ tempo: 115, radius: 500 });
    ok(s5.bill.fuelGalDay > s2.bill.fuelGalDay && near(s5.bill.fuelGalDay, 115 * SPEC.gal(500), 1e-6) && s5.dos.fuel < s2.dos.fuel, 'the solver feeds the radius to the bill: 115/day costs more fuel and fewer days of supply at 500 nm');
    const ov = L.dailyBill(115, 500);
    ok(near(ov.missionFuelGal + ov.overheadFuelGal, ov.fuelGalDay, 1e-9) && near(ov.overheadFuelGal, L.dailyBill(115, 200).overheadFuelGal, 1e-12), 'overhead (FCF / CQ near the ship) stays inside the bill and does not scale with strike radius');
    const e2 = s2.effects, e5 = s5.effects, w2 = e2.waves[0], w5 = e5.waves[0];
    ok(near(w2.fuelLb / w2.sorties, SPEC.gal(200) * SPEC.rho, 1e-6) && near(w5.fuelLb / w5.sorties, SPEC.gal(500) * SPEC.rho, 1e-6), 'Card E vignette uses the same radius-scaled fuel per sortie (' + (w2.fuelLb / w2.sorties).toFixed(0) + ' -> ' + (w5.fuelLb / w5.sorties).toFixed(0) + ' lb)');
    const h = L.cardsHTML(s5);
    ok(h.indexOf(T.fmt(s5.bill.galPerSortie, 0) + ' gal per sortie at 500 nm') >= 0, 'Card A shows the per-sortie fuel at the chosen radius');
  });

  group('F2 cost terms: APUC is procurement only; development shown separately (PAUC); catalog flyaway scope', () => {
    const lo = design({ buyQty: 50 }), hi = design({ buyQty: 500 });
    ok(near(lo.costs.apuc, hi.costs.apuc, 1e-12), 'DISCRIMINATOR: APUC does not move with the buy quantity (no development inside it)');
    ok(near(lo.costs.apuc, lo.costs.flyaway * (1 + SPEC.supportFrac), 1e-12), 'DISCRIMINATOR: APUC = flyaway x 1.15 (' + lo.costs.apuc.toFixed(4) + ')');
    let all = true, n = 0;
    for (const e of ['light', 'mid', 'heavy']) for (const q of [50, 100, 150, 300, 500]) {
      const d = design({ engineClass: e, buyQty: q }), c = d.costs, dev = SPEC.airframeDev + D.ENGINES[e].nre; n++;
      if (!(near(c.apuc, c.flyaway * 1.15, 1e-9) && near(c.devTotal, dev, 1e-9) && near(c.devPerUnit, dev / q, 1e-12) && near(c.pauc, c.apuc + dev / q, 1e-9) && c.pauc >= c.apuc && near(c.program, q * c.pauc, 1e-6))) all = false;
    }
    ok(all && n === 15, 'every engine x buy (15 cases): APUC-style = 1.15 recurring flyaway; development = $350M + engine NRE; PAUC-style = APUC-style + development per unit (this simplification has no development articles or facilities); program = Q x PAUC-style');
    const d = design();
    ok(near(d.costs.flyaway, 18.940625, 1e-9) && near(d.costs.apuc, 21.78171875, 1e-9) && near(d.costs.pauc, 25.78171875, 1e-9), 'default design: flyaway $18.94M, APUC $21.78M, PAUC $25.78M (150 a/c, $600M development)');
    const R = T.evalWing(500, { fa18: 12, custom: 6, mq25: 4, cap: 6 }), x = R.byType.filter(y => y.key === 'custom')[0];
    ok(R.customEffect > 0 && near(R.customCostPerEffect, 6 * T.syncCustom().costs.pauc * 1e6 / R.customEffect, 1e-6), 'cost per effect uses the all-in unit cost (PAUC), not a mislabeled APUC');
    ok(T.CAT.mq25.cost === 112 && near(136.840 / 1.22, 112, .5) && T.CAT.fa18.cost === 63 && T.CAT.horn5.cost === 63 && T.CAT.f35c.cost === 93 && near(82.1 + 11.3, 93, .5) && T.st.cost.f35c === 93 && T.CAT.ccx.cost === 18.5, 'DISCRIMINATOR: catalog per the cost check and the newer sources -- tanker $112M [illustrative, APUC 136.84 / 1.22] (was a $184M weapon-system figure), F/A-18E/F $63M (FY2013 then-year), F-35C $93M (CY2012 U.S. recurring flyaway 82.1 + 11.3), CCX-1 $18.5M [illustrative]');
    const panel = text(D.panelHTML(d, {}));
    ok(panel.indexOf('Program APUC') < 0 && panel.indexOf('APUC-style (procurement, incl. 15% support and spares [illustrative]): $' + T.fmt(d.costs.apuc, 2) + 'M') >= 0 && panel.indexOf('PAUC-style (incl. development, excl. facilities): $' + T.fmt(d.costs.pauc, 2) + 'M') >= 0 && panel.indexOf('Development: $' + T.fmt(d.costs.devTotal, 0) + 'M') >= 0, 'readout separates flyaway, APUC, development and PAUC; no "Program APUC"');
    ok(!/APUC[^.]*amortized|watch APUC/.test(page), 'no text ties development amortization to APUC');
  });

  group('F3 approach lift C_L,app = 1.10 (flapless / tailless approach is pitch-up and stall-onset limited)', () => {
    ok(D.C.clApp === SPEC.clApp && near(D.C.wlandPerS, 0.5 * SPEC.rhoSL * SPEC.clApp * Math.pow(135 * SPEC.ktFps, 2), 1e-12) && near(D.C.wlandPerS, 67.8737, 1e-4), 'C_L,app 1.10; landing weight per sq ft at 135 kt = 67.87 lb');
    const v = D.vpa(15000, 200);
    ok(v > 135 && near(v, SPEC.vpa(15000, 200), 1e-9) && near(v, 141.9, 0.05), 'DISCRIMINATOR: 15,000 lb on 200 sq ft approaches at ' + v.toFixed(2) + ' kt > 135 kt');
    const g = D.evaluateGates({ vpa: v, dt: .5, fuel: 1, fuelMax: 2, bFolded: 25, spot: .5 });
    ok(!g.approach.pass && g.bindingGate === 'GATE_APPROACH' && near(g.approach.value - 135, 6.9, 0.05), 'GATE_APPROACH trips with a +6.9 kt deficit');
    ok(near(D.sMinLanding(14000), 14000 / (0.5 * SPEC.rhoSL * SPEC.clApp * Math.pow(135 * SPEC.ktFps, 2)), 1e-9) && near(D.sMinLanding(14000), 206.3, 0.05), 'minimum wing area for 14,000 lb grows to 206.3 sq ft');
    const d = design();
    ok(d.doesClose && near(d.vpa, SPEC.vpa(d.W_land, 285), 1e-9), 'the default design still closes (V_PA ' + d.vpa.toFixed(1) + ' kt)');
  });

  group('F4 the 12-hour deck reset is debited against the fly-day ledger', () => {
    const st = solve({ tempo: 115, radius: 200, posture: 'stealth' }), bm = solve({ tempo: 115, radius: 200, posture: 'beast' });
    ok(!!(bm.reconfig && bm.reconfig.active) && bm.reconfig.events === 1 && bm.reconfig.ceiling === 15 && bm.reconfig.availHours === 2, 'DISCRIMINATOR: Beast Mode on a 14-hour fly day leaves 2 flying hours: 1 event, 15 sorties on the transition day');
    ok(!(st.reconfig && st.reconfig.active) && st.sag.events === 8 && st.sag.ceiling === 120, 'Stealth Ingress (the baseline posture) pays no reset: 8 events, 120 sorties');
    const s7 = solve({ tempo: 115, radius: 200, posture: 'stealth', horizon: '7' }), b7 = solve({ tempo: 115, radius: 200, posture: 'beast', horizon: '7' });
    ok(b7.sustainable < s7.sustainable && near(b7.limits.deck, (6 * 120 + 15) / 7, 1e-9) && near(b7.sustainable, 105, 1e-9) && b7.binding === 'deck', 'DISCRIMINATOR: 7-day surge horizon carries one transition day: deck ledger (6 x 120 + 15) / 7 = 105 of 115, deck binds');
    const b30 = solve({ tempo: 115, radius: 200, posture: 'beast', horizon: '30' });
    ok(near(b30.limits.deck, (29 * 120 + 15) / 30, 1e-9), '30-day horizon: deck ledger (29 x 120 + 15) / 30 = 116.5 sorties/day');
    const sg = solve({ tempo: 180, radius: 200, posture: 'beast', horizon: '7' });
    ok(sg.reconfig.availHours === 6 && sg.reconfig.ceiling === 60 && near(sg.limits.deck, 180, 1e-9), '18-hour surge day: 6 flying hours (3 events, 60 sorties) on the transition day; 7-day ledger 180 = the spec 16.29-hr amortization');
    const h = L.cardsHTML(bm), hs = L.cardsHTML(st);
    ok(h.indexOf('12-hour deck reset (transition day)') >= 0 && h.indexOf('2 of 14 fly-day hours left: 1 event, 15 sorties that day') >= 0 && hs.indexOf('12-hour deck reset (transition day)') < 0, 'Card B shows the transition day only in Beast Mode');
    ok(!/overnight/i.test(L.postureStatus()) && /12-hour deck reset/.test(L.postureStatus()), 'the posture status no longer calls the reset "overnight"');
  });

  group('F5 deck footprint gate (length-augmented spot <= 0.75) can fail inside the slider range', () => {
    const big = design({ engineClass: 'heavy', wingArea: 450 });
    ok(!big.gates.deck.pass, 'DISCRIMINATOR: heavy core on a 450-sq-ft wing fails GATE_DECK');
    ok(near(big.deckSpotFactor, SPEC.spot(450, 4.2), 1e-9) && near(big.deckSpotFactor, .795, .001) && near(big.L_overall, 45.55, 1e-9) && near(big.bFolded, 31.26, .01), 'spot ' + big.deckSpotFactor.toFixed(3) + ' = 45.55 ft x 31.26 ft / 1,792 sq ft (spec 0.795)');
    ok(/GATE_DECK: Spot factor 0\.795 exceeds 0\.75 limit/.test(big.gates.deck.message) && /45\.6 ft long/.test(big.gates.deck.message), 'message names the footprint excess: "' + big.gates.deck.message + '"');
    const small = design({ engineClass: 'light', wingArea: 220 });
    ok(small.gates.deck.pass && near(small.deckSpotFactor, SPEC.spot(220, 2.3), 1e-9) && near(small.deckSpotFactor, .469, .001), 'compact light CCA on 220 sq ft passes at ' + small.deckSpotFactor.toFixed(3));
    let fails = 0, passes = 0, exact = true;
    for (const e of ['light', 'mid', 'heavy']) for (let s = D.RANGES.wingArea[0]; s <= D.RANGES.wingArea[1]; s += 10) {
      const x = design({ engineClass: e, wingArea: s });
      if (!near(x.deckSpotFactor, SPEC.spot(s, D.ENGINES[e].nacelle), 1e-9)) exact = false;
      if (x.gates.deck.pass) passes++; else fails++;
    }
    ok(exact && fails > 0 && passes > 0 && D.C.spotMax === SPEC.spotMax, 'inside the sliders the gate binds ' + fails + ' and passes ' + passes + ' of 93 designs; spot = spec formula everywhere');
    const def0 = design();
    ok(def0.gates.deck.pass && near(def0.deckSpotFactor, SPEC.spot(285, 3.1), 1e-9), 'default design passes at ' + def0.deckSpotFactor.toFixed(3) + ' spots');
    ok(big.sMaxDeck < 450 && near(SPEC.spot(big.sMaxDeck, 4.2), .75, 1e-6), 'largest deck-legal wing for the heavy core: ' + big.sMaxDeck.toFixed(1) + ' sq ft (spot = 0.75 there)');
  });

  group('CV public caveats: present where the player reads them, public-clean, ASCII', () => {
    const logi = L.cardsHTML(solve({ tempo: 115, radius: 500, posture: 'beast', wing: 'collaborative' }));
    const dz = D.panelHTML(design(), { range: 500, nCustom: 4, schedule: null, customEffect: 100, costPerEffect: 1 });
    const fake = { summary: { effects: 500, sorties: 100, strikeSorties: 60, ccaSorties: 20, fuelGal: 1000, weapons: 50, aircrewHours: 100, binding: 'within aircrew limits', operators: 6, crewedLosses: 1, ccaLosses: 0, dollarsPerEffect: 1 }, label: 'x' };
    const cmpCap = T.watchCompareHTML ? T.watchCompareHTML({ off: fake, cap: fake }) : '', cmpStrike = T.watchCompareHTML ? T.watchCompareHTML({ off: fake, strike: fake }) : '';
    const where = { logistics: logi, designer: dz, 'compare-cap': cmpCap, compare: cmpStrike };
    for (const [key, [at, phrases]] of Object.entries(CAVEATS)) {
      const t = caveat(where[at], key);
      ok(t && phrases.every(p => t.indexOf(p) >= 0), 'caveat "' + key + '" shown in the ' + at + ' view with its spec text');
      ok(t && !DENY.test(t) && /^[\x20-\x7e]*$/.test(t), 'caveat "' + key + '" is public-clean and ASCII');
    }
    ok(caveat(cmpStrike, 'cap-equivalence') === null, 'the CAP-equivalence caveat appears only when a CAP-mode run is compared');
    // Replenishment wording (corrected ruling): alongside transfer CAN run with flight ops; availability is weather / sea state.
    const all = text(page) + ' ' + text(L.cardsHTML(solve()));
    ok(!/(?:replenishment|CONREP|UNREP|refueling alongside)[^.]{0,80}\b(?:halts?|stops?|shuts? down|suspends?)\b[^.]{0,40}flight op/i.test(all) && !/flight op[^.]{0,30}\b(?:halt|stop|cease)\b[^.]{0,40}(?:replenishment|CONREP|UNREP)/i.test(all), 'no text claims replenishment halts flight operations');
    ok(/thrust-sensitivity check/.test(text(dz)) && !/Hot-Day Thrust|hot-day aborts/i.test(text(dz)) && D.robustness(true, .81).text === 'MARGINAL CLOSURE: Fails the x0.88 thrust-sensitivity check (D/T_low > 0.85)' && D.robustness(true, .5).text === 'ROBUST CLOSURE: All gates pass the x0.88 thrust-sensitivity check', 'the adverse-thrust result is labeled a thrust-sensitivity check, not a hot-day prediction');
  });

  group('CV Gouge and README: v3.4 figures bound to the engine; replenishment wording', () => {
    const dir = path.dirname(html), gName = (/public|index|offline/.test(path.basename(html)) ? ['gouge.html', 'air_boss_gouge.html'] : ['air_boss_gouge.html', 'gouge.html']).find(f => fs.existsSync(path.join(dir, f)));
    const G = gName ? text(fs.readFileSync(path.join(dir, gName), 'utf8')) : '', R = fs.existsSync(path.join(dir, 'README.md')) ? fs.readFileSync(path.join(dir, 'README.md'), 'utf8') : '';
    ok(G.length > 0 && R.length > 0, 'Gouge (' + gName + ') and README sit next to the build');
    const halt = /(?:replenish|alongside|UNREP|CONREP)[^.]{0,120}\b(?:launch(?:es)?|flight op\w*)[^.]{0,20}\b(?:nearly stop|stops?|halts?|ceases?|suspend\w*)\b/i;
    ok(halt.test('during replenishment the carrier steams a fixed course alongside the supply ship, and launches nearly stop.') && !halt.test(text(L.cardsHTML(solve()))), 'the halt detector catches the old wording and passes the v3.4 caveat');
    ok(!halt.test(G) && !halt.test(R) && !halt.test(text(page)), 'DISCRIMINATOR: no Gouge, README or page text says launches stop during replenishment');
    ok(/Alongside fueling and highline cargo can continue with flight operations when wind and sea state permit, but helicopter replenishment cannot/.test(G), 'Gouge states the corrected replenishment rule');
    const b115 = L.dailyBill(115), b180 = L.dailyBill(180), d115 = L.daysOfSupply(b115), d180 = L.daysOfSupply(b180), p12 = L.pipeline(b180, 1200), f = T.fmt;
    ok(G.indexOf('burns about ' + f(b115.fuelGalDay, 0) + ' gal of JP-5 (' + f(b115.galPerSortie, 0) + ' gal a sortie)') >= 0 && G.indexOf('usable fuel lasts ' + f(d115.fuel, 1) + ' days') >= 0 && G.indexOf('fuel runs out in ' + f(d180.fuel, 1) + ' days') >= 0 && G.indexOf('each sortie burns ' + f(L.galPerSortie(500), 0) + ' gal') >= 0,
      'Gouge daily-bill card quotes the v3.4 engine: ' + f(b115.fuelGalDay, 0) + ' gal/day, ' + f(d115.fuel, 1) + ' / ' + f(d180.fuel, 1) + ' days, ' + f(L.galPerSortie(500), 0) + ' gal at 500 nm');
    ok(G.indexOf('usable fuel lasts only ' + f(d180.fuel, 1) + ' days, so at 1,200 nm (a ' + f(p12.cycleDays, 2) + '-day round trip) a second oiler must be staggered in: 3 ships') >= 0 && p12.oilers === 2 && p12.total === 3, 'Gouge shuttle card quotes the engine (1,200 nm: 2 oilers + 1 ammunition ship)');
    ok(/#{2,3} What's New in Air Boss v3\.4/.test(R) && !/\bAB-\d{2}\b|\bD-\d{3}\b/.test(R), 'README carries "What\'s New in Air Boss v3.4" with no internal finding or decision identifiers');
  });

  // ---- Second-round independent review: the prose must say only what the engine and the cited source support. ----
  group('Second review: player-facing claims match the engine and the source (fuel sign, reset direction, footprint, guide, crew, schedule)', () => {
    const dir = path.dirname(html), gName = (/public|index|offline/.test(path.basename(html)) ? ['gouge.html', 'air_boss_gouge.html'] : ['air_boss_gouge.html', 'gouge.html']).find(f => fs.existsSync(path.join(dir, f)));
    const G = gName ? text(fs.readFileSync(path.join(dir, gName), 'utf8')) : '', R = fs.existsSync(path.join(dir, 'README.md')) ? fs.readFileSync(path.join(dir, 'README.md'), 'utf8').replace(/\s+/g, ' ') : '';
    const fgm = page.match(/<details id="local-guide"[^>]*>([\s\S]*?)<\/details>/), F = fgm ? text(fgm[1]) : '';
    const P = text(page), f = T.fmt, cards = s => text(L.cardsHTML(s)), sent = t => t.split(/(?<=[.;:])\s+/);
    // R616-1: per-sortie fuel rises with radius; the daily bill = per-sortie fuel x sorties flown, so it can FALL as the ceiling sags.
    const c2 = L.sortieSag(200).ceiling, c5 = L.sortieSag(500).ceiling, d2 = L.dailyBill(c2, 200).fuelGalDay, d5 = L.dailyBill(c5, 500).fuelGalDay;
    ok(L.galPerSortie(500) > L.galPerSortie(200) && d5 < d2 && near(d2, 186000, 1e-6) && near(d5, 178646.17, .01), 'engine: per-sortie fuel rises 200 -> 500 nm, but at each radius\'s example ceiling the daily bill falls (' + f(d2, 0) + ' -> ' + f(d5, 0) + ' gal/day, ' + c2 + ' -> ' + c5 + ' sorties)');
    const fs1 = caveat(L.cardsHTML(solve()), 'fuel-scaling') || '';
    ok(fs1.indexOf('Fuel per sortie rises with sortie flight duration and standoff radius') >= 0 && fs1.indexOf('illustrative scaling law') >= 0 && fs1.indexOf(f(L.galPerSortie(200), 0) + ' gal per sortie at 200 nm') >= 0 && fs1.indexOf(f(L.galPerSortie(500), 0) + ' gal at 500 nm') >= 0 &&
      fs1.indexOf('so it can fall as the sortie ceiling sags') >= 0 && fs1.indexOf(f(d2, 0) + ' gal/day at 200 nm (' + c2 + ' sorties) and ' + f(d5, 0) + ' at 500 nm (' + c5 + ' sorties)') >= 0, 'DISCRIMINATOR: the fuel caveat states per-sortie fuel rising and the daily bill falling at the example ceilings, with the engine numbers');
    const promise = /expanding the daily fuel bill|bill grows with distance|raises the daily fuel bill/i;
    const unqualified = t => sent(t).filter(x => /daily (?:fuel )?bill/i.test(x) && /\b(?:expand|grow|rise|increase|raise)/i.test(x) && !/fixed tempo|same tempo|can fall|falls|lower/i.test(x));
    ok(!promise.test(P) && !promise.test(G) && !promise.test(R) && !unqualified(P + ' ' + G + ' ' + R + ' ' + cards(solve({ radius: 500 }))).length, 'DISCRIMINATOR: no page, Gouge or README sentence promises a daily fuel bill that rises with distance regardless of tempo (' + (unqualified(P + ' ' + G + ' ' + R).join(' | ') || 'none') + ')');
    ok(F.indexOf('Fuel per sortie rises with sortie duration and standoff radius') >= 0 && F.indexOf('so it can fall as the sortie ceiling sags') >= 0 && G.indexOf('so the daily bill (' + f(d5, 0) + ' gal) is slightly lower') >= 0, 'Field Guide and Gouge carry the per-sortie / daily distinction (Gouge bound to the engine: ' + f(d5, 0) + ' gal at the 500-nm ceiling)');
    // Surge-record source: a rough mixed-basis anchor (fixed-wing sorties, helicopter fuel in the total), not a validation of 2,382 gal or the 30/70 split.
    ok(!/re-anchored to empirical|empirical carrier combat surge/i.test(P + ' ' + G + ' ' + R), 'DISCRIMINATOR: no text calls the 1,550-gal anchor empirical surge consumption');
    const cna = sent(P + ' ' + G + ' ' + R).filter(x => /1,59\d gal/.test(x));
    ok(cna.length > 0 && cna.every(x => /fixed-wing/i.test(x) && /helicopter/i.test(x)), 'every mention of the ~1,590-gal surge figure says per fixed-wing sortie with helicopter fuel in the total (' + cna.length + ')');
    // R616-4: the reset is charged only on entering Beast Mode; the return to Stealth is not, and the text says so.
    L.setState(Object.assign({}, L.DEFAULT_STATE, { posture: 'beast' })); L.requestPosture('stealth'); const back = L.postureStatus();
    L.setState(L.DEFAULT_STATE); L.requestPosture('beast'); const fwd = L.postureStatus(); L.setState(L.DEFAULT_STATE); const idle = L.postureStatus();
    ok(/not charged/.test(back) && !/locked until[^.]*debited/.test(back), 'DISCRIMINATOR: a pending return to Stealth is not promised as a fly-day debit: "' + back + '"');
    ok(/entering Beast Mode is debited against the fly day/.test(fwd) && /return to Stealth is not charged/.test(idle) && !/Its hours come out of the fly day/.test(page), 'entering Beast Mode is the charged direction; the idle status and tooltips say the return is not charged');
    ok((caveat(L.cardsHTML(solve()), 'reconfig-penalty') || '').indexOf('the return to Stealth is not charged') >= 0 && /the return to Stealth is not charged/.test(F), 'the reset caveat and Field Guide name the uncharged direction');
    // R616-5: the footprint gate is an illustrative rectangle, not an elevator or deck-handling check.
    const dk = caveat(D.panelHTML(design(), {}), 'deck-footprint') || '';
    ok(!/deck handling and elevator limits/.test(P) && dk.indexOf('illustrative rectangular footprint') >= 0 && dk.indexOf('does not establish elevator or deck-handling compatibility') >= 0, 'DISCRIMINATOR: the footprint caveat claims no elevator / handling check');
    // R616-6: guide, approach-lift and CAP claims stated as assumptions.
    ok(/relieving 28 to 51 cockpit hours a day for defensive cover if one CCA on CAP counts as one crewed CAP fighter/.test(F) && !/small wings minimize high-speed drag/.test(F) && F.indexOf('a smaller wing cuts parasite drag but raises induced drag') >= 0 && F.indexOf('an illustrative assumption (C_L,app = 1.10)') >= 0, 'DISCRIMINATOR: Field Guide qualifies the CAP hours, states both drag effects and labels C_L,app 1.10 an assumption');
    const al = caveat(D.panelHTML(design(), {}), 'approach-lift') || '', ce = T.watchCompareHTML ? caveat(T.watchCompareHTML({ off: { summary: {}, label: 'x' }, cap: { summary: {}, label: 'x' } }), 'cap-equivalence') || '' : '';
    ok(!/calibrated/i.test(al) && al.indexOf('not a validated airworthiness value') >= 0 && !/In operational practice, CCAs carry/.test(page) && ce.indexOf('may carry fewer air-to-air missiles') >= 0, 'approach-lift caveat is not "calibrated"; CAP caveat states CCA limits conditionally');
    // R616-7: a flight-hour guideline flag, not a fatigue diagnosis; console staffing excludes transferred supervision and support labor.
    const ex = solve(), ct = cards(ex);
    ok(ex.exhausted && ct.indexOf('Flight-hour guideline exceeded') >= 0 && ct.indexOf('not a fatigue diagnosis') >= 0 && ct.indexOf('modeled fighter-pilot pool') >= 0 && !/Human exhaustion/.test(page) && !/human flesh/.test(page), 'DISCRIMINATOR: the aircrew flag is a guideline exceedance for the modeled fighter-pilot pool, not a fatigue diagnosis');
    const c2t = caveat(L.cardsHTML(ex), 'c2-capacity') || '';
    ok(c2t.indexOf('transferred outside this count') >= 0 && c2t.indexOf('total support labor') >= 0, 'the console caveat states transferred airborne supervision and support labor are not counted');
    // R616-8: the sortie ceiling is one example scheduling policy, not a necessary deck limit.
    const deep = solve({ radius: 500, horizon: '7' }), gt = L.gougeText(deep);
    ok(deep.binding === 'deck' && !/can launch only/.test(page + gt) && gt.indexOf('under this example cycle schedule') >= 0 && !/cannot buy back|causing sustainable daily sorties|even with an undamaged deck/.test(P + ' ' + G + ' ' + R) && /example cycle schedule/.test(F) && /example cycle schedule/.test(G) && /example cycle schedule/.test(R) && /example cycle schedule/.test(cards(deep)), 'DISCRIMINATOR: Field Guide, Gouge, README, Card B and the callout call the ceiling this example cycle schedule\'s, not the deck\'s necessary limit');
    const tm = page.match(/a second oiler is needed from about ([\d,]+) nm and a second ammunition ship from about ([\d,]+) nm/), b180 = L.dailyBill(180), nm = x => +x.replace(/,/g, '');
    ok(tm && L.pipeline(b180, nm(tm[1]) - 15).oilers === 1 && L.pipeline(b180, nm(tm[1]) + 15).oilers === 2 && L.pipeline(b180, nm(tm[2]) - 30).ammo === 1 && L.pipeline(b180, nm(tm[2]) + 30).ammo === 2, 'transit tooltip boundaries (' + (tm ? tm[1] + ' / ' + tm[2] : '?') + ' nm) match the v3.4 pipeline at 180 sorties/day');
  });

  group('Cost check: cost terms are labelled simplifications; tanker price consistent; per-effect bases labelled', () => {
    const dir = path.dirname(html), gName = (/public|index|offline/.test(path.basename(html)) ? ['gouge.html', 'air_boss_gouge.html'] : ['air_boss_gouge.html', 'gouge.html']).find(f => fs.existsSync(path.join(dir, f)));
    const G = gName ? text(fs.readFileSync(path.join(dir, gName), 'utf8')) : '', R = fs.existsSync(path.join(dir, 'README.md')) ? fs.readFileSync(path.join(dir, 'README.md'), 'utf8').replace(/\s+/g, ' ') : '';
    const P = text(page), d = design(), panel = text(D.panelHTML(d, { nCustom: 4, customEffect: 100, costPerEffect: 1 }));
    // The stale tanker price: no player-facing text may state a tanker price other than the catalog value.
    const tank = [...(P + ' ' + G + ' ' + R).matchAll(/(?:MQ-25|tanker archetype|tanker drone)[^.$]{0,30}\$(\d+)M/gi)].map(m => +m[1]);
    ok(!/\$184M/.test((P + ' ' + G + ' ' + R).replace(/a \$184M weapon-system figure/g, '')) && tank.length > 0 && tank.every(v => v === T.CAT.mq25.cost), 'DISCRIMINATOR: every player-facing tanker price equals the catalog ($' + T.CAT.mq25.cost + 'M); no stale $184M (' + tank.join(', ') + ')');
    // Never a universal PAUC >= APUC claim (a PAUC denominator can include development units).
    const universal = /PAUC[^.]{0,60}(?:always|never (?:below|less)|by definition|>= ?APUC)[^.]{0,30}APUC|PAUC[^.]{0,40}>= ?APUC/i;
    ok(!universal.test(P) && !universal.test(G) && !universal.test(R), 'DISCRIMINATOR: no page, Gouge or README text claims PAUC is always at least APUC');
    const cb = caveat(D.panelHTML(d, {}), 'cost-breakdown') || '';
    ok(cb.indexOf('excludes facilities') >= 0 && cb.indexOf('no separate development articles') >= 0 && cb.indexOf('one-time production and test costs') >= 0 && /15% \[illustrative\]/.test(cb), 'DISCRIMINATOR: the cost caveat states the omissions (facilities, development articles, one-time production costs) and marks 15% illustrative');
    ok(panel.indexOf('Unit recurring flyaway cost: $' + T.fmt(d.costs.flyaway, 2) + 'M') >= 0 && !/Unit flyaway cost/.test(panel) && /PAUC-style basis; not comparable with the wing's recurring flyaway \$ per effect point/.test(panel), 'readout: recurring flyaway, and the cost-per-effect basis is labelled and not offered as like-for-like');
    const fake = { summary: { effects: 1, dollarsPerEffect: 1 }, label: 'x' }, cmp = T.watchCompareHTML ? text(T.watchCompareHTML({ off: fake, strike: fake })) : '';
    ok(cmp.indexOf('Wing recurring flyaway $ per effect point') >= 0 && !/Wing flyaway \$/.test(cmp), 'DISCRIMINATOR: the comparison labels its basis (wing recurring flyaway)');
    ok(/not normalized to one dollar year/.test(P) && /not normalized to one dollar year/.test(G) && /not normalized to one dollar year/.test(R) && !/compared on uniform recurring flyaway unit cost/.test(P + ' ' + G + ' ' + R), 'page, Gouge and README say the catalog is not normalized to one dollar year (no uniform-scope claim)');
    ok(/F\/A-18E\/F[^.]{0,40}\$63M[^.]{0,80}FY2013 then-year/.test(P) && /F-35C \$93M: U\.S\. carrier-variant unit recurring flyaway, air vehicle plus engine, in CY2012 dollars/.test(P), 'controls note: F/A-18E/F $63M (FY2013 then-year), F-35C $93M (CY2012 U.S. recurring flyaway)');
  });

  // Real aircraft keep their real names and carry their sourced numbers. The MQ-25 ledger is anchored to the program's air-
  // refueling requirement: threshold >= 14,000 lb of give at 500 nm from the carrier (objective >= 16,000 lb; current estimate
  // >= 14,000 lb; demonstrated performance TBD), MQ-25 SAR / MSAR FY2027 PB (21 Apr 2026), printed p. 12. The source gives one
  // point; the game law at other stations (14,000 + 10 x (500 - orbit) lb) is labelled illustrative.
  group('Real names: MQ-25 Stingray named, its ledger anchored to the published 14,000 lb at 500 nm threshold', () => {
    const dir = path.dirname(html), gName = (/public|index|offline/.test(path.basename(html)) ? ['gouge.html', 'air_boss_gouge.html'] : ['air_boss_gouge.html', 'gouge.html']).find(f => fs.existsSync(path.join(dir, f)));
    const G = gName ? text(fs.readFileSync(path.join(dir, gName), 'utf8')) : '', R = fs.existsSync(path.join(dir, 'README.md')) ? fs.readFileSync(path.join(dir, 'README.md'), 'utf8').replace(/\s+/g, ' ') : '';
    const P = text(page), fgm = page.match(/<details id="local-guide"[^>]*>([\s\S]*?)<\/details>/), F = fgm ? text(fgm[1]) : '';
    ok(T.CAT.mq25.name === 'MQ-25 Stingray' && /MQ-25/.test(P) && /MQ-25/.test(G) && /MQ-25 Stingray/.test(R) && !/Tanker Drone|tanker drone/.test(P + ' ' + G + ' ' + R), 'DISCRIMINATOR: the real tanker keeps its real name (MQ-25 Stingray) on the page, in the Gouge and README; no generic stand-in name');
    const at = o => T.tankerLedger('mq25', o, false), law = o => 14000 + 10 * (500 - o);
    let onLaw = true; for (let o = 0; o <= 900; o += 10) if (!(at(o).feasible && at(o).offload === law(o))) onLaw = false;
    T.setDeck('nimitz'); const rec = T.evalWing(300, { mq25: 1 }, { tankerTactics: T.TACTIC_PLANS.recovery });
    ok(at(500).offload === 14000 && onLaw && near(rec.recoveryGas / 1.5, 14000, 1e-9), 'DISCRIMINATOR: MQ-25 ledger anchored: ' + at(500).offload + ' lb at 500 nm (published threshold 14,000 lb); single-station give = 14,000 + 10 x (500 - orbit) lb at every 10-nm station 0-900 nm (' + at(150).offload + ' lb at 150 nm); recovery sortie credited ' + (rec.recoveryGas / 1.5) + ' lb');
    const tb = caveat(T.designer.panelHTML(design(), {}), 'tanker-archetype') || '';
    ok(/requirement and an estimate, not demonstrated performance/.test(tb) && /TBD/.test(F) && /14,000 lb at 500 nm/.test(F) && /TBD/.test(G) && /at least 14,000 lb of fuel given at 500 nm/.test(G) && /TBD/.test(R) && /at least 14,000 lb of fuel given at 500 nm/.test(R) && !/demonstrated (?:offload|capability) of|has demonstrated/i.test(P + ' ' + G + ' ' + R), 'DISCRIMINATOR: caveat, Field Guide, Gouge and README call 14,000 lb at 500 nm a requirement / estimate with demonstrated performance TBD');
    const fr = F.match(/The MQ-25 single reach is ([\d,]+) nm/), gr = G.match(/MQ-25: Single reach \(([\d,]+) nm/), num = x => +String(x).replace(/,/g, '');
    ok(fr && gr && num(fr[1]) === at(150).maxReach && num(gr[1]) === at(150).maxReach && /single reach 1,900 nm/.test(R), 'Field Guide, Gouge and README MQ-25 single reach (' + (fr ? fr[1] : '?') + ' nm) equals the ledger (' + at(150).maxReach + ' nm)');
    const dt = T.designer.launchOffsetMin(500, .65), need = T.designer.tankersRequired(T.designer.loiterFuel(12, dt)), gm = G.match(/13,210 lb of loiter gas, (\d+) MQ-25 sortie[s]? \(([\d,]+) lb at the 150-nm station\)/);
    ok(gm && +gm[1] === need && num(gm[2]) === T.designer.tankerOffload(), 'Gouge doctrine card: 12 fighters need ' + (gm ? gm[1] : '?') + ' MQ-25 sortie of ' + (gm ? gm[2] : '?') + ' lb = engine (' + need + ' x ' + T.designer.tankerOffload() + ' lb)');
  });

  // v3.4 round 4 (release decision 2026-10-04): "Go with 600 nm, show 667 demonstrated". F-35C program MSAR FY2027 PB, printed p. 14,
  // Combat Radius NM - CV Variant: current estimate 600 (= threshold 600), demonstrated 667. The engine flies 600; 667 is a
  // labelled display value only.
  group('Real numbers: F-35C combat radius 600 nm (program current estimate = threshold); 667 nm demonstrated shown, not flown', () => {
    const dir = path.dirname(html), gName = (/public|index|offline/.test(path.basename(html)) ? ['gouge.html', 'air_boss_gouge.html'] : ['air_boss_gouge.html', 'gouge.html']).find(f => fs.existsSync(path.join(dir, f)));
    const G = gName ? text(fs.readFileSync(path.join(dir, gName), 'utf8')) : '', R = fs.existsSync(path.join(dir, 'README.md')) ? fs.readFileSync(path.join(dir, 'README.md'), 'utf8').replace(/\s+/g, ' ') : '';
    const saved = { weapon: T.st.weapon, strike: T.st.strike }; T.setDeck('nimitz'); Object.assign(T.st, { weapon: 'amraam', strike: 'direct' });
    // Hand values: no tankers -> no top-off; AMRAAM in the bay costs 0.05 x 0.2 = 1% of clean radius; direct attack stands off
    // 25 nm. clean = 600 x 0.99 = 594 nm; at 700 nm the F-35C needs (700 - 25 - 594) x 13.5 = 1,093.5 lb of tanker gas per sortie
    // (650 would give 643.5 nm / 425.25 lb; 667 would give 660.33 nm / 198.05 lb).
    const x = T.evalWing(700, { f35c: 12 }, { tankerTactics: T.TACTIC_PLANS.strike }).byType.find(y => y.key === 'f35c');
    Object.assign(T.st, saved);
    ok(T.CAT.f35c.clean === 600 && x && near(x.clean, 594, 1e-9) && near(x.dP, 1093.5, 1e-9), 'DISCRIMINATOR: F-35C flies the published 600-nm current estimate: clean radius ' + T.CAT.f35c.clean + ' nm, AMRAAM-loaded ' + (x ? x.clean.toFixed(2) : '?') + ' nm, ' + (x ? x.dP.toFixed(1) : '?') + ' lb gas per sortie at 700 nm (hand: 594 nm, 1,093.5 lb); 667 is never an engine input');
    const note = text(T.CAT.f35c.note), desc = text(T.CAT.f35c.desc);
    const has = (s, t) => s.includes(t);
    ok(has(note, 'Combat radius 600 nm (program current estimate = threshold); 667 nm demonstrated.') &&
      has(desc, '600 nm is the program current estimate (equal to the threshold) and is the value the game flies; 667 nm is demonstrated performance, shown for reference only and not used in the model') &&
      has(G, 'F-35C combat radius: 600 nm, the program current estimate (equal to the threshold)') && has(G, '667 nm demonstrated is shown for reference only and is not used in the model') &&
      has(R, 'F-35C Combat Radius:** 600 nm, the program current estimate (equal to the threshold)') && has(R, '667 nm demonstrated, shown in the roster for reference only and not used in the model') &&
      !has(note + ' ' + desc + ' ' + G, '650 nm'),
      'DISCRIMINATOR: the F-35C roster row, its description, the Gouge and README show 600 nm labelled program current estimate = threshold and 667 nm labelled demonstrated (reference only)');
  });

  bad += S.done(path.basename(html));
}
if (bad) { console.log('MODEL HONESTY SUITE FAILED: ' + bad + ' failure(s)'); process.exit(1); }
console.log('MODEL HONESTY SUITE PASSED: fuel scaling, cost terms, approach lift, deck-reset ledger, deck footprint gate, caveats');
