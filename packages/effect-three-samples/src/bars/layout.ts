import type { Vec3 } from '@opsydyn/effect-three';
/**
 * Pure chart geometry: foldkit-viz scales (D3 parity) map months, series and values to
 * world units. Bars are a unit box scaled to size, so a change in value is a change in
 * position and scale, which the scene eases.
 */
import { band, linear, linearTicks, niceLinear } from '@opsydyn/foldkit-viz/math/scale';

import { totalOf, type Values } from './data';
import {
  type Bar,
  isShown,
  type Model,
  type Month,
  months,
  type Series,
  seriesList,
} from './model';

/** World size of the plot: width (months), height (values) and depth (series). */
export const plot = { width: 7, height: 3.2, depth: 3 } as const;

/** Never scale a bar to zero: a degenerate matrix breaks lighting and hit testing. */
const flat = 0.001;

export type BarLayout = {
  readonly key: string;
  readonly bar: Bar;
  readonly value: number;
  readonly shown: boolean;
  readonly position: Vec3;
  readonly scale: Vec3;
};

export type Gridline = { readonly key: string; readonly value: number; readonly y: number };

export type ChartLayout = {
  readonly months: ReadonlyArray<Month>;
  readonly bars: ReadonlyArray<BarLayout>;
  readonly gridlines: ReadonlyArray<Gridline>;
  /** The value of one gridline step, for the caption. */
  readonly step: number;
};

export const barKey = (bar: Bar): string => `bar:${bar.month}:${bar.series}`;

/** Reads a bar back from its scene key. */
export const barOf = (key: string): Bar | undefined => {
  const [prefix, month, series] = key.split(':');
  const knownMonth = months.find((candidate) => candidate === month);
  const knownSeries = seriesList.find((candidate) => candidate === series);
  if (prefix !== 'bar' || knownMonth === undefined || knownSeries === undefined) return undefined;
  return { month: knownMonth, series: knownSeries };
};

export const orderedMonths = (model: Model, values: Values): ReadonlyArray<Month> => {
  if (model.order === 'calendar') return months;
  const shown = seriesList.filter((series) => isShown(model, series));
  return [...months].sort((a, b) => totalOf(values, b, shown) - totalOf(values, a, shown));
};

export const layoutFor = (model: Model, values: Values): ChartLayout => {
  const ordered = orderedMonths(model, values);
  const x = band({
    domain: ordered,
    range: [-plot.width / 2, plot.width / 2],
    paddingInner: 0.3,
    paddingOuter: 0.15,
  });
  const z = band({
    domain: seriesList,
    range: [-plot.depth / 2, plot.depth / 2],
    paddingInner: 0.55,
    paddingOuter: 0.15,
  });
  const shownValues = months.flatMap((month) =>
    seriesList.filter((series) => isShown(model, series)).map((series) => values[month][series]),
  );
  const domain = niceLinear([0, Math.max(1, ...shownValues)], 4);
  const y = linear({ domain, range: [0, plot.height] });
  const ticks = linearTicks(domain, 4);

  const barLayout = (month: Month, series: Series): BarLayout => {
    const value = values[month][series];
    const shown = isShown(model, series);
    const height = shown ? Math.max(flat, y(value)) : flat;
    return {
      key: barKey({ month, series }),
      bar: { month, series },
      value,
      shown,
      position: [
        x.position(month) + x.bandwidth / 2,
        height / 2,
        z.position(series) + z.bandwidth / 2,
      ],
      scale: [x.bandwidth, height, z.bandwidth],
    };
  };

  return {
    months: ordered,
    bars: months.flatMap((month) => seriesList.map((series) => barLayout(month, series))),
    gridlines: ticks
      .filter((value) => value > 0)
      .map((value) => ({ key: `grid:${value}`, value, y: y(value) })),
    step: (ticks[1] ?? 0) - (ticks[0] ?? 0),
  };
};
