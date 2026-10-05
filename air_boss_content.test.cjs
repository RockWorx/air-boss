/* Air Boss content and version-consistency suite (v3.3.2; v3.4 content). Reads the SHIPPED page, the Gouge and the README that sit next
 * to each build, and binds every number the teaching text quotes to the SHIPPED engine (window.__airbossTest via the shared
 * loader) -- no model value is copied here.
 *   Rule V1 (release rule): the in-page field-guide label version equals the newest "What's New" version in the README,
 *     and the Gouge carries a "New in v<that version>" note. A stale label can no longer ship.
 *   Rule V2: outside the field guide, the page shows no versioned label (v<major>.<minor>) to the player; code comments
 *     are not user-visible and are ignored.
 * Run: node air_boss_content.test.cjs [build.html]   (no argument: every build present; exit 0 = PASS)
 * Pure Node built-ins only. ASCII only.
 */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { builds, loadEngine, suite } = require('./air_boss_test_loader.cjs');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', le: '<=', ge: '>=', mdash: '--', ndash: '-', middot: '.', times: 'x', rarr: '->' };
function text(html) {
  return html.replace(/<\/?(?:b|i|em|strong|span|small|a|sub|sup)\b[^>]*>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&(#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCharCode(+e.slice(1)) : (e in ENT ? ENT[e] : m))
    .replace(/\s+/g, ' ').trim();
}
const VER = /\bv(\d+(?:\.\d+)+)(?![\d.]*\d)/g;   // a versioned label: v3.3, v3.3.1 (major-only "v3" is a product name, not a release label)
function cmpVer(a, b) { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; }
function fieldGuide(html) {
  const m = html.match(/<details id="local-guide"[^>]*>([\s\S]*?)<\/details>/);
  if (!m) return null;
  const s = m[1].match(/<summary>([\s\S]*?)<\/summary>/);
  return { raw: m[0], summary: s ? text(s[1]) : null, body: text(m[1].replace(/<summary>[\s\S]*?<\/summary>/, '')), all: text(m[1]) };
}
// README: "### What's New in Air Boss v3.3: ..." (build README) or "## What's New in Air Boss v3.3" / "## New in v3.1" (public README).
function readmeNewest(readme) {
  const vs = [...readme.matchAll(/^#{2,3}\s+(?:What's\s+)?New\s+in\s+(?:Air\s+Boss\s+)?v(\d+(?:\.\d+)+)\b/gm)].map(m => m[1]);
  return vs.length ? vs.sort(cmpVer).pop() : null;
}
function labelVersion(fg) { const m = fg && fg.summary && fg.summary.match(/^Field guide - v(\d+(?:\.\d+)+)$/); return m ? m[1] : null; }
// The release rule. Returns the reasons it fails ([] = consistent).
function versionRule(html, readme, gouge) {
  const why = [], fg = fieldGuide(html), lv = labelVersion(fg), rv = readmeNewest(readme || '');
  if (!fg) why.push('no #local-guide field guide');
  else if (!lv) why.push('field-guide label is not "Field guide - v<version>": ' + JSON.stringify(fg.summary));
  if (!rv) why.push('README has no "What\'s New in Air Boss v<version>" section');
  if (lv && rv && lv !== rv) why.push('field-guide label v' + lv + ' != README newest What\'s New v' + rv);
  if (rv && gouge != null && !new RegExp('New in v' + rv.replace(/\./g, '\\.') + '(?![\\d.]*\\d)').test(text(gouge))) why.push('Gouge has no "New in v' + rv + '" note');
  return why;
}
// v3.4.2 disclaimer rule: the shipped page, the Gouge and the README make no "fictional" / "not calibrated to real" claim and
// each carries the published-figures wording (page: header .illus; Gouge: footer .foot; README: anywhere). Fail-closed.
const DISCLAIMER = 'Illustrative teaching model, not operational analysis. Real aircraft use published program figures; the CCA and other values are notional or illustrative.';
function disclaimerRule(page, gouge, readme) {
  const why = [], flat = s => (s || '').replace(/\s+/g, ' ');
  const header = (page.match(/<span class="illus">([\s\S]*?)<\/span>/) || [])[1];
  const foot = gouge == null ? null : (gouge.match(/<div class="foot">([\s\S]*?)<\/div>/) || [])[1];
  if (/fictional/i.test(text(page))) why.push('page claims figures are fictional');
  if (!header || !text(header).includes(DISCLAIMER)) why.push('page header lacks the published-figures wording');
  if (gouge == null) why.push('no Gouge next to the build');
  else { if (/fictional/i.test(text(gouge))) why.push('Gouge claims figures are fictional'); if (!foot || !text(foot).includes(DISCLAIMER)) why.push('Gouge footer lacks the published-figures wording'); }
  if (readme == null) why.push('no README next to the build');
  else {
    if (/fictional/i.test(readme)) why.push('README claims figures are fictional');
    if (/not calibrated to (?:any )?real/i.test(flat(readme))) why.push('README claims not calibrated to real aircraft');
    if (!flat(readme).includes(DISCLAIMER)) why.push('README lacks the published-figures wording');
  }
  return why;
}
// v3.4.2 round 2 loss-label rule (Captain: "Go with Potential crewed aircraft losses...better wording"): the player-facing
// text (markup text, attribute values and JS string literals; code comments and identifiers such as expectedLosses are
// ignored) of the page, the Gouge and the README shows no "Expected ... loss" label, and the page carries the "Potential"
// labels. Numbers and the engine are untouched; the label counts aircraft (a relative index, not casualties).
const LOSS_NEW = ['Potential crewed aircraft losses', 'Potential CCA losses', 'Potential strike aircraft lost'];
const LOSS_OLD = /\bexpected\b[^.<>'"]{0,40}?\blos(?:s|ses|t)\b|\blos(?:s|ses|t)\b[^.<>'"]{0,12}?\(expected\b/i;
function playerStrings(html) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const markup = html.replace(/<script>[\s\S]*?<\/script>/g, ' ').replace(/<style>[\s\S]*?<\/style>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const out = [text(markup)];
  for (const a of markup.matchAll(/\s[\w-]+="([^"]*)"/g)) out.push(a[1]);
  for (const sc of scripts) {
    const code = sc.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map(l => l.replace(/(^|[\s;{}(),])\/\/.*$/, '$1')).join('\n');
    for (const q of code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) out.push(text(q[1] || q[2] || ''));
  }
  return out;
}
function lossLabelRule(page, gouge, readme) {
  const why = [];
  const hit = (where, strs) => { for (const x of strs) { const m = x.match(LOSS_OLD); if (m) { why.push(where + ' shows an "expected" loss label ("' + m[0] + '")'); return; } } };
  const P = playerStrings(page);
  hit('page', P);
  const all = P.join(' | ');
  for (const l of LOSS_NEW) if (!all.includes(l)) why.push('page lacks "' + l + '"');
  if (gouge != null) hit('Gouge', playerStrings(gouge));
  if (readme != null) hit('README', [readme.replace(/\s+/g, ' ')]);
  return why;
}
// User-visible version labels outside the field guide: page text, attribute values and JS string literals (comments ignored).
function strayVersions(html) {
  const out = [];
  const noGuide = html.replace(/<details id="local-guide"[^>]*>[\s\S]*?<\/details>/, '');
  const scripts = [...noGuide.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const markup = noGuide.replace(/<script>[\s\S]*?<\/script>/g, ' ').replace(/<style>[\s\S]*?<\/style>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  for (const m of markup.matchAll(/<title>([\s\S]*?)<\/title>/g)) for (const v of m[1].matchAll(VER)) out.push('title: ' + v[0]);
  for (const v of text(markup.replace(/<title>[\s\S]*?<\/title>/g, ' ')).matchAll(VER)) out.push('text: ' + v[0]);
  for (const a of markup.matchAll(/\s[\w-]+="([^"]*)"/g)) for (const v of a[1].matchAll(VER)) out.push('attribute: ' + v[0]);
  for (const s of scripts) {
    const code = s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map(l => l.replace(/(^|[\s;{}(),])\/\/.*$/, '$1')).join('\n');
    for (const q of code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) for (const v of (q[1] || q[2] || '').matchAll(VER)) out.push('script string: ' + v[0]);
  }
  return out;
}

let bad = 0;
for (const html of builds()) {
  const S = suite('CONTENT SUITE'), ok = S.ok, group = S.group;
  const dir = path.dirname(html), page = fs.readFileSync(html, 'utf8');
  const gName = (/public|index|offline/.test(path.basename(html)) ? ['gouge.html', 'air_boss_gouge.html'] : ['air_boss_gouge.html', 'gouge.html']).find(f => fs.existsSync(path.join(dir, f)));
  const gouge = gName ? fs.readFileSync(path.join(dir, gName), 'utf8') : null, G = gouge ? text(gouge) : '';
  const readme = fs.existsSync(path.join(dir, 'README.md')) ? fs.readFileSync(path.join(dir, 'README.md'), 'utf8') : null;
  const { T } = loadEngine(html, { reduce: true });
  const L = T.logistics, fg = fieldGuide(page), F = fg ? fg.body : '';
  const has = (hay, s) => hay.includes(s);
  console.log('== ' + path.basename(html) + ' (Gouge: ' + gName + ')');

  group('V1 version rule: field-guide label = README newest What\'s New = Gouge note', () => {
    ok(readme != null && gouge != null, 'README.md and the Gouge sit next to the build');
    ok(fg && fg.summary === 'Field guide - v3.4.2', 'field-guide label reads "Field guide - v3.4.2"');
    const why = versionRule(page, readme, gouge);
    ok(why.length === 0, 'field-guide label version equals the newest README What\'s New version (' + (why.join('; ') || 'v' + readmeNewest(readme)) + ')');
    // The rule discriminates (in-memory mutants of the shipped files).
    const stale = page.replace(/<summary>Field guide - v[\d.]+<\/summary>/, '<summary>Field guide - v3.1</summary>');
    ok(stale !== page && versionRule(stale, readme, gouge).some(w => /label v3\.1 != README/.test(w)), 'rule FAILS a stale label (v3.1 against README v3.4.2)');
    const unlabeled = page.replace(/<summary>Field guide - v[\d.]+<\/summary>/, '<summary>Field guide</summary>');
    ok(versionRule(unlabeled, readme, gouge).some(w => /not "Field guide - v/.test(w)), 'rule FAILS an unversioned label');
    const newer = (readme || '').replace(/^(#{2,3}\s+What's New in Air Boss v)[\d.]+/m, '$13.5');
    ok(newer !== readme && versionRule(page, newer, gouge).some(w => /!= README newest What's New v3\.5/.test(w)), 'rule FAILS when the README gains a newer What\'s New (v3.5) the label lacks');
    ok(versionRule(page, '# Air Boss\n', gouge).some(w => /README has no/.test(w)), 'rule FAILS a README with no What\'s New section (fail-closed)');
    ok(versionRule(page, readme, (gouge || '').replace(/New in v3\.4\.2(?![\d.]*\d)/g, 'New in vX')).some(w => /Gouge has no "New in v3\.4\.2"/.test(w)), 'rule FAILS a Gouge without a note for the newest version');
    ok(readmeNewest('## What\'s New in Air Boss v3.3\n## What\'s New in Air Boss v3.2\n## New in v3.1\n') === '3.3' && readmeNewest('### What\'s New in Air Boss v3.10: x\n### What\'s New in Air Boss v3.9: y\n') === '3.10', 'README newest is numeric (v3.10 > v3.9), public "##" layout read');
  });

  group('V2 no stale version labels elsewhere on the page', () => {
    const stray = strayVersions(page);
    ok(stray.length === 0, 'outside the field guide the page shows no versioned label to the player (' + (stray.join(', ') || 'none') + ')');
    ok(!/\bv3\.1\s*:/.test(F) && !/Field guide - v3\.[0-2]\b/.test(fg ? fg.all : ''), 'field guide has no legacy "v3.1:" prefix or older label');
    const injected = page.replace('<details id="local-guide"', '<span data-help="New in v3.1">x</span><details id="local-guide"');
    ok(strayVersions(injected).includes('attribute: v3.1'), 'V2 discriminates: an injected v3.1 tooltip is caught');
    ok(strayVersions(page.replace('</title>', ' v3.1</title>')).includes('title: v3.1') && strayVersions(page.replace("var CCA_KEYS=", "var STALE='New in v3.2';var CCA_KEYS=")).includes('script string: v3.2'), 'V2 discriminates: title and script-string labels are caught; code comments are not');
  });

  group('Field guide body (v3.1 to v3.4 teaching content)', () => {
    for (const h of ['Mission-Governed Launch & Recovery:', 'Deck Spots & Target Matching:', 'Tanker Geometry & Reach:', 'The Organic Cliff & Auto-Boss:',
      'v3.2/v3.4 Logistics Pipeline ("Tempo is a Logistics Bill"):', 'v3.3/v3.4 "Your Design" Conceptual Aircraft Closure:', 'v3.3.1 Guided Tour & CCA Force-Mix Modes:'])
      ok(has(F, h), 'section: ' + h);
    ok(has(F, 'Buddy relay is the teaching case: single reach 212.1 nm versus relay reach 274.2 nm; try a 250-nm orbit.'), 'relay teaching sentence kept verbatim (UI suite contract)');
    ok(has(F, 'An unsupplied jet is never launched for zero effect.') && has(F, 'consuming deck slots and airframes while delivering no combat effect'), 'v3.1: mission-governed launch and combat overhead');
    ok(has(F, 'fuel in gal/day and ordnance in short tons/day') && has(F, 'Combat Logistics Force (CLF) supply shuttles') && has(F, 'Aviator flight-time guidelines (daily, 7-day surge, 30-day sustained)') && has(F, 'player-tunable CCA supervisory control ratio') && has(F, '"beast mode" weapons incurs a mandatory 12-hour deck reset debited against the fly day') && !/overnight|halving/.test(F), 'v3.2 / v3.4: logistics bill, CLF shuttles, aircrew guidelines, control ratio, beast-mode reset on the fly-day ledger (no "overnight", no "halving")');
    ok(has(F, 'Fuel per sortie rises with sortie duration and standoff radius') && has(F, 'the daily bill also depends on how many sorties fly, so it can fall as the sortie ceiling sags') && !/empirical/.test(F), 'v3.4: fuel per sortie scales with radius under an illustrative law; the daily bill depends on sorties flown');
    ok(has(F, 'An unclosed aircraft flies only in PowerPoint.') && has(F, 'Light, Mid, or Heavy dry turbofans') && has(F, 'development NRE amortized over fleet buy quantity') && has(F, 'carrier wing-area pinch') && has(F, 'doctrine departures (early launch, push-point loiter, or slower package ingress)') && has(F, 'stall-onset and pitch-up limits on uncrewed swept wings') && has(F, 'an APUC-style procurement unit cost and a PAUC-style unit cost incl. development (illustrative simplifications: no facilities, no development articles)') && has(F, 'cost per delivered combat effect ($/effect, on the PAUC-style basis)') && has(F, 'recurring flyaway unit cost'), 'v3.3 / v3.4: closure, engines + NRE, wing-area pinch, doctrine, approach lift, APUC-style / PAUC-style simplifications, $/effect basis');
    ok(has(F, "adaptive reading-time pacing scaled to each explainer's word count") && has(F, 'with transport controls'), 'v3.3.1: tour pacing controls');
    ok(has(F, 'Off flies the pure crewed baseline;') && has(F, 'CAP fields CCAs in place of crewed CAP fighters (same deck, same strike wing, fewer crew in the air') && has(F, 'Strike swaps Super Hornets for CCX-1 strikers at 4 aircraft for every 3 deck spots (less payload per spot, fewer crew at risk'), 'v3.3.1: the three CCA tour modes Off / CAP / Strike');
    ok(has(F, 'effect, sorties, fuel, weapons, aircrew fatigue, operators, casualties, and cost per effect side by side'), 'v3.3.1: comparison table rows');
    ok(has(F, 'This is an illustrative teaching game, not for planning.'), 'illustrative disclaimer kept');
    ok(fg && /^[\x09\x0a\x0d\x20-\x7e]*$/.test(fg.raw), 'field-guide markup is ASCII (entities for symbols)');
  });

  group('Field guide numbers bound to the shipped engine', () => {
    const m = F.match(/Deck spots are finite \((\d+) on Nimitz, (\d+) on Ford\)/);
    ok(m && +m[1] === T.DECKS.nimitz.spots && +m[2] === T.DECKS.ford.spots, 'deck spots ' + (m ? m[1] + ' / ' + m[2] : '?') + ' = engine DECKS ' + T.DECKS.nimitz.spots + ' / ' + T.DECKS.ford.spots);
    const e = F.match(/from ([\d.]+) hr at (\d+) nm to ([\d.]+) hr at (\d+) nm/);
    ok(e && L.eventLength(+e[2]) === +e[1] && L.eventLength(+e[4]) === +e[3], 'event length ' + (e ? e[1] + ' hr / ' + e[3] + ' hr' : '?') + ' = engine eventLength');
    const p0 = F.match(/from ([\d.]+) hr at (\d+) nm to ([\d.]+) hr at (\d+) nm\), and under this example cycle schedule the daily sortie ceiling can sag by ([\d.]+)% \(from (\d+) down to (\d+) sorties on a (\d+)-hour fly day/), p = p0 && [p0[0], p0[5], p0[6], p0[7], p0[8], p0[2], p0[4]], pa = p && L.sortieSag(+p[5]), pb = p && L.sortieSag(+p[6]);
    ok(p && +p[2] === pa.ceiling && +p[3] === pb.ceiling && +p[4] === pa.flyDay && Math.abs(+p[1] - 100 * (1 - pb.ceiling / pa.ceiling)) < 0.05 && !/up to 40%/.test(F),
      'sortie sag ' + (p ? p[1] + '% (' + p[2] + ' -> ' + p[3] + ', ' + p[5] + ' -> ' + p[6] + ' nm)' : '?') + ' = engine sortieSag ' + (pa ? pa.ceiling + ' -> ' + pb.ceiling + ' (' + (100 * (1 - pb.ceiling / pa.ceiling)).toFixed(1) + '%)' : '?') + '; no "up to 40%"');
    const fu = F.match(/\(\+(\d+)% from (\d+) to (\d+) nm under an illustrative scaling law, anchored roughly at ([\d,]+) gal\/sortie at (\d+) nm\)/);
    ok(fu && +fu[4].replace(/,/g, '') === L.C.galBase && +fu[5] === L.C.rRef && +fu[2] === L.C.rRef && Math.round(100 * (L.galPerSortie(+fu[3]) / L.galPerSortie(+fu[2]) - 1)) === +fu[1], 'fuel scaling +' + (fu ? fu[1] + '% (' + fu[2] + ' -> ' + fu[3] + ' nm), base ' + fu[4] : '?') + ' = engine galPerSortie');
    const rs = F.match(/on a (\d+)-hour fly day the reset day keeps (\d+) flying hours \((\d+) event, (\d+) of (\d+) sorties\)/), rd = rs && L.reconfigDay(200, { hours: +rs[1], spot: 15 });
    ok(rs && rd.availHours === +rs[2] && rd.events === +rs[3] && rd.ceiling === +rs[4] && L.sortieSag(200).ceiling === +rs[5], 'deck reset ' + (rs ? rs[2] + ' hr, ' + rs[3] + ' event, ' + rs[4] + ' of ' + rs[5] : '?') + ' = engine reconfigDay');
    const cl = F.match(/C_L,app = ([\d.]+)/), sp4 = F.match(/Spot <= ([\d.]+)/);
    ok(cl && sp4 && +cl[1] === T.designer.C.clApp && +sp4[1] === T.designer.C.spotMax, 'C_L,app ' + (cl ? cl[1] : '?') + ' and Spot <= ' + (sp4 ? sp4[1] : '?') + ' = engine designer constants');
    const r = F.match(/default (\d+) CCAs per operator/);
    ok(r && +r[1] === L.CCA_CONTROL_RATIO_DEFAULT, 'control ratio default ' + (r ? r[1] : '?') + ' = engine ' + L.CCA_CONTROL_RATIO_DEFAULT);
    const v = F.match(/V_PA <= (\d+) kt/), d = F.match(/D\/T <= ([\d.]+)/), C = T.designer.C;
    ok(v && d && +v[1] === C.vpaMax && +d[1] === C.dtMax, 'closure limits V_PA <= ' + (v ? v[1] : '?') + ' kt, D/T <= ' + (d ? d[1] : '?') + ' = engine ' + C.vpaMax + ' / ' + C.dtMax);
    const sp = F.match(/at (\d+) aircraft for every (\d+) deck spots/);
    ok(sp && Math.abs(+sp[2] / +sp[1] - T.CAT.ccx.spots) < 1e-12, 'Strike mode ' + (sp ? sp[1] + ' for ' + sp[2] : '?') + ' spots = CCX-1 spot weight ' + T.CAT.ccx.spots);
  });

  // Reading-time pacing: every stated floor is bound to the engine for EACH selectable pace (a 3-word card sits on the floor),
  // longer text must hold longer, and no source may promise an unqualified "at least 6 s" (it is the Relaxed floor only).
  group('Tour pacing claims bound to the engine at every pace (Field Guide, Gouge, README)', () => {
    const W = T.watchPacing, floors = ['relaxed', 'normal', 'brisk'].map(p => W.dwellMs('one two three', p) / 1000);
    const long = 'word '.repeat(60), rx = /at least ([\d.]+) (?:s|seconds) on Relaxed, ([\d.]+)(?: s| seconds)? on Normal,? (?:and )?([\d.]+)(?: s| seconds)? on Brisk/;
    const bad = t => /(?:at least|>=) ?6(?:\.0)? ?(?:s|seconds)\b(?! on Relaxed)/.test(t);
    ok(JSON.stringify(floors) === '[6,3.6,2.1]' && ['relaxed', 'normal', 'brisk'].every((p, i) => W.dwellMs(long, p) / 1000 > floors[i]), 'engine floors per pace ' + floors.join(' / ') + ' s; longer text holds longer at every pace');
    for (const [name, t] of [['Field Guide', F], ['Gouge', G], ['README', readme || '']]) {
      const m = t.match(rx);
      ok(m && +m[1] === floors[0] && +m[2] === floors[1] && +m[3] === floors[2] && /longer for longer (?:explanations|text)/.test(t), name + ' states the per-pace floors ' + (m ? m.slice(1).join(' / ') : '?') + ' = engine, longer for longer text');
      ok(!bad(t), name + ' makes no unqualified "at least 6 s" promise');
    }
    ok(bad('the guided tour holds each card at least 6 seconds (longer for longer explanations)') && bad('pacing (>= 6 s scaled to word count)') && !bad('at least 6 s on Relaxed, 3.6 s on Normal'), 'the unqualified-claim detector discriminates (at least / >= forms)');
  });

  group('Gouge v3.2 / v3.3 / v3.4 notes (Events 02, 09, 12) and preserved reach examples', () => {
    ok(!/\bv3\.1(?![\d.]*\d)/.test(G), 'Gouge shows no stale v3.1 label');
    const gv = [...G.matchAll(VER)].map(x => x[1]), rv = readme ? readmeNewest(readme) : null;
    ok(gv.length > 0 && gv.every(x => cmpVer(x.split('.').slice(0, 2).join('.'), rv || '0') <= 0), 'every Gouge version label (' + [...new Set(gv)].join(', ') + ') is within the README newest v' + rv);
    const c = G.match(/Carrier CCAs: four CCX-1 fit in three deck spots \(([\d.]+) spots each\).*?cap unrefueled clean radius \((\d+) nm\)/);
    ok(c && +c[1] === T.CAT.ccx.spots && +c[2] === T.CAT.ccx.clean, 'Event 02: CCA note with ' + (c ? c[1] + ' spots / ' + c[2] + ' nm' : '?') + ' = engine CCX-1 ' + T.CAT.ccx.spots + ' / ' + T.CAT.ccx.clean);
    ok(has(G, 'They can fly as strikers (less payload per spot, fewer crew at risk) or on defensive CAP (same strike wing, fewer crew in the air).'), 'Event 02: CCX-1 strike and CAP roles');
    const gcl = G.match(/closing approach speed \(C_L,app = ([\d.]+)\), thrust margin, fuel tankage, and length-augmented deck spot constraints simultaneously\. Catalog unit costs are rounded public or illustrative figures, not normalized to one dollar year\./);
    ok(has(G, 'New in v3.4: close your own carrier CCA under Your Design') && gcl && +gcl[1] === T.designer.C.clApp && !/statutory flyaway/.test(G), 'Event 02: New in v3.4 Your Design note (C_L,app = engine; flyaway is not called statutory)');
    ok(has(G, 'Air Boss v3.4 series: Educational Visual Tour') && !has(G, 'Air Boss v3.4 Educational Visual Tour') && /a 12-hour deck reset to enter, debited against the fly day \(the return to Stealth is not charged in this model\)/.test(G) && !/overnight reset|Hot day:/.test(G), 'Gouge subtitle is the explicit v3.4 series label (N623-1); beast-mode reset on the fly-day ledger; thrust-sensitivity check, not "Hot day"');
    ok(has(G, 'Mission-governed launch: a strike jet launches only when') && has(G, 'binding resource (weapons, fuel, or deck)'), 'Event 09: mission-governed launch (no version prefix)');
    ok(has(G, 'New in v3.2 -- tempo is a logistics bill: the daily tally also solves for fuel burned (gal/day), weapons expended (short tons/day)') && has(G, 'and supervisory CCA console operators.'), 'Event 09: New in v3.2 logistics note');
    ok(has(G, 'New in v3.3 / v3.3.1 -- guided tour comparison:') && has(G, 'compare three CCA modes (Off crewed baseline, CAP defensive cover, or Strike mass) side by side on the same deck'), 'Event 09: New in v3.3 / v3.3.1 tour comparison note');
    ok(has(G, 'Watch the Air Boss (v3.3.1): the guided tour holds each card for a reading time scaled to its words') && has(G, 'Off (crewed baseline), CAP (same strike wing, fewer crew in the air), or Strike (less payload per spot, fewer crew at risk). Illustrative, not for planning.'), 'Event 12: v3.3.1 tour + three modes card');
    ok(has(G, '212 nm') && has(G, '274 nm') && has(G, '1,900 nm') && has(G, 'Inside single reach (<=212 nm): Consolidation loses') && has(G, 'Beyond single reach (>212 nm)'), 'Event 05 reach example preserved (212 / 274 / 1,900 nm; MQ-25 ledger anchored at 14,000 lb at 500 nm)');
    ok(has(G, 'MQ-25 strike tankers holding 350 nm'), 'Event 07 Deep Strike hint preserved (350 nm MQ-25 orbit)');
    const src = path.join(dir, 'air_boss_gouge.html'), gen = path.join(dir, 'gouge.html');
    if (fs.existsSync(src) && fs.existsSync(gen)) {
      const a = fs.readFileSync(src, 'utf8'), b = fs.readFileSync(gen, 'utf8');
      ok(b.startsWith(a) && /^\n<script>if\(location\.protocol === "file:"\)[^\n]*<\/script>\n$/.test(b.slice(a.length)), 'gouge.html is the current build of air_boss_gouge.html (source + the offline return-link script)');
    }
    const notes = gouge ? [...gouge.matchAll(/<p class="sc-p"[^>]*>[\s\S]*?<\/p>|<div class="sc-row hint">[\s\S]*?<\/div>/g)].map(x => x[0]).filter(x => /New in v|Watch the Air Boss \(|Carrier CCAs:|Mission-governed launch/.test(x)) : [];
    ok(notes.length === 8 && notes.every(x => /^[\x20-\x7e]*$/.test(x)), 'the eight new / reworded Gouge notes (v3.4.1 and v3.4.2 add one each) are ASCII (' + notes.length + ' found)');
  });

  // v3.4.2: since v3.4 real aircraft carry published program figures (MQ-25 14,000 lb at 500 nm, F-35C 600 nm, catalog unit
  // costs), so a blanket "all figures fictional" / "not calibrated to real aircraft" claim is false. The page header, the
  // Gouge footer and the README must carry the published-figures wording and no fictional claim.
  group('H1 disclaimer honesty: published-figures wording, no "fictional" claim (page header, Gouge footer, README)', () => {
    const why = disclaimerRule(page, gouge, readme);
    ok(why.length === 0, 'DISCRIMINATOR: disclaimer is honest on page, Gouge and README (' + (why.join('; ') || 'ok') + ')');
    const header = (page.match(/<span class="illus">([\s\S]*?)<\/span>/) || [])[1], foot = (gouge && gouge.match(/<div class="foot">([\s\S]*?)<\/div>/) || [])[1];
    ok(header && text(header) === DISCLAIMER && foot && text(foot).endsWith(DISCLAIMER), 'header and Gouge footer read exactly: "' + DISCLAIMER + '"');
    // The rule discriminates (in-memory mutants of the shipped files restoring the v3.4.1 text).
    const oldHeader = page.replace(/<span class="illus">[\s\S]*?<\/span>/, '<span class="illus">Illustrative model &mdash; a teaching game, not operational analysis. All figures fictional.</span>');
    ok(oldHeader !== page && disclaimerRule(oldHeader, gouge, readme).length >= 2, 'rule FAILS the v3.4.1 page header ("All figures fictional", no published-figures wording)');
    const oldFoot = (gouge || '').replace(/<div class="foot">[\s\S]*?<\/div>/, '<div class="foot">RockWorx Aerospace &mdash; The Gouge. Illustrative teaching model, not for planning. All figures fictional.</div>');
    ok(oldFoot !== gouge && disclaimerRule(page, oldFoot, readme).length >= 2, 'rule FAILS the v3.4.1 Gouge footer');
    ok(disclaimerRule(page, gouge, (readme || '') + '\nnot calibrated to any real aircraft, engine or program\n').some(w => /README claims not calibrated/.test(w)), 'rule FAILS a README that says figures are not calibrated to real aircraft');
    ok(disclaimerRule(page, gouge, (readme || '').split(DISCLAIMER).join('Illustrative.')).some(w => /README lacks/.test(w)), 'rule FAILS a README without the published-figures wording');
  });

  // v3.4.2 round 2: the loss rows read "Potential ...", not "Expected ..." (Captain wording). The rule discriminates.
  group('H2 loss labels: "Potential" wording, no "Expected ... loss" label (page, Gouge, README)', () => {
    const why = lossLabelRule(page, gouge, readme);
    ok(why.length === 0, 'DISCRIMINATOR: loss labels read "Potential" on page, Gouge and README (' + (why.join('; ') || 'ok') + ')');
    ok(page.includes("['Potential crewed aircraft losses','crewedLosses',1]") && page.includes("['Potential CCA losses','ccaLosses',1]") && page.includes("row('Potential strike aircraft lost',f(e.expectedLosses,1)"), 'comparison and logistics rows carry the new labels, bound to the unchanged engine fields');
    ok(page.includes("cv('exposure-index'") && /relative cockpit risk across force mixes, rather than an empirical casualty forecast/.test(page), 'AB-17 caveat kept: the crewed-loss row is a relative exposure index, not a casualty forecast');
    const old1 = page.replace("'Potential crewed aircraft losses'", "'Expected crewed strike losses'");
    ok(old1 !== page && lossLabelRule(old1, gouge, readme).length >= 2, 'rule FAILS the 9723e72f label "Expected crewed strike losses"');
    const old2 = page.replace("'Potential CCA losses'", "'Expected CCA losses'");
    ok(old2 !== page && lossLabelRule(old2, gouge, readme).length >= 2, 'rule FAILS the 9723e72f label "Expected CCA losses"');
    const old3 = page.replace("row('Potential strike aircraft lost'", "row('Expected strike aircraft lost'");
    ok(old3 !== page && lossLabelRule(old3, gouge, readme).length >= 2, 'rule FAILS the 9723e72f logistics label "Expected strike aircraft lost"');
    const old4 = page.replace('shows as potential losses.', 'shows as expected losses.');
    ok(old4 !== page && lossLabelRule(old4, gouge, readme).length >= 1, 'rule FAILS the 9723e72f help prose "shows as expected losses"');
    ok(lossLabelRule(page, gouge, (readme || '') + '\nExpected CCA losses are shown.\n').some(w => /README/.test(w)), 'rule FAILS a README with an "Expected ... losses" label');
    ok(lossLabelRule(page.replace('// v3.4 public model caveat', '// Expected CCA losses v3.4 public model caveat'), gouge, readme).length === 0, 'rule ignores code comments (identifiers such as expectedLosses are not player text)');
  });

  bad += S.done(path.basename(html));
}
if (bad) { console.log('CONTENT SUITE FAILED: ' + bad + ' failure(s)'); process.exit(1); }
console.log('CONTENT SUITE PASSED');
