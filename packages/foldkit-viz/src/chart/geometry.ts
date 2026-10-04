import { bin } from '../math/bin.js';
import { line } from '../shape/line.js';
import type { CurveType } from '../shape/line.js';
import { axisTicks, chartLayout, finiteCoordinate, resolveDomain } from './layout.js';
import type { AxisTick, CartesianConfig, CartesianLayout, ChartFrame, Domain } from './layout.js';

export type DatumAccessors<T> = Readonly<{
  x: (datum: T, index: number) => number;
  y: (datum: T, index: number) => number;
  datumKey: (datum: T, index: number) => string;
  seriesKey: (datum: T, index: number) => string;
}>;
export type ProjectedDatum<T> = Readonly<{
  datum: T;
  key: string;
  seriesKey: string;
  x: number;
  y: number;
}>;
export type ScatterGeometry<T> = Readonly<{
  layout: CartesianLayout;
  points: ReadonlyArray<ProjectedDatum<T>>;
  xTicks: ReadonlyArray<AxisTick>;
  yTicks: ReadonlyArray<AxisTick>;
}>;
export type LineGeometry<T> = ScatterGeometry<T> &
  Readonly<{
    series: ReadonlyArray<
      Readonly<{ key: string; path: string; points: ReadonlyArray<ProjectedDatum<T>> }>
    >;
  }>;
export type LineGeometryConfig<T> = CartesianConfig &
  Readonly<{ curve?: CurveType; defined?: (datum: T, index: number) => boolean }>;
type Sample<T> = Readonly<{
  datum: T;
  key: string;
  seriesKey: string;
  x: number;
  y: number;
  defined: boolean;
}>;

function samples<T>(
  data: ReadonlyArray<T>,
  accessors: DatumAccessors<T>,
  defined?: (datum: T, index: number) => boolean,
): ReadonlyArray<Sample<T>> {
  const keys = new Set<string>();
  return data.map((datum, index) => {
    const key = accessors.datumKey(datum, index);
    if (keys.has(key)) throw new RangeError(`Duplicate datum key: ${key}`);
    keys.add(key);
    const x = accessors.x(datum, index),
      y = accessors.y(datum, index);
    return {
      datum,
      key,
      seriesKey: accessors.seriesKey(datum, index),
      x,
      y,
      defined: Number.isFinite(x) && Number.isFinite(y) && (defined?.(datum, index) ?? true),
    };
  });
}

function project<T>(data: ReadonlyArray<Sample<T>>, config: CartesianConfig): ScatterGeometry<T> {
  const finite = data.filter((d) => d.defined);
  const layout = chartLayout(
    config.frame,
    resolveDomain(
      finite.map((d) => d.x),
      config.xDomain,
      config.includeZero?.x,
    ),
    resolveDomain(
      finite.map((d) => d.y),
      config.yDomain,
      config.includeZero?.y,
    ),
  );
  return {
    layout,
    points: finite.map((d) => ({
      datum: d.datum,
      key: d.key,
      seriesKey: d.seriesKey,
      x: finiteCoordinate(layout.x(d.x)),
      y: finiteCoordinate(layout.y(d.y)),
    })),
    xTicks: axisTicks(layout.xDomain, layout.x, config.xTickCount),
    yTicks: axisTicks(layout.yDomain, layout.y, config.yTickCount),
  };
}

export function scatterGeometry<T>(
  data: ReadonlyArray<T>,
  accessors: DatumAccessors<T>,
  config: CartesianConfig,
): ScatterGeometry<T> {
  return project(samples(data, accessors), config);
}

