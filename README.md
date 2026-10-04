# Air Boss — Effects Per Spot

An illustrative teaching game from **RockWorx Aerospace**. You are the **Air Boss** running a carrier
air wing: build a mix of aircraft across a finite flight deck, pick your strike ordnance and air-to-air
loadout, set the target range and op tempo, and maximize the **effect index delivered at range**. Watch
the cyclic-ops "ballet" run the day, read the sortie tally, see who survives under fire, and let
**Auto-Boss** search thousands of wing mixes and rank them by your objective.

**▶ Play it: https://rockworx.github.io/air-boss/**
**▶ The Gouge — animated field guide: https://rockworx.github.io/air-boss/gouge.html**

## What's New in Air Boss v3.3: "Your Design" Conceptual Aircraft Closure
- **Conceptual Aircraft Closure:** Replaces the old point-buy sliders with an illustrative conceptual closure model.
  An aircraft does not exist because features were chosen; it closes only if thrust, wing area, fuel volume,
  carrier approach speed and deck footprint close at the same time. Cost is shown as a price-vs-value readout.
- **Discrete Propulsion Selection & Development Amortization:** Choose a Light, Mid-Thrust or Heavy Core generic
  dry turbofan class with altitude thrust lapse and fuel consumption. Engine hardware is priced separately from
  the airframe, and engine development (non-recurring engineering, NRE) is spread over the fleet buy you choose.
- **The Carrier Wing-Area Pinch:** A small wing keeps drag low for high-speed thrust margin, but a larger wing is
  needed to stay under the illustrative 135-knot carrier approach speed (V_PA <= 135 kt) and to hold wet-wing fuel.
- **Transonic Drag Rise & Package Keep-Up Doctrine:** Models transonic wave drag. A CCA either keeps up with the
  nominal Mach 0.80 strike package or takes a doctrine departure: an early launch (which reveals the strike axis
  and, in the first event of the day, needs spare tanker sorties for the fighters' hold -- without them the CCA is
  withheld from that event and joins the next), fighter loiter at the push point (spare tanker gas every event),
  or a slower common package (longer exposure to air defenses).
- **Term-by-Term Drag Build-Up:** Drag is built up from the design itself -- wetted-area parasite drag,
  lift-induced drag and compressibility wave drag -- never from a lift-to-drag ratio borrowed from another shape.
- **"Does It Close?" Diagnostic Panel & Hot-Day Robustness:** Checks the four closure gates (approach speed, thrust
  margin, fuel volume, deck spot footprint), names the primary binding gate, and re-checks thrust margin with
  12% less installed thrust (an adverse hot-day scenario, not a probability).
- **Economic Value Index ($ per Delivered Combat Effect):** Shows recurring unit flyaway cost, average procurement
  unit cost (APUC) and cost per delivered combat effect point; an unclosed or grounded design delivers zero
  effect, so its cost per effect is infinite.
- **"Watch the Air Boss" Pacing Controls:** each card stays up at least 6 seconds (longer for longer text), with Relaxed / Normal / Brisk pace, Pause / Resume, Next, Space and Right Arrow keys, a pause while you read, and instant jumps for reduced motion.
- **"With CCAs" Modes (Off / CAP / Strike):** watch the same seeded day three ways on the same deck: **Off**, the crewed-only wing; **CAP**, CCAs flying combat air patrol in the CAP fighter spots (the strike fighters, tankers and E-2 / EA-18G stay as they are: same strike wing, fewer crew in the air); or **Strike**, CCA strikers in place of Super Hornets, 4 for every 3 deck spots (less payload, fewer crew at risk). The deck-load step shows the CCAs on screen, and a side-by-side table compares effect, sorties, fuel, weapons, aircrew hours, operators, crewed and CCA losses (also per 100 effect points) and cost per effect (illustrative).

## What's New in Air Boss v3.2: The Logistics Pipeline
- **Inverted Requirement Architecture ("Tempo is a Logistics Bill"):** Rather than treating fuel and ordnance
  as infinite backdrop assumptions, v3.2 solves for the logistics bill a chosen sortie tempo generates: JP-5
  in gal/day and ordnance in short tons/day across standoff missiles, guided bombs and air-to-air weapons.
- **Geography & Sortie Sag with Distance:** Strikes at greater standoff distances lengthen sorties and stretch
  carrier cyclic events (from 1.75 hr at 200 nm to 2.75 hr at 500 nm). Because the fly day has a fixed length,
  a 14-hour day fits 120 sorties at 200 nm but only 75 at 500 nm (37.5% fewer), even with an undamaged deck.
- **Combat Logistics Force (CLF) Shuttle Sizing:** Simulates the replenishment pipeline (generic fleet oilers
  and ammunition ships), computing round-trip shuttle cycle times for a logistics hub 200 to 2,500 nm away and
  sizing the shuttle so the carrier never runs out of stores.
- **Reserve-Safe Replenishment Cadences:** Delivery intervals never exceed the carrier's usable stores above its
  safety reserve or one ship's cargo, so high-tempo operations do not breach the reserve.
- **Human Physiological Limits & CCA Supervisory Control Ratio:** Models illustrative aviator flight-time limits
  patterned on public guidance (daily, 7-day and 30-day). Adds a player-tunable CCA supervisory control ratio
  (CCAs per operator, a teaching assumption) and a manned-unmanned teaming (MUMT) handoff choice, sizing the
  shipboard operator bill across tempos.
- **Binding Sustainable Headline:** Names whether flight-deck events, the 7-day or the 30-day aircrew limit binds
  the sustainable tempo over the chosen horizon.
- **Day-Level Stealth Fighter Posture:** The trade between low-observable internal carriage and high-capacity
  external "beast mode" loading, changed only by an overnight deck reset.

## New in v3.1

- Unsupported strike sorties stay on deck when weapons or tanker gas run short.
- Whole functional-check and qualification flights consume aircraft and deck slots without combat effect.
- Contested Strait scoring requires useful effect as well as protection, with an illustrative 350-effect requirement.
- A three-day Strait campaign carries magazines, flight losses and fatigue between days.
- The illustrative CCX-1 carrier drone trades compact deck footprint against recovery and tanker needs.

## Also included from v3

- **Three scenarios:** *War at Sea* (moving targets: speed matters), *Deep Strike Inland* (hardened
  targets: warhead matters) and *Contested Strait Defense* (severe air opposition: protect the wing).
- **Blackbeard / MACE** hypersonic strike option alongside heavy standoff, direct attack and mixed loads.
- **Tanker tactics:** yo-yo, strike tanker, tanker-to-tanker consolidation (it pays only beyond a single
  tanker's reach) and recovery tanker.
- **The organic cliff:** how far your wing reaches with carrier gas alone, versus requesting a theater tanker.
- **Watch mode:** press *Watch the Air Boss* (or open `#watch`) to see a scenario set up and play out --
  then answer the question: *do you want to see the air wing surge?*
- Help bubbles on every control, and an updated **Gouge**.

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
