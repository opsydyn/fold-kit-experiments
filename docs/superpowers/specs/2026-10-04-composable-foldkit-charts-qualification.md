# Composable FoldKit charts qualification

Date: 2026-10-04. Checkout: managed `codex/foldkit-viz-promo` worktree.

## Automated evidence

- Root `bun run check`: exit 0, no lint or format findings.
- Root `bun typecheck`: exit 0, Astro diagnostics contain zero errors/warnings/hints.
- Root `bun run test`: 381 passing tests (Viz 165, integration 74, promo 37, web 105).
- Promo production build: exit 0, six pages generated.
- `git diff --check`: exit 0.
- Independent OS temporary projects for line, histogram and scatter: npm install,
  typecheck and build all exit 0; all three new public subpaths import under Node.
- Packed package: root/geometry/theme work under Bun and Node; real npm pure
  installation leaves FoldKit and Effect absent; an independent installation of
  both optional peers renders adapter output under Bun and Node.

## Browser evidence

The in-app browser loaded the actual dev server at `127.0.0.1:4321`. Each of
line, histogram and scatter was checked at 390 and 1280 CSS pixels, in both
light and dark themes (12 combinations). Document scroll width equalled viewport
width in every combination. Computed axis labels were 12px throughout. Measured
chart width was 324px on mobile and 818px on desktop; viewBox width followed it.

Line controls updated the chart description, raw table and maintained settings
source together (first observation 10 → 11). Two series, a keyed legend and the
80-unit annotation remained visible. Histogram dataset/bin controls changed the
bar count from five to six, source agreed, and the raw table exposed 40 records.
Reset restored five spread bins. Scatter End inspected b-12 with original X=95,
Y=8; selection and the custom tooltip survived a resize to 390px. Pointer
inspection worked, filtering to the opposite group cleared selection, reset
restored 24 marks, and its raw table had 24 records. Circles and squares matched
the legend and retained group paint.

Native browser input changed the StackBlitz editor buffer. A session marker
survived tab switches, theme change and mobile/desktop resize. Restart created a
fresh editor with the current first observation of 11. WebContainer installation
completed and its nested preview rendered the composed chart. Editing chart.css
to set `--chart-series-a: oklch(65% .15 150)` updated the real nested preview's
computed stroke to `oklch(0.65 0.15 150)`, with the reference stroke retained.

Download produced visible success feedback. The resulting native Downloads ZIP
contained 43 files, shared frame/measurement sources and settings with first
observation 11, agreeing with the controls/source rather than editor edits.

## Evidence boundaries

Changing initialSettings in a running editor preserves the existing runtime
Model; the preview does not reset live control state merely because defaults
change. Reload the preview to apply edited defaults. CSS edits update directly.
The browser download-event waiter did not observe the native download; the
success state and actual ZIP contents confirmed it independently.

No site deployment, npm publication, release version bump or full-catalogue
migration was performed. Mathematical colour interpolation remains hex-only;
the existing RGB basis interpolation parity gap is outside this slice.
