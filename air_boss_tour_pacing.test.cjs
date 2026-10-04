/* Air Boss v3.3 "Watch the Air Boss" pacing suite (spec 9.2-9.3, Tests D13-D14). Runs the SHIPPED tour on a virtual clock behind
 * a storage-backed fake DOM: reading-time dwell per explainer and pace, Pause / Resume, Next (one sub-step, also while
 * paused and during the day run), pace rescaling, composed hover / focus / manual pause locks, Space / ArrowRight,
 * capture-phase takeover exemptions, stale-timer cancellation and reduced motion. Nothing is re-implemented: dwell
 * expectations are the spec formula ceil(max(6 s, words / 3 + 2 s) x k x 1000) applied to the text the engine wrote
 * into #watch-explainer.
 * Run: node air_boss_tour_pacing.test.cjs [build.html]   (no argument: every build present; exit 0 = PASS)
 */
'use strict';
const path = require('node:path');
const { builds, loadEngine, target, suite } = require('./air_boss_test_loader.cjs');
const K = { relaxed: 1, normal: .6, brisk: .35 };
const spec = (text, pace) => { const w = String(text).trim() ? String(text).trim().split(/\s+/).length : 0; return Math.ceil(Math.max(6, w / 3 + 2) * K[pace] * 1000); };
const ORDER = ['scenario', 'wing', 'weapons', 'tankers', 'launch', 'result'];
let bad = 0;
for (const html of builds()) {
  const S = suite('PACING SUITE'), ok = S.ok, group = S.group;
  console.log('== ' + path.basename(html));
  const words = n => Array.from({ length: n }, (_, i) => 'w' + i).join(' ');

  group('D13 dwell formula fixtures', () => {
    const { T } = loadEngine(html);
    const P = T.watchPacing;
    ok(JSON.stringify(['relaxed', 'normal', 'brisk'].map(p => P.dwellMs(words(12), p))) === '[6000,3600,2100]', 'D13 Step A 12 words: 6,000 / 3,600 / 2,100 ms');
    ok(JSON.stringify(['relaxed', 'normal', 'brisk'].map(p => P.dwellMs(words(36), p))) === '[14000,8400,4900]', 'D13 Step B 36 words: 14,000 / 8,400 / 4,900 ms');
    ok(P.dwellMs('', 'relaxed') === 6000 && P.dwellMs(words(3), 'relaxed') === 6000 && P.dwellMs(words(13), 'relaxed') === spec(words(13), 'relaxed'), 'D13 6-s floor holds for short or empty explainers; 13 words just above the floor');
    ok(P.PACE.relaxed.k === 1 && P.PACE.normal.k === .6 && P.PACE.brisk.k === .35 && P.ctx.pace === 'relaxed', 'D13 pace presets 1.00 / 0.60 / 0.35; Relaxed is the default');
    ok(P.words('  a  b\tc\nd ') === 4, 'D13 word count splits on whitespace');
  });

  for (const pace of ['relaxed', 'normal', 'brisk']) group('D13 shipped tour dwell per step at ' + pace, () => {
    const { T, clock, el } = loadEngine(html), P = T.watchPacing, W = T.watchState;
    el('watch-pace').value = pace; el('watch-pace').fire('change');
    ok(P.ctx.pace === pace, 'pace selector sets ' + pace);
    T.startWatch('pace-' + pace); clock.advance(0);
    const seen = [];
    for (let i = 0; i < 6; i++) {
      const phase = W.phase, text = el('watch-explainer').textContent, want = spec(text, pace);
      ok(phase === ORDER[i] && text.trim().length > 0 && P.ctx.dwellTotal === want && want >= Math.ceil(6 * K[pace] * 1000), 'step ' + phase + ': ' + P.words(text) + ' words -> dwell ' + want + ' ms');
      clock.advance(want - 1);
      const held = W.phase === phase;
      clock.advance(1);
      ok(held && W.phase !== phase, 'step ' + phase + ' holds for ' + want + ' ms, then advances (to ' + W.phase + ')');
      seen.push(phase);
    }
    ok(W.cycle === 1 && W.phase === 'scenario' && JSON.stringify(seen) === JSON.stringify(ORDER), 'five-step cycle (scenario, roster, loadout, tankers, day ops and results) then Next Cycle');
    T.stopWatch();
  });

  group('D13 Pause / Resume freezes and restores remaining dwell', () => {
    const { T, clock, el } = loadEngine(html), P = T.watchPacing, W = T.watchState;
    T.startWatch('pause'); clock.advance(0);
    const want = P.ctx.dwellTotal;
    clock.advance(1000); el('watch-pause').fire('click');
    ok(P.ctx.manualPause && el('watch-pause').textContent === 'Resume' && /paused/i.test(el('watch-status').textContent), 'Pause: button reads Resume, status shows paused');
    clock.advance(120000);
    ok(W.phase === 'scenario' && P.ctx.remaining === want - 1000, 'no step transition while paused (120 s); remaining ' + P.ctx.remaining + ' ms frozen');
    el('watch-pause').fire('click');
    ok(!P.ctx.manualPause && el('watch-pause').textContent === 'Pause', 'Resume: button reads Pause');
    clock.advance(want - 1000 - 1); const held = W.phase === 'scenario'; clock.advance(1);
    ok(held && W.phase === 'wing', 'resume continues with max(0, total - elapsed) = ' + (want - 1000) + ' ms');
    T.stopWatch();
  });

  group('D13 Next advances exactly one sub-step and resets the timer', () => {
    const { T, clock, el } = loadEngine(html), P = T.watchPacing, W = T.watchState;
    T.startWatch('next'); clock.advance(0); clock.advance(2000);
    el('watch-next').fire('click'); clock.advance(0);
    ok(W.phase === 'wing' && P.ctx.dwellTotal === spec(el('watch-explainer').textContent, 'relaxed'), 'Next: scenario -> wing immediately, explainer updated, fresh dwell');
    const want = P.ctx.dwellTotal; clock.advance(want - 1); const held = W.phase === 'wing'; clock.advance(1);
    ok(held && W.phase === 'weapons', 'Next reset the timer: wing holds its full dwell');
    P.togglePause(); P.next(); clock.advance(0);
    ok(W.phase === 'tankers' && P.ctx.manualPause && el('watch-explainer').textContent.length > 0, 'Next while paused: advances one card (tankers), updates the explainer, stays paused');
    clock.advance(60000);
    ok(W.phase === 'tankers', 'still paused after Next: timer disarmed');
    P.next(); clock.advance(0);
    ok(W.phase === 'launch' && !T.dayRunning(), 'Next while paused into Day Flight Operations: deck card shown, day not started while paused');
    P.togglePause(); clock.advance(0);
    ok(T.dayRunning() || W.phase === 'launch', 'Resume starts the day run');
    P.next(); clock.advance(0);
    ok(W.phase === 'result' && !T.dayRunning() && /Day tally/.test(el('daytally').innerHTML), 'Next during the day run: animation cancelled, combat results completed, Day Results card shown');
    const n = P.ctx.log.filter(x => x.phase === 'result').length; clock.advance(P.ctx.dwellTotal - 1);
    ok(W.phase === 'result' && P.ctx.log.filter(x => x.phase === 'result').length === n, 'results dwell armed once; no duplicate result from the cancelled run');
    clock.advance(1);
    ok(W.phase === 'scenario' && W.cycle === 1, 'after the results dwell: Next Cycle (1)');
    T.stopWatch();
  });

  group('D13 Next during the animated day run (no reduced motion)', () => {
    const { T, clock, el } = loadEngine(html, { reduce: false }), P = T.watchPacing, W = T.watchState;
    T.startWatch('day'); clock.advance(700);
    for (let i = 0; i < 4; i++) { P.next(); clock.advance(700); }
    ok(W.phase === 'launch' && T.dayRunning(), 'day animation running in the launch step');
    P.next(); clock.advance(0);
    ok(W.phase === 'result' && !T.dayRunning() && /Day tally/.test(el('daytally').innerHTML), 'Next cancels the 7-s day animation and shows results at once');
    clock.advance(20000 > P.ctx.dwellTotal ? P.ctx.dwellTotal - 200 : 20000);
    ok(W.phase === 'result', 'cancelled animation frames do not re-enter results');
    T.stopWatch();
  });

  group('D13 pace change rescales the remaining dwell', () => {
    const { T, clock, el } = loadEngine(html), P = T.watchPacing, W = T.watchState;
    T.startWatch('rescale'); clock.advance(0);
    const want = P.ctx.dwellTotal; clock.advance(2000);
    el('watch-pace').value = 'brisk'; el('watch-pace').fire('change');
    const rem = (want - 2000) * .35;
    ok(Math.abs(P.ctx.remaining - rem) < 1e-6 && W.active, 'Relaxed -> Brisk mid-step: remaining ' + rem.toFixed(1) + ' ms = old remaining x 0.35 / 1.00; tour keeps running');
    clock.advance(rem - .5); const held = W.phase === 'scenario'; clock.advance(1);
    ok(held && W.phase === 'wing', 'rescaled step ends on time');
    P.togglePause(); clock.advance(1000); const before = P.ctx.remaining, tot = P.ctx.dwellTotal; P.setPace('normal');
    ok(Math.abs(tot - spec(el('watch-explainer').textContent, 'brisk')) < 1e-9 && Math.abs(P.ctx.remaining - before * .6 / .35) < 1e-6 && Math.abs(P.ctx.dwellTotal - tot * .6 / .35) < 1e-6 && P.isPaused(), 'pace change while paused rescales the frozen remainder (' + before.toFixed(1) + ' -> ' + P.ctx.remaining.toFixed(1) + ' ms) and stays paused');
    T.stopWatch();
  });

  group('D13 composed hover / focus / manual pause locks', () => {
    const { T, clock, el } = loadEngine(html), P = T.watchPacing, W = T.watchState, tip = el('watch-explainer');
    T.startWatch('locks'); clock.advance(0);
    tip.fire('mouseenter'); clock.advance(60000);
    ok(P.ctx.hoverPause && W.phase === 'scenario', 'hover on #watch-explainer pauses (60 s, no transition)');
    tip.fire('focusin'); tip.fire('mouseleave'); clock.advance(60000);
    ok(!P.ctx.hoverPause && P.ctx.focusPause && W.phase === 'scenario', 'mouseleave does not unpause while keyboard focus remains');
    tip.fire('focusout', { relatedTarget: tip }); clock.advance(60000);
    ok(P.ctx.focusPause && W.phase === 'scenario', 'focus moving inside the explainer keeps the lock');
    tip.fire('focusout', { relatedTarget: null });
    ok(!P.ctx.focusPause && !P.isPaused(), 'focus leaving the explainer clears the lock');
    const left = P.ctx.remaining; clock.advance(left - 1); const held = W.phase === 'scenario'; clock.advance(1);
    ok(held && W.phase === 'wing', 'tour resumes the remaining ' + left + ' ms');
    P.togglePause(); tip.fire('mouseenter'); tip.fire('mouseleave'); clock.advance(60000);
    ok(P.ctx.manualPause && P.isPaused() && W.phase === 'wing', 'mouseleave does not unpause a manual pause');
    T.stopWatch();
  });

  group('D13 keyboard: Space toggles, ArrowRight advances, typing and repeats suppressed', () => {
    const { T, clock, dispatch } = loadEngine(html), P = T.watchPacing, W = T.watchState;
    T.startWatch('keys'); clock.advance(0);
    let e = dispatch('keydown', { key: ' ', code: 'Space', target: target(null, 'BODY') });
    ok(P.ctx.manualPause && e.defaultPrevented && W.active, 'Space pauses (preventDefault) and keeps the tour');
    e = dispatch('keydown', { key: ' ', code: 'Space', repeat: true, target: target(null, 'BODY') });
    ok(P.ctx.manualPause && W.active, 'auto-repeat Space is suppressed');
    dispatch('keydown', { key: ' ', code: 'Space', target: target(null, 'BODY') });
    ok(!P.ctx.manualPause, 'Space resumes');
    dispatch('keydown', { key: 'ArrowRight', target: target(null, 'BODY') }); clock.advance(0);
    ok(W.phase === 'wing' && W.active, 'ArrowRight advances one step');
    dispatch('keydown', { key: ' ', code: 'Space', target: target('panel', 'SELECT') });
    dispatch('keydown', { key: 'ArrowRight', target: target('panel', 'SELECT') }); clock.advance(0);
    ok(!P.ctx.manualPause && W.phase === 'wing' && W.active, 'typing in the pace selector: Space / ArrowRight suppressed, tour continues');
    dispatch('keydown', { key: ' ', code: 'Space', target: target(null, 'INPUT') });
    ok(!P.ctx.manualPause && !W.active, 'typing in a game input outside the panel: shortcut suppressed, manual takeover stops the tour');
  });

  group('capture-phase takeover exemptions', () => {
    const { T, clock, dispatch } = loadEngine(html), W = T.watchState;
    T.startWatch('capture'); clock.advance(0);
    ['pointerdown', 'click', 'input', 'change'].forEach(t => dispatch(t, { target: target('panel', 'BUTTON') }));
    ok(W.active, 'pointerdown / click / input / change inside #watch-panel do not stop the tour');
    ['pointerdown', 'click'].forEach(t => dispatch(t, { target: target('explainer', 'ASIDE') }));
    ok(W.active, 'interaction inside #watch-explainer (outside #watch-panel) does not stop the tour');
    dispatch('click', { target: target('deck', 'BUTTON') });
    ok(W.active, 'deck / tempo choices remain permitted (queued for the next cycle)');
    dispatch('click', { target: target(null, 'BUTTON') });
    ok(!W.active, 'a click on an unrelated game card is a manual takeover');
  });

  group('stale-timer cancellation (cleared timers still fire)', () => {
    const { T, clock } = loadEngine(html, { ignoreClear: true }), P = T.watchPacing, W = T.watchState;
    T.startWatch('stale'); clock.advance(0);
    const oldDue = P.ctx.dwellTotal, t0 = P.ctx.token; P.next(); clock.advance(0);
    ok(P.ctx.token === t0 + 1 && W.phase === 'wing', 'Next increments the generation token');
    P.togglePause();   // paused: no legitimate transition can happen, so any advance would come from the stale timer
    const arms = P.ctx.log.length; clock.advance(oldDue + 1000);
    ok(W.phase === 'wing' && P.ctx.log.length === arms, 'the superseded scenario timer fires (at ' + oldDue + ' ms) but returns on the token check (no advance, no re-arm)');
    P.togglePause();
    T.stopWatch(); clock.advance(200000);
    ok(!W.active && W.phase === 'stopped', 'Stop: every pending callback is inert');
    T.startWatch('stale-2'); clock.advance(0); const t1 = P.ctx.token; T.startWatch('stale-3'); clock.advance(0);
    ok(P.ctx.token > t1 && W.seed === 'stale-3' && W.phase === 'scenario', 're-starting Watch invalidates the previous run');
    clock.advance(P.ctx.dwellTotal - 1);
    ok(W.phase === 'scenario', 'no zombie advance from the previous run');
    T.stopWatch();
  });

  group('D14 "With CCAs" Watch toggle (spec 9.3)', () => {
    const CCA = loadEngine(html).T.CCA_KEYS;   // the engine's CCA keys (public builds alias the concept keys)
    const setToggle = (e, on) => { e.el('watch-with-ccas').checked = on; e.el('watch-with-ccas').fire('change'); };
    const runToResult = (e, seed) => { const W = e.T.watchState; e.T.watchPacing.setPace('brisk'); e.T.startWatch(seed); e.clock.advance(0);
      for (let i = 0; i < 400 && W.phase !== 'result'; i++) e.clock.advance(250); return e; };
    const fresh = loadEngine(html);
    // D14.1 default state and DOM binding
    ok(fresh.T.watchState.withCCAs === true && fresh.el('watch-with-ccas').checked === true && /id="watch-with-ccas-label"[^>]*title="[^"]+"><input type="checkbox" id="watch-with-ccas" checked> <span class="toggle-text">With CCAs<\/span>/.test(fresh.html) && fresh.html.indexOf('id="watch-start"') < fresh.html.indexOf('id="watch-with-ccas"') && fresh.html.indexOf('id="watch-with-ccas"') - fresh.html.indexOf('id="watch-start"') < 300, 'D14.1 #watch-with-ccas checkbox beside the Watch button (#watch-start), checked by default, label "With CCAs" with a tooltip');
    ok(fresh.html.indexOf("'watch-with-ccas':'Toggle ON to tour the carrier air wing operating with autonomous CCAs; toggle OFF to tour the exact same scenario with a traditional crewed-only strike package") >= 0, 'D14.1 accessible help text (spec 9.3.2 item 4)');
    // D14.3 strict ceteris paribus on a wing that fields CCAs
    const mixed = { f35c: 4, fa18: 6, mq25: 6, horn5: 2, cap: 6, isr: 2 }; CCA.forEach((k, i) => { mixed[k] = [8, 2, 2, 3, 4][i]; });
    ok(CCA.length === 5 && CCA.indexOf('ccx') >= 0 && CCA.indexOf('custom') >= 0 && CCA.indexOf('ccxcap') >= 0, 'D14 CCA set: CCX-1 (strike and on CAP), the two CCA concepts and Your Design');
    const off = fresh.T.watchCCAAlloc(mixed, false), on = fresh.T.watchCCAAlloc(mixed, true);
    ok(JSON.stringify(on) === JSON.stringify(mixed) && on !== mixed, 'D14 ON keeps the wing exactly (a copy)');
    ok(CCA.every(k => off[k] === 0) && Object.keys(mixed).filter(k => CCA.indexOf(k) < 0).every(k => off[k] === mixed[k]), 'D14.3 OFF zeroes CCX-1, CCA-Strike, CCA-Penetrator and Your Design; crewed fighters, MQ-25 tankers, CAP and ISR unchanged');
    const T = fresh.T; Object.assign(T.st, { wing: 2, tempo: 0, strike: 'direct', tankerTactics: T.TACTIC_PLANS.balanced });
    const rOn = T.evalWing(400, on), rOff = T.evalWing(400, off), crewedKeys = r => r.byType.filter(x => CCA.indexOf(x.key) < 0).map(x => [x.key, x.n, x.ssScheduled]);
    const sOn = T.watchSummary(rOn, on), sOff = T.watchSummary(rOff, off);
    ok(rOn.byType.some(x => CCA.indexOf(x.key) >= 0 && x.ss > 0) && !rOff.byType.some(x => CCA.indexOf(x.key) >= 0) && JSON.stringify(crewedKeys(rOn)) === JSON.stringify(crewedKeys(rOff)), 'D14.3 OFF removes exactly the CCA sorties; crewed strike fighter counts and schedule unchanged');
    ok(sOff.operators === 0 && sOff.ccaSorties === 0 && sOff.ccaLosses === 0 && sOn.operators > 0 && sOn.ccaSorties > 0, 'D14.3 / D14.5 OFF: 0 CCA operators, 0 CCA sorties, 0 CCA losses (ON: ' + sOn.operators + ' operators, ' + sOn.ccaSorties.toFixed(1) + ' CCA sorties)');
    ok(sOn.effects >= sOff.effects, 'D14.5 E_with ' + sOn.effects.toFixed(1) + ' >= E_without ' + sOff.effects.toFixed(1) + ' under identical conditions');
    // D14.3 / D14.4 the shipped tour, same seed, both settings
    const A = runToResult(loadEngine(html), 'd14-seed'), Bx = loadEngine(html); setToggle(Bx, false); const B = runToResult(Bx, 'd14-seed');
    ok(A.T.watchState.phase === 'result' && B.T.watchState.phase === 'result' && B.T.watchState.withCCAs === false, 'D14 both tours reach the day results');
    const run = e => ({ scenario: e.T.watchState.input.scenario, seed: e.T.watchState.seed, days: e.T.SCENARIOS[e.T.watchState.input.scenario].days || 1, range: e.T.st.rng, tempo: e.T.st.tempo,
      fighters: JSON.stringify([e.T.st.alloc.f35c || 0, e.T.st.alloc.fa18 || 0, e.T.st.alloc.isr || 0]), deck: e.T.getDeck(), loadout: e.T.st.strike + '/' + e.T.st.weapon, tankers: JSON.stringify(e.T.st.tankerTactics) + (e.T.st.alloc.mq25 || 0) });
    const runOn = run(A), runOff = run(B);
    ok(['scenario', 'seed', 'days', 'range', 'tempo', 'fighters', 'deck', 'loadout', 'tankers'].every(k => runOff[k] === runOn[k]), 'D14.4 OFF keeps the same scenario, seed, days, range, tempo, F-35C, F/A-18E/F and E-2 / EA-18G, deck, loadout and tankers');
    ok(JSON.stringify(A.T.st.alloc) === JSON.stringify(A.T.watchTourAlloc(A.T.watchState.input, true).alloc) && JSON.stringify(B.T.st.alloc) === JSON.stringify(B.T.watchState.input.alloc) && CCA.every(k => !B.T.st.alloc[k]), 'D14.3 ON flies the seeded wing plus the tour CCA complement; OFF flies the seeded wing with no CCA');
    const sA = A.T.watchCompareStore(), sB = B.T.watchCompareStore();
    ok(JSON.stringify(sA.on.summary) === JSON.stringify(A.T.watchSummary(A.T.evalWing(A.T.st.rng), A.T.st.alloc)) && JSON.stringify(sB.off.summary) === JSON.stringify(B.T.watchSummary(B.T.evalWing(B.T.st.rng), B.T.st.alloc)), 'D14.5 recorded values equal the engine for each run');
    ok(/Now try it without CCAs/.test(A.el('watch-compare').innerHTML) && /Now try it with CCAs/.test(B.el('watch-compare').innerHTML), 'D14 a single run prompts the other setting');
    // one session, both settings
    A.T.stopWatch(); setToggle(A, false); runToResult(A, 'd14-seed');
    const st = A.T.watchCompareStore(), h = A.el('watch-compare').innerHTML;
    ok(st.on && st.off && h === A.T.watchCompareHTML(st) && /Crewed only/.test(h) && /With CCAs/.test(h) && /Delta/.test(h), 'D14.5 after both settings: Crewed only / With CCAs / Delta table rendered from the engine summaries');
    ['effects', 'sorties', 'fuelGal', 'weapons', 'aircrewHours', 'binding', 'operators', 'crewedLosses', 'ccaLosses', 'dollarsPerEffect'].forEach(k => ok(k in st.on.summary && k in st.off.summary, 'D14.5 comparison carries ' + k));
    ok(!Object.is(st.off.summary.operators, -0) && !/>-0</.test(h), 'D14 zero CCA operators render as 0, never -0');
    // D14.2 in-flight lock
    const L = loadEngine(html); L.T.startWatch('lock'); L.clock.advance(0);
    ok(L.el('watch-with-ccas').disabled === true, 'D14.2 starting the tour disables #watch-with-ccas');
    setToggle(L, false);
    ok(L.T.watchState.withCCAs === true && L.el('watch-with-ccas').checked === true && L.T.watchSetCCAs(false) === false, 'D14.2 a change while the tour runs is rejected and the box is reset');
    L.T.watchPacing.togglePause(); setToggle(L, false);
    ok(L.el('watch-with-ccas').disabled === true && L.T.watchState.withCCAs === true, 'D14.2 Pause does not unlock the toggle');
    L.T.stopWatch();
    ok(L.el('watch-with-ccas').disabled === false, 'D14.2 Stop re-enables the toggle');
    setToggle(L, false);
    ok(L.T.watchState.withCCAs === false && L.el('watch-with-ccas').checked === false, 'D14.2 after Stop the toggle switches OFF');
  });

  group('Tour CAP: With CCAs ON, CCX-1 fly CAP in the CAP fighter spots (same deck; E-2 / EA-18G and every strike fighter unchanged; OFF = the v3.2 tour wing)', () => {
    const E = loadEngine(html), T = E.T; T.st.wing = 2;
    const W075 = T.CAT.ccx.spots;
    const setQ = q => { T.applyScenario(q.scenario, { deck: q.deck, tempo: q.tempo }); Object.assign(T.st, { rng: q.range, tempo: q.tempo, strike: q.strike, weapon: q.weapon, strikeOrbit: q.strikeOrbit, relayOrbit: q.relayOrbit, tankerTactics: Object.assign({}, T.TACTIC_PLANS[q.plan]) }); };
    // per scenario: the three tour seeds first (each reproduces a fixed reference tour at index 0 exactly), else the first seed whose day is not fuel-dead (engine-checked)
    const seeds = {}; ['tour-0-11491', 'tour-1-13234', 'tour-10-6114'].concat(Array.from({ length: 200 }, (_, i) => 'tcap-' + i)).forEach(sd => { const q = T.watchCycle(sd, 0, { deck: 'nimitz', tempo: 0 }); if (q.scenario in seeds) return; setQ(q); if (T.evalWing(q.range, q.alloc).effects > 0) seeds[q.scenario] = sd; });
    ok(Object.keys(seeds).length === 3 && T.TOUR_CAP_KEY === 'ccxcap' && !!T.CAT.ccxcap && T.CAT.ccxcap.role === 'cap' && T.CAT.ccxcap.spots === W075 && T.CAT.ccxcap.cost === T.CAT.ccx.cost && T.CCA_KEYS.indexOf('ccxcap') >= 0, 'Tour CAP: CCX-1 on CAP is a CAP-role CCA at the shipped 0.75 spot weight and CCX-1 price; tour seeds for all three scenarios ' + JSON.stringify(seeds));
    const want = m => { const n = Math.floor(m / W075 + 1e-9); return { n, label: m > 0 ? 'Same deck: ' + n + ' CCAs fly CAP in place of ' + m + ' CAP fighters -- same strike wing, fewer crew in the air' : 'Same deck: no CAP fighter spots to hand to CCAs' }; };
    Object.keys(seeds).forEach(sc => {
      const q = T.watchCycle(seeds[sc], 0, { deck: 'nimitz', tempo: 0 }), off = T.watchTourAlloc(q, false), on = T.watchTourAlloc(q, true), m = q.alloc.cap || 0, w = want(m);
      ok(JSON.stringify(off.alloc) === JSON.stringify(q.alloc) && off.fielded === 0 && off.label === '', 'Tour CAP OFF tour wing is the v3.2 wing exactly (' + sc + ')');
      ok(m > 0 && on.fielded === w.n && on.replaced === m && on.alloc.ccxcap === w.n && on.alloc.cap === 0, 'Tour CAP ' + sc + ': ' + w.n + ' CCX-1 fly CAP in place of ' + m + ' CAP fighters');
      ok(on.alloc.isr === q.alloc.isr && Object.keys(q.alloc).filter(k => k !== 'cap').every(k => on.alloc[k] === q.alloc[k]) && Object.keys(on.alloc).every(k => k === 'ccxcap' || k in q.alloc), 'Tour CAP ' + sc + ': E-2 / EA-18G unchanged; F-35C, F/A-18E/F, MQ-25 and buddy tankers unchanged (no crewed fighter re-roled)');
      const su = T.usedSpots(on.alloc), so = T.usedSpots(q.alloc);
      ok(su <= so + 1e-9 && su > so - W075 - 1e-9 && Math.abs((so - su) - (m - w.n * W075)) < 1e-9, 'Tour CAP ' + sc + ': same deck (ON ' + su + ' of the ' + so + ' OFF spots; as many CCX-1 as the CAP spots hold)');
      ok(on.label === w.label && !/(to|for|freed?|into)\s+strike|re-?rol/i.test(on.label), 'Tour CAP label "' + on.label + '" (never claims crewed fighters go to strike)');
      setQ(q); const rOn = T.evalWing(q.range, on.alloc), rOff = T.evalWing(q.range, q.alloc);
      const asCrewed = Object.assign({}, on.alloc, { ccxcap: 0, cap: w.n }), rEq = T.evalWing(q.range, asCrewed), rNone = T.evalWing(q.range, Object.assign({}, on.alloc, { ccxcap: 0 }));
      ok(!rOn.byType.some(x => x.key === 'ccxcap') && JSON.stringify(rOn.byType.map(x => [x.key, x.n])) === JSON.stringify(rOff.byType.map(x => [x.key, x.n])), 'Tour CAP ' + sc + ': CCAs on CAP fly no strike; the strike rows (types and counts) are identical ON and OFF');
      ok(rOn.effects === rEq.effects && rOn.meanSurv === rEq.meanSurv && rOn.capSorties === rEq.capSorties && rOn.strikeSorties === rEq.strikeSorties, 'Tour CAP ' + sc + ': ' + w.n + ' CCX-1 on CAP deliver exactly the existing CAP model of ' + w.n + ' CAP airframes (effect ' + rOn.effects.toFixed(1) + ')');
      ok(rOn.meanSurv > rNone.meanSurv && rOn.capCCASorties === rOn.capSorties && rOn.capSorties > 0 && rOff.capCCASorties === 0, 'Tour CAP ' + sc + ': the CCAs provide the CAP survivability term (mean survival ' + rOn.meanSurv.toFixed(4) + ' vs ' + rNone.meanSurv.toFixed(4) + ' with no CAP); every CAP sortie ON is a CCA sortie');
      const sOn = T.watchSummary(rOn, on.alloc), sOff = T.watchSummary(rOff, q.alloc);
      ok(sOn.ccaAirframes === w.n && sOn.operators > 0 && sOff.operators === 0 && Math.abs(sOn.ccaSorties - rOn.capCCASorties) < 1e-9 && sOn.aircrewHours < sOff.aircrewHours && sOn.ccaLosses === 0, 'Tour CAP ' + sc + ': summary counts the CCAs and their CAP sorties as uncrewed (' + sOn.operators + ' operators; aircrew ' + sOn.aircrewHours.toFixed(0) + ' vs ' + sOff.aircrewHours.toFixed(0) + ' h)');
    });
    ok((() => { const t = T.watchTourAlloc({ deck: 'nimitz', alloc: { f35c: 30, mq25: 6, isr: 2 } }, true); return t.fielded === 0 && t.alloc.isr === 2 && t.alloc.f35c === 30 && !('ccxcap' in t.alloc) && t.label === want(0).label; })(), 'Tour CAP no CAP fighters: 0 CCAs fielded, the E-2 / EA-18G and F-35C untouched, and the label says so');
    ok((() => { const t = T.watchTourAlloc({ deck: 'nimitz', alloc: { fa18: 20, cap: 1, isr: 2 } }, true); return t.fielded === 1 && t.alloc.cap === 0 && t.alloc.ccxcap === 1; })(), 'Tour CAP one CAP spot holds one CCX-1 (0.75 spot)');
    ok(T.autoSearch.toString().indexOf('.tour') >= 0 && T.CAT.ccxcap.tour === 1, 'Tour CAP: the tour-only CAP CCA is excluded from the Auto-Boss search');
    const results = {};
    for (const deck of ['nimitz', 'ford']) Object.keys(seeds).forEach(sc => {
      const runs = {};
      [true, false].forEach(on => { const e = loadEngine(html), W = e.T.watchState; e.T.setDeck(deck); e.T.watchSetCCAs(on); e.T.watchPacing.setPace('brisk'); e.T.startWatch(seeds[sc]); e.clock.advance(0);
        for (let i = 0; i < 400 && W.phase !== 'result'; i++) e.clock.advance(250);
        runs[on] = { s: e.T.watchCompareStore()[on ? 'on' : 'off'].summary, eng: e.T.watchSummary(e.T.evalWing(e.T.st.rng), e.T.st.alloc), cap: e.el('watch-compare').innerHTML + e.el('watch-result').textContent + e.el('watch-caption').textContent, alloc: e.T.st.alloc, q: W.input }; });
      const a = runs[true].s, b = runs[false].s, w = want(runs[true].q.alloc.cap || 0); results[deck + ' ' + sc] = { a, b };
      ok(JSON.stringify(a) === JSON.stringify(runs[true].eng) && JSON.stringify(b) === JSON.stringify(runs[false].eng), 'Tour CAP ' + sc + ' (' + deck + '): recorded with / without values equal the engine');
      ok(a.ccaAirframes === w.n && w.n > 0 && b.ccaAirframes === 0 && a.operators > 0 && b.operators === 0 && a.aircrewHours < b.aircrewHours && a.effects !== b.effects, 'Tour CAP ' + sc + ' (' + deck + '): non-zero comparison -- effect ' + a.effects.toFixed(1) + ' vs ' + b.effects.toFixed(1) + ', sorties ' + a.sorties.toFixed(1) + ' vs ' + b.sorties.toFixed(1) + ', aircrew ' + a.aircrewHours.toFixed(0) + ' vs ' + b.aircrewHours.toFixed(0) + ' h, operators ' + a.operators);
      ok(runs[true].cap.indexOf(w.label) >= 0 && runs[false].cap.indexOf('CCAs fly CAP') < 0, 'Tour CAP ' + sc + ' (' + deck + '): label shown on the watch panel ON only');
    });
    if (process.env.TOURCAP_REPORT) console.log('TOURCAP_REPORT ' + JSON.stringify({ seeds, results }));
  });

  group('reduced motion and post-scroll dwell start', () => {
    const r = loadEngine(html, { reduce: true });
    r.T.startWatch('rm'); r.clock.advance(0);
    const sc = r.el('watch-explainer').__scrolls;
    ok(sc.length > 0 && sc.every(o => o.behavior === 'instant' || o.behavior === 'auto'), 'prefers-reduced-motion: explainer jumps instantly');
    r.T.stopWatch();
    const m = loadEngine(html, { reduce: false }), P = m.T.watchPacing, W = m.T.watchState;
    m.T.startWatch('motion'); const start = m.clock.now(); m.clock.advance(0);
    m.clock.advance(400);
    ok(m.el('watch-explainer').__scrolls.some(o => o.behavior === 'smooth'), 'motion allowed: smooth scroll');
    ok(!P.ctx.running, 'dwell not started while the card is still scrolling / revealing');
    m.clock.advance(700);
    ok(P.ctx.running, 'dwell started after the reveal and scroll settle');
    const armedAt = P.ctx.log[P.ctx.log.length - 1].at, want = P.ctx.dwellTotal;
    m.clock.advance(armedAt + want - m.clock.now() - 1); const held = W.phase === 'scenario'; m.clock.advance(1);
    ok(held && W.phase === 'wing' && armedAt > start, 'full dwell experienced after positioning (' + want + ' ms from ' + armedAt + ' ms)');
    m.T.stopWatch();
  });
  bad += S.done(path.basename(html));
}
console.log(bad ? 'PACING SUITE FAILED' : 'PACING SUITE PASSED: Tests D13-D14 pacing, transport, locks, lifetime and the With CCAs toggle');
process.exitCode = bad ? 1 : 0;
