# Air Boss — Effects Per Spot

An illustrative teaching game from **RockWorx Aerospace**. You are the **Air Boss** running a carrier
air wing: build a mix of aircraft across a finite flight deck, pick your strike ordnance and air-to-air
loadout, set the target range and op tempo, and maximize the **effect index delivered at range**. Watch
the cyclic-ops "ballet" run the day, read the sortie tally, see who survives under fire, and let
**Auto-Boss** search thousands of wing mixes and rank them by your objective.

**▶ Play it: https://rockworx.github.io/air-boss/**
**▶ The Gouge — animated field guide: https://rockworx.github.io/air-boss/gouge.html**

## What's New in Air Boss v3.4: "Model Honesty"
- **Fuel per Sortie Scales with Distance:** Under an illustrative scaling law, fuel per sortie is 1,550 gal at the 200-nm
  reference (a rough anchor from a published carrier surge record of about 1,590 gal per fixed-wing sortie, whose fuel
  total also includes helicopters) and 2,382 gal at 500 nm (+54%). The daily bill is fuel per sortie times sorties flown:
  at a fixed tempo it rises with distance, but at this example schedule's ceilings it falls slightly (186,000 gal/day at
  200 nm with 120 sorties, 178,646 at 500 nm with 75) because fewer sorties fly.
- **Honest Cost Terms:** The readout shows recurring flyaway (hardware only), an APUC-style procurement unit cost (recurring
  flyaway plus 15% [illustrative] for support and initial spares; about 15-25% in one published program) and a
  PAUC-style unit cost that adds development divided by the buy. Both are simplifications: no facilities and no separate
  development articles. Catalog unit costs are rounded public or illustrative figures, not normalized to one dollar year
  (F-35C $93M U.S. recurring flyaway in CY2012 dollars; F/A-18E/F $63M flyaway in FY2013 then-year dollars;
  MQ-25 Stingray $112M illustrative, derived from the program's published average procurement unit cost, replacing a
  $184M weapon-system figure). The design's cost per effect (PAUC-style) and the wing's $ per effect point (recurring flyaway)
  are on different bases.
- **Approach Lift Grounding:** Carrier approach lift is an illustrative C_L,app = 1.10 (an assumption standing in for
  pitch-up and stall-onset limits on uncrewed swept wings without complex flaps or a trimming tail, not a validated
  value), so Your Design needs a larger wing to land at 135 kt.
- **Deck Reset on the Fly-Day Ledger:** The 12-hour reset into Beast Mode is debited against the fly day: on a 14-hour day
  the reset day keeps 2 flying hours (1 event, 15 of 120 sorties), and the 7-day or 30-day ledger carries that one day.
  The return to Stealth is not charged in this model.
- **Active Deck Footprint Gate:** Spot factor = overall length x folded span against a 56 x 32 ft strike-fighter footprint,
  limit 0.75 (4 CCAs in 3 spots). A heavy core on the largest wing now fails it inside the slider range. It is an
  illustrative compactness proxy, not an elevator or deck-handling check.
- **MQ-25 Tanker Ledger:** Real aircraft keep their real names. The MQ-25 Stingray give is anchored to the program's
  published air-refueling requirement: at least 14,000 lb of fuel given at 500 nm from the carrier (threshold; objective
  16,000 lb; current estimate at least 14,000 lb). That is a requirement and an estimate, not demonstrated performance:
  the same published table lists demonstrated performance as TBD. The source gives one point, not a curve, so give at
  other stations is an illustrative game law: 14,000 lb plus 10 lb for every nm closer than 500 nm (17,500 lb at 150 nm;
  single reach 1,900 nm). Near-boat and recovery sorties are credited 14,000 lb (illustrative). The CCX-1 carrier CCA is
  RockWorx's notional, illustrative addition.
- **F-35C Combat Radius:** 600 nm, the program current estimate (equal to the threshold) for the carrier variant in the
  F-35C program's published selected acquisition report; that is the value the game flies (was an unsourced 650 nm). The
  same table lists 667 nm demonstrated, shown in the roster for reference only and not used in the model. The F/A-18E/F
  420 nm rests on the same basis (its published current estimate, 419 nm).
- **Model Caveats on Screen:** Short notes where you read the numbers: replenishment availability (alongside fueling and
  highline can continue with flight operations when wind and sea state permit; no helicopter replenishment while
  flying), double-cycling, CAP equivalence and CAP attrition, ordnance build rates, console and datalink capacity,
  launch-timing boundary, thrust-sensitivity check, design calibration, the MQ-25 tanker ledger, aircrew waivers and the
  crewed-loss exposure index. All illustrative, not for planning.

