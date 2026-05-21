# foldkit-viz Chart Roadmap

## Completed (15 charts)

| Chart | Primitive | Notes |
|---|---|---|
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

---

## Remaining

### 1. Packed Circles
**Primitive:** Add `pack` layout to `hierarchy` module (alongside existing `treemap` + `partition`).  
**Why next:** Completes the hierarchy visualisation trio. Low primitive cost — the packing algorithm is self-contained and the chart reuses all existing patterns.  
**Demo data:** Tech company org chart or programming language family tree.

---

### 2. Box Plot
**Primitive:** Add `quantile` to `math/scale` (or new `math/stats` — `min`, `max`, `median`, `q1`, `q3`, `iqr`).  
**Why:** Fills the biggest analytical gap — statistical distribution comparison across categories. No existing chart covers this.  
**Demo data:** Salary distribution by engineering level.

---

### 3. Candlestick
**Primitive:** None needed — reuses `math/scale` band + linear.  
**Why:** Standard financial chart. Band scale for dates, linear for OHLC range. Straightforward build.  
**Demo data:** 30-day stock price OHLC (e.g. a fictional tech stock).

---

### 4. Waterfall
**Primitive:** None needed — reuses `math/scale` band + linear.  
**Why:** Very practical for budget, P&L, and funnel-delta data. Bars stack from previous total; positive/negative coloring.  
**Demo data:** Annual P&L breakdown (revenue, costs, EBITDA, taxes, net profit).

---

### 5. Gauge
**Primitive:** None needed — reuses `shape/arc`.  
**Why:** Common KPI indicator. Single arc with needle or fill showing progress toward a target.  
**Demo data:** Single metric (e.g. server health score 0–100).

---

### 6. Parallel Coordinates
**Primitive:** Multiple linear scales (one per axis) — `math/scale` already supports this. May want a `normalise` helper.  
**Why:** Best chart for comparing multi-dimensional data across many categories. Niche but distinctive.  
**Demo data:** Car comparison (mpg, horsepower, weight, acceleration, year).

---

### 7. Calendar Heatmap
**Primitive:** None needed — variant of existing heatmap + `math/color`.  
**Why:** Standard activity/time-series view (GitHub-style). Cells are weekday × week, colored by daily value.  
**Demo data:** Daily commit activity over a full year.
