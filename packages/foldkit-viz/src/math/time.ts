// D3 parity: d3-scale scaleTime + d3-time timeTicks
// Functional API — no method chaining.

// ── Duration constants (ms) ───────────────────────────────────────────────────

const MS_SECOND = 1_000;
const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;
const MS_WEEK = 604_800_000;
const MS_MONTH = 2_592_000_000; // 30 days (approximate, used for interval selection only)
const MS_YEAR = 31_536_000_000; // 365 days

// ── Tick interval table ───────────────────────────────────────────────────────
// Each entry: [unit, step, approx_duration_ms]

type TimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
type TickInterval = readonly [TimeUnit, number, number];

const TICK_INTERVALS: ReadonlyArray<TickInterval> = [
  ['second',  1,       MS_SECOND],
  ['second',  5,   5 * MS_SECOND],
  ['second', 15,  15 * MS_SECOND],
  ['second', 30,  30 * MS_SECOND],
  ['minute',  1,       MS_MINUTE],
  ['minute',  5,   5 * MS_MINUTE],
  ['minute', 15,  15 * MS_MINUTE],
  ['minute', 30,  30 * MS_MINUTE],
  ['hour',    1,       MS_HOUR],
  ['hour',    3,   3 * MS_HOUR],
  ['hour',    6,   6 * MS_HOUR],
  ['hour',   12,  12 * MS_HOUR],
  ['day',     1,       MS_DAY],
  ['day',     2,   2 * MS_DAY],
  ['week',    1,       MS_WEEK],
  ['month',   1,       MS_MONTH],
  ['month',   3,   3 * MS_MONTH],
  ['year',    1,       MS_YEAR],
];

// ── Floor helpers (local time) ────────────────────────────────────────────────

function floorSecond(d: Date, step: number): Date {
  const t = Math.floor(+d / (step * MS_SECOND)) * (step * MS_SECOND);
  return new Date(t);
}
function stepSecond(d: Date, step: number): Date {
  return new Date(+d + step * MS_SECOND);
}

function floorMinute(d: Date, step: number): Date {
  const t = Math.floor(+d / (step * MS_MINUTE)) * (step * MS_MINUTE);
  return new Date(t);
}
function stepMinute(d: Date, step: number): Date {
  return new Date(+d + step * MS_MINUTE);
}

function floorHour(d: Date, step: number): Date {
  const t = Math.floor(+d / (step * MS_HOUR)) * (step * MS_HOUR);
  return new Date(t);
}
function stepHour(d: Date, step: number): Date {
  return new Date(+d + step * MS_HOUR);
}

function floorDay(d: Date, step: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), Math.floor(d.getDate() / step) * step || 1);
}
function stepDay(d: Date, step: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + step);
}

function floorWeek(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}
function stepWeek(d: Date, step: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * step);
}

function floorMonth(d: Date, step: number): Date {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / step) * step, 1);
}
function stepMonth(d: Date, step: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + step, 1);
}

function floorYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}
function stepYear(d: Date, step: number): Date {
  return new Date(d.getFullYear() + step, 0, 1);
}

function generateTicks(start: Date, stop: Date, unit: TimeUnit, step: number): Date[] {
  const ticks: Date[] = [];
  let cur: Date;

  switch (unit) {
    case 'second': cur = floorSecond(start, step); break;
    case 'minute': cur = floorMinute(start, step); break;
    case 'hour':   cur = floorHour(start, step);   break;
    case 'day':    cur = floorDay(start, step);    break;
    case 'week':   cur = floorWeek(start);         break;
    case 'month':  cur = floorMonth(start, step);  break;
    case 'year':   cur = floorYear(start);         break;
  }

  // advance to >= start
  while (+cur < +start) {
    switch (unit) {
      case 'second': cur = stepSecond(cur, step); break;
      case 'minute': cur = stepMinute(cur, step); break;
      case 'hour':   cur = stepHour(cur, step);   break;
      case 'day':    cur = stepDay(cur, step);    break;
      case 'week':   cur = stepWeek(cur, step);   break;
      case 'month':  cur = stepMonth(cur, step);  break;
      case 'year':   cur = stepYear(cur, step);   break;
    }
  }

  while (+cur <= +stop) {
    ticks.push(new Date(+cur));
    switch (unit) {
      case 'second': cur = stepSecond(cur, step); break;
      case 'minute': cur = stepMinute(cur, step); break;
      case 'hour':   cur = stepHour(cur, step);   break;
      case 'day':    cur = stepDay(cur, step);    break;
      case 'week':   cur = stepWeek(cur, step);   break;
      case 'month':  cur = stepMonth(cur, step);  break;
      case 'year':   cur = stepYear(cur, step);   break;
    }
  }

  return ticks;
}