## What's New in Air Boss v3.3: "Your Design" Conceptual Aircraft Closure
- **Conceptual Aircraft Closure:** Replaces the old point-buy sliders with an illustrative conceptual closure model.
  An aircraft does not exist because features were chosen; it closes only if thrust, wing area, fuel volume,
  carrier approach speed and deck footprint close at the same time. Cost is shown as a price-vs-value readout.
- **Discrete Propulsion Selection & Development Amortization:** Choose a Light, Mid-Thrust or Heavy Core generic
  dry turbofan class with altitude thrust lapse and fuel consumption. Engine hardware is priced separately from
  the airframe, and engine development (non-recurring engineering, NRE) is spread over the fleet buy you choose.
- **The Carrier Wing-Area Pinch:** A smaller wing cuts parasite drag but raises induced drag, so high-speed drag has a
  best wing area (smaller is not always lower drag); a larger wing is needed to stay under the illustrative 135-knot
  carrier approach speed (V_PA <= 135 kt) and to hold wet-wing fuel.
- **Transonic Drag Rise & Package Keep-Up Doctrine:** Models transonic wave drag. A CCA either keeps up with the
  nominal Mach 0.80 strike package or takes a doctrine departure: an early launch (which reveals the strike axis
  and, in the first event of the day, needs spare tanker sorties for the fighters' hold -- without them the CCA is
  withheld from that event and joins the next), fighter loiter at the push point (spare tanker gas every event),
  or a slower common package (longer exposure to air defenses).
- **Term-by-Term Drag Build-Up:** Drag is built up from the design itself -- wetted-area parasite drag,
  lift-induced drag and compressibility wave drag -- never from a lift-to-drag ratio borrowed from another shape.
- **"Does It Close?" Diagnostic Panel & Thrust-Sensitivity Check:** Checks the four closure gates (approach speed, thrust
  margin, fuel volume, deck spot footprint), names the primary binding gate, and re-checks thrust margin with
  12% less installed thrust (a deterministic sensitivity check, not a hot-day model or a probability).
- **Economic Value Index ($ per Delivered Combat Effect):** Shows recurring unit flyaway cost, unit cost including
  development (labeled PAUC-style since v3.4; v3.3 mislabeled it APUC) and cost per delivered combat effect point; an unclosed or grounded design delivers zero
  effect, so its cost per effect is infinite.
- **"Watch the Air Boss" Pacing Controls:** each card stays up for a reading time scaled to its text: at least 6 seconds on Relaxed, 3.6 on Normal and 2.1 on Brisk (longer for longer text), with Pause / Resume, Next, Space and Right Arrow keys, a pause while you read, and instant jumps for reduced motion.
- **"With CCAs" Modes (Off / CAP / Strike):** watch the same seeded day three ways on the same deck: **Off**, the crewed-only wing; **CAP**, CCAs flying combat air patrol in the CAP fighter spots (the strike fighters, tankers and E-2 / EA-18G stay as they are: same strike wing, fewer crew in the air); or **Strike**, CCA strikers in place of Super Hornets, 4 for every 3 deck spots (less payload, fewer crew at risk). The deck-load step shows the CCAs on screen, and a side-by-side table compares effect, sorties, fuel, weapons, aircrew hours, operators, crewed and CCA losses (also per 100 effect points) and cost per effect (illustrative).

## What's New in Air Boss v3.2: The Logistics Pipeline
- **Inverted Requirement Architecture ("Tempo is a Logistics Bill"):** Rather than treating fuel and ordnance
  as infinite backdrop assumptions, v3.2 solves for the logistics bill a chosen sortie tempo generates: JP-5
  in gal/day and ordnance in short tons/day across standoff missiles, guided bombs and air-to-air weapons.
- **Geography & Sortie Sag with Distance:** Strikes at greater standoff distances lengthen sorties and stretch
  carrier cyclic events (from 1.75 hr at 200 nm to 2.75 hr at 500 nm). Under this example cycle schedule a
  14-hour day plans 120 sorties at 200 nm but 75 at 500 nm (37.5% fewer); real air wings may double-cycle long
  sorties instead, so this is one scheduling policy, not a hard deck limit.
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
  external "beast mode" loading, changed only by a 12-hour deck reset (since v3.4, entering Beast Mode is debited against the fly day; the
  return to Stealth is not charged).

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
