# Composable FoldKit charts and themes

Status: approved in conversation on 2026-10-04. This file specifies the first
implementation slice; the implementation plan is reviewed separately.

## Outcome

A developer can render line, histogram and scatter charts with their own data,
colours, theme, tooltip and annotation without editing or copying chart internals.
The same maintained chart layers power the promo previews and exported projects.
Composition follows FoldKit's Elm architecture; React is outside this work.

The reference checkout is `codex/foldkit-viz-promo`, starting at `3efd77b`.
Baseline `bun typecheck` and `bun run check` pass. The assessment identified invalid
geometry for a singleton line and equal scale domains, colour-string assumptions,
duplicated rendering scaffolding, and SVG labels that shrink on narrow screens.

## Decision and alternatives

Add pure Cartesian geometry and theme contracts to `@opsydyn/foldkit-viz`, with
FoldKit rendering helpers available only through an explicit optional subpath.
Preserve existing mathematical imports and existing application state machines.

Keeping helpers private to the promo app would reduce initial packaging work but
would leave consumers copying examples. Moving every demo chart into the package
would mix this contract change with a much larger migration. The selected slice
publishes the reusable pieces and proves them with three existing examples.

## Package boundaries

- `@opsydyn/foldkit-viz/chart/cartesian`: framework-independent layout, domains,
  projected data, ticks and line/histogram/scatter geometry.
- `@opsydyn/foldkit-viz/chart/theme`: semantic theme values and keyed series styles.
- `@opsydyn/foldkit-viz/foldkit/cartesian`: pure rendering functions accepting the
  caller's render-scoped `HtmlBuilder<Message>`.

The root barrel may export geometry and theme values. It must not re-export the
FoldKit adapter or introduce runtime FoldKit/Effect imports into existing math,
shape, simulation or selection entry points. Add matching package `exports`,
`typesVersions`, and build entries. Keep tree shaking and `sideEffects: false`.

No Astro lifecycle, remote data, runtime, subscription or browser measurement
policy belongs in the pure geometry modules. The package gains no D3 dependency.
Use FoldKit 0.165.0, Effect 4.0.0, Astro 7.1.1 and the current Bun workspace tools.

## Geometry contract

Expose immutable `ChartFrame`, `ChartMargins`, `CartesianLayout`, `Domain`,
`CartesianConfig`, `ProjectedDatum<T>`, `AxisTick`, `LineGeometry<T>`,
`ScatterGeometry<T>` and `HistogramGeometry<T>` records.

`ChartFrame` supplies width, height and margins. `CartesianLayout` supplies the
frame, plot bounds, and projected axes. `CartesianConfig` supplies a frame,
optional explicit X/Y domains, tick counts, and an `includeZero` policy per axis.
Unspecified continuous domains derive from finite values; zero inclusion is
explicit. Caller-specified reversed domains remain valid.

`lineGeometry<T>(data, accessors, config)` and
`scatterGeometry<T>(data, accessors, config)` accept typed `x`, `y`, `datumKey` and
`seriesKey` accessors. Line config additionally accepts the existing `CurveType`
and optional `defined` predicate. Projected records retain their original datum,
stable datum key, stable series key, and X/Y positions. Accessors and render
callbacks are passed at the view boundary, not stored in a serialised Model.

`histogramGeometry<T>(data, valueAccessor, config)` accepts an explicit domain or
derives one from finite values. Histogram config supplies thresholds or a desired
bin count, a gap, and the frame. Explicit bin count means exactly that many
equal-width intervals across the resolved domain; preserve the existing promo
control semantics. Returned bins retain interval bounds, counts and geometry.

Handle these inputs deliberately:

- Empty data produces empty marks and a readable empty state; finite default
  axes may use `[0, 1]`.
- Equal domain endpoints map to the range midpoint, matching D3 continuous scale
  normalisation. A singleton series renders a point without invalid path data.
- Constant and all-zero data produce finite geometry and useful ticks. Auto
  domains expand a constant extent deterministically before generating ticks.
