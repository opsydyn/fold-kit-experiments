# foldkit-viz

D3-quality visualisation primitives for FoldKit — **no D3 dependency**.

A pure-TypeScript data-transformation and geometry layer designed for use with
[FoldKit](https://github.com/foldkit/foldkit)'s TEA (The Elm Architecture) rendering model.
The root and mathematical modules are pure and framework-agnostic. The optional
`foldkit/cartesian` adapter renders through your parent's FoldKit `HtmlBuilder`.

The runnable [`/request-diagnostics`](../../apps/web/src/apps/request-diagnostics/) example shows these primitives inside a FoldKit state machine. The machine belongs to the consuming application; this package remains focused on chart geometry and chart-local state.

The [`comparison workbench`](../../apps/web/src/apps/comparison/) demonstrates
stable keyed panels and linked range inspection using these primitives.
`foldChildAt`, panel identity, selection policy and browser effects remain
application-owned. The promo reuses that workbench with maintained source and
standalone exports; no public comparison controller is added to this package.

---

## Installation

For coding agents, the independent
[foldkit-viz skill](https://github.com/opsydyn/fold-kit-experiments/tree/main/skills/foldkit-viz)
includes a standalone pure-TypeScript example and optional FoldKit rendering
guidance. Install the complete skill folder through your agent host; it is
separate from this npm package and does not require Astro or its skill.

```bash
bun add @opsydyn/foldkit-viz
```

## FoldKit compatibility

The optional FoldKit adapters peer on FoldKit `>=0.167.0 <0.172.0` and Effect 4,
and are qualified on FoldKit `0.171.0` with Effect `4.1.0`. Consumers can use
`Command.define(name, { interrupt: true, ... })` to replace remote chart-data
loads while this package remains focused on pure geometry, chart-local state,
and rendering helpers. Chart views consume the render-scoped `HtmlBuilder`
supplied by their parent; the package does not own application effects or
remote-data policy.

The pure entry points do not require FoldKit or Effect. Install both peers to
use `foldkit/cartesian`. The adapter accepts a caller-supplied builder, including
one supplied by server rendering; it owns no runtime or server entry point.
Astro server handoff belongs to `@opsydyn/astro-foldkit`'s opt-in `definePage`
path. Application Commands, request flags and data loading remain app-owned.

---

## Modules

| Import path                                    | Contents                                                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@opsydyn/foldkit-viz`                         | Root barrel — pure exports                                                                                                                                            |
| `@opsydyn/foldkit-viz/math/scale`              | `linear`, `log`, `band`, `point`, `sqrt`, `ordinal`, `scaleSequential`, `scaleQuantile`, `scaleQuantize`, `scalePow`, `scaleSymlog`, `linearInvertible`, `niceLinear` |
| `@opsydyn/foldkit-viz/math/array`              | `extent`, `sum`, `mean`, `median`, `variance`, `deviation`, `cumsum`, `group`, `rollup`, `bisect`, `pairs`, `zip`, `range`                                            |
| `@opsydyn/foldkit-viz/math/color`              | `interpolateRgb`, `interpolateLab`, `interpolateHsl`, `interpolateRgbBasis`, `colorScale`, `divergingScale`                                                           |
| `@opsydyn/foldkit-viz/math/schemes`            | `tableau10`, `category10`, `wong`, `ibmCarbon`, `tolMuted`, `viridis`, `magma`, `inferno`, `plasma`, `cividis`, diverging + sequential palettes                       |
| `@opsydyn/foldkit-viz/math/tween`              | `tweenCreate`, `tweenStep`, `tweenValue`, `tweenPath`, `easeOutCubic`, `easeInOutCubic`, `easeOutElastic`, + 5 more easings                                           |
| `@opsydyn/foldkit-viz/math/time`               | `scaleTime`, `timeTicks`, `timeFormat`, `timeParse`, `timeNice`                                                                                                       |
| `@opsydyn/foldkit-viz/math/stats`              | `boxStats`, `kde`, `silvermanBandwidth`, `quantile`                                                                                                                   |
| `@opsydyn/foldkit-viz/math/bin`                | `bin` — histogram binning                                                                                                                                             |
| `@opsydyn/foldkit-viz/math/brush`              | `BrushState`, `brushUpdate`, `brushExtent`, `brushContains`, `brushDomain`                                                                                            |
| `@opsydyn/foldkit-viz/math/zoom`               | `scaleAt`, `translateBy`, `constrainScale`, `rescaleDomain`                                                                                                           |
| `@opsydyn/foldkit-viz/interaction/selection`   | Selection, interval/key constructors, clamping, and membership helpers for parent-owned chart interaction state                                                       |
| `@opsydyn/foldkit-viz/shape/line`              | `line` — 14 curve types: `linear`, `catmullRom`, `natural`, `basis`, `cardinal`, `step`, `stepBefore`, `stepAfter`, + open/closed variants                            |
| `@opsydyn/foldkit-viz/shape/area`              | `area` — filled area between two line generators                                                                                                                      |
| `@opsydyn/foldkit-viz/shape/areaRadial`        | `areaRadial`, `wedge` — polar area shapes                                                                                                                             |
| `@opsydyn/foldkit-viz/shape/arc`               | `arc`, `arcCentroid` — pie/donut arc paths                                                                                                                            |
| `@opsydyn/foldkit-viz/shape/pie`               | `pie` — compute arc angles from data                                                                                                                                  |
| `@opsydyn/foldkit-viz/shape/stack`             | `stack` — stacked series (D3 `d3-shape` parity)                                                                                                                       |
| `@opsydyn/foldkit-viz/shape/chord`             | `chord`, `ribbon` — chord diagram layout                                                                                                                              |
| `@opsydyn/foldkit-viz/shape/sankey`            | `sankey` — Sankey flow diagram layout                                                                                                                                 |
| `@opsydyn/foldkit-viz/shape/geo`               | `geoPath`, `geoEquirectangular`, `geoMercator`, `geoGraticule`                                                                                                        |
| `@opsydyn/foldkit-viz/shape/link`              | `linkVertical`, `linkHorizontal`                                                                                                                                      |
| `@opsydyn/foldkit-viz/hierarchy`               | `hierarchy`, `treeLayout`, `packLayout`                                                                                                                               |
| `@opsydyn/foldkit-viz/simulation`              | Barnes-Hut force simulation (N-body)                                                                                                                                  |
| `@opsydyn/foldkit-viz/stateflow`               | Framework-free Stateflow graph records and deterministic layout                                                                                                       |
| `@opsydyn/foldkit-viz/svg/plot`                | `plotSvg`, `plotHtml`, `paletteOf` — compiled plots as SVG or HTML strings, in a theme                                                                                |
| `@opsydyn/foldkit-viz/canvas/image`            | `paintImage`, `imageSize`, `plotPng` — compiled plots as images on a canvas you supply                                                                                |
| `@opsydyn/foldkit-viz/webgl/points`            | `pointsLayer` — dense dot marks drawn and highlighted on the GPU                                                                                                      |
| `@opsydyn/foldkit-viz/jupyter`                 | `displayPlot`, `plotMimeBundle` — inline plots in Deno and Bun Jupyter kernels                                                                                        |
| `@opsydyn/foldkit-viz/plot`                    | `compilePlot`, `describePlot`, `plotTable`, `columnTable`, `fromArrow`, `fromDuckDB`, `indexPlot`, `highlightPoints` — the plot grammar                               |
| `@opsydyn/foldkit-viz/foldkit/plot`            | `plotChart`, `plotCanvas` — compiled plots in a FoldKit view                                                                                                          |
| `@opsydyn/foldkit-viz/canvas/plot`             | `paintPlot`, `paintCanvas` — compiled plots on a 2D canvas                                                                                                            |
| `@opsydyn/foldkit-viz/chart/cartesian`         | `scatterGeometry`, `lineGeometry`, `histogramGeometry`                                                                                                                |
| `@opsydyn/foldkit-viz/chart/bars`              | `barGeometry` — grouped and stacked bars                                                                                                                              |
| `@opsydyn/foldkit-viz/chart/cells`             | `cellGeometry` — heatmap cells                                                                                                                                        |
| `@opsydyn/foldkit-viz/chart/errorBars`         | `errorBarGeometry` — supplied intervals                                                                                                                               |
| `@opsydyn/foldkit-viz/chart/intervalBand`      | `intervalBandGeometry` — a band between supplied bounds                                                                                                               |
| `@opsydyn/foldkit-viz/chart/segments`          | `contiguousRuns` — break a series at gaps                                                                                                                             |
| `@opsydyn/foldkit-viz/chart/orbit`             | `orbitGeometry` — modules orbiting a core                                                                                                                             |
| `@opsydyn/foldkit-viz/chart/space3d`           | `space3d`, `scatter3d`, `surface3d`, `rgbOf` — 3D charts as plain geometry                                                                                            |
| `@opsydyn/foldkit-viz/effect-three/space3d`    | `scatter3dScene`, `surface3dScene`, `space3dNodes` — 3D charts as effect-three scenes                                                                                 |
| `@opsydyn/foldkit-viz/chart/theme`             | `lightTheme`, `darkTheme`, `chartThemes`, `createSeriesStyles`, `themeProperties`                                                                                     |
| `@opsydyn/foldkit-viz/foldkit/cartesian`       | `chartFrame`, `axis`, `grid`, `legend`, `dataTable`, `barSeries`, `cellSeries`, `hexSeries`                                                                           |
| `@opsydyn/foldkit-viz/foldkit/orbit`           | `orbitChart`                                                                                                                                                          |
| `@opsydyn/foldkit-viz/foldkit/paint`           | `linearGradient`, `radialGradient`, `hatchPattern`, `dotPattern`                                                                                                      |
| `@opsydyn/foldkit-viz/foldkit/keyboard`        | `chartKeyDown`, `chartKeyDownFocus`                                                                                                                                   |
| `@opsydyn/foldkit-viz/interaction/keyboard`    | `chartCommandOf`, `targetAfter` — keyboard paths through chart targets                                                                                                |
| `@opsydyn/foldkit-viz/interaction/coordinates` | `clientToLocal`                                                                                                                                                       |
| `@opsydyn/foldkit-viz/interaction/viewport`    | `zoomDomain`, `panDomain`, `constrainDomain`                                                                                                                          |
| `@opsydyn/foldkit-viz/interaction/inspection`  | `nearestByX`                                                                                                                                                          |
| `@opsydyn/foldkit-viz/layout/text`             | `wrapText`                                                                                                                                                            |
| `@opsydyn/foldkit-viz/layout/wordcloud`        | `wordCloud`                                                                                                                                                           |
| `@opsydyn/foldkit-viz/math/bin2d`              | `rectBins`, `hexbin`, `hexagonPath`                                                                                                                                   |
| `@opsydyn/foldkit-viz/math/contour`            | `density2d`, `contourLines`, `segmentsToPath`                                                                                                                         |
| `@opsydyn/foldkit-viz/math/delaunay`           | `triangulate`, `voronoiDiagram`, `voronoiCells`, `voronoiPath`                                                                                                        |
| `@opsydyn/foldkit-viz/math/downsample`         | `lttb`, `m4`                                                                                                                                                          |
| `@opsydyn/foldkit-viz/math/regression`         | `linearRegression`, `polynomialRegression`, `loess`                                                                                                                   |
| `@opsydyn/foldkit-viz/math/format`             | `format`, `siFormat`                                                                                                                                                  |
| `@opsydyn/foldkit-viz/math/random`             | `randomLcg`, `randomNormal`, `randomLogNormal`, `randomUniform`                                                                                                       |
| `@opsydyn/foldkit-viz/math/ease`               | `easeCubicIn`, `easeCubicOut`, `easeBackInOut`, `easeBounceOut` and the rest of the D3 easings                                                                        |
| `@opsydyn/foldkit-viz/shape/path`              | `path` — a canvas-style path builder                                                                                                                                  |
| `@opsydyn/foldkit-viz/shape/lineRadial`        | `lineRadial`                                                                                                                                                          |
| `@opsydyn/foldkit-viz/shape/symbol`            | `symbolPath`, `SYMBOLS_FILL`                                                                                                                                          |
| `@opsydyn/foldkit-viz/shape/globe`             | `projectGlobePoint`, `clipGlobeLine` — an orthographic sphere                                                                                                         |

---

## Grouped and stacked bars

`chart/bars` exports pure `barGeometry` and its accessor/configuration types.
It supports grouped or stacked series in either orientation, preserves each
original datum and key, and accumulates positive and negative values separately.
Explicit domains must include zero and every bar endpoint. Duplicate datum keys
and category/series pairs are rejected; aggregate duplicate rows before calling.

```ts
import { barGeometry } from '@opsydyn/foldkit-viz/chart/bars';

const geometry = barGeometry(
  [{ id: 'jan-core', month: 'Jan', team: 'Core', count: 12 }],
  { key: (d) => d.id, category: (d) => d.month, series: (d) => d.team, value: (d) => d.count },
  {
    frame: { width: 400, height: 240, margins: { top: 16, right: 16, bottom: 32, left: 40 } },
    mode: 'grouped',
    orientation: 'vertical',
  },
);
// geometry.bars contains x/y/width/height and the original datum.
```

The optional `foldkit/paint` subpath provides `dotPattern`, `hatchPattern`,
`linearGradient` and `radialGradient`. Compose them inside your builder's SVG
`defs`; supply IDs unique across the whole document. They accept CSS colours and
variables, own no state, and are not exported from the framework-free root.
Both ship in the published package.

## Orbit charts (0.17.0+)

`chart/orbit` exports pure `orbitGeometry`: items on one ring around a core,
with a halo of category arcs between them. It suits "big ball of mud" views of
a system, where each module orbits the core, its area shows its risk, and the
halo shows how the modules integrate. Nodes run clockwise from twelve o'clock in
data order. Node area grows linearly with value between the radius bounds, and
neighbours never overlap: on a crowded ring both bounds shrink, and an orbit too
small to fit its nodes is rejected. `coreScale` lets the caller grow the core
with a metric of its own. Keys must be unique and values finite and
non-negative. Halo angles follow `shape/arc`, so each arc passes straight to it.

```ts
import { orbitGeometry } from '@opsydyn/foldkit-viz/chart/orbit';

const geometry = orbitGeometry(
  [{ id: 'billing', risk: 7.4, integration: 'intrusive' }],
  { key: (d) => d.id, value: (d) => d.risk, halo: (d) => d.integration },
  { size: 300, valueDomain: [1, 10], coreScale: 0.8 },
);
// geometry.nodes holds x/y (relative to geometry.centre), radius and the datum;
// geometry.halo.arcs holds one arc per category with its count.
```

The optional `foldkit/orbit` subpath renders the geometry with the parent's
builder through `orbitChart`. Without `onSelect` it is an image whose nodes name
themselves in native tooltips, so it reads completely as static HTML. With
`onSelect` each node is a focusable button that selects on click, Enter or
Space, and `onInspect` reports hover and focus. A `pulse` ring is classed
`chart-orbit-pulse` for the host's CSS to animate; respect
`prefers-reduced-motion` when it does. Pair it with `dataTable` from
`foldkit/cartesian` for a non-visual reading. The web app's `/complexity-field`
page composes both into a complete card.

## 3D scatter and surface (0.19.0+)

`chart/space3d` lays a three-dimensional chart out as plain geometry, with no
renderer. `space3d(domains)` maps three domains onto a cube (x across, z up, y
into the scene) and returns its twelve box edges, a grid on the floor and the
two back walls at nice ticks, and tick and axis labels placed outside the box.
`scatter3d(data, { x, y, z, color })` places each finite row, keeps which row
each point came from, and colours categories in palette order with a legend.
`surface3d({ xs, ys, z })` draws a grid of heights as a wireframe coloured by
height from a sequential scheme (viridis by default).

`effect-three/space3d` turns that geometry into
[effect-three](https://github.com/opsydyn/fold-kit-experiments/tree/main/packages/effect-three)
scene nodes: lines for the box, grid and wireframe, round points, and billboard
labels that face the camera. It is plain data the parent places in its scene,
so the camera, gestures and selection stay in its Model. `@opsydyn/effect-three`
is an optional peer, needed only for this subpath; labels need a label engine
such as effect-three-troika in the environment.

```ts
import { scene } from '@opsydyn/effect-three';
import { scatter3d } from '@opsydyn/foldkit-viz/chart/space3d';
import { lightTheme } from '@opsydyn/foldkit-viz/chart/theme';
import { scatter3dScene } from '@opsydyn/foldkit-viz/effect-three/space3d';

const scatter = scatter3d(
  measurements,
  { x: (d) => d.latency, y: (d) => d.load, z: (d) => d.cost, color: (d) => d.cluster },
  { labels: { x: 'Latency', y: 'Load', z: 'Cost' } },
);

const view = (model: Model) =>
  scene({
    camera: model.camera,
    gestures: 'scene',
    children: [scatter3dScene(scatter, { key: 'scatter', theme: lightTheme })],
  });
```

The web app's `/effect-three/chart-3d` page orbits a scatter and a surface, in
light and dark. Surfaces draw as wireframes for now: a filled, lit mesh waits on
mesh geometry in effect-three.

## Composable Cartesian charts

These modules are available from version 0.10.0. Use package imports or the
promo's standalone projects, which include the compiled modules they consume.

- `chart/cartesian`: `lineGeometry`, `scatterGeometry`, `histogramGeometry` and layout types.
- `chart/theme`: `lightTheme`, `darkTheme`, `resolveSeriesStyle`, `createSeriesStyles`, `themeProperties`.
- `foldkit/cartesian`: optional frame, grid, axes, line/point/bar layers, annotation, tooltip, legend and data table.

Your data shape is arbitrary. Accessors preserve original records for tooltips
and tables; datum keys must be globally unique. Series IDs identify stable groups.

```ts
import { lineGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';
import {
  lightTheme,
  darkTheme,
  createSeriesStyles,
  resolveSeriesStyle,
} from '@opsydyn/foldkit-viz/chart/theme';
import {
  chartFrame,
  grid,
  axis,
  lineSeries,
  annotation,
  tooltip,
} from '@opsydyn/foldkit-viz/foldkit/cartesian';

const data = [
  { id: 'jan', month: 1, revenue: 45, team: 'north' },
  { id: 'feb', month: 2, revenue: 80, team: 'north' },
];
const geometry = lineGeometry(
  data,
  {
    x: (d) => d.month,
    y: (d) => d.revenue,
    datumKey: (d) => d.id,
    seriesKey: (d) => d.team,
  },
  {
    frame: { width: 560, height: 290, margins: { top: 30, right: 24, bottom: 60, left: 48 } },
    includeZero: { x: false, y: true },
    curve: 'linear',
  },
);
const theme = lightTheme; // Choose darkTheme using app-owned state or CSS tokens.
const styles = createSeriesStyles(['north', 'south'], ['var(--brand)', 'oklch(65% .15 150)']);
const style = resolveSeriesStyle(theme, {}, styles.get('north') ?? {}, {});
const target = resolveSeriesStyle(theme, {}, { stroke: 'currentColor', dashPattern: '4 4' }, {});

// Inside the parent's render function, using its supplied h:
const chart = chartFrame(
  h,
  {
    layout: geometry.layout,
    title: 'Revenue',
    description: 'Monthly revenue',
    theme,
  },
  [
    grid(h, { layout: geometry.layout, xTicks: geometry.xTicks, yTicks: geometry.yTicks, theme }),
    ...geometry.series.map((series) => lineSeries(h, { path: series.path, style })),
    annotation(h, {
      layout: geometry.layout,
      axis: 'y',
      value: 60,
      label: 'Target',
      style: target,
    }),
    axis(h, {
      layout: geometry.layout,
      orientation: 'bottom',
      ticks: geometry.xTicks,
      label: 'Month',
      format: String,
      theme,
    }),
  ],
);

// A replacement tooltip receives the original record and resolved paint.
const point = geometry.points[0];
const detail =
  point &&
  tooltip(h, {
    point,
    style,
    theme,
    render: ({ datum, x, y, style }, h) =>
      h.text(
        [h.X(String(x)), h.Y(String(y - 16)), h.Fill(style.fill)],
        [`${datum.team}: ${datum.revenue}`],
      ),
  });
```

Layer order is ordinary child order: render the grid first, then marks, overlays
and axes as appropriate. Add `detail` to that child array when inspecting a point.
`legend` accepts keyed entries and `dataTable` takes your raw data, columns and
caption. The promo scatter demonstrates a clamped tooltip, matching symbol
legend and one chart focus stop with arrow/Home/End/Escape inspection.

Style precedence is defaults → theme → chart override → series override → datum
override. Construct the series map from a stable explicit domain before filtering
or reordering; colours then keep their identities. Palettes cycle on overflow,
so add symbols or dash patterns when repeated colours need distinction. Paints
are opaque CSS strings: CSS variables, `currentColor`, `rgb()` and `oklch()` pass
through unchanged. Set numeric opacity separately; never append hex alpha to an
arbitrary paint. Numerical colour interpolation in existing `math/color` remains
hex-only. Its `interpolateRgbBasis` parity gap remains outside this slice.

Frames require finite positive dimensions and non-negative margins with a
positive plot area. Explicit domains require finite endpoints; reversed domains
are preserved. Equal endpoints project to the range midpoint. Automatic domains
use finite defined observations, expand constant extents by `max(abs(value)*.1, 1)`,
and fall back to `[0,1]` for empty input. Zero inclusion is opt-in for line/scatter;
histogram counts start at zero. Non-finite samples are excluded; line samples
marked undefined retain gaps. Empty input produces no marks and still has usable
axes. Histogram thresholds must be finite and strictly increasing; explicit
thresholds outside the domain are trimmed by the existing bin primitive.
`binCount` is a positive integer and provides equal-width intervals on a
non-degenerate domain. A degenerate explicit domain collapses to one zero-width
interval. Invalid frames, domains, duplicate datum keys, non-finite projected
coordinates, tick counts below two, negative sizes or opacity outside `[0,1]`
throw `RangeError`. Curves whose internal arithmetic produces non-finite paths
are rejected too. Requested histogram thresholds that cannot be represented
distinctly inside a non-degenerate domain also throw. Tick positions preserve
full numeric precision; format their labels separately. See [D3 source provenance](D3-PROVENANCE.md) for the precise
primitive contracts.

## Axis scales (0.18.0+)

`scatterGeometry` and `lineGeometry` take `xScale` and `yScale`: linear (the
default), `log` with an optional `base`, `symlog` with an optional `constant`,
`pow` with an `exponent`, or `time`. Ticks follow the scale and carry a default
`label`, which the `axis` helper draws when you pass no `format`.

```ts
const geometry = lineGeometry(rows, accessors, {
  frame,
  xScale: { type: 'time' }, // x values are epoch milliseconds
  yScale: { type: 'log' },
});
// geometry.yTicks: [{ value: 1, position, label: '1' }, { value: 10, ..., label: '10' }, ...]
```

- Time axes default to UTC, so a server and a browser in another zone render
  the same ticks and labels. Pass `{ type: 'time', zone: 'local' }` for the
  viewer's zone. `utcTicks` and `utcTickFormat` join `timeTicks` and
  `timeTickFormat` in `math/time`.
- A log axis omits zero and negative values, as every axis omits non-finite
  ones, and breaks lines there. Explicit log domains must be positive, and
  `includeZero` is rejected.
- Linear labels use as many decimals as the tick step needs, grouped the same
  way on every machine; log labels mark powers of the base in SI notation.
- Histograms stay linear; categorical axes remain in `chart/bars`.

## Statistics, binning and downsampling (0.18.0+)

Pure functions for the overlays and density views data-science charts need.
All skip non-finite values; the web app's `/data-science` page uses each one.

```ts
import {
  linearRegression,
  loess,
  polynomialRegression,
} from '@opsydyn/foldkit-viz/math/regression';
import { ecdf, movingWindow, qqNormal } from '@opsydyn/foldkit-viz/math/stats';
import { hexbin, rectBins } from '@opsydyn/foldkit-viz/math/bin2d';
import { cellGeometry } from '@opsydyn/foldkit-viz/chart/cells';
import { lttb, m4 } from '@opsydyn/foldkit-viz/math/downsample';

const fit = linearRegression(rows, { x: (r) => r.dose, y: (r) => r.response });
fit.interval(5); // { fit, lower, upper }: the 95% confidence interval for the mean at x = 5
const curve = loess(rows, { x: (r) => r.dose, y: (r) => r.response }, { bandwidth: 0.4 });
const drawn = m4(series, { x: (p) => p.t, y: (p) => p.v }, { width: 800 }); // one column per pixel
```

- `math/regression`: `polynomialRegression` of any degree and `linearRegression`,
  with R squared, `predict` and confidence intervals from Student's t, fitted on
  centred x so epoch-millisecond x stays accurate; `loess` with robustness
  iterations.
- `math/stats` adds `ecdf`, `qqNormal`, `movingWindow` (mean, median, sum, min,
  max; trailing or centred), `normalQuantile` and `studentTQuantile`.
- `math/bin2d`: `rectBins` for 2D histograms in data units; `hexbin` and
  `hexagonPath` for hexagonal density in pixel space, after d3-hexbin.
- `chart/cells`: `cellGeometry` lays out heatmaps, calendar heatmaps and
  correlation matrices; `foldkit/cartesian` adds `cellSeries` and `hexSeries`.
- `math/downsample`: `lttb` keeps the shape at a target point count; `m4` keeps
  each pixel column's first, last, lowest and highest point, so the drawn line
  matches the full one. Both return original rows in order and handle a
  million points in under 50 ms.

## Plot grammar (0.18.0+)

A chart as plain data: marks whose channels name fields in the rows, with scales,
axes and legends inferred ([ADR 0037](../../docs/adr/0037-a-declarative-grammar-of-marks-for-foldkit-viz.md)).
The spec holds no functions, so a server, a notebook or a language model can write
it, and it renders the same everywhere.

```ts
import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';

const geometry = compilePlot({
  width: 720,
  height: 300,
  data: penguins,
  facet: { x: 'species' },
  marks: [
    { mark: 'dot', x: 'mass', y: 'flipper', fill: 'sex', title: 'id' },
    { mark: 'line', x: 'mass', y: 'flipper', transform: { type: 'regression' } },
  ],
});
// In a FoldKit view: plotChart(h, geometry)
```

- Marks: `dot`, `line`, `area`, `bar` (with `y0` or `x0` for interval bars),
  `rule`, `text`, `cell`, `link`, `box` and `violin` on the x and y axes, and
  `treemap`, `sunburst`, `sankey` and `parallel`, which fill their panel. A
  channel is a field name or `{ value }`.
- Scales are inferred from every mark's values: numbers give linear axes, strings
  band axes, ISO dates UTC time axes, and colour is categorical or sequential.
  Override any part, including log, symlog and power axes, any scheme, or
  explicit categorical colours with `color.range`. Crowded band labels thin out.
- `facet` splits every mark's rows into panels on shared scales.
- Line transforms: `regression` (with its confidence band), `loess`, `window` and
  `downsample`, alone or chained in order; area takes `window`.
- Errors name the spec path, such as `marks[0].x: field "dosage" is missing from
the data`.
- `compilePlot` is pure and framework-free; `foldkit/plot` renders the result as
  an accessible SVG with a legend. The web app's `/plot-grammar` page shows each
  chart beside its spec, and ships no JavaScript.

## Scale and interaction for plots (0.18.0+)

A million points stay interactive. Mark a dot layer `dense` and it compiles to
one packed graphic of typed arrays instead of a circle per row; paint it on a
canvas and draw hover feedback in an SVG overlay above it.

```ts
import { compilePlot, indexPlot, pointerToPlot } from '@opsydyn/foldkit-viz/plot';
import { paintCanvas } from '@opsydyn/foldkit-viz/canvas/plot';
import { plotCanvas } from '@opsydyn/foldkit-viz/foldkit/plot';

const geometry = compilePlot({
  width: 720,
  height: 420,
  data: requests,
  x: { type: 'log' },
  marks: [
    {
      mark: 'dot',
      x: 'latency',
      y: 'payload',
      dense: true,
      highlight: { field: 'latency', range: brushed },
    },
  ],
});
const index = indexPlot(geometry);

// On pointer move, in update: the nearest row within 12 plot pixels.
const hit = index.nearest(x, y, 12);

// In the view: a canvas the parent's Mount paints with paintCanvas,
// under an overlay that moves without recompiling.
plotCanvas(h, geometry, {
  key,
  onMount: PaintScatter({ key }),
  overlay: { crosshair: { x, y }, ring: { x, y, r: 5 } },
});
```

- `canvas/plot`: `paintPlot(ctx, geometry, options)` paints any compiled
  geometry, axes and text included, clipped to each facet's plot area;
  `paintCanvas(canvas, geometry, options)` sizes the canvas for the device pixel
  ratio first. It needs no DOM types and has no FoldKit dependency.
- `indexPlot(geometry)` builds a 16-pixel grid over dots, packed points and bar
  centres; `nearest(x, y, radius)` returns the facet, mark, row and position.
- `pointerToPlot(client, rect, geometry)` turns a pointer's client position into
  plot pixels; `invertPlot` and `invertAxis` turn plot pixels into data values.
- `highlight: { field, range }` or `{ field, values }` dims non-matching rows. A
  linked brush is one chart's selection written into another chart's spec.
- `plotChart` and `plotCanvas` take an `overlay` of crosshair, hover ring and
  brush, drawn without recompiling.
- Zoom by writing a narrower domain into the spec, for example with `zoomDomain`
  from `interaction/viewport` anchored at `invertAxis` of the pointer.

The library still installs no listeners: the parent streams pointer events and
keeps hover, brush and domain in its Model. The web app's `/explore` page links a
million-point scatter to a latency histogram this way.

### Points on the GPU (0.19.0+)

`webgl/points` draws dense dot marks with WebGL, for brushing a million points
within a frame. A layer uploads each packed graphic's positions, radii, colour
indices and palette once; a highlight uploads one byte per point and redraws.

```ts
import { paintCanvas } from '@opsydyn/foldkit-viz/canvas/plot';
import { highlightPoints } from '@opsydyn/foldkit-viz/plot';
import { pointsLayer } from '@opsydyn/foldkit-viz/webgl/points';

// Grid, axes and other marks on a 2D canvas; the points on a WebGL canvas above.
paintCanvas(base, geometry, { pixelRatio, points: false });
const layer = pointsLayer(gpu.getContext('webgl')!, geometry, { pixelRatio });
layer.draw();

// On each brush move: restyle, upload the dimmed flags, redraw.
layer.highlight(highlightPoints(geometry, 0, data, { field: 'latency', range }));
layer.draw();
```

- In Chromium, brushing `/explore`'s million points costs 13 ms (median: 8 ms
  restyling, under 5 ms on the GPU) against 62 ms repainting a canvas, so the
  page now highlights live as the brush moves.
- `plotCanvas` takes a `pointsLayer` canvas to stack between its canvas and the
  overlay; key it by what moves the points, not by the highlight. Make the
  layer in that canvas's Mount and release it with `dispose` when it unmounts.
- Every point blends over those beneath, as sparse dots do, so overlaps shade
  by density. canvas/plot and SVG fill each colour group in a few paths, where
  overlaps stack less.
- `layer.append(geometry)` takes geometry grown by `appendPoints` and uploads
  only the new points while its buffers have room, doubling them when not: a
  million points streamed in 20 batches cost 81 ms on the GPU in all, against
  116 ms rebuilding the layer each batch (4.5 ms against 9.7 ms for the last).
- Checked in Chromium 151, WebKit 26.5 and Firefox 153 (Playwright's builds),
  at device pixel ratio 2 and drawing at ratios 1 to 3: the GPU's points cover
  the same solid pixels as the canvas painter's (intersection over union 0.96 to
  0.99 for 3-pixel points, 0.71 to 0.97 for 1.2-pixel ones, which rasterise
  differently), highlights dim the same way, and a million-point brush takes
  12 ms in WebKit and 20 ms in Firefox.
- The context type is structural (`PointsGl`), so foldkit-viz needs no DOM
  types. Colours must be hex, `rgb()` or `rgba()`; pass `current` for points
  painted `currentColor`.

## More marks and transforms (0.18.0+)

The grammar covers the common data-science charts on x and y axes. Every chart
demo in the web app's gallery that sits on axes is now a spec.

```ts
// A histogram from raw rows, one series per tier on shared bins.
{ mark: 'rect', x: 'latency', fill: 'tier', inset: 1, transform: { type: 'bin', thresholds: 20 } }

// A two-dimensional histogram; binned rows carry count for colour.
{ mark: 'rect', x: 'latency', y: 'payload', fill: 'count', transform: { type: 'bin' } }

// Stacked, diverging and grouped bars, and streamgraphs.
{ mark: 'bar', x: 'month', y: 'units', fill: 'region', stack: 'zero' }
{ mark: 'bar', x: 'month', y: 'units', fill: 'region', group: true }
{ mark: 'area', x: 'date', y: 'downloads', fill: 'framework', stack: { offset: 'center' } }

// Kernel density: a curve per series, or contour lines over a scatter.
{ mark: 'density', x: 'salary', fill: 'level' }
{ mark: 'density', x: 'x', y: 'y', bandwidth: 40, thresholds: 6 }

// Symbols, merged with the colour legend when one field drives both.
{ mark: 'dot', x: 'hp', y: 'mpg', fill: 'origin', symbol: 'origin' }
```

- **`rect`**:
  - Spans `x1` to `x2` and `y1` to `y2` on continuous axes.
  - A missing start begins at the baseline.
  - `inset` leaves a gap between neighbours.
- **`bin`**:
  - Thresholds are a count or explicit breaks; `reduce` is `count` or
    `proportion`.
  - Binned rows name their fields plainly (`x1`, `x2`, `count`, `proportion`),
    so titles and highlights can use them.
- **`stack`** on bars and areas:
  - Offsets are `zero`, `normalize`, `center` and `wiggle`; orders follow d3.
  - `zero` stacks negative values down from zero, so Likert charts need
    nothing more.
  - `z` names the series when colour should encode something else.
- **`group: true`** places a bar's series side by side within each band.
- **`density`**:
  - A one-dimensional curve per series, with `bandwidth` in data units.
  - Two-dimensional contour lines computed in plot pixels, with `bandwidth` in
    pixels.
- **`symbol`** on dots maps a field onto the d3 symbol set, or takes a
  constant such as `{ value: 'square' }`.
- **`clip: true`** on a spec clips marks to the plot area, for zoomed domains.
- **`axis: false`** on an axis blanks its labels and grid, for tile maps and
  calendars.
- **Constant marks**, such as `{ mark: 'rule', y: { value: 0 } }`, draw once.
- **`highlightPoints(geometry, markIndex, data, highlight)`** restyles a dense
  mark for a new highlight without recompiling, keeping its hover index valid.

## Polar charts, maps, networks and trees (0.18.0+)

```ts
// A radar: polar coordinates close a line over categories into a ring.
{ coordinates: 'polar', marks: [{ mark: 'line', x: 'quality', y: 'score', stroke: 'language' }] }

// A wind rose: bars become wedges; stacked bars stack outwards.
{ coordinates: 'polar', polar: { inner: 0.1 }, marks: [{ mark: 'bar', x: 'direction', y: 'frequency' }] }

// Pie, donut and gauge.
{ mark: 'arc', value: 'share', fill: 'team', inner: 0.6, labels: true, text: { value: '100%' } }
{ mark: 'arc', value: 'amount', fill: 'part', inner: 0.7, start: -120, end: 120 }

// A choropleth: rows are the features' properties.
{ projection: { type: 'naturalEarth1' }, marks: [{ mark: 'geo', features: countries, fill: 'internet' }] }

// Trees, packing, chords, arc diagrams, force layouts and Voronoi cells.
{ mark: 'tree', path: 'path', layout: 'cluster', radial: true }
{ mark: 'pack', path: 'path', value: 'usage', fill: 'family' }
{ mark: 'chord', source: 'from', target: 'to', value: 'billions' }
{ mark: 'arc-diagram', source: 'from', target: 'to', value: 'weight' }
{ mark: 'force', source: 'from', target: 'to' }
{ mark: 'voronoi', x: 'x', y: 'y', fill: 'y' }
```

- **Polar coordinates:**
  - `coordinates: 'polar'` maps x to angle and y to radius.
  - Bars, lines, areas, dots, text and rules can be drawn in polar coordinates.
  - Facets carry a `polar` frame of rings and spokes, which both renderers draw.
- **`arc`** fills its panel: one slice per row over a sweep from `start` to
  `end` degrees, with an optional centre `text` and share `labels`.
- **Maps:**
  - A plot-level `projection` (equirectangular, mercator, naturalEarth1,
    orthographic or albers) is fitted to the geo marks.
  - `zoom` and `center` zoom the map.
  - The `geo` mark draws GeoJSON, and `graticule` draws lines of latitude and
    longitude.
  - Dots and text are placed by longitude and latitude.
- **Networks and trees:** `tree`, `pack`, `chord`, `arc-diagram` and `force`
  fill their panel and run their layouts at compile time. The force layout is
  seeded, so it is the same every time.
- **`voronoi`** draws each point's cell, clipped to the plot area.

## Keyboard and accessibility (0.18.0+)

```ts
import { chartCommandOf, targetAfter } from '@opsydyn/foldkit-viz/interaction/keyboard';
import { chartKeyDown, chartKeyDownFocus } from '@opsydyn/foldkit-viz/foldkit/keyboard';
import { compilePlot, describePlot, plotTable } from '@opsydyn/foldkit-viz/plot';
import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';

// A chart's targets step with the keys a listbox uses.
h.OnKeyDownPreventDefault(chartKeyDown((command) => PressedChartKey({ command })));
// In update: const next = targetAfter(count, current, command);

// Every chart can describe itself and carry its data as a hidden table.
plotChart(h, compilePlot(spec), { summary: true, table: plotTable(spec) });
```

- **`chartCommandOf(key, modifiers)`** maps keys to commands:
  - arrows step by one, and Page Up and Page Down by a page;
  - Home and End jump to the ends;
  - Escape clears, and Enter and Space select;
  - keys held with Ctrl, Alt or Meta are left to the browser.
- **`targetAfter(count, current, command)`** applies a command to a target
  index.
- **`chartKeyDown` and `chartKeyDownFocus`** wrap the two for FoldKit's
  `OnKeyDownPreventDefault` and `OnKeyDownFocus`. The latter moves roving focus
  to the target's element.
- **`describePlot(geometry)`** summarises a plot in plain language: what it
  draws and how many, what the axes cover, and what colour shows.
- **`plotTable(spec)`** lists the data a spec plots, field by field, capped at
  200 rows with the total noted.
- **Framework boundary:** only `foldkit/*` modules import FoldKit or Effect,
  and a test enforces it.

## Column data and other languages (0.18.0+)

A spec's `data` can be a column table instead of rows: named columns of equal
length, plain arrays or typed arrays. Data from Polars, DuckDB or Arrow plots
without becoming a row object per row. A dense dot mark reads its columns
directly and builds no rows at all.

```ts
import { columnTable, compilePlot, fromArrow } from '@opsydyn/foldkit-viz/plot';

const geometry = compilePlot({
  width: 720,
  height: 420,
  data: columnTable({ latency, payload }), // Float64Arrays, or plain arrays
  marks: [{ mark: 'dot', x: 'latency', y: 'payload', dense: true }],
});

// Any Arrow table (flechette or apache-arrow), with no dependency on either.
compilePlot({ ...spec, data: fromArrow(tableFromIPC(bytes)) });
```

- **Tables are immutable**, like rows: to plot changed data, make a new table.
  `columnTable` wraps existing arrays without copying them.
- **`rowsOf(data)`** returns rows for code that looks one up, whichever form
  the data takes.
- **A million-row Polars frame** plots as a dense scatter in 86 ms through
  Arrow, against 248 ms through row objects.

Specs are plain JSON, so programs in other languages can write them. The
package publishes a JSON Schema for `PlotSpec`, generated from its types, at
`@opsydyn/foldkit-viz/plot-spec.schema.json`. Validate a spec before plotting
it with any JSON Schema validator: `jsonschema` in Python, or the
`jsonschema` crate in Rust. In JSON, a column table's columns are arrays. A
`"$schema"` key is allowed, for editors, and `compilePlot` ignores it.

- **Checked by the schema:** marks, channel types, transforms, scales, and
  `color.scheme`, which must be one of the 21 schemes `math/schemes` exports
  (`tableau10`, `viridis`, `rdBu` and the rest; the `SchemeName` type). An
  unknown key anywhere is rejected, including a misspelt top-level key that
  `compilePlot` would ignore.
- **Not checked by the schema:** what depends on the data, such as whether a
  field a channel names exists in the rows. `compilePlot` reports those, by
  spec path.

The repository's [Polars summary app](https://github.com/opsydyn/fold-kit-experiments/tree/main/apps/polars-summary)
is a worked example: a Bun server that bins a million rows in Polars on each
request and sends a spec of the summary.

### DuckDB and streaming data (0.19.0+)

`fromDuckDB` reads a DuckDB result (`@duckdb/node-api`'s reader) as a column
table, and `duckdbColumns` does the same for one streamed chunk. Numeric,
temporal and 64-bit columns become `Float64Array`s (nulls `NaN`, dates epoch
milliseconds, as `fromArrow` gives). foldkit-viz does not depend on DuckDB.

```ts
import { DuckDBInstance, JSDuckDBValueConverter } from '@duckdb/node-api';
import {
  appendPoints,
  columnStore,
  compilePlot,
  duckdbColumns,
  fromDuckDB,
} from '@opsydyn/foldkit-viz/plot';

const connection = await (await DuckDBInstance.create(':memory:')).connect();

// A whole result.
const table = fromDuckDB(await connection.runAndReadAll('select * from requests'));

// A result streamed in, plotted as it grows: compiled on the first chunk, appended after.
const result = await connection.stream('select latency, payload, kind from requests');
const store = columnStore();
let geometry: PlotGeometry | undefined;
for (
  let chunk = await result.fetchChunk();
  chunk !== null && chunk.rowCount > 0;
  chunk = await result.fetchChunk()
) {
  const rows = duckdbColumns(result.columnNames(), chunk.convertColumns(JSDuckDBValueConverter));
  const rowOffset = store.table().length;
  const all = store.append(rows);
  geometry =
    geometry === undefined
      ? compilePlot({ ...spec, data: all })
      : appendPoints(geometry, spec, rows, { rowOffset });
}
```

- `columnStore()` grows a column table chunk by chunk in buffers that double, so
  an append copies only the chunk; each table it returns is a view of the rows
  so far.
- `appendPoints` compiles only the chunk and adds its points to dense dot marks.
  It needs a spec nothing new can change: fixed `x` and `y` domains, a fixed
  `color` domain for a colour field, no size field, no facets and only dense dot
  marks. Anything else is refused, to recompile.
- Measured with a million DuckDB rows: through columns a dense scatter takes
  126 ms against 285 ms through row objects. Streamed in 20 batches, appending
  spends 120 ms plotting in all (6 ms for the last batch) against 678 ms
  recompiling every batch (57 ms for the last).

### Pushing bins into DuckDB or Polars (0.19.0+)

`pushdown(spec, { from, query })` draws a spec whose data lives in a SQL engine
from what the engine sends back, rather than every row, as VegaFusion does for
Vega. A binned rect mark (a histogram, per series or not, or a two-dimensional
grid) is counted in the engine; every other mark pulls only the columns it uses.

```ts
import { compilePlot, fromDuckDB, pushdown } from '@opsydyn/foldkit-viz/plot';

const query = async (sql: string) => fromDuckDB(await connection.runAndReadAll(sql));
const spec = await pushdown(
  {
    width: 480,
    height: 300,
    marks: [{ mark: 'rect', x: 'latency', fill: 'kind', transform: { type: 'bin' } }],
  },
  { from: 'requests', query },
);
const geometry = compilePlot(spec);
```

- The chart is exactly the one compiling every row draws: the engine counts on
  breakpoints from the same functions local binning uses (`binThresholds`,
  `rectBinEdges`), and tests compare the whole geometry against a local compile.
- A million-row histogram by series takes 31 ms against 212 ms pulling every
  row; a two-dimensional grid 8 ms against 230 ms.
- The SQL is portable: every statement also runs in Polars' SQL context
  (checked with Python Polars 2.1.0). `query` is any function from SQL to a
  column table: DuckDB in Bun, Node or the browser, or Polars.
- `from` is inserted as written (a table name, a subquery, `read_parquet(…)`), so
  it must never come from untrusted input; field names are quoted.
- In the browser, DuckDB-Wasm returns Arrow tables, so the query is
  `async (sql) => fromArrow(await connection.query(sql))`. The web app's
  [`/duckdb` page](https://github.com/opsydyn/fold-kit-experiments/tree/main/apps/web/src/apps/duckdb)
  bins a million rows in the visitor's browser in about 200 ms (Chromium), and
  its tests run the same code through DuckDB-Wasm's Node build.
- Series keep the order they first appear in, through `row_number() OVER ()`,
  which follows DuckDB's default `preserve_insertion_order`.
- Not pushed: density marks (their bandwidth needs every value) and anything a
  binned mark carries beyond its series field; those pull columns instead. A
  faceted spec is refused.

### Upgrading

Two changes need code changes in some callers:

- **`spec.data` and `mark.data` are `PlotData`:** rows or a column table. Code
  that reads them as rows (to look a row up, say) should call `rowsOf(data)`,
  which returns rows either way. Code that only writes specs is unaffected.
- **`color.scheme` is a `SchemeName`**, not any string. A scheme held in a
  plain `string` must be narrowed to `SchemeName`. A spec parsed from JSON is
  unaffected at compile time, and `compilePlot` still rejects an unknown
  scheme at run time.

## SVG and PNG export, themes and Jupyter notebooks (0.19.0+)

Any compiled plot renders to a string or an image, with no FoldKit, Effect or
DOM: for a file, a server response, an image pipeline or a notebook.

```ts
import { compilePlot, plotTable } from '@opsydyn/foldkit-viz/plot';
import { plotHtml, plotSvg } from '@opsydyn/foldkit-viz/svg/plot';
import { plotPng } from '@opsydyn/foldkit-viz/canvas/image';

const geometry = compilePlot(spec);
await Bun.write('chart.svg', plotSvg(geometry, { theme: 'dark' }));
const fragment = plotHtml(geometry, { table: plotTable(spec), summary: true });
// In a browser or worker:
const png = await plotPng(geometry, new OffscreenCanvas(1, 1), { pixelRatio: 2 });
```

- `plotSvg(geometry, options)` is a standalone SVG document: the plot, its
  accessible title and description, and its legends drawn below it (the
  document grows to fit them), over the theme's background. It draws in the
  `light` theme by default, concrete colours, because image renderers and file
  viewers have no page colour to inherit. `legend: false` and `background: false`
  leave those out.
- `plotHtml(geometry, options)` is the whole figure (the SVG, the data table and
  HTML legends) in the page's colour, the same markup `foldkit/plot`'s `plotChart`
  renders. Both come from one renderer, and a test holds them byte for byte
  equal. Given a `theme`, the figure paints its own background and text colour.
- `canvas/image` paints the same picture as `plotSvg` on any 2D canvas context:
  `paintImage(ctx, geometry, options)`, sized by `imageSize(geometry, options)`.
  `plotPng(geometry, canvas, options)` sizes a canvas for the pixel ratio, paints
  it and returns PNG bytes through the canvas's own encoder, such as a browser's
  `OffscreenCanvas`. foldkit-viz bundles no rasteriser: in Bun, Node or Deno,
  call `paintImage` on a canvas library's context and use its encoder. Images
  over 16,384 pixels a side or 16.7 million pixels are refused before painting.

**Themes.** A `theme` is a name or any palette. `chart/theme` names four in
`chartThemes`: `light`, `dark`, and `high-contrast-light` and `high-contrast-dark`,
which hold text at WCAG AAA (7:1) and axes at 4.5:1, with larger labels and
heavier marks. A test holds every theme to AA. `contrastRatio(a, b)` in
`math/color` measures any pair of colours.

To write TypeScript in Jupyter, install Deno's kernel with `deno jupyter --install`
(or the community Bun kernel, `jupyter-bun`) and make a plot the cell's value. The
[example notebook](https://github.com/opsydyn/fold-kit-experiments/tree/main/packages/foldkit-viz/examples/deno-jupyter.ipynb) runs in Deno 2.9's kernel:

```ts
import { displayPlot } from 'npm:@opsydyn/foldkit-viz/jupyter';

displayPlot({ width: 520, height: 300, data, marks: [{ mark: 'dot', x: 'a', y: 'b' }] });
```

Both kernels call a value's `Symbol.for('Jupyter.display')` method (exported as
`jupyterDisplay`) and show the richest type in the bundle it returns:
`text/html` (the figure, following the notebook's light or dark theme), then
`image/svg+xml` (the chart and its legends in concrete colours, for exports),
then `text/plain` (the title and `describePlot` summary). A `theme` option themes
both pictures. `displayPlot` compiles the spec at once,
so a spec error is raised in the cell, and turns on the summary and the data
table; `plotMimeBundle(geometry, options)` builds the bundle from geometry, such
as for `Deno.jupyter.display(bundle, { raw: true })`, or `display(bundle)` in the
Bun kernel. Both kernels are checked: the example notebook runs in Deno 2.9's
kernel and in `jupyter-bun` 0.1.0 with the same outputs. Output is static:
neither kernel documents widget support.

From Python, the repository's `foldkit-viz` Python package (not yet on PyPI)
draws a spec as an [anywidget](https://anywidget.dev): `Plot(spec)` checks it
against the published schema and redraws when `plot.spec` or `plot.theme`
changes. See
[its README](https://github.com/opsydyn/fold-kit-experiments/tree/main/packages/foldkit-viz-py).

## Parent-owned interaction state

Viz owns pure interaction values. Individual charts own their local gesture
mechanics, while the consuming parent owns shared selection state and
child-message coordination. Stateful chart children use typed `OutMessage`
unions such as `InspectedPoint` or `InspectedRange`. Fold them with `foldChild`:
map the child Message, consume its semantic event in the parent, and retain the
returned Commands. Initialise sibling children with `foldChildInits`.
The [linked-charts example](../../apps/web/src/apps/linked-charts/fold.ts) composes
scatter and histogram events without interpreting private child message tags or
discarding child Commands. Resize is a Mount stream fact stored as chart width
in the promo Model; its observer is scoped to island lifetime.

```ts
const selection = intervalSelection('x', [100, 300]);
const visible = allPoints.filter((point) => selectionContainsValue(selection, 'x', point.x));
```

`keySelection` is available for future hover or active-series interaction
state. Hover and zoom are not implemented by this contract.

---

## Stateflow Observatory

The reference route [`/stateflow`](../../apps/web/src/pages/stateflow.astro)
visualises app-owned Machine transitions, replay, and typed Port activity.
Import `layoutStateFlow` and `StateFlowGraph` from
`@opsydyn/foldkit-viz/stateflow`: the app derives plain node/edge records from its
Model, and `layoutStateFlow(graph, { width, height })` returns deterministic
node positions and edge endpoints. The view renders that geometry without
re-running guards or interpreting Machine messages.

The app owns the Machine, trace Model, Commands, replay policy, and Port
subscriptions. Astro supplies the island and lifecycle bridge. This package
accepts already-derived records and computes geometry; it owns no async state.

## Remote visual loads

For future remote filter, brush, or zoom loads, construct the refresh step with
an explicit selection snapshot and request ID. `LoadFilteredData` is an
app-owned interruptible Command whose declared args include `selection` and
`requestId`; its `execute` uses those args and returns the ID with its result
Message. Commands do not read the later Model implicitly.

In this example, `Model.data` is `AsyncData<Data, string>`. `Selection`, `Data`,
`Model`, and `Message` are application types. The app also stores the latest
`selection`, a monotonic `nextRequestId`, `routeActive`, and a discriminated
`request` union: `Idle | Running { requestId } | Cancelling { requestId }`.

```ts
import { Option } from 'effect';
import { getData, Idle, revalidateOrLoad, succeed } from 'foldkit/asyncData';
import { refresh } from 'foldkit/update';
import type { Return } from 'foldkit/update';

import { LoadFilteredData } from './command';
import type { Message } from './message';
import type { Data, Model, Selection } from './model';

const loadOnFilter = (selection: Selection, requestId: number) =>
  refresh<Model, Message, Data, string>({
    read: (model) => Option.some(model.data),
    revalidate: revalidateOrLoad,
    write: (model, data) => ({ ...model, data }),
    load: LoadFilteredData({ selection, requestId }),
  });

// Call only when request is Idle and data is not Loading or Refreshing.
const startLatest = (model: Model): Return<Model, Message> => {
  const requestId = model.nextRequestId;
  const next: Model = {
    ...model,
    nextRequestId: requestId + 1,
    request: { _tag: 'Running', requestId },
  };
  return loadOnFilter(next.selection, requestId)(next);
};

// The outcome handler first checks Cancelling and the cancelled request ID.
const afterInterruption = (model: Model): Return<Model, Message> => {
  const next: Model = {
    ...model,
    request: { _tag: 'Idle' },
    data: Option.match(getData(model.data), {
      onNone: () => Idle(),
      onSome: (data) => succeed(data),
    }),
  };
  if (!next.routeActive) return { model: next };
  return startLatest(next);
};
```

Use this explicit **latest-selection wins** policy in the app's update loop:

1. Record every new filter, brush, or zoom selection in `Model.selection`. If
   the route is active and `request` is `Idle`, call `startLatest` with that
   updated Model. While the route is inactive, only store the selection.
2. If a request is `Running`, change it to `Cancelling` with the same request
   ID and return only its keyed interruption Command. Capture that ID in the
   interruption outcome Message. Do not start a replacement in the same batch.
3. While `Cancelling`, keep replacing `Model.selection` with the latest input;
   emit no further load or interruption Commands. Ignore normal result Messages
   for this cancelled request, including a result racing with interruption.
4. For a matching interruption outcome (`Interrupted` or `NotFound`), call
   `afterInterruption` using the current Model. An interrupted Command will not
   send its original result Message. The helper therefore explicitly clears
   pending AsyncData: `Loading` becomes `Idle`, and `Refreshing(data)` becomes
   `Success(data)`. It then starts the latest selection with a fresh ID, moving
   back to `Loading` or `Refreshing`. Calling `refresh` on the old pending state
   would produce no Command because `revalidateOrLoad` returns `None` there.
5. Accept a normal result only when its ID matches the `Running` request.
   Apply `settle(model.data, result)` from `foldkit/asyncData` and set `request`
   to `Idle` in the same update. Ignore stale IDs and duplicate outcomes. Cached
   data retained during replacement still belongs to the previous selection;
   present it as such until the matching replacement result arrives.
6. On route exit, mark the route inactive and interrupt any `Running` request,
   or wait for the existing `Cancelling` outcome. The same outcome handler
   clears pending AsyncData but starts no replacement while inactive. Route
   entry can call `startLatest` from `Idle`; if still `Cancelling`, wait for its
   outcome before loading the latest selection.

The app owns command keys and correlation, interruption/cancellation policy,
AsyncData, and the Model. `refresh` supplies the revalidation step, not that
replacement policy. The app derives the records supplied to `foldkit-viz`,
whose synchronous functions compute geometry; chart primitives cannot fetch
data or subscribe to events or Ports.

Use typed Ports only for host input/output: map validated inbound values to app
Messages and emit outbound values through app-owned Commands. Keep internal
state in the Model and internal event flow in Messages and update. Astro mounts
the island and supplies lifecycle facts; it does not own remote visual loads.

---

## Quick start

```typescript
import { linear, linearTicks } from '@opsydyn/foldkit-viz/math/scale';
import { extent } from '@opsydyn/foldkit-viz/math/array';
import { line } from '@opsydyn/foldkit-viz/shape/line';

const values = [10, 45, 23, 88, 67];
const [lo, hi] = extent(values) as [number, number];
const xScale = linear({ domain: [0, values.length - 1], range: [0, 400] });
const yScale = linear({ domain: [lo, hi], range: [200, 0] });

const points = values.map((v, i) => [xScale(i), yScale(v)] as const);
const pathD = line(points, { curve: 'catmullRom' });
// → "M0,148 C133.3,..."
```

---

## Animation

Use `math/tween` with FoldKit's `Subscription.animationFrameEntry` for smooth transitions:

```typescript
import { tweenCreate, tweenStep, tweenValue, allTweensDone } from '@opsydyn/foldkit-viz/math/tween';
import { Subscription } from 'foldkit';

// In model.ts
const tween = tweenCreate(600 /* ms */, easeOutCubic);

// In subscription.ts
Subscription.animationFrameEntry({
  isActive: (model) => !allTweensDone(model.tweens),
  toMessage: (dt) => Ticked({ dt }),
});

// In update.ts — on Tick:
tweenStep(model.tween, dt);

// In view.ts — bar height:
tweenValue(0, bar.value, model.tween);
```

---

## Design principles

- **No D3 dependency** — pure TypeScript, tree-shakeable by module path
- **Immutable** — all functions return new values, never mutate
- **TEA-native** — designed for use in The Elm Architecture (state → message → update → view)
- **D3 parity** — faithful ports of D3's mathematical core; DOM-handling D3 packages are replaced by TEA patterns
- **TypeScript strict** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`

---

## Documentation

```bash
bun run docs   # generates docs/ using TypeDoc
```

---

## Testing

```bash
bun test       # run this package's tests from packages/foldkit-viz
```

---

## License

MIT — Alan P Currie

## Bars, word cloud, text and paint

These subpaths ship in the published package.

```ts
import { barGeometry } from '@opsydyn/foldkit-viz/chart/bars';

const data = [
  { id: 'jan-core', month: 'Jan', team: 'Core', count: 20 },
  { id: 'jan-tools', month: 'Jan', team: 'Tools', count: 12 },
];
const geometry = barGeometry(
  data,
  {
    key: (d) => d.id,
    category: (d) => d.month,
    series: (d) => d.team,
    value: (d) => d.count,
  },
  {
    frame: { width: 600, height: 320, margins: { top: 20, right: 20, bottom: 40, left: 50 } },
    mode: 'grouped',
    orientation: 'vertical',
  },
);
```

`mode` is `grouped` or `stacked`; `orientation` is `vertical` or `horizontal`.
Signed stacks accumulate positive and negative values independently. Missing
category/series pairs leave gaps; duplicate pairs must be aggregated by the caller.
Non-finite values, invalid frames, duplicate datum keys and domains that omit
zero or an endpoint throw `RangeError`. Colours remain a renderer concern.

```ts
import { wordCloud } from '@opsydyn/foldkit-viz/layout/wordcloud';
import { wrapText } from '@opsydyn/foldkit-viz/layout/text';

const measured = [{ id: 'geometry', text: 'Geometry', width: 180, height: 32 }];
const cloud = wordCloud(
  measured,
  {
    key: (d) => d.id,
    text: (d) => d.text,
    width: (d) => d.width,
    height: (d) => d.height,
    rotation: () => 0,
  },
  { width: 600, height: 320, padding: 3, spiral: 'archimedean' },
);
// cloud.words contain centre anchors and conservative collision bounds.
// cloud.omitted contains input records which could not fit.
const label = wrapText('Values become visuals', (text) => text.length * 8, { width: 100 });
// Replace this illustrative measurement function with real font metrics.
```

Use `archimedean` or `rectangular` spirals. Placement is deterministic and
bounded by `maxSteps` (default 8000, maximum 100000 per word). Rotated measured
rectangles are conservative, so packing is less dense than pixel-mask clouds.
There is no font/DOM dependency in the layout: measure the same font, weight
and size used by your SVG renderer. The native promo example performs font
loading and canvas measurement in a Foldkit Command, discarding stale revisions.

`wrapText` preserves explicit newlines, collapses other whitespace and breaks
long words on Unicode graphemes. It reports `overflow` if a glyph exceeds the
width or `maxLines` omits text. The caller controls measurement; no DOM is used.

```ts
import {
  dotPattern,
  hatchPattern,
  linearGradient,
  radialGradient,
} from '@opsydyn/foldkit-viz/foldkit/paint';
// Optional Foldkit adapter: compose the returned nodes inside h.defs.
// Use a unique caller-owned id per definition, then fill with url(#that-id).
```

All four paint functions accept caller colours including `currentColor` and
CSS variables. Patterns use `userSpaceOnUse`. Gradient offsets are ordered in
`[0, 1]`; opacity is optional. Linear endpoints and radial centres/radii can
be customised. The pure package root does not import these optional adapters.

The word-cloud spirals adapt [d3-cloud](https://github.com/jasondavies/d3-cloud)
by Jason Davies; see `THIRD-PARTY-NOTICES.md` for its BSD licence. Existing bar
scales and signed stack accumulation reference the vendored D3 source.

### Controlled exploration

Pure helpers keep viewport and inspection state with the caller. The coordinate matrix
uses the six numeric fields of SVG `getScreenCTM()`; obtain it at your runtime boundary.

```typescript
import { clientToLocal } from '@opsydyn/foldkit-viz/interaction/coordinates';
import { constrainDomain, zoomDomain, panDomain } from '@opsydyn/foldkit-viz/interaction/viewport';
import { nearestByX } from '@opsydyn/foldkit-viz/interaction/inspection';

const point = clientToLocal({ x: 30, y: 60 }, { a: 2, b: 0, c: 0, d: 3, e: 10, f: 30 });
const viewport = constrainDomain([-2, 3], [0, 10], 1); // [0, 5]
const zoomed = zoomDomain(viewport, 0.5, 2, [0, 10], 1);
const panned = panDomain(zoomed, 1, [0, 10], 1);
const record = nearestByX([{ id: 'sample-a', time: 2 }], { key: (d) => d.id, x: (d) => d.time }, 3);
```

Domains require finite increasing endpoints and positive representable spans.
Invalid input throws `RangeError`; singular/unrepresentable coordinate inversions
return `null`. Inspection returns an original record, uses lexicographic key ties,
and validates every unique non-empty key and finite X value. These helpers do not
install event listeners, retain application state, or require Foldkit/Effect.

`chartFrame` also accepts an optional typed `onMount` action on its SVG. Use a
caller-defined Foldkit Mount stream to acquire scoped pointer/resize facts; the
adapter owns no input state. Existing frames without this option render unchanged.

## Contiguous signals and supplied intervals

`contiguousRuns` (`chart/segments`) preserves original records in input order. Supply finite strictly increasing X values, a drawable predicate and an explicit connection policy; missing values and false connections break runs. No sorting or gap duration is inferred.

`intervalBandGeometry` (`chart/intervalBand`) projects one ordered run of finite lower/upper bounds through a shared Cartesian layout. Bounds must be ordered and keys unique/non-empty. Signed/equal bounds are valid; empty/singleton runs return no area path, retaining singleton endpoints. Compose each disconnected run separately and clip to the plot. These pure root/subpath exports do not infer confidence, quality or statistics, and require no Foldkit/Effect peers.

## Orthographic sphere

The additive `@opsydyn/foldkit-viz/shape/globe` entry exports `GlobeView`,
`GlobePoint`, `projectGlobePoint`, `clipGlobeLine` and `GLOBE_EPSILON`.
These functions are pure and require neither FoldKit, Effect nor D3 at runtime.
Published from 0.13.0.

Supply longitude/latitude in degrees, a view centre, positive radius and screen
translation. East is screen-right, north screen-up; `facing` is independent of
domain measurements. Rear points have `visible:false`; do not render them or
their interactive targets. Horizon tolerance is 1e-9 on the unit sphere.
Open-line clipping emits separate projected runs with limb intersections. Edges
are minor great-circle arcs; ambiguous antipodal edges throw `RangeError`.
Non-finite/out-of-range latitude, invalid view and coordinate overflow also throw.
Arrays are not mutated. This is not polygon clipping, resampling or full D3 parity;
existing `geoOrthographic` and `geoPath` contracts remain unchanged.

## Supplied error bars

`errorBarGeometry` (`chart/errorBars`, also root) projects independent caller-supplied intervals through a Cartesian layout. Accessors provide position, lower, upper and datumKey; options select axis x/y and the full capSize in SVG user units. For Y intervals position uses X, and for X intervals position uses Y. Each mark retains the original datum/key with numeric stem/lowerCap/upperCap endpoints; compose SVG lines and clipping yourself, using your own theme. No statistics, sorting, clipping or runtime peers are required.

Bounds and positions must be finite, lower<=upper, keys unique/non-empty, and capSize finite/non-negative; invalid projections or cap-offset overflow throw RangeError. Equal bounds, zero caps, signed values and repeated positions with distinct keys are supported; order is preserved. Example: use capSize8 for sparse inspected intervals rather than caps on every dense sample.
