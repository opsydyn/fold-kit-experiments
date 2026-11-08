# Zloz logo concept review — 2026-11-08

Historical concept-review evidence, captured before selection. The user has since
selected **B — Nested frame**; see [the selection record](zloz-selection.md).

- **Result:** complete
- **Claim:** Three original SVG concepts with derived monochrome assets, shown beside Viz and Three in six family-header proofs. Existing family palette, typography and theme behavior reused. Review route: `/brand/zloz/` in the Viz promo app.
- **Evidence:** [Light page](zloz-logos-light.png), [dark page](zloz-logos-dark.png), [family headers](zloz-family-headers.png), [390px page](zloz-logos-mobile.png), [browser result](zloz-logos-browser.json). Reproduce with `bun run --filter @opsydyn/promo build`, `bun run --filter @opsydyn/promo preview --host 127.0.0.1 --port 4328`, then `node apps/promo/evidence/zloz-logos-browser.mjs`. Browser assertions cover six headers, 18 equal-size family marks, 16/24/32px proofs, theme colors/toggling, six downloadable SVGs, no overflow at 1600/390px and no page errors. Both theme proofs and small-size silhouettes were visually inspected. Host-run validation passed: promo production build, `bun typecheck`, `bun run check` (existing repository warnings remain) and `bun run test`, all exit 0. The final web suite reports 420 passing tests. After regenerating browser JSON, run `bunx oxfmt apps/promo/evidence/zloz-logos-browser.json` to match repository formatting.
- **Remaining uncertainty:** These are local browser proofs, not hosted, CI or user acceptance. No final mark selected. No production navigation rollout, package rename, publication or deployment. Optical refinement, favicon export and final clear-space rules follow selection.
- **Next:** Recommendation: needs follow-up. Select a direction, then refine the chosen mark and produce final light/dark, monochrome, favicon and wordmark assets. A is recommended for its compact three-part assembly silhouette and negative-space port.