- Negative values participate in inferred domains. Line/scatter do not silently
  force positive-only domains. Bar baselines use the projected zero value.
- Non-finite samples are excluded from extent and histogram calculations. For
  lines they break the path, preserving gaps rather than connecting across them.
- Dimensions must be finite and leave positive plot space after margins; reject
  invalid layout configuration with a descriptive error at the pure API boundary.
- Datum keys must be unique within a chart. Reject duplicates rather than create
  ambiguous selection. A series key need not be unique.

Fix the existing `linear` equal-domain defect as part of this slice. Reference
the official D3 source and document the provenance. `d3-main/` is absent from both
current checkouts: resolve that reference before changing chart maths, rather
than treating its absence as permission to invent behaviour.

## Theme and colour contract

`ChartTheme` supplies semantic background, text, muted text, grid, axis, focus,
selection, tooltip background and tooltip text tokens, plus font family, label
size and default mark sizes. Provide light and dark defaults as explicit values
and CSS custom properties. Defaults remain replaceable at a containing chart.

`SeriesStyle` supplies stroke, fill, opacity, stroke width, point radius, symbol
and dash pattern. Resolve precedence as library defaults, application theme,
chart overrides, keyed series overrides, then per-datum overrides. State styling
may add an outline or size change while retaining the series' identity.

`seriesStyles` is keyed by stable series ID; marks, legends and tooltips resolve
their appearance through the same mapping. Colour assignments must survive
filtering, sorting and selection. Do not derive series identity from its current
position in a filtered array. A default palette uses an explicit stable series
domain; handle palette exhaustion deterministically and document its cycling.

Paint accepts ordinary CSS colour strings, including `var(--brand)` and
`currentColor`. Opacity is a separate SVG attribute; never append hex characters
to paint strings. Correct the demo line/area renderers' suffix construction and
honour the existing line `areaColor` option.

Numerical interpolation is a separate contract from SVG paint. This slice does
not promise that unresolved CSS variables can be numerically interpolated.
Document the current hex-only interpolation limitation and the known
`interpolateRgbBasis` parity gap; a comprehensive colour-parser/spline parity
repair is separate work. The new rendering contract must not depend on either
limitation to support custom themes.

Provide semantic series tokens for the promo examples, including both scatter
groups and legend markers. Light/dark switching changes chart surfaces and
legibility without resetting settings or changing series identities. Sample
datasets and named defaults are allowed; consumer data, domains, dimensions,
formatters and colours must not be locked inside reusable renderers.

## Rendering and extensibility

The optional FoldKit module exposes `chartFrame`, `axis`, `grid`, `lineSeries`,
`pointSeries`, `barSeries`, `legend`, `annotation`, `tooltip`, and `dataTable`.
Each returns `Html` and receives the parent's builder; it creates no runtime.
Use descriptive option records, with geometry from the pure API and explicit
appearance, formatting and accessible labels.

`chartFrame` accepts ordered child layers, so the caller controls draw order and
can overlay multiple series, a threshold or custom SVG. Annotation geometry uses
the same scales and plot bounds as series and axes; it must not use unrelated
pixel constants. Custom tooltip rendering receives the original datum, projected
position, resolved style and the supplied builder. A caller can replace legend
or tooltip output without replacing mark geometry or interaction handling.

Pointer/focus/click handlers are supplied as functions producing the parent's
typed Messages. Rendering never dispatches directly or mutates the DOM.
These initial layers are stateless and therefore need no artificial child Model.
The existing promo Models continue to own controls, selection and editor state.

For existing stateful chart composition, use `foldChild` to preserve child
models, Commands and typed out messages. Use `foldChildInits` for sibling
initialisation. Describe interactions as past-tense Messages. Publish semantic
selection changes through typed out messages rather than make parents inspect
private gesture state. Preserve the existing public `Selection` union and its
parent-owned coordination boundary. This slice documents and tests the folding
contract using a small composed example; it does not migrate all demo charts.

## Responsive and accessible design

