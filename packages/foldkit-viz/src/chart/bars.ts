import { band, linear } from '../math/scale.js';
import { axisTicks, chartLayout, finiteCoordinate, resolveDomain } from './layout.js';
import type { AxisTick, ChartFrame, Domain, PlotBounds } from './layout.js';

export type BarAccessors<T> = Readonly<{
  key: (datum: T, index: number) => string;
  category: (datum: T, index: number) => string;
  series: (datum: T, index: number) => string;
  value: (datum: T, index: number) => number;
}>;
export type BarConfig = Readonly<{
  frame: ChartFrame;
  mode: 'grouped' | 'stacked';
  orientation: 'vertical' | 'horizontal';
  padding?: number;
  valueDomain?: Domain;
  tickCount?: number;
}>;
export type BarRectangle<T> = Readonly<{
  datum: T;
  key: string;
  category: string;
  series: string;
  value: number;
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
}>;
export type BarGeometry<T> = Readonly<{
  bars: ReadonlyArray<BarRectangle<T>>;
  categories: ReadonlyArray<Readonly<{ key: string; position: number }>>;
  series: ReadonlyArray<string>;
  ticks: ReadonlyArray<AxisTick>;
  domain: Domain;
  plot: PlotBounds;
  baseline: number;
  frame: ChartFrame;
}>;

/** Nested band scales follow d3-main/d3-scale/src/band.js.
 * Stacking uses d3-shape's zero-baseline accumulation, separated by sign
 * (d3-main/d3-shape/src/offset/diverging.js). No rendering or colour policy.
 * Duplicate category/series pairs are rejected: aggregate your rows explicitly.
 */
export function barGeometry<T>(
  data: ReadonlyArray<T>,
  accessors: BarAccessors<T>,
  config: BarConfig,
): BarGeometry<T> {
  const padding = config.padding ?? 0.2;
  if (!Number.isFinite(padding) || padding < 0 || padding >= 1)
    throw new RangeError('Bar padding must be finite in [0, 1)');
  const keys = new Set<string>();
  const pairs = new Map<string, Set<string>>();
  const totals = new Map<string, { positive: number; negative: number }>();
  const samples = data.map((datum, index) => {
    const key = accessors.key(datum, index),
      category = accessors.category(datum, index),
      series = accessors.series(datum, index),
      value = accessors.value(datum, index);
    if (keys.has(key)) throw new RangeError(`Duplicate datum key: ${key}`);
    keys.add(key);
    if (!Number.isFinite(value)) throw new RangeError('Bar values must be finite');
    const categoryPairs = pairs.get(category) ?? new Set<string>();
    if (categoryPairs.has(series))
      throw new RangeError(`Duplicate category/series pair: ${category}/${series}`);
    categoryPairs.add(series);
    pairs.set(category, categoryPairs);
    return { datum, key, category, series, value, start: 0, end: value };
  });
  const categoryKeys = [...new Set(samples.map((d) => d.category))];
  const seriesKeys = [...new Set(samples.map((d) => d.series))];
  const seriesOrder = new Map(seriesKeys.map((key, index) => [key, index]));
  // Only internal samples are mutated. Caller data and returned datum order stay intact.
  if (config.mode === 'stacked')
    for (const sample of [...samples].sort(
      (a, b) => (seriesOrder.get(a.series) ?? 0) - (seriesOrder.get(b.series) ?? 0),
    )) {
      const total = totals.get(sample.category) ?? { positive: 0, negative: 0 };
      sample.start = sample.value < 0 ? total.negative : total.positive;
      sample.end = finiteCoordinate(sample.start + sample.value);
      if (sample.value < 0) total.negative = sample.end;
      else total.positive = sample.end;
      totals.set(sample.category, total);
    }
  const endpoints = samples.flatMap((d) => [d.start, d.end]);
  const domain = resolveDomain(endpoints, config.valueDomain, true);
  if (
    domain[0] > 0 ||
    domain[1] < 0 ||
    domain[0] >= domain[1] ||
    endpoints.some((v) => v < domain[0] || v > domain[1])
  )
    throw new RangeError('Bar domain must increase, include zero and contain all endpoints');
  const { plot } = chartLayout(config.frame, domain, domain);
  const vertical = config.orientation === 'vertical';
  const categoryScale = band({
    domain: categoryKeys,
    range: vertical ? [plot.left, plot.right] : [plot.top, plot.bottom],
    paddingInner: padding,
    paddingOuter: padding / 2,
  });
  const seriesScale = band({
    domain: seriesKeys,
    range: [0, categoryScale.bandwidth],
    paddingInner: padding / 2,
  });
  const valueScale = linear({
    domain,
    range: vertical ? [plot.bottom, plot.top] : [plot.left, plot.right],
  });
  const thickness = config.mode === 'grouped' ? seriesScale.bandwidth : categoryScale.bandwidth;
  const bars = samples.map((d) => {
    const categoryPosition =
      categoryScale.position(d.category) +
      (config.mode === 'grouped' ? seriesScale.position(d.series) : 0);
    const start = valueScale(d.start),
      end = valueScale(d.end);
    return {
      ...d,
      x: finiteCoordinate(vertical ? categoryPosition : Math.min(start, end)),
      y: finiteCoordinate(vertical ? Math.min(start, end) : categoryPosition),
      width: finiteCoordinate(vertical ? thickness : Math.abs(end - start)),
      height: finiteCoordinate(vertical ? Math.abs(end - start) : thickness),
    };
  });
  return {
    bars,
    categories: categoryKeys.map((key) => ({
      key,
      position: categoryScale.position(key) + categoryScale.bandwidth / 2,
    })),
    series: seriesKeys,
    ticks: axisTicks(domain, valueScale, config.tickCount),
    domain,
    plot,
    baseline: valueScale(0),
    frame: config.frame,
  };
}
