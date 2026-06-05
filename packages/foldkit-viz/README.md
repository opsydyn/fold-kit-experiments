# foldkit-viz

D3-quality visualisation primitives for FoldKit — **no D3 dependency**.

A pure-TypeScript data-transformation and geometry layer designed for use with
[FoldKit](https://github.com/opsydyn/foldkit)'s TEA (The Elm Architecture) rendering model.
All functions are pure, immutable, and framework-agnostic.

---

## Installation

```bash
bun add @opsydyn/foldkit-viz
```

---

## Modules

| Import path | Contents |
|---|---|
| `@opsydyn/foldkit-viz` | Root barrel — all exports |
| `@opsydyn/foldkit-viz/math/scale` | `linear`, `log`, `band`, `point`, `sqrt`, `ordinal`, `scaleSequential`, `scaleQuantile`, `scaleQuantize`, `scalePow`, `scaleSymlog`, `linearInvertible`, `niceLinear` |
| `@opsydyn/foldkit-viz/math/array` | `extent`, `sum`, `mean`, `median`, `variance`, `deviation`, `cumsum`, `group`, `rollup`, `bisect`, `pairs`, `zip`, `range` |
| `@opsydyn/foldkit-viz/math/color` | `interpolateRgb`, `interpolateLab`, `interpolateHsl`, `interpolateRgbBasis`, `colorScale`, `divergingScale` |
| `@opsydyn/foldkit-viz/math/schemes` | `tableau10`, `category10`, `wong`, `ibmCarbon`, `tolMuted`, `viridis`, `magma`, `inferno`, `plasma`, `cividis`, diverging + sequential palettes |
| `@opsydyn/foldkit-viz/math/tween` | `tweenCreate`, `tweenStep`, `tweenValue`, `tweenPath`, `easeOutCubic`, `easeInOutCubic`, `easeOutElastic`, + 5 more easings |
| `@opsydyn/foldkit-viz/math/time` | `scaleTime`, `timeTicks`, `timeFormat`, `timeParse`, `timeNice` |
| `@opsydyn/foldkit-viz/math/stats` | `boxStats`, `kde`, `silvermanBandwidth`, `quantile` |
| `@opsydyn/foldkit-viz/math/bin` | `bin` — histogram binning |
| `@opsydyn/foldkit-viz/math/brush` | `BrushState`, `brushUpdate`, `brushExtent`, `brushContains`, `brushDomain` |
| `@opsydyn/foldkit-viz/math/zoom` | `scaleAt`, `translateBy`, `constrainScale`, `rescaleDomain` |
| `@opsydyn/foldkit-viz/shape/line` | `line` — 14 curve types: `linear`, `catmullRom`, `natural`, `basis`, `cardinal`, `step`, `stepBefore`, `stepAfter`, + open/closed variants |
| `@opsydyn/foldkit-viz/shape/area` | `area` — filled area between two line generators |
| `@opsydyn/foldkit-viz/shape/areaRadial` | `areaRadial`, `wedge` — polar area shapes |
| `@opsydyn/foldkit-viz/shape/arc` | `arc`, `arcCentroid` — pie/donut arc paths |
| `@opsydyn/foldkit-viz/shape/pie` | `pie` — compute arc angles from data |
| `@opsydyn/foldkit-viz/shape/stack` | `stack` — stacked series (D3 `d3-shape` parity) |
| `@opsydyn/foldkit-viz/shape/chord` | `chord`, `ribbon` — chord diagram layout |
| `@opsydyn/foldkit-viz/shape/sankey` | `sankey` — Sankey flow diagram layout |
| `@opsydyn/foldkit-viz/shape/geo` | `geoPath`, `geoEquirectangular`, `geoMercator`, `geoGraticule` |
| `@opsydyn/foldkit-viz/shape/link` | `linkVertical`, `linkHorizontal` |
| `@opsydyn/foldkit-viz/hierarchy` | `hierarchy`, `treeLayout`, `packLayout` |
| `@opsydyn/foldkit-viz/simulation` | Barnes-Hut force simulation (N-body) |

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

Use `math/tween` with FoldKit's `Subscription.animationFrame` for smooth transitions:

```typescript
import { tweenCreate, tweenStep, tweenValue, allTweensDone } from '@opsydyn/foldkit-viz/math/tween';
import { Subscription } from 'foldkit';

// In model.ts
const tween = tweenCreate(600 /* ms */, easeOutCubic);

// In subscription.ts
Subscription.animationFrame({
  isActive: (model) => !allTweensDone(model.tweens),
  toMessage: (dt) => Ticked({ dt }),
})

// In update.ts — on Tick:
tweenStep(model.tween, dt)

// In view.ts — bar height:
tweenValue(0, bar.value, model.tween)
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
bun test       # 119 tests across 9 files
```

---

## License

MIT — Alan P Currie