The promo host owns a serialisable size record and any measurement lifecycle.
Measurement facts enter the update loop; measurements and observers run in
scoped FoldKit effects, with cleanup. Do not place DOM elements or callbacks in
Models. Recompute geometry and hit testing when available chart size changes.
Use a shared responsive frame policy, with readable label sizes and reduced tick
density on narrow screens, instead of shrinking the entire fixed SVG equally.

Verify 390px and desktop layouts. The narrow plot must have labels at least 12px
in rendered CSS pixels and no horizontal page overflow. Long labels must have a
documented wrapping, omission or formatting policy that preserves raw values in
the data alternative. Significant zero baselines remain visible.

Every reference chart supplies a title, description, axis units/labels, a data
alternative and visible empty feedback. Chart examples remain labelled as
illustrative data. Scatter groups use different symbols or an equivalent visible
non-colour distinction; legends show that distinction. Keyboard and pointer
inspection produce the same parent selection. Focus has a visible indicator.
Avoid an unbounded tab stop per datum: use a chart-level keyboard navigation
pattern plus the existing explicit point selector. Honour reduced motion.

## Reference examples and export compatibility

Migrate `/examples/line/`, `/examples/histogram/` and `/examples/scatter/` to the
shared geometry and FoldKit layers. Retain their controls, reset, source selector,
copy, ZIP download and StackBlitz launch. Keep the line Edit live session and
its restart/preservation behaviour. Do not broaden live editing to other charts.

Demonstrate a threshold annotation, custom tooltip, keyed series styles and a
custom brand theme through maintained example code. Explain the override points
in the documentation and exported README. The demonstrations must exercise the
public API; no example-only branch inside the library is permitted.

`buildExampleTemplate` already vendors compiled Viz modules into exported Vite
projects. Extend its module closure and exports to include the new geometry,
theme and optional FoldKit adapter plus their emitted dependencies and types.
Exports must run independently of the workspace and of an unpublished npm
version. Source previews must show the code that actually runs.

## Acceptance and verification

1. Geometry tests independently check empty, singleton, constant, zero, negative,
   non-finite, reversed-domain, custom-frame and duplicate-key cases. SVG paths
   and projected mark positions contain no `NaN` or `Infinity` for accepted data.
2. Rendering tests use real FoldKit-produced output to verify custom CSS paint,
   independent opacity, keyed colour stability, replaced tooltips, composed
   overlays, accessible descriptions and data alternatives.
3. A composed child-update test proves Commands and typed out messages reach the
   parent through `foldChild`, with no direct DOM state or discarded results.
4. Existing control/state tests continue to pass. New tests prove custom data
   does not depend on fixtures imported by the reusable chart functions.
5. Build and typecheck each exported standalone project outside the workspace.
   Import-smoke the public subpaths under Bun and Node. Confirm that importing the
   root mathematical API does not require the optional FoldKit adapter.
6. Browser-check all three reference charts in light/dark modes at 390px and
   desktop widths, including keyboard inspection, filter/reset, custom theme,
   tooltip, annotation, resize, ZIP and line editor preservation.
7. Run `bun run check`, `bun typecheck`, `bun run test`, the promo build and
   `git diff --check`. Run package-rebuilding checks sequentially and restore
   healthy promo dev mode on port 4321 after verification.

Commit verified work on the existing worktree branch. Do not push, publish or
deploy as part of this slice. Add package changelog and usage documentation;
versioning/publication are separate release work.

## Limits of this slice

No React adapter, full migration of the demo catalogue, Canvas renderer,
large-dataset performance claim, new remote-data policy, new linked dashboard,
or comprehensive mathematical parity audit. Later chart migrations use the
contracts demonstrated here. Theme support does not by itself establish colour
contrast conformance: inspect reference themes and document consumer obligations.

## Review record

Self-review: the package boundary preserves the framework-independent core;
accessors/callbacks stay outside serialised Models; interpolation limitations are
explicit; standalone vendoring includes new module dependencies; acceptance
covers rendering, interaction composition, data robustness and actual browser
behaviour. No product implementation has started under this approved spec.
