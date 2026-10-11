# Chart Composition

## A standalone pure consumer

`assets/scatter/` contains a complete TypeScript consumer with package imports,
build/typecheck scripts and Node tests. No monorepo path or other skill is needed.
It pins Viz 0.11.0 and TypeScript 6.0.3; copy it into an independent project and
run the commands in the skill entrypoint. The package's pure root does not
require FoldKit or Effect; don't install them just to compute points or paths.

The input shape belongs to the consumer. `scatterGeometry(data, accessors, config)`
and `lineGeometry` take `x`, `y`, `datumKey` and `seriesKey` functions. The frame
contains `width`, `height`, and `{ top, right, bottom, left }` margins. Geometry
contains a layout, axis ticks and projected points; line geometry also contains
series paths. Each projected point retains its original `datum` and key.

For Cartesian geometry in this baseline:

- Duplicate datum keys throw. Keys must identify records across all series.
- Non-finite samples are omitted from projected points. A line can use `defined`
  to introduce gaps. Don't substitute zero for missing measurements.
- Empty and single-valued inputs get resolved domains; test what the consumer
  should display rather than assuming an exception or a useful empty chart.
- Explicit domains, zero inclusion and tick counts are consumer decisions.
  Resizing changes the frame, not the underlying datum identity.
- `histogramGeometry` takes a value accessor and its own configuration, not the
  Cartesian accessor object. Its bins preserve original records.

## Optional FoldKit rendering

`assets/foldkit-view.ts` is an optional view-function example, not part of the
pure starter. Copy it into an existing FoldKit application with Viz 0.11.0,
FoldKit 0.167.x and Effect 4.0.0 installed. Call `chartView(h)` inside the parent's
`view(model, h)` and include the returned `Html` in its `Document.body`.

The adapter receives `HtmlBuilder<Message>` from that render. Do not cache it,
construct a global builder, start an app runtime in a chart helper, or mutate SVG
nodes imperatively. The same ownership rule applies when the parent server-renders.
Pure geometry can also feed a non-FoldKit renderer without installing these peers.

Compose layers as children: grid, marks, annotations/inspection, and axes in the
desired drawing order. Use the exported helpers' installed types rather than
inventing props such as `data` on a layer that expects projected `points`.

Theme precedence is defaults, theme, chart, series, then datum override. Fix the
series-to-style mapping before filtering so colours and symbols do not change
when a series is hidden. Keep light/dark choice in application state or CSS tokens.

## Interaction and accessibility

In a FoldKit host, store selection and active datum IDs in the Model. Map pointer,
keyboard, brush and zoom events into past-tense Messages. For linked charts,
fold child OutMessages into the parent and pass the resulting selection back
down; stable panel identity belongs in the parent as well.
In a plain TypeScript host, use its existing state and event mechanisms instead;
the following lifetime and identity requirements still apply without FoldKit.

Use a scoped measurement source and release it when the owning chart disappears.
Recompute geometry on resize. On filter or data changes, clamp interval selection
and clear an inspected key when the datum is no longer present. Remote loading,
stale-data presentation, request correlation and cancellation remain outside Viz.

An SVG label is not a complete interaction model. The current `chartFrame`
uses `role="img"`; do not assume nested focusable marks are independently exposed
by every accessibility tree. Choose a deliberate strategy: a single focusable
chart with keyboard navigation and a live summary, or a suitable grouped
structure for individually focusable labelled marks. Verify the resulting tree
and keyboard behaviour. Include a raw-data table; colour and hover alone are
insufficient. Test mobile overflow and reduced motion for animated charts.

## Grouped bars and paint availability

The reviewed workspace adds `chart/bars` and `foldkit/paint` ahead of publication.
They are intentionally absent from this skill's 0.11.0 runnable examples. After
confirming a consumer version exports them:

- `barGeometry` uses `key`, `category`, `series`, `value` accessors (not the
  Cartesian names), plus grouped/stacked mode and vertical/horizontal orientation.
- Values must be finite; duplicate keys and category/series pairs are rejected.
  Aggregate intentionally before calling. Signed stacks accumulate separately;
  explicit domains must include zero and all endpoints.
- Paint helpers are optional FoldKit render helpers. Put their output inside SVG
  `defs`, provide document-unique IDs, and reference those IDs from marks.
  They are not exports from the framework-free root.

Do not cast away a missing import or point at repository source to pretend an
unreleased feature is installed. Retain an existing supported chart or propose
a separately approved compatible package upgrade.

## Verification and references

Test real geometry for empty/sparse input, original datum preservation, stable
keys, invalid input, signed data and resizing as relevant. Run typechecking and
the consumer build. Browser interaction and screen-reader claims need separate
evidence; the pure starter's tests do not establish them.

For package implementation work, verify a local D3 reference is present and
version-appropriate. Otherwise use the relevant official d3 repository source;
do not assume every consumer has a `d3-main/` checkout.

Package documentation: https://github.com/opsydyn/fold-kit-experiments/tree/main/packages/foldkit-viz
Use the installed release's README/declarations when repository main is newer.
