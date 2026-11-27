---
name: foldkit-viz
description: Use when building or reviewing charts with @opsydyn/foldkit-viz, choosing geometry and scales, writing declarative plot specs, using its optional Effect UI rendering adapters, plotting column or Arrow data, or implementing chart selection, responsive measurement, themes and accessibility. Astro is not required.
---

# FoldKit Viz

Use Viz for pure data transformation and geometry, with optional Effect UI view
helpers. The consuming application owns rendering lifetime, data loading and
interaction policy. This skill works without Astro or its integration skill.

## Establish the consumer contract

Read the installed version, export map and declarations before selecting APIs. The [pure
scatter example](assets/scatter/package.json) targets the published
`@opsydyn/foldkit-viz@0.18.0` contract and installs neither FoldKit, Effect nor Astro.
The coordinated major release provides Effect UI adapters under
`effect-ui/*`. Use the Effect UI snapshot declared in the workspace catalog.
Earlier releases have their own export maps and renderer contracts.

## Choose the smallest layer

| Need                                          | Public entry                                                        |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Line, scatter or histogram geometry           | `@opsydyn/foldkit-viz/chart/cartesian`                              |
| Scales, shapes, statistics or layout          | Relevant `/math/*`, `/shape/*`, `/hierarchy`, `/simulation` subpath |
| Parent-owned selection values                 | `/interaction/selection`                                            |
| Themes and series styles                      | `/chart/theme`                                                      |
| Effect UI SVG frame, axes, marks, legend, table | `/effect-ui/cartesian` with the parent's `Html.H`                |
| State-machine graph layout                    | `/stateflow` (`layoutStateFlow`)                                    |
| Modules orbiting a core (ball of mud)         | `/chart/orbit`, rendered by `/effect-ui/orbit` (`0.17.0`+)       |
| A standard chart as a JSON spec (`0.18.0`+)   | `/plot` (`compilePlot`), rendered by `/effect-ui/plot` or `/canvas/plot` |
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

The root is framework-free. Optional adapters return view content through the
owning component's HTML builder. See [chart composition](references/charts.md)
and [the adapter example](assets/effect-ui-view.ts).

## Preserve data and state ownership

- Cartesian accessors are `x`, `y`, `datumKey`, `seriesKey`. Supply globally
  unique, stable datum IDs and stable series IDs; don't use filtered positions
  as identity. Preserve original records for labels and tables.
- Derive geometry from current data and measured dimensions. The host application
  owns remote loads, selection, brush/zoom and theme choice. In Effect UI, keep these
  in the Model and describe effects with Commands and scoped subscriptions/Mounts.
  A plain TypeScript host uses its own state and lifecycle, without adding a UI dependency.
- In Effect UI, share inspection through parent updates and child events. A
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

Consult `astro-effect-ui` only when embedding into Astro. AG-UI transport and agent
tools are separate application concerns. For a declarative chart, use the plot
grammar's JSON spec and its published schema where the installed version has them,
rather than inventing a chart format.
