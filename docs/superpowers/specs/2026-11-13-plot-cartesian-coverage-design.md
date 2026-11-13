# Plot Cartesian coverage — design

**Status:** approved for foldkit-viz 0.21.0, 2026-11-13. Fourth release of the
[data-science release track](../../roadmap.md#viz-data-science-release-track--2026-11-13),
extending [ADR 0037](../../adr/0037-a-declarative-grammar-of-marks-for-foldkit-viz.md).

## Goal

Every chart demo that sits on x and y axes is a plot spec from the library, so
the web app's `apps/web/src/ui` loses its Cartesian chart modules. The grammar
gains what those demos need and nothing else.

## Principles kept

- The spec stays JSON: every new option is a plain value.
- Geometry stays pure and renderer-agnostic; no listeners, no state.
- Errors are RangeErrors that start with the spec path.
- No argument spreading of data-sized arrays.

## Derived channels

Transforms already rewrite a mark's rows before scales are resolved, but only
for `x` and `y`. Stacking and binning also write `x0`, `y0` and new mark
channels, so a prepared mark carries a map of channel overrides instead of an
`x` and a `y`. Scales, colour and mark geometry read a channel through the
override when there is one. Colour reads the transformed rows when a transform
replaces the rows (binning), so a fill can name an output field such as `count`.

## Symbols

- `symbol` on dot marks: a field, mapped in order of appearance onto `circle`,
  `cross`, `diamond`, `square`, `star`, `triangle` and `wye` (`SYMBOLS_FILL`, the
  D3 order), or a constant such as `{ value: 'square' }`.
- A plot-level `symbol: { domain?, range?, legend?, label? }` overrides the order
  or the symbols.
- Circles stay `circle` graphics. Other symbols are `path` graphics translated to
  the point, sized so the symbol's area matches a circle of the same `r`.
- A symbol legend joins the legends: `{ kind: 'symbol', label, entries }`, each
  entry with its symbol's path. When the same field drives colour, entries carry
  the colour too.
- A dense dot mark draws circles only; `symbol` on it is an error.
- `indexPlot` indexes translated paths by their centre, so symbols hover.

## Density

`{ mark: 'density' }` with `x` alone, or with `x` and `y`.

- **One-dimensional:** a kernel density of `x` per series (`z`, or the `fill`
  or `stroke` field), sampled at 128 points across the series' extent padded by
  three bandwidths. It becomes rows of x and density before scales are resolved,
  so the y axis is density and starts at zero. Drawn as a filled area (opacity
  0.3 by default) with an outline. `bandwidth` is in data units; the default is
  Silverman's rule per series.
- **Two-dimensional:** contour lines of point density, computed after scales are
  resolved, in plot pixels, so any axis scale works and the bandwidth means the
  same on both axes. `bandwidth` is in pixels (default 20) and `thresholds` is
  the number of levels (default 8). Points are splatted onto a grid of 4-pixel
  cells within the plot area, so the cost grows with points times the kernel
  area, not points times the grid. Each level is a `path` graphic; its opacity
  rises from the outermost to the innermost level. The stroke is the mark's
  `stroke`, a constant colour.

## Stacking and grouping

- `stack` on bar and area marks: `'zero'`, `'normalize'`, `'center'` or
  `'wiggle'`, or `{ offset?, order? }` with order `'input'`, `'ascending'`,
  `'descending'` or `'insideOut'`.
  - Series come from `z`, or the `fill` field. Bars stack within each category
    of the band axis; areas stack at each x, with a missing series counting as
    zero.
  - `'zero'` stacks positive values up from zero and negative values down from
    it, so diverging charts such as Likert scales need no extra option.
    `'normalize'` scales each stack to sum to one. `'center'` and `'wiggle'`
    (areas only) give streamgraph baselines through `shape/stack`.
  - Stacking writes the value channel and its start (`y` and `y0`, or `x` and
    `x0` for horizontal bars), so the axes include every stacked extent.
- `group: true` on bar marks places each series side by side within its band,
  in series order. Grouping and stacking together is an error.
- A bar's orientation follows its band axis: the axis spec's type when given,
  otherwise whichever channel holds strings.

## Rectangles and binning

- A new `rect` mark spans `x1` to `x2` and `y1` to `y2` on continuous axes. A
  missing `y1` (or `x1`) starts at the axis baseline, as bars do.
- A `bin` transform on `rect` marks: `{ type: 'bin', thresholds?, domain?,
reduce? }`, with thresholds a count or explicit breaks (`math/bin`), and
  reduce `'count'` (default) or `'proportion'`.
  - With `x` alone, rows become one per bin with `x1`, `x2` and the reduced
    value as `y2`: a histogram from raw rows. Series (`z`, or the `fill` field)
    bin separately on shared thresholds.
  - With `x` and `y`, rows become one per non-empty rectangle with `x1`, `x2`,
    `y1`, `y2` and a `count` field, so `fill: 'count'` colours a two-dimensional
    histogram (`math/bin2d` `rectBins`).
- Hexagonal binning stays in `chart/cells`: hexagons tile only in pixel space,
  which the grammar does not reach before scales are resolved. It is not needed
  by any demo moved here.

## Highlight without recompiling

Measured on the `/explore` data (bun, a million rows): compiling the dense
scatter takes about 130 ms, computing highlight factors 8 ms and indexing 20 ms.
The rest of the 680 ms brush is rebuilding the index and painting a million
arcs.

- `highlightPoints(geometry, markIndex, data, highlight)` in `plot` returns the
  geometry with that dense mark's `dimmed` flags recomputed. Positions, palette
  and row indices are shared, so a `PlotIndex` built from the old geometry
  stays valid. Packed points' `rows` index the mark's full data even when the
  plot is faceted, which this relies on.
- `paintPlot` draws packed points of radius 1.5 pixels or less as squares,
  which canvas fills far faster than arcs and which look the same at that size.
- `/explore` caches its index by zoom alone and restyles on brush.

## Demos moved into the grammar

Each becomes a spec beside a pre-rendered app, as the 0.19.0 promotions did, with
hover details moved into native tooltips. Its `apps/web/src/ui` module is removed.

- Expressible before this release: area, bar, bubble, bullet, bump, calendar
  heatmap, correlation matrix, curve comparison, diverging bar, heatmap, line,
  log scatter, scatter, threshold bar, tile-grid map, timeline, waterfall and
  zoomable line.
- Needing this release: diverging stacked bar (stack), streamgraph (stack
  wiggle), histogram (rect and bin), histogram brush (bin and highlight),
  symbol scatter (symbol) and density contour (two-dimensional density).
- Zoomable line and histogram brush keep their interaction as small apps over
  specs, using overlays and the 0.20.0 helpers, as `/explore` does.
- `histogram-chart` and `scatter-chart` stay for now: the linked-charts,
  request-diagnostics and comparison reference apps use their selection
  messages. Moving those apps is separate work.
- The Storybook primitives stories that use the area, bar, line and scatter
  modules render specs instead.

## Exit criteria

The 24 demos above are plot specs rendered on the server; their `ui` modules are
removed except the two kept for the reference apps; and brushing on `/explore`
highlights the scatter within one frame.

## Out of scope

Polar, geographic, network and tree charts (0.22.0); hexagonal binning in the
grammar; reducers other than count and proportion.
