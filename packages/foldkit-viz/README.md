# foldkit-viz

D3-quality visualisation primitives for FoldKit — **no D3 dependency**.

A pure-TypeScript data-transformation and geometry layer designed for use with
[FoldKit](https://github.com/opsydyn/foldkit)'s TEA (The Elm Architecture) rendering model.
All functions are pure, immutable, and framework-agnostic.

The runnable [`/request-diagnostics`](../../apps/web/src/apps/request-diagnostics/) example shows these primitives inside a FoldKit state machine. The machine belongs to the consuming application; this package remains focused on chart geometry and chart-local state.

---

## Installation

```bash
bun add @opsydyn/foldkit-viz
```

## FoldKit compatibility

`@opsydyn/foldkit-viz` is tested with FoldKit `0.155.x`. Consumers can use
`Command.define(name, { interrupt: true, ... })` to replace remote chart-data
loads while this package remains focused on pure geometry, chart-local state,
and rendering helpers. Chart views consume the render-scoped `HtmlBuilder`
supplied by their parent; the package does not own application effects or
remote-data policy.

This package remains framework-free and does not support server rendering. It
does not import Astro, `Request`, `foldkit/experimental/server`, or
`Runtime.hydrate`, and it does not own server Commands, request-derived Flags,
or remote-data loading. Use `@opsydyn/astro-foldkit`'s opt-in `definePage` path
for the Astro server handoff, then pass the resulting model data to these pure
chart primitives.

---

## Modules

| Import path                                  | Contents                                                                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@opsydyn/foldkit-viz`                       | Root barrel — all exports                                                                                                                                             |
| `@opsydyn/foldkit-viz/math/scale`            | `linear`, `log`, `band`, `point`, `sqrt`, `ordinal`, `scaleSequential`, `scaleQuantile`, `scaleQuantize`, `scalePow`, `scaleSymlog`, `linearInvertible`, `niceLinear` |
| `@opsydyn/foldkit-viz/math/array`            | `extent`, `sum`, `mean`, `median`, `variance`, `deviation`, `cumsum`, `group`, `rollup`, `bisect`, `pairs`, `zip`, `range`                                            |
| `@opsydyn/foldkit-viz/math/color`            | `interpolateRgb`, `interpolateLab`, `interpolateHsl`, `interpolateRgbBasis`, `colorScale`, `divergingScale`                                                           |
| `@opsydyn/foldkit-viz/math/schemes`          | `tableau10`, `category10`, `wong`, `ibmCarbon`, `tolMuted`, `viridis`, `magma`, `inferno`, `plasma`, `cividis`, diverging + sequential palettes                       |
| `@opsydyn/foldkit-viz/math/tween`            | `tweenCreate`, `tweenStep`, `tweenValue`, `tweenPath`, `easeOutCubic`, `easeInOutCubic`, `easeOutElastic`, + 5 more easings                                           |
| `@opsydyn/foldkit-viz/math/time`             | `scaleTime`, `timeTicks`, `timeFormat`, `timeParse`, `timeNice`                                                                                                       |
| `@opsydyn/foldkit-viz/math/stats`            | `boxStats`, `kde`, `silvermanBandwidth`, `quantile`                                                                                                                   |
| `@opsydyn/foldkit-viz/math/bin`              | `bin` — histogram binning                                                                                                                                             |
| `@opsydyn/foldkit-viz/math/brush`            | `BrushState`, `brushUpdate`, `brushExtent`, `brushContains`, `brushDomain`                                                                                            |
| `@opsydyn/foldkit-viz/math/zoom`             | `scaleAt`, `translateBy`, `constrainScale`, `rescaleDomain`                                                                                                           |
| `@opsydyn/foldkit-viz/interaction/selection` | Selection, interval/key constructors, clamping, and membership helpers for parent-owned chart interaction state                                                       |
| `@opsydyn/foldkit-viz/shape/line`            | `line` — 14 curve types: `linear`, `catmullRom`, `natural`, `basis`, `cardinal`, `step`, `stepBefore`, `stepAfter`, + open/closed variants                            |
| `@opsydyn/foldkit-viz/shape/area`            | `area` — filled area between two line generators                                                                                                                      |
| `@opsydyn/foldkit-viz/shape/areaRadial`      | `areaRadial`, `wedge` — polar area shapes                                                                                                                             |
| `@opsydyn/foldkit-viz/shape/arc`             | `arc`, `arcCentroid` — pie/donut arc paths                                                                                                                            |
| `@opsydyn/foldkit-viz/shape/pie`             | `pie` — compute arc angles from data                                                                                                                                  |
| `@opsydyn/foldkit-viz/shape/stack`           | `stack` — stacked series (D3 `d3-shape` parity)                                                                                                                       |
| `@opsydyn/foldkit-viz/shape/chord`           | `chord`, `ribbon` — chord diagram layout                                                                                                                              |
| `@opsydyn/foldkit-viz/shape/sankey`          | `sankey` — Sankey flow diagram layout                                                                                                                                 |
| `@opsydyn/foldkit-viz/shape/geo`             | `geoPath`, `geoEquirectangular`, `geoMercator`, `geoGraticule`                                                                                                        |
| `@opsydyn/foldkit-viz/shape/link`            | `linkVertical`, `linkHorizontal`                                                                                                                                      |
| `@opsydyn/foldkit-viz/hierarchy`             | `hierarchy`, `treeLayout`, `packLayout`                                                                                                                               |
| `@opsydyn/foldkit-viz/simulation`            | Barnes-Hut force simulation (N-body)                                                                                                                                  |
| `@opsydyn/foldkit-viz/stateflow`              | Framework-free Stateflow graph records and deterministic layout                                                                                                       |

---

## Parent-owned interaction state

Viz owns pure interaction values. Individual charts own their local gesture
mechanics, while the consuming parent owns shared selection state and
child-message coordination.

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

For future remote filter, brush, or zoom loads, define the refresh step in the
consuming app. In this example, `Model.data` is `AsyncData<Data, string>`, and
`LoadFilteredData` is the app-owned Command that returns its result as a Message.
`Model`, `Data`, and `Message` are application types.

```ts
import { Option } from 'effect';
import { revalidateOrLoad } from 'foldkit/asyncData';
import { refresh } from 'foldkit/update';

import { LoadFilteredData } from './command';
import type { Message } from './message';
import type { Data, Model } from './model';

const loadOnFilter = refresh<Model, Message, Data, string>({
  read: (model) => Option.some(model.data),
  revalidate: revalidateOrLoad,
  write: (model, data) => ({ ...model, data }),
  load: LoadFilteredData(),
});
```

Apply this step from the app's update loop after recording the new filter,
brush, or zoom selection; compose it with other steps using `combine` from
`foldkit/update`. Handle the Command's result Message with `settle` from
`foldkit/asyncData` to update the app-owned AsyncData field. The app derives the
records supplied to `foldkit-viz`, whose synchronous functions compute geometry;
chart primitives cannot fetch data or subscribe to events or Ports.

The app also owns command keys, interruption/cancellation policy, and stale
result handling. `refresh` manages the revalidation step; it does not establish
a latest-request-wins policy. For interruptible replacements, wait for the
interruption outcome Message before starting the next Command, and cancel on
route exit without starting a replacement.

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
bun test       # 125 tests across 11 files
```

---

## License

MIT — Alan P Currie
