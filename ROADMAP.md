# foldkit-viz Chart Roadmap

## Completed (49 charts)

| Chart                 | Primitive                                                  | Notes                                                                          |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Donut                 | `shape/pie` + `shape/arc`                                  |                                                                                |
| Bar                   | `math/scale` band + linear                                 |                                                                                |
| Line                  | `shape/line`                                               |                                                                                |
| Area                  | `shape/area`                                               |                                                                                |
| Scatter               | `math/scale` linear                                        |                                                                                |
| Bubble                | `math/scale` sqrt                                          |                                                                                |
| Radar                 | `shape/lineRadial`                                         |                                                                                |
| Force Graph           | `simulation`                                               |                                                                                |
| Treemap               | `hierarchy` treemap                                        |                                                                                |
| Sunburst              | `hierarchy` partition + `shape/arc`                        |                                                                                |
| Streamgraph           | `shape/stack` + `shape/area`                               |                                                                                |
| Heatmap               | `math/color` colorScale                                    | New primitive: `math/color`                                                    |
| Chord                 | `shape/chord`                                              | New primitive                                                                  |
| Sankey                | `shape/sankey`                                             | New primitive                                                                  |
| Packed Circles        | `hierarchy` pack                                           | New primitive                                                                  |
| Box Plot              | `math/stats` quantile/boxStats                             | New primitive                                                                  |
| Candlestick           | `math/scale` band + linear                                 |                                                                                |
| Waterfall             | `math/scale` band + linear                                 |                                                                                |
| Gauge                 | `shape/arc`                                                | Supports 1–3 gauges, threshold zones                                           |
| Parallel Coordinates  | `math/scale` linear                                        | Per-axis domains, hover highlight                                              |
| Calendar Heatmap      | `math/color` colorScale                                    | GitHub-style, 365 days, hover tooltip                                          |
| Zoomable Line         | `math/zoom` TransformMatrix                                | Zoom+pan via TEA state; +/− buttons + drag; rescaleDomain data-zoom            |
| Phyllotaxis           | `math/zoom` + pure phyllotaxis math                        | Full 2D SVG matrix zoom, drag-to-pan, mini map with viewport indicator         |
| Histogram             | `math/bin`                                                 | Bimodal salary distribution, hover-count tooltip                               |
| Symbol Scatter        | `shape/symbol` + `math/scale/ordinal`                      | Auto MPG dataset, 3-category shape+colour encoding                             |
| Tidy Tree             | `hierarchy/tree` + `shape/link`                            | Frontend tech-stack dependency tree, hover highlight                           |
| Timeline              | `math/time` scaleTime + timeTicks                          | Product launch Gantt — 7 tasks, monthly ticks, hover highlight                 |
| Violin Plot           | `math/scale/point` + `math/stats` KDE                      | Salary by IC level, Epanechnikov KDE + IQR overlay, hover                      |
| Radial Tree           | `hierarchy/cluster` + `shape/link` radial                  | Indo-European language family, hover shows family name                         |
| Log Scatter           | `math/scale/log` + `math/format` SI                        | npm packages — downloads vs stars, log axes, SI-formatted labels               |
| Curve Comparison      | `shape/curve` variants                                     | 5 interpolation types: linear, basis, cardinal, catmullRom, monotoneX          |
| Diverging Bar         | `math/schemes` rdBu + `math/color` divergingScale          | Monthly YoY revenue growth, red/blue diverging from 0                          |
| Threshold Bar         | `math/scale/threshold`                                     | API response times, traffic-light coloring: green/amber/red                    |
| Easing Curves         | `math/ease`                                                | 6 easing functions: linear, sinOut, cubicOut, backOut, elasticOut, bounceOut   |
| Color Spaces          | `math/color` interpolateHsl + interpolateLab               | Red→blue gradient compared across RGB, HSL, Lab                                |
| Density Contour       | `math/contour` + `math/random`                             | Bivariate normal scatter + marching-squares contour lines                      |
| Voronoi Diagram       | `math/delaunay`                                            | 55-point Delaunay triangulation + clipped Voronoi cells, per-cell HSL coloring |
| Map Projections       | `shape/geo`                                                | Side-by-side equirectangular vs Mercator with graticule grid + 20 cities       |
| Bullet Chart          | `math/scale` linear + `math/array`                         | KPI performance vs target with range bands — hover highlights row              |
| Bump Chart            | `shape/line` curveNatural + `math/scale`                   | JS framework popularity rankings 2019–2024, smooth rank-order lines            |
| Arc Diagram           | `shape/path` + `math/scale` linear                         | JS tooling dependency network, arcs above linear node axis                     |
| Linked Views          | `shared/dispatch` CrosshairState                           | Scatter + histogram, bidirectional hover sync via parent TEA update            |
| Diverging Stacked Bar | `math/array` cumsum + `math/scale` linear                  | Likert survey responses, stacked from centre, net score on hover               |
| Correlation Matrix    | `math/color` interpolateLab + `scaleSequential`            | Tech stock return correlations, colour-encoded [-1, +1] cells                  |
| Wind Rose             | `shape/areaRadial` wedge + `math/scale` linear             | 8-direction wind frequency, segmented polar bars with gap                      |
| Animated Bar          | `math/tween` + `Subscription.animationFrame`               | Staggered bar entry animation, 6 easing functions                              |
| Tile Grid Map         | `math/array` extent + `scaleSequential` + `interpolateRgb` | US state GDP index on a 12×7 cartogram grid with legend                        |

