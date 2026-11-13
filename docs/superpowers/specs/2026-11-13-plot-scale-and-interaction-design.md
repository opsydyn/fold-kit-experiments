# Plot scale and interaction — design

**Status:** approved for foldkit-viz 0.20.0, 2026-11-13. Third release of the
[data-science release track](../../roadmap.md#viz-data-science-release-track--2026-11-13),
extending [ADR 0037](../../adr/0037-a-declarative-grammar-of-marks-for-foldkit-viz.md).

## Principles kept

- Geometry stays pure. foldkit-viz installs no event listeners and holds no
  interaction state (a [deliberate non-goal](../../roadmap.md#deliberate-non-goals)).
- The parent owns hover, selection, brush and zoom in its Model. Interaction
  reaches a chart as data: a spec setting, or an overlay passed to a renderer.
- The spec stays JSON. Interaction settings in it are plain values.

## Scale: a million points

- **Dense dot marks.** `{ mark: 'dot', dense: true }` compiles to one packed
  `points` graphic, with `Float64Array` x and y positions, instead of a graphic
  per row. Per-row keys and titles are dropped; the hit-test index below names
  the row instead. Colour, size and highlight still apply, through per-point
  paint indices into a small palette.
- **No argument spreading** of data-sized arrays anywhere in the compiler: all
  extents are loops, so a million rows cannot overflow the call stack.
- **`canvas/plot`** (new, framework-free): `paintPlot(context, geometry, options)`
  draws compiled geometry on any `CanvasRenderingContext2D`-shaped context,
  including axes, grid and text, scaled for the device pixel ratio. `foldkit/plot`
  gains `plotCanvas`, which renders a `<canvas>` and paints it from a Mount when it
  enters the DOM; keying it by the geometry repaints on change.

## Interaction

- **Hit-testing.** `indexPlot(geometry)` builds a quadtree over circles, packed
  points and rectangle centres. `nearest(x, y, radius)` returns the closest mark
  element in plot pixels: its facet, mark, key or row index, and position.
  Building is linear in points; a query is logarithmic.
- **Pixel to data.** `invertPlot(geometry, x, y)` returns the facet under a point
  and its data coordinates on continuous axes, or the band under it on band axes.
  `pointerToPlot(client, rect, geometry)` converts a pointer's client position
  through the element's bounding rectangle into plot pixels.
- **Highlight.** A mark's `highlight: { field, range? | values? }` keeps matching
  rows at full opacity and dims the rest. A linked brush is one chart's brushed
  range written into another chart's spec.
- **Overlays.** `plotChart` and `plotCanvas` take an `overlay` of crosshair and
  hover-ring positions, drawn without recompiling the plot.
- **Zoom and pan.** `zoomDomain` and `panDomain` from `interaction/viewport`
  compute new domains, which the parent writes back into the spec's `x` and `y`
  domains. `invertPlot` supplies the zoom centre.

## Exit criteria

A web-app page with a one-million-point scatter on canvas linked to a histogram:
hovering finds the nearest point and draws its crosshair within one frame
(16 ms), and brushing the histogram highlights the matching points.

## Out of scope

WebGL, streaming appends, touch gestures beyond single pointers, and interaction
written into the spec beyond highlights and domains.
