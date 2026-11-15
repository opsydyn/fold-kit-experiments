import { siFormat } from '../math/format.js';
import { linear, linearTicks, log, scalePow, scaleSymlog } from '../math/scale.js';
import { timeTickFormat, timeTicks, utcTickFormat, utcTicks } from '../math/time.js';

export type Domain = readonly [number, number];
export type ChartMargins = Readonly<{ top: number; right: number; bottom: number; left: number }>;
export type ChartFrame = Readonly<{ width: number; height: number; margins: ChartMargins }>;

/**
 * How an axis maps data to position. Time values are epoch milliseconds. Time
 * axes default to UTC so a server and a browser in another zone agree on ticks
 * and labels; `zone: 'local'` opts into the viewer's zone.
 */
export type AxisScale =
  | Readonly<{ type: 'linear' }>
  | Readonly<{ type: 'log'; base?: number }>
  | Readonly<{ type: 'symlog'; constant?: number }>
  | Readonly<{ type: 'pow'; exponent: number }>
  | Readonly<{ type: 'time'; zone?: 'utc' | 'local' }>;

export type CartesianConfig = Readonly<{
  frame: ChartFrame;
  xDomain?: Domain;
  yDomain?: Domain;
  xScale?: AxisScale;
  yScale?: AxisScale;
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
  xScale: AxisScale;
  yScale: AxisScale;
  x: (value: number) => number;
  y: (value: number) => number;
}>;
/** `label` is the scale's default text for the tick; ticks built by hand may omit it. */
export type AxisTick = Readonly<{ value: number; position: number; label?: string }>;

const LINEAR: AxisScale = { type: 'linear' };

const logBase = (scale: Extract<AxisScale, { type: 'log' }>): number => {
  const base = scale.base ?? 10;
  if (!Number.isFinite(base) || base <= 0 || base === 1)
    throw new RangeError('Log axis base must be finite, positive and not one');
  return base;
};

function validateScale(scale: AxisScale): AxisScale {
  switch (scale.type) {
    case 'log':
      logBase(scale);
      break;
    case 'symlog':
      if (scale.constant !== undefined && (!Number.isFinite(scale.constant) || scale.constant <= 0))
        throw new RangeError('Symlog axis constant must be finite and positive');
      break;
    case 'pow':
      if (!Number.isFinite(scale.exponent) || scale.exponent === 0)
        throw new RangeError('Power axis exponent must be finite and non-zero');
      break;
    default:
      break;
  }
  return scale;
}

/** Whether a value can be placed on the axis. Log axes take positive values only. */
export function acceptsValue(scale: AxisScale, value: number): boolean {
  return Number.isFinite(value) && (scale.type !== 'log' || value > 0);
}

export function validateDomain(domain: Domain): Domain {
  if (!domain.every(Number.isFinite) || !Number.isFinite(domain[1] - domain[0]))
    throw new RangeError('Chart domain must have finite endpoints and span');
  return domain;
}

function validateScaleDomain(domain: Domain, scale: AxisScale): Domain {
  validateDomain(domain);
  if (scale.type === 'log' && !(domain[0] > 0 && domain[1] > 0))
    throw new RangeError('Log axis domain must be positive');
  return domain;
}

