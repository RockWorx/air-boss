# Air Boss — Effects Per Spot

An illustrative teaching game from **RockWorx Aerospace**. You are the **Air Boss** running a carrier
air wing: build a mix of aircraft across a finite flight deck, pick your strike ordnance and air-to-air
loadout, set the target range and op tempo, and maximize the **effect index delivered at range**. Watch
the cyclic-ops "ballet" run the day, read the sortie tally, see who survives under fire, and let
**Auto-Boss** search thousands of wing mixes and rank them by your objective.

**▶ Play it: https://rockworx.github.io/air-boss/**
**▶ The Gouge — animated field guide: https://rockworx.github.io/air-boss/gouge.html**

It is a **reduced-order operations-analysis model**, deliberately abstracted for teaching — every
coefficient is illustrative and not calibrated to real platforms. **Not operational analysis and not for
planning.** A RockWorx give-away; contains no protected IP.

## Quick start

Three one-click presets show the core thesis in seconds:

- **Legacy Wing** — Super-Hornet-heavy; crushes close-in, starves at long range.
- **Stealth Penetration** — reaches deep, but the deck-spot cost limits total strike volume.
- **Distributed CCA** — uncrewed mass and fast cycling win effect-per-spot across the whole envelope.

Then work three modes: **Build Wing → Simulate Day → Optimize Wing**, in the flight-deck jersey motif
(shooter yellow, ordie red, grape purple, handler blue, ISR green) with an IFLOLS "meatball" fuel gauge.

## What's modeled

- **Sortie generation** on deck-cycle terms, anchored to historical carrier surge/sustained rates
  (~1.2–1.6 sorties/jet sustained, ~2.6 surge, from the 1997 USS *Nimitz* surge).
- **Gas in the air** — strikers past their clean radius need tanker offload pooled across the wing;
  offload decays as the tanker orbit pushes out, with a recovery-tanking floor. The **meatball** widget
  shows the fuel picture (fully supplied vs gas-starved) at a glance.
- **Survivability** — CAP and ISR/EW spots raise how much of the strike gets through (saturating returns —
  the first escorts buy the most).
- **Strike ordnance** — a mass-vs-standoff trade: **Direct Attack** (JDAM / SDB II — the most aimpoints,
  but you fly into the terminal defenses) vs **Mixed** vs **Standoff** (JASSM-ER / LRASM — fewer, pricier
  cruise missiles from outside the defenses). **Standoff's survivability edge widens with target range.**
- **Air-to-air loadout** — grounded in air-to-air engagement literature (Weapon Engagement Zone / Dynamic
  Launch Zone, cardioid aspect geometry, missile weights):
  - **AMRAAM** (AIM-120) — magazine depth, the close-in workhorse (most shots, lightest).
  - **GUNSLINGER** (AIM-174B, an air-launched SM-6) — long reach, but the heavy external round is the
    deck's biggest gas hog.
  - **MALICE** (AIM-424) — a dedicated very-long-range LRAAM; a **range-specialist** whose survivability
    edge grows the deeper the strike (it overtakes AMRAAM on deep targets), at a moderate gas cost.
  - **Carriage matters** — stealth jets (F-35C and the uncrewed CCAs) carry bay-compatible weapons
    **internally** with almost no drag penalty, while a Super Hornet carries them **externally** and pays
    the fuel; the SM-6 is external-only.
- **Under fire** — a multi-day attrition read: loss-per-sortie scales with survivability, so an
  attritable uncrewed wing sustains a whole campaign while a legacy manned wing depletes fast.
- **Cost** — sourced public flyaway unit costs where available, feeding an effect-per-dollar objective.
- **Auto-Boss** — a seeded heuristic search over thousands of wing mixes, ranked by your objective: most
  effect, effect-per-spot, survivability, least gas, or effect-per-dollar.

## The Gouge

**[The Gouge](https://rockworx.github.io/air-boss/gouge.html)** is an animated, auto-playing field guide
that walks all eight events of the Air Boss day — *the brief, spot the deck, gas in the air, load out,
fly the day, the tally, ask the Boss, man up* — in the flight-deck jersey motif.

## Play offline (no analytics)

Download **[`air-boss-offline.html`](air-boss-offline.html)** — a single self-contained file with no
server, no internet, and no external assets or trackers. Open it in any browser; it runs fully offline.
Copy it to a thumb drive or an air-gapped machine and it just works.

The hosted page above includes privacy-first, cookieless **Cloudflare Web Analytics** (aggregate visit
counts only — no personal data, no consent banner needed). The offline file has none of that.

## License

MIT — see [LICENSE](LICENSE).
