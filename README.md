# Air Boss — Effects Per Spot

An illustrative teaching game from **RockWorx Aerospace**. You are the **Air Boss** running a carrier
air wing: build a mix of aircraft across a finite flight deck, choose your air-to-air loadout, set the
target range and op tempo, and maximize the **effect index delivered at range**. Watch the cyclic-ops
"ballet" run the day, read the sortie tally, and let **Auto-Boss** search thousands of wing mixes and
rank them by your objective — most effect, effect-per-spot, survivability, least gas, or effect-per-dollar.

**▶ Play it: https://rockworx.github.io/air-boss/**

It is a **reduced-order operations-analysis model**, deliberately abstracted for teaching — every
coefficient is illustrative and not calibrated to real platforms. **Not operational analysis and not for
planning.** A RockWorx give-away.

## Play offline (no analytics)

Download **[`air-boss-offline.html`](air-boss-offline.html)** — a single self-contained file with no
server, no internet, and no external assets or trackers. Open it in any browser; it runs fully offline.
Copy it to a thumb drive or an air-gapped machine and it just works.

The hosted page above includes privacy-first, cookieless **Cloudflare Web Analytics** (aggregate visit
counts only — no personal data, no consent banner needed). The offline file has none of that.

## What's modeled

- **Sortie generation** on deck-cycle terms, anchored to historical carrier surge/sustained rates.
- **Gas in the air** — strikers past their clean radius need tanker offload pooled across the wing.
- **Survivability** — CAP / ISR-EW spots and the air-to-air loadout raise how much of the strike gets through.
- **Cost** — sourced public flyaway unit costs where available, feeding an effect-per-dollar objective.

## License

MIT — see [LICENSE](LICENSE).