export function lineGeometry<T>(
  data: ReadonlyArray<T>,
  accessors: DatumAccessors<T>,
  config: LineGeometryConfig<T>,
): LineGeometry<T> {
  const raw = samples(data, accessors, config.defined);
  const geometry = project(raw, config);
  const byKey = new Map(geometry.points.map((point) => [point.key, point]));
  const groups = new Map<string, Array<Sample<T>>>();
  for (const datum of raw) {
    const group = groups.get(datum.seriesKey) ?? [];
    group.push(datum);
    groups.set(datum.seriesKey, group);
  }
  const series = Array.from(groups, ([key, group]) => {
    const points: Array<ProjectedDatum<T>> = [];
    const coordinates: Array<readonly [number, number]> = [];
    for (const datum of group) {
      const point = byKey.get(datum.key);
      if (point === undefined) coordinates.push([NaN, NaN]);
      else {
        points.push(point);
        coordinates.push([point.x, point.y]);
      }
    }
    return {
      key,
      points,
      path:
        line(coordinates, {
          curve: config.curve,
          defined: (p) => Number.isFinite(p[0]) && Number.isFinite(p[1]),
        }) ?? '',
    };
  });
  return { ...geometry, series };
}

export type HistogramConfig = Readonly<{
  frame: ChartFrame;
  domain?: Domain;
  gap?: number;
  xTickCount?: number;
  yTickCount?: number;
}> &
  (
    | Readonly<{ binCount: number; thresholds?: never }>
    | Readonly<{ thresholds: ReadonlyArray<number>; binCount?: never }>
  );
export type HistogramBin<T> = Readonly<{
  key: string;
  x0: number;
  x1: number;
  count: number;
  values: ReadonlyArray<T>;
  x: number;
  y: number;
  width: number;
  height: number;
}>;
export type HistogramGeometry<T> = Readonly<{
  layout: CartesianLayout;
  bins: ReadonlyArray<HistogramBin<T>>;
  xTicks: ReadonlyArray<AxisTick>;
  yTicks: ReadonlyArray<AxisTick>;
}>;

export function histogramGeometry<T>(
  data: ReadonlyArray<T>,
  value: (datum: T) => number,
  config: HistogramConfig,
): HistogramGeometry<T> {
  const raw = data
    .map((datum) => ({ datum, value: value(datum) }))
    .filter((d) => Number.isFinite(d.value));
  const domain = resolveDomain(
    raw.map((d) => d.value),
    config.domain,
  );
  const lo = Math.min(...domain),
    hi = Math.max(...domain);
  const gap = config.gap ?? 0;
  if (!Number.isFinite(gap) || gap < 0)
    throw new RangeError('Histogram gap must be finite and non-negative');
  let thresholds: ReadonlyArray<number>;
  if (config.binCount !== undefined) {
    if (!Number.isInteger(config.binCount) || config.binCount <= 0)
      throw new RangeError('Histogram bin count must be a positive integer');
    thresholds = Array.from(
      { length: config.binCount - 1 },
      (_, i) => lo + (hi - lo) * ((i + 1) / config.binCount),
    );
  } else {
    thresholds = config.thresholds;
    if (
      !thresholds.every(
        (t, i) => Number.isFinite(t) && (i === 0 || t > (thresholds[i - 1] ?? -Infinity)),
      )
    )
      throw new RangeError('Histogram thresholds must be finite and strictly increasing');
  }
  const buckets =
    raw.length === 0 ? [] : bin(raw, { domain: [lo, hi], value: (d) => d.value, thresholds });
  const maxCount = buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0);
  const layout = chartLayout(config.frame, domain, [0, Math.max(1, maxCount)]);
  const bins = buckets.map((bucket) => {
    const left = finiteCoordinate(Math.min(layout.x(bucket.x0), layout.x(bucket.x1)));
    const right = finiteCoordinate(Math.max(layout.x(bucket.x0), layout.x(bucket.x1)));
    const y = finiteCoordinate(layout.y(bucket.count));
    return {
      key: `${bucket.x0}:${bucket.x1}`,
      x0: bucket.x0,
      x1: bucket.x1,
      count: bucket.count,
      values: bucket.values.map((d) => d.datum),
      x: left,
      y,
      width: Math.max(0, right - left - gap),
      height: finiteCoordinate(layout.y(0) - y),
    };
  });
  return {
    layout,
    bins,
    xTicks: axisTicks(domain, layout.x, config.xTickCount),
    yTicks: axisTicks(layout.yDomain, layout.y, config.yTickCount),
  };
}
