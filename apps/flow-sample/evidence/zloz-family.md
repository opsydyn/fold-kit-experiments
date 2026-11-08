# Zloz identity and family styling — 2026-11-08

- **Result:** complete
- **Claim:** Final Nested frame mark, outlined Inter wordmark, fixed light/dark and monochrome variants, adaptive favicon and usage rules. The board shell now uses Viz/Three neutral surfaces, blue accents and locally bundled Inter. Its visible brand is Foldkit Zloz. The promo identity review presents the final assets in both themes; the dedicated Zloz promo remains the next slice.
- **Evidence:** [Light board](zloz-family-board-light.png), [dark board](zloz-family-board-dark.png), [390px board](zloz-family-board-mobile.png), [light identity review](zloz-family-identity-light.png), [dark identity review](zloz-family-identity-dark.png), [browser results](zloz-family-browser.json). The host-run browser checks exercise the built board and promo: family palette values, local Inter, graph preservation across theme changes, keyboard edit and Undo, theme reload/system updates, blocked-storage first paint, mobile sidebar collapse, five SVG downloads, zero page errors and no external requests. Screenshots were visually inspected. Host-run gates passed: board and promo production builds, `bun typecheck`, `bun run check` and `bun run test` all exit 0 (the final web suite reports 420 passing tests). Deterministic regeneration of all ten SVG outputs, including the board favicon copy, passed. Repository lint warnings remain; no errors were reported.
- **Remaining uncertainty:** Local Chromium and build evidence only; no hosted deployment, CI or human/device accessibility acceptance. Graph package defaults, public APIs, saved graph formats and theme preference keys remain unchanged. SVG wordmark lettering is outlined and does not require fonts at use time. The one catalog dependency addition is the existing Fontsource Inter package in the private board app; no new version or graph dependency.
- **Next:** Recommendation: needs follow-up. Build the dedicated Zloz Astro promo shell using this final identity, the Viz/Three styling and the approved Compose / Model / Communicate messaging. Keep deployment and package naming/publication as separate slices.

Reproduce: build `@opsydyn/flow-sample` and `@opsydyn/promo`; preview the board at
4323 and promo at 4328. Run `node apps/flow-sample/evidence/zloz-family-browser.mjs`,
then format its JSON with `bunx oxfmt apps/flow-sample/evidence/zloz-family-browser.json`.
The harness accepts `ZLOZ_BOARD_URL` / `ZLOZ_PROMO_URL` for other preview ports.
Asset sources and regeneration are documented in the
[identity guide](../../../docs/assets/zloz/final/README.md), with the dependency
and ownership decision in [ADR 0011](../../../docs/adr/0011-align-zloz-with-the-foldkit-family.md).
