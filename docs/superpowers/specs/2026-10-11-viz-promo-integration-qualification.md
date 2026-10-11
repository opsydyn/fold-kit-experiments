# FoldKit Viz promo integration qualification

Date: 2026-10-11. Scope: local integration only; no push, deployment or package
publication is authorised by this work.

## Integration

Reconcile all 34 unique commits from `codex/foldkit-0-166-0` at
`9d2a9a63b23ba0870fb2294b341134444ae65796` with main at
`77399d7af133f167ef29ff1c78534c7a56a2adb6`, retaining both histories.

- Add Signal Desk: controlled exploration, missing-data and supplied-interval
  rendering, captured baseline comparison, and an independent caller event lane.
- Add the word-cloud example with Command-owned font measurement and stale
  measurement rejection.
- Add pure segments, interval-band, error-bar, viewport, coordinate, inspection,
  text and word-cloud primitives, plus optional chart-frame `onMount` support.
- Preserve main's bars accessibility and zero-value regression, source links and
  highlighting, comparison exports, AG-UI and Astro lifecycle ownership fixes.
- Preserve FoldKit 0.167.0, Effect 4.0.0, Astro 7.2.8, package versions and release
  metadata. These exports are workspace changes, not evidence of npm availability.

Dependency assembly remains at existing ownership boundaries. Viz geometry has no
Astro/FoldKit/Effect dependency; application state, events and Commands remain in
the promo examples. Word-cloud placement uses conservative rectangles, not
pixel-mask D3 parity. Supplied intervals do not imply statistical significance.

## Qualification

- `bun install --frozen-lockfile`: passed without lockfile changes.
- `bun run check`: passed, including oxlint and oxfmt.
- `bun typecheck`: passed across all workspaces; zero Astro diagnostic errors,
  warnings or hints.
- `bun run test`: 845 passed, zero failed, one existing conditional Pages-artifact
  skip (Astro 95, Viz 212, promo 183, web 355). Includes packed Bun/Node/strict
  TypeScript consumers, real-DOM event focus/identity and existing web regressions.
- Actual Pages-base production build at `/fold-kit-experiments/viz/`: 11 pages.
- Postbuild Pages-artifact test: one passed, 335 assertions, no skip. Checks new
  gallery routes, hydrated assets, source line anchors and highlighting alongside
  existing comparison downloads and source links.
- Chromium production-preview matrix: Signal Desk and word cloud at 1280px and
  390px, light and dark, eight cases passed with no page errors or horizontal
  document overflow. Screenshots inspected at desktop and mobile sizes.
- Signal checks: keyboard inspection, baseline retention after source changes,
  event selection/centring, keyboard clear-focus recovery, 115 raw observation
  rows, viewport reset and source-link navigation.
- Word-cloud checks: real font measurement, settings, keyboard word inspection,
  placement status and source-link navigation.
- Independent read-only integration review: no Critical or Important findings.
- `git diff --check`: passed.

The source-link regression was observed failing against the first combined build.
Replacing the new example wrapper's old Astro Code renderer with main's existing
SourceCode component made both new pages satisfy the line-anchor/token checks.

## Decisions And Limits

Use a temporary branch in the primary checkout rather than another dependency-heavy
worktree; the original promo branch remains unchanged. Existing local servers can
observe intermediate checkout changes. Preserve current-main contracts instead of
reintroducing old dependency versions or release metadata from the feature branch.

The production build still emits Vite's greater-than-500-kB chunk-size warning.
Do not suppress it or infer a measured performance result: bundle analysis is a
separate bounded follow-up.

Browser automation is not physical-touch, actual screen-reader speech,
independent pointer-capture-loss, large-feed performance or representative-user
comprehension acceptance. Those gates remain open; historical qualification
documents retain their original scope and dates.

Local browser evidence and command logs are preserved under the ignored
`.superpowers/sdd/2026-10-11-viz-promo-integration/` execution directory. They are
not publication or deployment evidence.
