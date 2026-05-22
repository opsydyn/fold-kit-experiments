# foldkit-viz Chart Roadmap

## Completed (22 charts)

| Chart | Primitive | Notes |
| --- | --- | --- |
| Donut | `shape/pie` + `shape/arc` | |
| Bar | `math/scale` band + linear | |
| Line | `shape/line` | |
| Area | `shape/area` | |
| Scatter | `math/scale` linear | |
| Bubble | `math/scale` sqrt | |
| Radar | `shape/lineRadial` | |
| Force Graph | `simulation` | |
| Treemap | `hierarchy` treemap | |
| Sunburst | `hierarchy` partition + `shape/arc` | |
| Streamgraph | `shape/stack` + `shape/area` | |
| Heatmap | `math/color` colorScale | New primitive: `math/color` |
| Chord | `shape/chord` | New primitive |
| Sankey | `shape/sankey` | New primitive |
| Packed Circles | `hierarchy` pack | New primitive |
| Box Plot | `math/stats` quantile/boxStats | New primitive |
| Candlestick | `math/scale` band + linear | |
| Waterfall | `math/scale` band + linear | |
| Gauge | `shape/arc` | Supports 1–3 gauges, threshold zones |
| Parallel Coordinates | `math/scale` linear | Per-axis domains, hover highlight |
| Calendar Heatmap | `math/color` colorScale | GitHub-style, 365 days, hover tooltip |

---

## Primitive Parity Audit

foldkit-viz maps D3's 30 packages to a smaller set of pure-math/shape primitives. D3 packages that are DOM or event-driven (`d3-selection`, `d3-transition`, `d3-drag`, `d3-axis`, `d3-dispatch`, `d3-timer`) are intentionally not ported — the TEA architecture replaces them. Everything below is about the *data-transformation and geometry* layer.

### Implemented

| foldkit-viz module | Covers |
| --- | --- |
| `shape/path` | `d3-path` — full parity |
| `shape/arc` | `d3-shape` arc — full parity (cornerRadius bug documented) |
| `shape/area` | `d3-shape` area — full parity |
| `shape/line` | `d3-shape` line — full parity |
| `shape/lineRadial` | `d3-shape` lineRadial — full parity |
| `shape/pie` | `d3-shape` pie — full parity |
| `shape/stack` | `d3-shape` stack — full parity |
| `shape/chord` | `d3-shape` chord + ribbon — full parity |
| `shape/sankey` | `d3-sankey` — full parity |
| `math/scale` | `d3-scale` linear, band, sqrt — partial |
| `math/color` | `d3-interpolate` interpolateRgb/Basis + `d3-scale` colorScale — partial |
| `math/stats` | `d3-array` quantile (R-7), boxStats — custom, D3-parity quantile |
| `hierarchy` | `d3-hierarchy` treemap, pack, partition — partial |
| `simulation` | `d3-force` simulation, center, collide, link, manyBody — full parity |
| `simulation/quadtree` | `d3-quadtree` — full parity (internal) |

### Gaps

#### HIGH — unlock major new chart types

| Gap | D3 source | What it enables |
| --- | --- | --- |
| `math/scale/log` | `d3-scale` scaleLog | Log-axis scatter, volcano plots, magnitude charts |
| `math/scale/time` | `d3-scale` scaleTime/scaleUtc | Timeline, real-date axes on line/area/candlestick |
| `math/scale/ordinal` | `d3-scale` scaleOrdinal | Categorical color mapping, symbol type encoding |
| `math/bin` | `d3-array` bin() | Histogram, violin plot (KDE), density strip |
| `hierarchy/tree` | `d3-hierarchy` tree() | Tidy tree / dendrogram |
| `hierarchy/cluster` | `d3-hierarchy` cluster() | Radial dendrogram |
| `shape/link` | `d3-shape` linkVertical/linkHorizontal | Smooth Bézier connectors for tree diagrams |
| `shape/symbol` | `d3-shape` symbol, symbolsFill | Multi-category scatter (●■◆▲✦) |

#### MEDIUM — improve existing charts or enable niche types

