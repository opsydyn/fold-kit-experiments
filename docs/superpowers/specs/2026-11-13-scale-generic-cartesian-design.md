# Scale-generic Cartesian layer — design

**Status:** approved for 0.18.0, 2026-11-13. First item of the
[data-science release track](../../roadmap.md#viz-data-science-release-track--2026-11-13).

## Problem

`chartLayout` hard-codes linear x and y scales, so `scatterGeometry`,
`lineGeometry`, `intervalBandGeometry` and `errorBarGeometry` cannot draw log,
symlog, power or time axes. The scales already exist in `math/scale` and
`math/time`; only the chart layer cannot use them. Consumers fake time axes with
epoch milliseconds and hand-built ticks, as the web app's Evolution demo does.

`timeTicks` and `timeTickFormat` also use local time only. A chart rendered on a
UTC server and hydrated in a browser in another zone gets different ticks and
labels.

## API

Every addition is optional, so existing configurations behave exactly as before.
`AxisTick.label` is optional too: code that builds ticks by hand keeps compiling,
while `axisTicks` always fills it in.

```ts
export type AxisScale =
  | Readonly<{ type: 'linear' }>
  | Readonly<{ type: 'log'; base?: number }> // default base 10
  | Readonly<{ type: 'symlog'; constant?: number }> // default constant 1
  | Readonly<{ type: 'pow'; exponent: number }> // 0.5 is a square-root scale
  | Readonly<{ type: 'time'; zone?: 'utc' | 'local' }>; // default 'utc'

CartesianConfig  += { xScale?: AxisScale; yScale?: AxisScale }  // default linear
CartesianLayout  += { xScale: AxisScale; yScale: AxisScale }
AxisTick         += { label?: string }  // always set by axisTicks
chartLayout(frame, xDomain, yDomain, scales?: { x?: AxisScale; y?: AxisScale })
resolveDomain(values, explicit?, includeZero?, scale?)
axisTicks(domain, project, count?, scale?)
AxisOptions.format becomes optional; without it the axis draws `tick.label`.
math/time adds utcTicks and utcTickFormat beside the local functions.
```

Time values stay numbers, epoch milliseconds, so accessors keep one numeric
signature. `new Date(ms)` recovers the instant.

## Behaviour per scale

| Scale  | Accepted values                      | Automatic domain                                                     | Ticks                                                                   | Default labels                                      |
| ------ | ------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| linear | finite                               | as today                                                             | `linearTicks`                                                           | fixed decimals from the tick step, `en-US` grouping |
| pow    | finite (sign kept)                   | as today                                                             | `linearTicks`                                                           | as linear                                           |
| symlog | finite, including zero and negatives | as today                                                             | `linearTicks`                                                           | as linear                                           |
| log    | finite and positive                  | extent of positive values; a single value spans one base either side | each power of the base, or 1–9 multiples when fewer than two powers fit | SI notation on powers, empty on multiples           |
| time   | finite epoch ms                      | as today                                                             | calendar ticks in the chosen zone                                       | `utcTickFormat` or `timeTickFormat`                 |

- A log axis omits non-positive values exactly as every axis omits non-finite
  values: no point is projected and a line breaks. Explicit log domains must be
  positive, and `includeZero` on a log axis is rejected with a `RangeError`.
- An explicit domain with equal endpoints projects to the middle of the range on
  every scale, as linear already does.
- Labels are deterministic: no runtime locale or time zone reaches them except an
  explicit `zone: 'local'`.

## Out of scope

- Band and point (categorical) axes. Categories already work through
  `chart/bars`; the grammar layer in 0.19.0 unifies them.
- `histogramGeometry` stays linear: log-spaced bins need their own thresholds.
- Nice domains, axis breaks and secondary axes.

## Verification

Test-first, in `packages/foldkit-viz/test/cartesian-scales.test.ts` and
`time-utc.test.ts`:

- Unchanged default output for linear configurations, with labels added.
- Log projection, omission of non-positive values, line breaks, rejected zero
  domains, and multiples on narrow domains.
- Symlog symmetry through zero, and power projection matching `sqrt`.
- UTC ticks on UTC boundaries with UTC labels, independent of the test machine's
  zone; local time unchanged.
- The FoldKit `axis` adapter drawing tick labels when no `format` is given.