---

## Primitive Parity Audit

foldkit-viz maps D3's 30 packages to a smaller set of pure-math/shape primitives. D3 packages that are DOM or event-driven (`d3-selection`, `d3-transition`, `d3-drag`, `d3-axis`, `d3-dispatch`, `d3-timer`) are intentionally not ported — the TEA architecture replaces them. Everything below is about the _data-transformation and geometry_ layer.

### Implemented

| foldkit-viz module       | Covers                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shape/path`             | `d3-path` — full parity                                                                                                                                                                  |
| `shape/arc`              | `d3-shape` arc — full parity (cornerRadius bug documented)                                                                                                                               |
| `shape/area`             | `d3-shape` area — full parity                                                                                                                                                            |
| `shape/line`             | `d3-shape` line — full parity                                                                                                                                                            |
| `shape/lineRadial`       | `d3-shape` lineRadial — full parity                                                                                                                                                      |
| `shape/pie`              | `d3-shape` pie — full parity                                                                                                                                                             |
| `shape/stack`            | `d3-shape` stack — full parity                                                                                                                                                           |
| `shape/chord`            | `d3-shape` chord + ribbon — full parity                                                                                                                                                  |
| `shape/sankey`           | `d3-sankey` — full parity                                                                                                                                                                |
| `math/scale`             | `d3-scale` linear, band, sqrt, ordinal — partial                                                                                                                                         |
| `shape/link`             | `d3-shape` linkVertical, linkHorizontal, linkRadial — full parity                                                                                                                        |
| `math/time`              | `d3-scale` scaleTime + `d3-time` timeTicks/timeTickFormat/timeNice — full parity                                                                                                         |
| `math/scale/point`       | `d3-scale` scalePoint — full parity                                                                                                                                                      |
| `math/stats/kde`         | Epanechnikov KDE + silvermanBandwidth — added to `math/stats`                                                                                                                            |
| `hierarchy/cluster`      | `d3-hierarchy` cluster() — full parity                                                                                                                                                   |
| `math/bin`               | `d3-array` bin() — full parity                                                                                                                                                           |
| `shape/symbol`           | `d3-shape` symbol, symbolsFill — full parity                                                                                                                                             |
| `math/color`             | `d3-interpolate` interpolateRgb/Basis + `d3-scale` colorScale — partial                                                                                                                  |
| `math/stats`             | `d3-array` quantile (R-7), boxStats — custom, D3-parity quantile                                                                                                                         |
| `hierarchy`              | `d3-hierarchy` treemap, pack, partition — partial                                                                                                                                        |
| `simulation`             | `d3-force` simulation, center, collide, link, manyBody — full parity                                                                                                                     |
| `simulation/quadtree`    | `d3-quadtree` — full parity (internal)                                                                                                                                                   |
| `math/zoom`              | `d3-zoom` ZoomTransform math — 2D affine matrix, scaleAt, rescaleDomain                                                                                                                  |
| `math/scale` (log)       | `d3-scale` scaleLog — added `log()` + `logTicks()` to `math/scale`                                                                                                                       |
| `math/format`            | `d3-format` — `format(specifier)` covering f, %, s (SI), e, d, g types + `siFormat()`                                                                                                    |
| `shape/curve` variants   | `d3-shape` curveBasis, curveCardinal — added to `shape/line` (basis, cardinal, catmullRom, monotoneX, linear)                                                                            |
| `math/schemes`           | `d3-scale-chromatic` — categorical (tableau10, category10, dark2, set1), sequential (blues, greens, reds, oranges, purples), diverging (rdBu, spectral, rdYlGn, brBG)                    |
| `math/color` (diverging) | `d3-scale` scaleDiverging — added `divergingScale()` to `math/color`                                                                                                                     |
| `math/scale/threshold`   | `d3-scale` scaleThreshold — bisect-right bucket lookup                                                                                                                                   |
| `math/random`            | `d3-random` — LCG seeded RNG, uniform, normal, log-normal distributions                                                                                                                  |
| `math/ease`              | `d3-ease` — linear, cubic, sin, back, bounce, elastic easing functions                                                                                                                   |
| `math/color` (HSL + Lab) | `d3-color` — HSL shortest-path + CIELAB perceptual interpolation                                                                                                                         |
| `math/contour`           | `d3-contour` — Epanechnikov KDE density2d + marching-squares contourLines                                                                                                                |
| `math/delaunay`          | `d3-delaunay` — Delaunator triangulation + Voronoi cells + Cohen-Sutherland clipping                                                                                                     |
| `shape/geo`              | `d3-geo` — 6 projections (equirectangular, Mercator, Natural Earth 1, Orthographic, Albers, Albers USA), `fitSize`/`fitExtent`, `geoPath` with `.bounds()`/`.centroid()`, `geoGraticule` |

### Gaps

None. All D3 data-transformation and geometry primitives are implemented.

> **Not applicable:** `d3-zoom` (event handlers), `d3-brush` (event handlers), `d3-drag`, `d3-axis` (manual in each chart), `d3-selection`, `d3-transition`, `d3-dispatch`, `d3-timer`, `d3-fetch`, `d3-dsv`. The TEA/HTML-DSL architecture replaces all of these.

---

## Remaining — New Charts

All planned charts complete. Primitive parity with D3's data-transformation layer is fully achieved.

## FoldKit 0.129 Augmentation Slice

FoldKit 0.129 adds keyed, explicitly interruptible Commands. This is the next product slice because it lets the demo app show cancellation without weakening the pure chart and Astro package boundaries.

- [ ] **P0 — Cancellable request diagnostics:** make `apps/web/src/apps/request-diagnostics/` use `Command.Interruptible.define` with a real request identity, then cancel the previous HTTP load before starting a replacement. Sequence the replacement from the interrupt result Message; never return interruption and replacement Commands in the same update batch.
- [ ] **P1 — Astro navigation cancellation example:** add a route-aware demo showing that `@opsydyn/astro-foldkit` can surface navigation lifecycle events while the FoldKit app owns the interrupt key and cancellation policy.
- [ ] **P1 — Remote chart-data cancellation guidance:** document the consuming-app pattern for cancelling keyed filter, brush, or zoom loads while keeping `@opsydyn/foldkit-viz` primitives pure and synchronous.
- [ ] **P2 — Typed Markdown showcase:** evaluate `@foldkit/markdown` for build-time typed Markdown documents with live FoldKit islands in the Astro demo.
- [ ] **P2 — Runtime inspection:** evaluate `@foldkit/devtools` for command and model tracing once the cancellation example exists.
- [ ] **P3 — UI package fit:** evaluate `@foldkit/ui` only where it complements, rather than duplicates, the repository's chart and application primitives.

---

## T0 — Chart theming (light / dark mode)

Charts currently use hardcoded hex colors. Goal: CSS-variable-driven theming via nanostores, switchable at runtime with no chart rewrites.

### Design

- `apps/web/src/stores/theme.ts` — nanostores `atom<'light' | 'dark'>` persisted to localStorage
- `apps/web/src/styles/chart-tokens.css` — CSS custom properties for chart colors, gridlines, axes, text
- Each chart reads tokens via `var(--chart-*)` in SVG `fill`/`stroke` where possible, falling back to `currentColor`
- Theme toggle in nav wires the store → sets `data-theme` on `<html>` (matches existing `custom.css` pattern)

### Tasks

- [x] `src/stores/theme.ts` — `persistentAtom<'light'|'dark'>` key `foldkit-theme`
- [x] `src/styles/chart-tokens.css` — `--chart-grid`, `--chart-axis`, `--chart-label`, `--chart-accent`, `--chart-tooltip-text/bg`, `--chart-crosshair` for dark (default) + light
- [x] `shared/axes.ts` — defaults use `var(--chart-grid, …)` / `var(--chart-label, …)` with hex fallbacks
- [x] `shared/svg-root.ts` — `color: var(--chart-label, #888)` on root so `currentColor` propagates
- [x] `shared/tooltip.ts` — `color: var(--chart-accent, …)` default
- [x] Theme `◑` toggle in web nav wired to the nanostore via `themeAtom.subscribe(applyTheme)`
- [x] All 39 charts adapt via shared layer — zero per-chart changes required

---

## Elite Library Roadmap — Phase 2

Goal: match D3 + visx on primitives, scale family, curves, interactions, accessibility, and chart breadth.

---

### T1 — Quick wins (1–2 days each)

#### T1-A `math/array.ts` — aggregation utilities

- [x] `extent(values)` — `[min, max]` in one pass
- [x] `sum`, `mean`, `median`, `deviation`, `variance`
- [x] `group(data, key)` → `Map<K, T[]>` — categorical aggregation
- [x] `rollup(data, reduce, key)` → `Map<K, R>` — aggregate by group
- [x] `cumsum(values)` — running total
- [x] `bisect` / `bisectLeft` — binary search (unblocks cursor-tracking tooltips)
- [x] `pairs`, `zip`, `range` — combinatorial helpers

#### T1-B `math/scale.ts` — missing scale family

- [x] `linearInvertible()` — linear scale with `.invert()` reverse lookup
- [x] `niceLinear(domain, count)` — expand domain to round tick boundary
- [x] `scaleQuantile(data, range)` — quantile bucketing
- [x] `scaleQuantize(domain, range)` — equal-width discrete range
- [x] `scaleSequential(domain, interpolator)` — continuous domain → interpolator
- [x] `scaleIdentity()` — 1:1 passthrough
- [x] `scalePow(exponent)` — generalised power scale
- [x] `scaleSymlog(constant)` — symmetric log (handles zero/negative)

#### T1-C `shape/line.ts` — missing curve types

- [x] `curveStep`, `curveStepBefore`, `curveStepAfter` — step interpolation
- [x] `curveNatural` — cubic natural spline (D3 Thomas algorithm)
- [x] `curveBasisOpen`, `curveBasisClosed`
- [x] `curveCardinalOpen`, `curveCardinalClosed`
- [x] `curveCatmullRomOpen`, `curveCatmullRomClosed`
- [x] `areaRadial()` + `wedge()` — polar stacked area + single wedge segment (`shape/areaRadial.ts`)

#### T1-D `math/time.ts` — time formatting + parsing

- [x] `timeFormat(specifier)` — format Date → string, full `%` directive set
- [x] `timeParse(specifier)` — parse string → Date (inverse of format)
- [x] Directives: `%Y %y %m %d %e %H %I %M %S %L %f %p %P %a %A %b %B %j %%`

#### T1-E `math/schemes.ts` — colour-blind safe palettes

- [x] `wong` — 8-colour colour-blind safe (Wong 2011)
- [x] `ibmCarbon` — IBM Carbon Design System categorical
- [x] `tolMuted` — Paul Tol muted qualitative
- [x] `viridis`, `magma`, `inferno`, `plasma` — perceptual sequential
- [x] `cividis` — deuteranopia/protanopia optimised

---

### T2 — Architecture gaps (3–5 days each)

#### T2-A Brush primitive — `math/brush.ts`

- [x] `BrushState = { anchor, extent, active }` + `BRUSH_IDLE`
- [x] `BrushMessage` — `StartedBrush`, `MovedBrush`, `EndedBrush`, `ClearedBrush`
- [x] `brushExtent(state)` → `[lo, hi]` | null (pixel space)
- [x] `brushContains(state, x)` — point membership test
- [x] `brushDomain(state, invert)` — maps pixel extent → domain values via `linearInvertible`
- [x] `brushUpdate(state, msg)` — pure update function
- [x] Showcase: histogram brush filter chart — `apps/histogram-brush/` + brushable histogram + scatter cross-filter

#### T2-B Cursor-tracking tooltip — `shared/cursor-tooltip.ts`

- [x] `nearestIndex(sortedX, pointerX)` — bisect-based 1D nearest point
- [x] `nearestPoint(coords, px, py)` — Euclidean 2D nearest point (scatter charts)
- [x] `cursorTooltip(h, x, y, lines[], style?)` — multi-line SVG tooltip with bg rect, CSS-variable colours
- [x] Migrate bar, line, area, scatter to cursor-tracking (replaces transparent hit rects) — T2-B-migrate

#### T2-C Linked views — `shared/dispatch.ts`

- [x] `CrosshairState`, `CROSSHAIR_IDLE` — shared cursor identity keyed by string
- [x] `isHighlighted`, `isDimmed`, `crosshairActive` — helpers for per-datum opacity
- [x] `apps/linked-charts/` showcase — scatter + histogram, bidirectional hover via parent update function
- [x] Pattern documented: child emits normal messages → parent cross-wires sibling model update

#### T2-D Animation / tween layer — `math/tween.ts`

- [x] `Tween` state + `tweenCreate(duration, ease)` — immutable tween record
- [x] `tweenStep(tween, dt)` — advance by delta, returns new Tween (pure)
- [x] `tweenValue(from, to, tween)` — interpolate between two numbers
- [x] `tweenPath(from, to, tween)` — interpolate SVG path `d=` strings
- [x] `tweenDone`, `allTweensDone` — completion checks
- [x] `easeLinear`, `easeOutCubic`, `easeInCubic`, `easeInOutCubic`, `easeOutElastic`, `easeOutBack`
- [x] `apps/animated-bar/` showcase — staggered bar entry via `Subscription.animationFrame`
- [x] 27 tween tests covering all easing functions, step, value, path interpolation

---

### T3 — New chart types

- [x] **Bullet chart** — KPI vs target with range bands (`math/scale` linear + `math/array`)
- [x] **Bump / rank chart** — temporal rankings, smooth `curveNatural` rank-order lines
- [x] **Arc diagram** — network links as arcs above a linear node axis
- [x] **Diverging stacked bar** — Likert survey, `cumsum` stacking, net score label on hover
- [x] **Correlation matrix** — `scaleSequential` + `interpolateLab` colour encoding, hover highlights row/col
- [x] **Tile grid map** — choropleth-style with `scaleSequential` + `interpolateRgb`; US state GDP index on a 12×7 grid, no GeoJSON required
- [x] **Area radial / wind rose** — `areaRadial` + `wedge` shapes, 8-direction frequency chart with gap segments
- [x] **Choropleth world map** — real TopoJSON via `topojson-client` + `world-atlas`; `geoNaturalEarth1().fitSize()` auto-scaling; `scaleSequential` color encoding; internet penetration % dataset; hover tooltip via `geoPath().centroid()`

---

### T4 — Accessibility + quality

#### T4-A Accessible chart markup

- [x] `role="application"` + `aria-roledescription="interactive chart"` on interactive charts via `svgRoot`
- [x] `<title>` + `<desc>` SVG children for reliable accessible name across all screen readers
- [x] `aria-hidden="true"` on decorative gridlines/axes groups (`yGridlines`, `xLinearGridlines`)
- [x] `withAccessibleTable(h, chart, caption, headers, rows)` — visually-hidden `<table>` companion
- [x] `srOnly(h, text)` — screen-reader-only `<span>` helper
- [x] `withAriaLive(h, chart, liveText)` — `<div aria-live="polite">` sibling wrapping the SVG; demonstrated in `bar-chart/index.ts`
- [ ] Screen reader test pass across all 49 charts

#### T4-B Test harness — `packages/foldkit-viz/test/`

- [x] `runChart(init, update, messages)` — runs TEA cycle, returns final model + history
- [x] `assertScaleRange`, `assertMonotone`, `assertApprox` — scale assertion helpers
- [x] 47 primitive tests: `math/array`, `math/scale` (new), `math/time` format+parse
- [x] `collectText`, `collectAttr`, `countElements`, `findNodes` — Html tree walkers (`test/collect-html.ts`)
- [x] 13 tests for collect-html helpers against simulated chart vdom output
- [x] Snapshot tests via `collectAttr`/`countElements` in `collect-html.test.ts` — structural assertions without brittle string snapshots

---

### T5 — Developer experience

- [x] **TypeDoc** — `typedoc.json` config + `bun run docs` script; generates `docs/` from `src/index.ts`; `@category` tags added to `math/array.ts`
- [x] **README.md** — module index, quick-start, animation example, design principles
- [x] **CHANGELOG.md** — v0.1.0 and v0.2.0 documented; TypeDoc updated with `readme: "none"` pending README finalisation
- [x] **Storybook props explorer** — `charts-primitives.stories.ts` — bar, line, area, scatter with live color/curve/spacing controls
- [ ] **`@opsydyn/foldkit-viz` npm publish** — versioned releases (0.2.0 ready)
- [x] **Migration guide** — v0 → v1 — `apps/web/MIGRATION.md`

---

## Chart Library Quality Refactor

Goal: make foldkit-viz best-in-class — extensible, modular, reusable, low-coupling. Inspired by Airbnb visx.

### P1 — Shared rendering primitives layer

Extract duplicated inline logic across all 39 charts into `apps/web/src/ui/shared/`.

- [x] `shared/axes.ts` — `yGridlines()`, `xCategoryAxis()`, `xLinearAxis()`, `xLinearGridlines()`
- [x] `shared/svg-root.ts` — `svgRoot(h, config, handleKeyDown, children)` — accepts optional `style` override
- [x] `shared/tooltip.ts` — `valueTooltip(h, x, y, text, style?)`
- [x] `shared/keyboard.ts` — `arrowKeyNav(key, makeMessage)`, `nextIndex(n, current, direction)`
- [x] `shared/math.ts` — `r3`, `extentWithPadding(values, pad)`
- [x] `shared/layout.ts` — `Margins`, `Dims`, `Layout` types + `makeLayout()`, `DEFAULT_DIMS`, `DEFAULT_MARGINS`
- [x] Migrate all 39 charts to use shared layer

### P2 — Configurable layout (margins + dimensions)

- [x] `dims?: Partial<Dims>` and `margins?: Partial<Margins>` added to 17 data charts (bar, line, area, scatter, histogram, box-plot, bubble, candlestick, waterfall, diverging-bar, threshold-bar, curve-comparison, density-contour, tidy-tree, timeline, violin, log-scatter)
- [x] `layout: Layout` stored in `Model`, destructured in `view()` — module-level constants removed
- [x] `makeLayout()` from `shared/layout.ts` used in all migrated `init()` functions; zero breaking changes

### P3 — Tooltip slot

- [x] `renderTooltip?: (datum, x, y) => Html` added to `view()` props on bar, line, area, scatter, histogram
- [x] Default falls back to `valueTooltip()` from shared layer — no behaviour change without opt-in

### P4 — `UpdatedData` message pattern

- [x] `UpdatedBars` added to bar-chart
- [x] `UpdatedPoints` added to line-chart, area-chart, scatter-chart
- [x] `UpdatedCells` added to heatmap-chart
- [x] All handlers use `Schema.Unknown` cast — no recompute of layout or interaction state

### P5 — Connect `math/schemes` to multi-series chart defaults

- [x] `tableau10` used as default color fallback in streamgraph, chord, sankey
- [x] `scheme?: ReadonlyArray<string>` added to `InitConfig` of all three
- [x] `color` made optional in `SeriesMeta`, `GroupMeta`, `NodeMeta` — explicit colors still take precedence

### P6 — Bug fixes

- [x] Fix `line-chart`: replaced manual area fill string with `area()` primitive call
- [x] Fix `box-plot-chart`: replaced inline `tint()` with `interpolateRgb` from `math/color`
- [x] `voronoi-chart` HSL: intentional continuous hue rotation for 55 cells — kept as-is

### P7 — Root barrel completeness

- [x] Added `ordinal`, `log`, `logTicks`, `threshold`, `point` to `math/scale` exports
- [x] Added `colorScale`, `divergingScale`, `interpolateHsl`, `interpolateLab`, `interpolateRgb`, `interpolateRgbBasis` to `math/color` exports
- [x] Added `kde`, `silvermanBandwidth` to `math/stats` exports
- [x] Added `bin` to `math/bin` exports
- [x] Added `stack` to `shape/stack` exports
- [x] Added `SYMBOLS_FILL`, `symbolPath` to `shape/symbol` exports
- [x] Added `format`, `siFormat`, `scaleTime`, `timeTicks`, `timeTickFormat`, `timeNice`, zoom exports
