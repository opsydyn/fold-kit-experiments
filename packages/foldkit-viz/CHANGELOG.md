# Changelog

All notable changes to `@opsydyn/foldkit-viz` are documented here.

## [0.2.0] — 2026-06-05

### Added

**New modules**
- `math/array` — `extent`, `sum`, `mean`, `median`, `variance`, `deviation`, `cumsum`, `group`, `rollup`, `bisect`/`bisectLeft`, `pairs`, `zip`, `range`
- `math/tween` — `Tween` type, `tweenCreate`, `tweenStep`, `tweenValue`, `tweenPath`, `tweenDone`, `allTweensDone`; easing functions: `easeLinear`, `easeOutCubic`, `easeInCubic`, `easeInOutCubic`, `easeOutElastic`, `easeOutBack`
- `math/brush` — `BrushState`, `StartedBrush`/`MovedBrush`/`EndedBrush`/`ClearedBrush`, `brushUpdate`, `brushExtent`, `brushContains`, `brushDomain`
- `shape/areaRadial` — `areaRadial`, `wedge` for polar area charts and wind roses

**Scale additions** (`math/scale`)
- `linearInvertible` — linear scale with `.invert()` reverse lookup
- `niceLinear` — expand domain to round tick boundaries
- `scaleQuantile` — quantile bucketing
- `scaleQuantize` — equal-width discrete range
- `scaleSequential` — continuous domain → interpolator
- `scalePow` — generalised power scale
- `scaleSymlog` — symmetric log (handles zero/negative)
- `scaleIdentity` — 1:1 passthrough

**Curve types** (`shape/line`)
- `curveStep`, `curveStepBefore`, `curveStepAfter`
- `curveNatural` — cubic natural spline (D3 Thomas algorithm)
- `curveBasisOpen`, `curveBasisClosed`
- `curveCardinalOpen`, `curveCardinalClosed`
- `curveCatmullRomOpen`, `curveCatmullRomClosed`

**Time utilities** (`math/time`)
- `timeFormat(specifier)` — full `%Y %m %d %H %M %S %b %B %a %A %%` directive set
- `timeParse(specifier)` — inverse of `timeFormat`

**Colour schemes** (`math/schemes`)
- `wong`, `ibmCarbon`, `tolMuted` — colour-blind safe categorical palettes
- `viridis`, `magma`, `inferno`, `plasma`, `cividis` — perceptual sequential palettes

### Fixed
- `shape/geo.ts` — null-guard on coordinate array access in `ringPath`/`linePath`
- `shape/line.ts` — `CatmullRomOpenCurve`/`CatmullRomClosedCurve` now use composition instead of inheritance to avoid private member access
- `math/scale.ts` — `linearInvertible` uses `Object.assign` intersection type (no cast required)
- `math/bin.ts` — renamed `valueOf` local to `accessor` (no longer shadows global)
- `math/delaunay.ts` — `@ts-nocheck` for TypedArray `noUncheckedIndexedAccess` false-positives; `noSelfCompare` fixed with `Number.isNaN`
- `simulation/` — `isNaN` → `Number.isNaN` throughout; LCG assignment extracted from expression

### Internal
- TypeDoc config (`typedoc.json`) + `bun run docs` script
- Test harness: `runChart`, `assertScaleRange`, `assertMonotone`, `assertApprox`, `collectText`, `collectAttr`, `countElements`, `findNodes`
- 119 tests across 9 files (up from 0)

---

## [0.1.0] — 2025 (initial)

Initial release with:
- `math/scale` — `linear`, `log`, `band`, `point`, `ordinal`, `sqrt`, `threshold`
- `math/color` — `interpolateRgb`, `interpolateLab`, `interpolateHsl`, `colorScale`, `divergingScale`
- `math/schemes` — `tableau10`, `category10`, `dark2`, `set1`, diverging + sequential palettes
- `math/stats` — `boxStats`, `kde`, `silvermanBandwidth`, `quantile`
- `math/bin` — histogram binning
- `math/zoom` — viewport transform
- `math/ease` — standard easing functions
- `math/contour` — density contour (marching squares)
- `math/delaunay` — Delaunay triangulation + Voronoi
- `math/random` — LCG-based deterministic random
- `math/format` — number formatting
- `math/time` — `scaleTime`, `timeTicks`, `timeNice`, `timeTickFormat`
- `shape/line` — `line` with `linear`, `catmullRom`, `monotoneX`, `basis`, `cardinal` curves
- `shape/area` — filled area
- `shape/arc` — pie/donut arcs
- `shape/pie` — angle computation
- `shape/path` — SVG path builder
- `shape/stack` — stacked series
- `shape/chord` — chord diagram
- `shape/sankey` — Sankey layout
- `shape/geo` — map projections + GeoJSON path
- `shape/link` — vertical/horizontal links
- `shape/lineRadial` — polar line
- `shape/symbol` — symbol markers
- `hierarchy` — tree layout, pack layout
- `simulation` — N-body force simulation (Barnes-Hut quadtree)
