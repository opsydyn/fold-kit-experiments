# Changelog

All notable changes to `@opsydyn/foldkit-viz` are documented here.

## [0.4.0](https://github.com/opsydyn/fold-kit-experiments/compare/foldkit-viz-v0.3.0...foldkit-viz-v0.4.0) (2026-06-12)


### Features

* :arrow_up: bump foldkit to 0.108.0 and migrate runtime API ([7441538](https://github.com/opsydyn/fold-kit-experiments/commit/744153844de11b096e2434e7e678d1149238d1b0))
* :rotating_light: add Effect language service and linteffect rules ([c2fad21](https://github.com/opsydyn/fold-kit-experiments/commit/c2fad2198616a0df333bb41e8fe0aaa9af9c433c))
* :sparkles: a111y and tiled grid ([5d8bb60](https://github.com/opsydyn/fold-kit-experiments/commit/5d8bb603d662a937b07732ececf6c94bdb916b1b))
* :sparkles: add data viz ([8992086](https://github.com/opsydyn/fold-kit-experiments/commit/89920867f65a5befa9f00089c025355f5ad23140))
* :sparkles: add tween and type doc ([a37d6ee](https://github.com/opsydyn/fold-kit-experiments/commit/a37d6ee8ccafb5ee331172855b851c3ae10fc1e8))
* :sparkles: charts update ([c0a71ac](https://github.com/opsydyn/fold-kit-experiments/commit/c0a71ac898a070840e68fab926debb72f2263ef0))
* :sparkles: charts updates ([cd052d9](https://github.com/opsydyn/fold-kit-experiments/commit/cd052d9e0bccd7994ec2f4283fb3e2ccff9bc030))
* :sparkles: foldkit upgrade ([cafc368](https://github.com/opsydyn/fold-kit-experiments/commit/cafc36852352e66c7446e06701eaa87103279ff0))
* :sparkles: force graph ([044da69](https://github.com/opsydyn/fold-kit-experiments/commit/044da69eff603d097a5ef68ecc27f4bbbbe92135))
* :sparkles: prop enhance for charts ([394c068](https://github.com/opsydyn/fold-kit-experiments/commit/394c06859c330a86bdd26b99c40681970d81b32e))
* :sparkles: refaactor charts and bloom ([b139fba](https://github.com/opsydyn/fold-kit-experiments/commit/b139fbaf0df6c9b0b6b1a21142c48c50a514a5a3))
* :sparkles: storybook primitives ([c8e81c7](https://github.com/opsydyn/fold-kit-experiments/commit/c8e81c7a2a31b4bc87e8d967dc59c10e918c5d6f))
* :sparkles: theming and storybook ([00beadc](https://github.com/opsydyn/fold-kit-experiments/commit/00beadc87552b76b75c2f3a4fe87965404833d4b))
* :sparkles: update charts lib ([3e848db](https://github.com/opsydyn/fold-kit-experiments/commit/3e848db975f6f492e99de966057953c3230b4806))
* :sparkles: viz usability roadmap work ([dc082c3](https://github.com/opsydyn/fold-kit-experiments/commit/dc082c33583879a91d6d41b96a2e46468165edb9))
* :white_check_mark: updated chrt lib ([ff99bc0](https://github.com/opsydyn/fold-kit-experiments/commit/ff99bc093ccfa8e05ad6ddc75456d728453d899d))


### Bug Fixes

* :white_check_mark: resolve all biome lint errors ([b09399d](https://github.com/opsydyn/fold-kit-experiments/commit/b09399dc0c9e68a2cca0fc53c0a1b59c2b517c90))

## [0.3.0] — 2026-06-05

### Added

**`shape/geo` — major upgrade**
- 4 new projections: `geoNaturalEarth1`, `geoOrthographic`, `geoAlbers`, `geoAlbersUsa`
- `ProjectionObject` — rich callable with `fitSize(size, object)` / `fitExtent(extent, object)` / `withScale` / `withTranslate`; auto-scales projection to fill SVG (D3 `fitSize` algorithm, `REF_SCALE=150`)
- `GeoPathFn` — path renderer with `.bounds(obj)` and `.centroid(obj)` methods for bounding box and label placement
- `geoBounds(proj, obj)` / `geoCentroid(proj, obj)` — standalone helpers
- New exported types: `GeoBBox`, `GeoCoord`, `GeoFeature`, `GeoFeatureCollection`, `GeoObject`, `GeoPathFn`, `Projection`, `ProjectionObject`

**Choropleth chart** (in `apps/web`)
- `ui/choropleth-map` — reusable chart primitive: TopoJSON-agnostic, data-driven color encoding, centroid-anchored hover tooltip, sequential color legend
- `apps/choropleth` — TEA app: `world-atlas` 110m countries + `topojson-client` conversion, internet penetration dataset

---

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
