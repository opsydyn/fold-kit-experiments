---
name: foldkit-viz
description: Use when building or reviewing charts with @opsydyn/foldkit-viz, choosing geometry and scales, writing declarative plot specs, using its optional FoldKit rendering adapters, plotting column or Arrow data, or implementing chart selection, responsive measurement, themes and accessibility. Astro is not required.
---

# FoldKit Viz

Use Viz for pure data transformation and geometry, with optional FoldKit view
helpers. The consuming application owns rendering lifetime, data loading and
interaction policy. This skill works without Astro or its integration skill.

## Establish the consumer contract

Read the installed version, export map and declarations before selecting APIs. The [pure
scatter example](assets/scatter/package.json) targets the published
`@opsydyn/foldkit-viz@0.18.0` contract and installs neither FoldKit, Effect nor Astro.
Optional FoldKit adapters peer on FoldKit `>=0.167.0 <0.172.0` in Viz 0.19.1 and Effect 4.
When using these adapters, pin a browser platform version whose Effect peer
range accepts the application’s installed Effect version.

Every subpath in the table below is published by `0.19.0`; rows marked `0.19.0`+
need that release or newer. New in `0.19.0`: SVG and PNG export, named and
high-contrast themes, Jupyter, GPU points, DuckDB input, pushdown into SQL engines
and 3D charts through effect-three. New in
`0.18.0`: the plot grammar (`./plot`, `./foldkit/plot`, `./canvas/plot`), the keyboard
helpers (`./interaction/keyboard`, `./foldkit/keyboard`), column tables and Arrow data,
and the JSON Schema for plot specs (`./plot-spec.schema.json`); see
[the plot grammar](references/plot.md). `0.17.0` added `chart/orbit` with
`foldkit/orbit`, and earlier releases the remaining chart, layout, interaction and
shape subpaths. Repository main can move ahead of the published version: check an
older installed tarball's export map before importing a newer subpath. Word-cloud collision bounds are
conservative measured rectangles, not pixel-mask D3 parity. Supplied interval geometry
does not infer confidence or statistical significance.

## Choose the smallest layer

| Need                                          | Public entry                                                        |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Line, scatter or histogram geometry           | `@opsydyn/foldkit-viz/chart/cartesian`                              |
| Scales, shapes, statistics or layout          | Relevant `/math/*`, `/shape/*`, `/hierarchy`, `/simulation` subpath |
| Parent-owned selection values                 | `/interaction/selection`                                            |
| Themes and series styles                      | `/chart/theme`                                                      |
| FoldKit SVG frame, axes, marks, legend, table | `/foldkit/cartesian` with the parent's `HtmlBuilder`                |
| State-machine graph layout                    | `/stateflow` (`layoutStateFlow`)                                    |
| Modules orbiting a core (ball of mud)         | `/chart/orbit`, rendered by `/foldkit/orbit` (`0.17.0`+)       |
| A standard chart as a JSON spec (`0.18.0`+)   | `/plot` (`compilePlot`), rendered by `/foldkit/plot` or `/canvas/plot` |
| Column, Arrow or million-row data (`0.18.0`+) | `/plot` (`columnTable`, `fromArrow`, `dense` dot marks)             |
| Keyboard paths through chart targets (`0.18.0`+) | `/interaction/keyboard`, `/effect-ui/keyboard`                        |
| Checking specs another program writes (`0.18.0`+) | `/plot-spec.schema.json`, a JSON Schema for `PlotSpec`              |
| A plot as an SVG file or HTML string (`0.19.0`+) | `/svg/plot` (`plotSvg`, `plotHtml`), legends and a `theme` included |
| A plot as a PNG (`0.19.0`+)                  | `/canvas/image` (`plotPng` on an OffscreenCanvas, `paintImage` on any 2D context) |
| Brushing a million points in a frame (`0.19.0`+) | `/webgl/points` (`pointsLayer`) above `/canvas/plot` with `points: false` |
| DuckDB results and streamed data (`0.19.0`+) | `/plot` (`fromDuckDB`, `duckdbColumns`, `columnStore`, `appendPoints`) |
| Histograms over data in DuckDB or Polars (`0.19.0`+) | `/plot` (`pushdown`), counted in the engine |
| Named and high-contrast themes (`0.19.0`+)   | `/chart/theme` (`chartThemes`, `ThemeName`); `contrastRatio` in `/math/color` |
| Inline plots in Deno or Bun Jupyter kernels (`0.19.0`+) | `/jupyter` (`displayPlot`, `plotMimeBundle`)                   |
| 3D scatter or surface with effect-three (`0.19.0`+) | `/chart/space3d` laid out, `/effect-three/space3d` as scene nodes |

The root is framework-free. Optional adapters are not an app runtime; they
return `Html`, not a complete `Document`, and must not create a second builder.
Install FoldKit and Effect only when using those adapters. See
[chart composition](references/charts.md) for concrete input contracts and
[the adapter example](assets/foldkit-view.ts) for a render-scoped view function.

## Preserve data and state ownership

- Cartesian accessors are `x`, `y`, `datumKey`, `seriesKey`. Supply globally
  unique, stable datum IDs and stable series IDs; don't use filtered positions
  as identity. Preserve original records for labels and tables.
- Derive geometry from current data and measured dimensions. The host application
  owns remote loads, selection, brush/zoom and theme choice. In FoldKit, keep these
  in the Model and describe effects with Commands and scoped subscriptions/Mounts.
  A plain TypeScript host uses its own state and lifecycle, without adding FoldKit.
- In FoldKit, share inspection through parent updates and child OutMessages. A
  global mutable event bus is not required for linked charts.
- For empty, non-finite, duplicate-key and degenerate inputs, use the actual
  geometry contract. Do not invent fallback coordinates or silently aggregate
  rows. Domain/filter changes must reconcile stale selection.
- Provide meaningful labels, a data table, visible focus and a keyboard path for
  interactive marks. Pointer callbacks alone do not provide keyboard access.

## Verify

Copy `assets/scatter/` into a standalone project and run `bun install`,
`bun run check`, and `bun run test`. Tests exercise real geometry and datum
identity. For UI work also verify resizing, keyboard inspection, empty/error
states, and light/dark contrast in the browser.

When changing package geometry, compare the relevant upstream D3 source and
edge-case tests; D3 is a reference, not a required runtime dependency. For a
consumer task, use existing public primitives rather than reimplementing math.

Consult `astro-foldkit` only when embedding into Astro. AG-UI transport and agent
tools are separate application concerns. For a declarative chart, use the plot
grammar's JSON spec and its published schema where the installed version has them,
rather than inventing a chart format.