/** Automatic extent policy; explicit domains retain direction and equal endpoints. */
export function resolveDomain(
  values: ReadonlyArray<number>,
  explicit?: Domain,
  includeZero = false,
  scale: AxisScale = LINEAR,
): Domain {
  validateScale(scale);
  if (scale.type === 'log' && includeZero) throw new RangeError('A log axis cannot include zero');
  if (explicit !== undefined) return validateScaleDomain(explicit, scale);
  const accepted = values.filter((value) => acceptsValue(scale, value));
  if (scale.type === 'log') {
    const base = logBase(scale);
    if (accepted.length === 0) return [1, base];
    let lo = Number.POSITIVE_INFINITY,
      hi = Number.NEGATIVE_INFINITY;
    for (const value of accepted) {
      if (value < lo) lo = value;
      if (value > hi) hi = value;
    }
    return validateScaleDomain(lo === hi ? [lo / base, lo * base] : [lo, hi], scale);
  }
  if (accepted.length === 0) return [0, 1];
  let lo = includeZero ? 0 : Infinity;
  let hi = includeZero ? 0 : -Infinity;
  for (const value of accepted) {
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

function projection(scale: AxisScale, domain: Domain, range: Domain): (value: number) => number {
  // Every scale maps equal endpoints to the middle of the range, as linear does.
  if (domain[0] === domain[1] && scale.type !== 'linear') {
    const middle = (range[0] + range[1]) / 2;
    return () => middle;
  }
  switch (scale.type) {
    case 'linear':
    case 'time':
      return linear({ domain, range });
    case 'log':
      return log({ domain, range, base: logBase(scale) });
    case 'symlog':
      return scaleSymlog({ domain, range, constant: scale.constant ?? 1 });
    case 'pow':
      return scalePow({ domain, range, exponent: scale.exponent });
  }
}

export function chartLayout(
  frame: ChartFrame,
  xDomain: Domain,
  yDomain: Domain,
  scales: Readonly<{ x?: AxisScale; y?: AxisScale }> = {},
): CartesianLayout {
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
  const xScale = validateScale(scales.x ?? LINEAR);
  const yScale = validateScale(scales.y ?? LINEAR);
  return {
    frame,
    plot,
    xDomain: validateScaleDomain(xDomain, xScale),
    yDomain: validateScaleDomain(yDomain, yScale),
    xScale,
    yScale,
    x: projection(xScale, xDomain, [plot.left, plot.right]),
    y: projection(yScale, yDomain, [plot.bottom, plot.top]),
  };
}

/** Beyond this many decimals, labels switch to exponent notation, such as "2e-9". */
const MAX_FIXED_DECIMALS = 6;

/**
 * Fixed decimals from the tick step, grouped the same way on every machine.
 * A finer step gives exponent labels, with enough significant digits that
 * neighbouring ticks stay distinct.
 */
function linearLabels(values: ReadonlyArray<number>): ReadonlyArray<string> {
  const step = values.length > 1 ? Math.abs((values[1] ?? 0) - (values[0] ?? 0)) : 0;
  const decimals = step > 0 ? Math.max(0, -Math.floor(Math.log10(step) + 1e-12)) : 0;
  if (decimals > MAX_FIXED_DECIMALS) {
    const largest = Math.max(...values.map(Math.abs));
    const digits = Math.min(
      20,
      Math.max(0, Math.floor(Math.log10(largest) + 1e-12) - Math.floor(Math.log10(step) + 1e-12)),
    );
    // toExponential writes "2e-9"; any trailing zeros it pads with are dropped.
    return values.map((value) =>
      value === 0
        ? '0'
        : value
            .toExponential(digits)
            .replace(/\.?0+e/, 'e')
            .replace('e+', 'e'),
    );
  }
  return values.map((value) => {
    const text = value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    // Rounding can leave a negative zero, such as "-0.0".
    return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text;
  });
}

/** Powers of the base, or whole multiples of them when fewer than two powers fit. */
function logTickValues(lo: number, hi: number, base: number): ReadonlyArray<number> {
  const e0 = Math.floor(Math.log(lo) / Math.log(base));
  const e1 = Math.ceil(Math.log(hi) / Math.log(base));
  const powers: number[] = [];
  for (let e = e0; e <= e1; e += 1) {
    const value = base ** e;
    if (value >= lo && value <= hi) powers.push(value);
  }
  if (powers.length >= 2 || base < 2) return powers;
  const multiples: number[] = [];
  for (let e = e0; e <= e1; e += 1)
    for (let k = 1; k < base; k += 1) {
      const value = k * base ** e;
      if (value >= lo && value <= hi) multiples.push(value);
    }
  return multiples;
}

function tickValues(domain: Domain, count: number, scale: AxisScale): ReadonlyArray<number> {
  const [start, end] = domain;
  if (start === end) return [start];
  const lo = Math.min(start, end),
    hi = Math.max(start, end);
  let values: ReadonlyArray<number>;
  switch (scale.type) {
    case 'log':
      values = logTickValues(lo, hi, logBase(scale));
      break;
    case 'time': {
      const dates: readonly [Date, Date] = [new Date(lo), new Date(hi)];
      values = (scale.zone === 'local' ? timeTicks(dates, count) : utcTicks(dates, count)).map(
        (date) => date.getTime(),
      );
      break;
    }
    default:
      values = linearTicks([lo, hi], count);
  }
  return start < end ? values : [...values].reverse();
}

function tickLabels(values: ReadonlyArray<number>, scale: AxisScale): ReadonlyArray<string> {
  switch (scale.type) {
    case 'log': {
      const base = logBase(scale);
      const isPower = (value: number): boolean =>
        base ** Math.round(Math.log(value) / Math.log(base)) === value;
      return values.map((value) => (isPower(value) ? siFormat(value) : ''));
    }
    case 'time':
      return values.map((value) =>
        scale.zone === 'local' ? timeTickFormat(new Date(value)) : utcTickFormat(new Date(value)),
      );
    default:
      return linearLabels(values);
  }
}

export function axisTicks(
  domain: Domain,
  project: (value: number) => number,
  count = 5,
  scale: AxisScale = LINEAR,
): ReadonlyArray<AxisTick> {
  if (!Number.isInteger(count) || count < 2)
    throw new RangeError('Chart tick count must be an integer of at least two');
  validateScale(scale);
  const values = tickValues(domain, count, scale);
  const labels = tickLabels(values, scale);
  return values.map((value, index) => ({
    value,
    position: finiteCoordinate(project(value)),
    label: labels[index] ?? '',
  }));
}

export function finiteCoordinate(value: number): number {
  if (!Number.isFinite(value))
    throw new RangeError('Chart coordinate must be finite; check domain and datum magnitude');
  return value;
}
