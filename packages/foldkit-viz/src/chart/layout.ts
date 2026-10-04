import { linear, linearTicks } from '../math/scale.js';

export type Domain = readonly [number, number];
export type ChartMargins = Readonly<{ top: number; right: number; bottom: number; left: number }>;
export type ChartFrame = Readonly<{ width: number; height: number; margins: ChartMargins }>;
export type CartesianConfig = Readonly<{
  frame: ChartFrame;
  xDomain?: Domain;
  yDomain?: Domain;
  xTickCount?: number;
  yTickCount?: number;
  includeZero?: Readonly<{ x: boolean; y: boolean }>;
}>;
export type PlotBounds = Readonly<{
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}>;
export type CartesianLayout = Readonly<{
  frame: ChartFrame;
  plot: PlotBounds;
  xDomain: Domain;
  yDomain: Domain;
  x: (value: number) => number;
  y: (value: number) => number;
}>;
export type AxisTick = Readonly<{ value: number; position: number }>;

export function validateDomain(domain: Domain): Domain {
  if (!domain.every(Number.isFinite) || !Number.isFinite(domain[1] - domain[0]))
    throw new RangeError('Chart domain must have finite endpoints and span');
  return domain;
}

/** Automatic extent policy; explicit domains retain direction and equal endpoints. */
export function resolveDomain(
  values: ReadonlyArray<number>,
  explicit?: Domain,
  includeZero = false,
): Domain {
  if (explicit !== undefined) return validateDomain(explicit);
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [0, 1];
  let lo = includeZero ? 0 : Infinity;
  let hi = includeZero ? 0 : -Infinity;
  for (const value of finite) {
    lo = Math.min(lo, value);
    hi = Math.max(hi, value);
  }
  if (lo === hi) {
    const padding = Math.max(Math.abs(lo) * 0.1, 1);
    lo -= padding;
    hi += padding;
  }
  return validateDomain([lo, hi]);
}

export function chartLayout(frame: ChartFrame, xDomain: Domain, yDomain: Domain): CartesianLayout {
  const { width, height, margins } = frame;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new RangeError('Chart frame dimensions must be finite and positive');
  if (!Object.values(margins).every((v) => Number.isFinite(v) && v >= 0))
    throw new RangeError('Chart margins must be finite and non-negative');
  const plot = {
    left: margins.left,
    right: width - margins.right,
    top: margins.top,
    bottom: height - margins.bottom,
    width: width - margins.left - margins.right,
    height: height - margins.top - margins.bottom,
  };
  if (plot.width <= 0 || plot.height <= 0)
    throw new RangeError('Chart frame margins must leave positive plot space');
  return {
    frame,
    plot,
    xDomain: validateDomain(xDomain),
    yDomain: validateDomain(yDomain),
    x: linear({ domain: xDomain, range: [plot.left, plot.right] }),
    y: linear({ domain: yDomain, range: [plot.bottom, plot.top] }),
  };
}

export function axisTicks(
  domain: Domain,
  project: (value: number) => number,
  count = 5,
): ReadonlyArray<AxisTick> {
  if (!Number.isInteger(count) || count < 2)
    throw new RangeError('Chart tick count must be an integer of at least two');
  const [start, end] = domain;
  let values: ReadonlyArray<number>;
  if (start === end) values = [start];
  else if (start < end) values = linearTicks(domain, count);
  else values = [...linearTicks([end, start], count)].reverse();
  return values.map((value) => ({ value, position: finiteCoordinate(project(value)) }));
}

export function finiteCoordinate(value: number): number {
  if (!Number.isFinite(value))
    throw new RangeError('Chart coordinate must be finite; check domain and datum magnitude');
  return value;
}
