# The plot grammar

`@opsydyn/foldkit-viz/plot` is new in `0.18.0`. On an older installed version,
whose export map has no `./plot`, use the geometry layers in
[chart composition](charts.md).

## When to use it

- **A spec:** a chart described as plain data, with marks whose channels name
  fields, and scales, axes and legends inferred. Choose it when a chart is
  standard (scatter, line, bars, histogram, density, maps, trees and more), when
  something other than hand-written TypeScript writes the chart (a server, a
  notebook, another language, a model), or when it must render identically in
  several places.
- **Geometry primitives** (`chart/cartesian`, `math/*`, `shape/*`): choose them
  for a bespoke chart the grammar cannot express.

`compilePlot(spec)` is pure and framework-free. It returns geometry, which
`foldkit/plot` (`plotChart`, `plotCanvas`) renders in a FoldKit view, and
`canvas/plot` (`paintCanvas`) paints on a canvas with no FoldKit at all.
Where the installed export map has them (newer than `0.18.0`), `svg/plot`
returns markup strings with no framework: `plotSvg` a standalone SVG file with
its legends, in the `light` theme unless given another, and `plotHtml` the same
figure `plotChart` renders. `canvas/image` paints that picture on a canvas and
`plotPng` encodes it through a canvas the caller supplies (foldkit-viz bundles no
rasteriser). A `theme` is a `ThemeName` (`light`, `dark`, `high-contrast-light`,
`high-contrast-dark`) or a palette; choose a high-contrast theme where readers
need AAA text contrast, and never invent theme colours without checking them
with `contrastRatio`. In a Deno or Bun Jupyter kernel, make
`displayPlot(spec)` from `jupyter` a cell's value; `plotMimeBundle` builds the
same bundle from geometry. From Python, the repository's `foldkit_viz.Plot`
anywidget (not on PyPI yet) checks a spec against the schema and draws it the
same way. Don't hand-write SVG for a chart the grammar draws. For a dense
mark that must restyle within a frame (live brushing), draw the points with
`webgl/points` above a canvas painted with `points: false`, keep the layer for
the canvas's lifetime, and on each brush call `highlight` with the
`highlightPoints` result, then `draw`; do not remount the canvas per brush.

For DuckDB, plot `fromDuckDB(reader)` rather than row objects; for a result
streamed in, convert each chunk with `duckdbColumns`, grow a `columnStore`, and
add points with `appendPoints` when the spec fixes every domain a chunk could
move (otherwise recompile; `appendPoints` refuses rather than guess).

When the data stays in DuckDB or Polars, use `pushdown(spec, { from, query })`
to count binned rect marks in the engine instead of pulling every row; it gives
the same geometry as a local compile. Never build `from` from user input.

## Spec rules

- **Plain JSON, no functions.** A channel is a field name or `{ value }`. A spec
  must survive `JSON.parse(JSON.stringify(spec))` unchanged.
- **Errors name the spec path**, such as `marks[0].x: field "dosage" is missing
  from the data`. Fix the spec; do not catch and ignore.
- **Scales are inferred:** numbers give linear axes, strings band axes, ISO dates
  UTC time axes. Override with `x`, `y` and `color` (`type`, `domain`, `scheme`).
  `color.scheme` is one of the schemes `math/schemes` exports (`SchemeName`).
- **Transforms** derive rows: `bin`, `regression`, `loess`, `window`,
  `downsample`, and `stack` and `group` on bars and areas. Binned rows name
  their fields plainly (`x1`, `x2`, `count`).
- **Facets** (`facet: { x, y }`) split every mark's rows into panels on shared
  scales.

The package README's plot sections list every mark and option; read them for
the installed version rather than guessing a mark's channels.

## Data

- **Rows** (`ReadonlyArray<Row>`), or a **column table** from
  `columnTable({ name: column, ... })`, where columns are plain or typed arrays
  of equal length. `fromArrow(table)` adapts a flechette or apache-arrow table
  without depending on either.
- **Tables are immutable,** like rows: make a new table for changed data.
  `columnTable` wraps existing arrays without copying.
- **Reading data back:** `spec.data` may be either form; call `rowsOf(data)` to
  get rows.
- **Large data:** mark a dot layer `dense: true` to pack it into typed arrays,
  and paint it with `plotCanvas` or `paintCanvas`. Over a column table, a dense
  mark builds no row objects.
- **Summarise in the engine** when the chart shows a distribution, total or
  density: aggregate in Polars, DuckDB or SQL and send the bins, not a million
  rows. Send points only when people inspect, brush or hover single rows.

## Interaction and accessibility

The application owns hover, brush, zoom and selection state; the library installs
no listeners.

- `indexPlot(geometry).nearest(x, y, radius)` finds the row under a plot pixel;
  `pointerToPlot` converts client coordinates, and `invertAxis` and `invertPlot`
  convert pixels to data values.
- `highlight: { field, range }` or `{ field, values }` dims other rows; for a
  dense mark, `highlightPoints(geometry, markIndex, data, highlight)` restyles
  without recompiling. A linked brush is one chart's selection written into
  another chart's spec.
- Keyboard: `chartCommandOf` and `targetAfter` (`interaction/keyboard`), and
  `chartKeyDown` (`foldkit/keyboard`) for FoldKit views.
- Every chart should carry `plotChart(h, geometry, { summary: true, table: plotTable(spec) })`:
  a plain-language description and the data as a table.

## Specs from other languages

The package publishes a JSON Schema for `PlotSpec` at
`@opsydyn/foldkit-viz/plot-spec.schema.json`. A program in Python or Rust that
writes specs should validate them against it (`jsonschema` in either) before
sending. The schema checks structure: marks, channel types, transforms, scales,
schemes and unknown keys. `compilePlot` still checks what depends on the data,
such as a field missing from the rows. A `"$schema"` key is allowed.

## Verify

- Compile every spec the task adds in a test, and assert on the geometry or
  `describePlot(geometry)`, not on a snapshot of markup.
- For a spec another program writes, validate its JSON text against the schema
  in a test.
- In the browser, check light and dark, keyboard inspection, and a narrow
  viewport.
