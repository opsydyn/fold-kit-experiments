# Plot grammar — design

**Status:** approved for 0.19.0, 2026-11-13, under
[ADR 0037](../../adr/0037-a-declarative-grammar-of-marks-for-foldkit-viz.md).

## Spec

```ts
type Value = number | string | boolean | null;
type Row = Readonly<Record<string, Value>>;
/** A field name, or a constant. */
type Channel = string | Readonly<{ value: Value }>;

type PlotSpec = Readonly<{
  width: number;
  height: number;
  margins?: Partial<ChartMargins>; // defaults leave room for axes and labels
  title?: string;
  description?: string;
  data?: ReadonlyArray<Row>; // used by marks without their own data
  x?: PositionScaleSpec;
  y?: PositionScaleSpec;
  color?: ColorScaleSpec;
  r?: Readonly<{ range?: readonly [number, number] }>;
  facet?: Readonly<{ x?: string; y?: string }>;
  marks: ReadonlyArray<MarkSpec>;
}>;

type PositionScaleSpec = Readonly<{
  type?: 'linear' | 'log' | 'symlog' | 'pow' | 'time' | 'band';
  domain?: readonly [number, number] | ReadonlyArray<string>;
  label?: string;
  zero?: boolean;
  ticks?: number;
  grid?: boolean;
  base?: number;
  constant?: number;
  exponent?: number;
  zone?: 'utc' | 'local';
  padding?: number; // band scales
}>;

type ColorScaleSpec = Readonly<{
  type?: 'categorical' | 'sequential' | 'diverging';
  scheme?: string; // any scheme in math/schemes; defaults tableau10 and viridis
  domain?: readonly [number, number] | ReadonlyArray<string>;
  legend?: boolean; // default true when colour is mapped from a field
  label?: string;
}>;
```

### Marks

| Mark   | Channels                     | Draws                                                                             |
| ------ | ---------------------------- | --------------------------------------------------------------------------------- |
| `dot`  | x, y, r, fill, stroke, title | a circle per row                                                                  |
| `line` | x, y, z, stroke, title       | one path per series (z, else stroke field)                                        |
| `area` | x, y, y0, z, fill            | one filled band per series; y0 defaults to 0                                      |
| `bar`  | x, y, fill, title            | bars from a band axis to the value; vertical when x is band, horizontal when y is |
| `rule` | x or y, stroke               | full-height vertical or full-width horizontal lines                               |
| `text` | x, y, text, fill             | labels                                                                            |
| `cell` | x, y, fill, title            | band-by-band rectangles (heatmaps)                                                |

Common options: `data`, `key` (field giving stable identity), `opacity`, `curve`
(`line`, `area`), `strokeWidth`, `transform`.

### Transforms

Applied to a mark's rows before its channels are read:

- `{ type: 'regression', degree?: number, band?: boolean, level?: number }` on
  `line`: the least-squares fit, with its confidence band drawn behind it.
- `{ type: 'loess', bandwidth?: number }` on `line`.
- `{ type: 'window', size, reduce, anchor? }` on `line` or `area`: smooths y.
- `{ type: 'downsample', method: 'm4' | 'lttb' }` on `line`: to the plot's pixel width.

## Inference

- **Type.** A position scale is `band` when its channel values are strings, `time`
  when they are ISO 8601 date strings or the spec says so, otherwise `linear`.
  Colour is `categorical` for strings and booleans, `sequential` for numbers.
- **Domain.** Continuous: the extent of every mark's values, including zero for bar
  and area values unless `zero: false`. Band: first-seen order across marks.
- **Shared.** Every facet shares every scale.
- **Labels.** An axis label defaults to the field name when all marks agree on it.

## Output

`compilePlot(spec)` returns `PlotGeometry`: the frame, plus for each facet its plot
bounds, axes (ticks with labels), grid lines and positioned marks:
circles, paths, rectangles, lines and texts, each with resolved paint, a stable key
and its tooltip text. It also returns the legends. `foldkit/plot` renders that geometry
as one accessible SVG with a legend and an optional data table.

## Errors

Every rejection is a `RangeError` naming the spec path: unknown mark, missing field,
a channel a mark does not take, a band axis given numbers, a log axis given
non-positive values, an unknown scheme, a transform on a mark that cannot take it.

## Out of scope for this slice

Interaction, a published JSON Schema, geo and hierarchy marks, and the demo
promotions beyond rebuilding the data-science page as specs.
