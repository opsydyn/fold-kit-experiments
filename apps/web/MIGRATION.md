# Chart component migration guide — v0 → v1

This guide covers the breaking and additive API changes that happened during the
P1–P7 refactor and the T2-B cursor-tracking migration.  If you were using any of
the chart primitives in `src/ui/` before these changes, read the relevant sections
below.

---

## 1. Shared rendering layer (P1)

Previously every chart inlined its own axes, tooltip, SVG root, keyboard nav, and
math helpers.  All of that now lives in `src/ui/shared/` and must be imported from
there.

**Before**

```ts
// helpers duplicated per chart
function r3(n: number) { return Math.round(n * 1000) / 1000; }
function yGridlines(...) { /* inline */ }
```

**After**

```ts
import {
  arrowKeyNav,
  makeLayout,
  nearestIndex,
  r3,
  svgRoot,
  valueTooltip,
  withAccessibleTable,
  withAriaLive,
  xCategoryAxis,
  yGridlines,
} from '../shared';
```

Full exports: `axes`, `cursor-tooltip`, `dispatch`, `keyboard`, `layout`,
`math`, `svg-root`, `tooltip`, `accessible-table`.

---

## 2. Configurable layout (P2)

`init()` now accepts optional `dims` and `margins` overrides.  The resolved
`Layout` is stored on the model rather than as module-level constants.

**Before**

```ts
const W = 480, H = 280, MT = 24, MR = 16, MB = 44, ML = 44;
const PW = W - ML - MR;
const PH = H - MT - MB;

export function init(bars): readonly [Model, readonly []] {
  return [{ bars, activeIndex: Option.none(), config: DEFAULT_CONFIG }, []];
}
```

**After**

```ts
// InitConfig
export type InitConfig = Readonly<{
  bars: ReadonlyArray<Bar>;
  config?: Partial<Config>;
  dims?: Partial<Dims>;     // { width?, height? }  — defaults: 480×280
  margins?: Partial<Margins>; // { top?, right?, bottom?, left? }
}>;

export function init(cfg: InitConfig): readonly [Model, readonly []] {
  const layout = makeLayout(
    { width: 480, height: 280, ...cfg.dims },
    { top: 24, right: 16, bottom: 44, left: 44, ...cfg.margins },
  );
  return [{ bars: cfg.bars, ..., layout }, []];
}

// In view(), destructure from model.layout:
const { dims: { width: W, height: H }, margins: { top: MT, left: ML }, pw: PW, ph: PH } =
  model.layout;
```

---

## 3. Tooltip slot (P3)

All interactive charts now accept an optional `renderTooltip` function so callers
can replace the default tooltip without forking the chart.

```ts
// Usage
BarChart.view({
  model,
  toParentMessage,
  renderTooltip: (bar, x, y) =>
    myTooltip(h, x, y, `${bar.label} — £${bar.value.toLocaleString()}`),
});
```

When `renderTooltip` is omitted the chart uses `valueTooltip()` from shared — no
behaviour change.

Supported on: `bar-chart`, `line-chart`, `area-chart`, `scatter-chart`, `histogram-chart`.

---

## 4. UpdatedData messages (P4)

Charts now expose a message for live data replacement so parent TEA apps can push
new datasets without re-mounting.

| Chart | Message | Payload |
|---|---|---|
| `bar-chart` | `UpdatedBars` | `{ bars: Schema.Unknown }` |
| `line-chart` | `UpdatedPoints` | `{ points: Schema.Unknown }` |
| `area-chart` | `UpdatedPoints` | `{ points: Schema.Unknown }` |
| `scatter-chart` | `UpdatedPoints` | `{ points: Schema.Unknown }` |
| `heatmap-chart` | `UpdatedCells` | `{ cells: Schema.Unknown }` |

```ts
// Example: stream new bars from a parent update handler
case 'FetchedData':
  return [model, [Effect.succeed(BarChart.UpdatedBars({ bars: action.data }))]];
```

---

## 5. Cursor-tracking overlay (T2-B)

Per-element `OnMouseEnter` / `OnMouseLeave` hit areas have been replaced with a
single transparent `<rect>` overlay at `[0, 0, PW, PH]` that uses
`OnPointerMove` + `nearestIndex` (1D) or `nearestPoint` (2D scatter).

**Why this matters for custom charts:**
- Bars and line/area points are now **visual only** — remove any `OnMouseEnter`
  handlers you added directly to data elements.
- The overlay fires `OnPointerMove(screenX, screenY, pointerType)` — only screen
  coordinates are available, not client coords.  Convert via the `CaptureChartBounds`
  mount that records `rect.left + window.screenX` at mount time.

**Coordinate conversion**

```ts
// screenLeft and renderedPW captured once by CaptureChartBounds mount
const plotX = (screenX - screenLeft) * (PW / renderedPW);
const idx = nearestIndex(barCenters, plotX);
```

Scatter charts capture all four bounds fields and use `nearestPoint(coords, plotX, plotY)`.
Chrome height offset: `window.outerHeight - window.innerHeight`.

---

## 6. Accessibility wrappers (T4-A)

Interactive charts now wrap the SVG with two accessibility layers.

### `withAriaLive`

Adds a `<div aria-live="polite">` sibling that announces hover state to screen
readers.

```ts
// View return — before
return svgRoot(h, config, handleKeyDown, children);

// After
return withAriaLive(h, svgRoot(h, config, handleKeyDown, children), liveText);
// where liveText = activeBar ? `${activeBar.label}: ${activeBar.value}` : ''
```

### `withAccessibleTable`

Wraps the chart with a visually-hidden `<table>` so screen readers can read all
data without interacting with the SVG.

```ts
return withAccessibleTable(
  h,
  withAriaLive(h, svgRoot(...), liveText),
  ariaLabel,           // caption
  ['Label', 'Value'],  // column headers
  bars.map(b => [b.label, String(b.value)]),  // rows
);
```

`srOnly(h, text)` is also available for arbitrary screen-reader-only inline text.

---

## 7. `svgRoot` — title + desc for screen readers

`svgRoot` now renders `<title>` and `<desc>` SVG children derived from
`ariaLabel` and uses `role="application"` + `aria-roledescription="interactive
chart"` on interactive charts.  Pass `interactive: true` in the config object:

```ts
svgRoot(h, { width: W, height: H, ariaLabel, interactive: true }, handleKeyDown, children)
```

---

## 8. Multi-series scheme defaults (P5)

`streamgraph-chart`, `chord-chart`, and `sankey-chart` now accept a `scheme`
override in `InitConfig`:

```ts
StreamgraphChart.init({
  series,
  scheme: ['#f00', '#0f0', '#00f'],  // optional — defaults to tableau10
});
```

Explicit `color` fields on individual series/nodes still take precedence.