| Gap | D3 source | What it enables |
| --- | --- | --- |
| `math/scale/point` | `d3-scale` scalePoint | Violin plot x-positioning, jitter plots |
| `math/scale/diverging` | `d3-scale` scaleDiverging | Diverging heatmaps, P&L colour scales |
| `math/scale/threshold` | `d3-scale` scaleThreshold | Choropleth-style maps |
| `shape/curve` variants | `d3-shape` curveMonotoneX, curveCatmullRom, curveBasis, curveCardinal | Smoother line/area charts |
| `shape/link/radial` | `d3-shape` linkRadial | Radial tree connectors |
| `math/color/spaces` | `d3-color` hsl, lab, lch | Perceptual colour mapping, colour pickers |
| `math/color/schemes` | `d3-scale-chromatic` | Named palettes (viridis, blues, spectral…) |
| `math/format` | `d3-format` | SI notation (1.2M, 3.4k) on axis tick labels |
| `math/zoom` | `d3-zoom` ZoomTransform math only | Pan/zoom state in TEA model (pure {k, tx, ty}) |

#### LOW — specialised / large scope

| Gap | D3 source | What it enables |
| --- | --- | --- |
| `math/contour` | `d3-contour` | Density / contour plots |
| `math/delaunay` | `d3-delaunay` | Voronoi diagrams, nearest-neighbour hit testing |
| `shape/geo` | `d3-geo` projections + path | Choropleth maps |
| `math/time` | `d3-time` + `d3-time-format` | Date arithmetic, tick formatting for time scale |
| `math/random` | `d3-random` | Seeded distributions (normal, uniform, pareto) |
| `math/ease` | `d3-ease` | Easing values for CSS animation |

> **Not applicable:** `d3-zoom` (event handlers), `d3-brush` (event handlers), `d3-drag`, `d3-axis` (manual in each chart), `d3-selection`, `d3-transition`, `d3-dispatch`, `d3-timer`, `d3-fetch`, `d3-dsv`. The TEA/HTML-DSL architecture replaces all of these.

---

## Remaining — New Charts

Ordered by primitive readiness (primitives needed are already implemented or straightforward to add).

### 1. Histogram

**New primitive:** `math/bin` (d3-array bin)
**Why:** The canonical distribution chart. Pairs naturally with existing linear + band scale infrastructure.
**Demo data:** Employee salary distribution ($k), configurable bin count.

### 2. Tidy Tree / Dendrogram

**New primitives:** `hierarchy/tree` + `shape/link` (linkVertical/linkHorizontal)
**Why:** Shows hierarchical structure with tidy layout. Completes the hierarchy family (treemap, sunburst, packed circles already done).
**Demo data:** Tech stack dependency tree.

### 3. Timeline / Gantt

**New primitive:** `math/scale/time`
**Why:** Real-date x-axis. The most requested axis type missing from the current set.
**Demo data:** Software project milestones with date ranges.

### 4. Violin Plot

**New primitives:** `math/bin` + `math/scale/point`
**Why:** Combines box plot statistics with density shape. Builds directly on box plot work.
**Demo data:** Same salary-by-level dataset as the box plot for direct comparison.

### 5. Zoomable Line Chart

**New primitive:** `math/zoom` (pure ZoomTransform: {k, tx, ty}, rescaleX/rescaleY)
**Why:** Zoom/pan via TEA model state — no DOM event handler needed. Transform is pure math; events come through existing OnWheel/OnMouseDown messages.
**Demo data:** Dense time-series (e.g. stock price 2 years, 500 points).

### 6. Symbol Scatter

**New primitive:** `shape/symbol`
**Why:** Multi-category scatter using shape encoding (●■◆▲✦✕). Upgrades existing scatter to encode a third categorical dimension without colour alone.
**Demo data:** Car dataset — mpg vs horsepower, symbol = origin (USA / Europe / Japan).

### 7. Radial Tree

**New primitives:** `hierarchy/cluster` + `shape/link/radial`
**Why:** Space-efficient circular dendrogram. Distinct from radial chart types already implemented.
**Demo data:** Language family tree (Indo-European branches).