// ── Public: scaleTime ─────────────────────────────────────────────────────────

export type TimeScaleConfig = Readonly<{
  domain: readonly [Date, Date];
  range: readonly [number, number];
  clamp?: boolean;
}>;

export function scaleTime(config: TimeScaleConfig): (date: Date) => number {
  const [d0, d1] = config.domain;
  const [r0, r1] = config.range;
  const clamp = config.clamp ?? false;
  const k = (r1 - r0) / (+d1 - +d0);

  return (date: Date): number => {
    let t = (+date - +d0) * k + r0;
    if (clamp) t = r1 > r0 ? Math.max(r0, Math.min(r1, t)) : Math.max(r1, Math.min(r0, t));
    return t;
  };
}

// ── Public: timeTicks ─────────────────────────────────────────────────────────

export function timeTicks(
  domain: readonly [Date, Date],
  count = 10,
): ReadonlyArray<Date> {
  const [start, stop] = domain;
  const span = Math.abs(+stop - +start);
  const target = span / count;

  // Find the tick interval whose duration is closest to target
  let best: TickInterval = TICK_INTERVALS[TICK_INTERVALS.length - 1] as TickInterval;
  for (let i = 0; i < TICK_INTERVALS.length; i++) {
    const interval = TICK_INTERVALS[i] as TickInterval;
    const next = TICK_INTERVALS[i + 1] as TickInterval | undefined;
    if (!next || target <= interval[2] || target < Math.sqrt(interval[2] * next[2])) {
      best = interval;
      break;
    }
  }

  return generateTicks(start, stop, best[0], best[1]);
}

// ── Public: timeTickFormat ────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function timeTickFormat(date: Date): string {
  const ms = date.getMilliseconds();
  const s  = date.getSeconds();
  const m  = date.getMinutes();
  const h  = date.getHours();
  const D  = date.getDate();
  const M  = date.getMonth();

  if (ms !== 0) return `.${String(ms).padStart(3, '0')}`;
  if (s  !== 0) return `:${pad2(s)}`;
  if (m  !== 0 || h !== 0) return `${pad2(h)}:${pad2(m)}`;
  if (D  !== 1) return `${D} ${MONTHS_SHORT[M]}`;
  if (M  !== 0) return MONTHS_SHORT[M] as string;
  return String(date.getFullYear());
}

// ── Public: timeNice ──────────────────────────────────────────────────────────
// Expand domain to align with the best tick interval.

export function timeNice(
  domain: readonly [Date, Date],
  count = 10,
): readonly [Date, Date] {
  const [start, stop] = domain;
  const span = Math.abs(+stop - +start);
  const target = span / count;

  let unit: TimeUnit = 'year';
  let step = 1;
  for (let i = 0; i < TICK_INTERVALS.length; i++) {
    const interval = TICK_INTERVALS[i] as TickInterval;
    const next = TICK_INTERVALS[i + 1] as TickInterval | undefined;
    if (!next || target <= interval[2] || target < Math.sqrt(interval[2] * next[2])) {
      unit = interval[0];
      step = interval[1];
      break;
    }
  }

  let floor: Date;
  let ceil: Date;

  switch (unit) {
    case 'second': floor = floorSecond(start, step); ceil = stepSecond(floorSecond(stop, step), step); break;
    case 'minute': floor = floorMinute(start, step); ceil = stepMinute(floorMinute(stop, step), step); break;
    case 'hour':   floor = floorHour(start, step);   ceil = stepHour(floorHour(stop, step), step);     break;
    case 'day':    floor = floorDay(start, step);    ceil = stepDay(floorDay(stop, step), step);       break;
    case 'week':   floor = floorWeek(start);         ceil = stepWeek(floorWeek(stop), step);           break;
    case 'month':  floor = floorMonth(start, step);  ceil = stepMonth(floorMonth(stop, step), step);   break;
    case 'year':   floor = floorYear(start);         ceil = stepYear(floorYear(stop), step);           break;
  }

  return [floor, ceil];
}
