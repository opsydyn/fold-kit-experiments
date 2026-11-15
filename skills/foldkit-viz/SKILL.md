---
name: foldkit-viz
description: Use when building or reviewing charts with @opsydyn/foldkit-viz, choosing geometry and scales, using its optional FoldKit rendering adapters, or implementing chart selection, responsive measurement, themes and accessibility. Astro is not required.
---

# FoldKit Viz

Use Viz for pure data transformation and geometry, with optional FoldKit view
helpers. The consuming application owns rendering lifetime, data loading and
interaction policy. This skill works without Astro or its integration skill.

## Establish the consumer contract

Read the installed version, export map and declarations before selecting APIs. The [pure
scatter example](assets/scatter/package.json) targets the published
`@opsydyn/foldkit-viz@0.17.0` contract and installs neither FoldKit, Effect nor Astro.
Optional FoldKit adapters peer on FoldKit `>=0.167.0 <0.171.0` and Effect 4, and are
qualified on FoldKit `0.170.0` with Effect `4.1.0`. These are qualified baselines, not
instructions to downgrade another project. When using the adapters, pin
`@effect/platform-browser` to the same version as `effect` (`4.1.0` here). FoldKit 0.170
accepts `~4.1.0`, so npm otherwise picks the newest `4.1.x`, which requires an equal or
newer `effect` and fails to resolve against an exact `4.1.0`.

Every subpath in the repository's export map is published in `0.17.0`, including
`chart/bars`, `foldkit/paint`, `layout/wordcloud`, `layout/text`,
`interaction/coordinates`, `interaction/viewport`, `interaction/inspection`,
`chart/segments`, `chart/intervalBand`, `chart/errorBars`, `shape/globe`, `stateflow`,
and `chart/orbit` with `foldkit/orbit`, which are new in `0.17.0`. Repository
main can still move ahead of the published version: check an older installed tarball's
export map before importing a newer subpath. Word-cloud collision bounds are
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

Consult `astro-foldkit` only when embedding into Astro. AG-UI transport, agent
tools and a declarative chart schema are separate application concerns.
