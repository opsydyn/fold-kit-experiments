// D3 parity: d3-scale scaleTime + d3-time timeTicks + d3-time-format
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
  ['second', 1, MS_SECOND],
  ['second', 5, 5 * MS_SECOND],
  ['second', 15, 15 * MS_SECOND],
  ['second', 30, 30 * MS_SECOND],
  ['minute', 1, MS_MINUTE],
  ['minute', 5, 5 * MS_MINUTE],
  ['minute', 15, 15 * MS_MINUTE],
  ['minute', 30, 30 * MS_MINUTE],
  ['hour', 1, MS_HOUR],
  ['hour', 3, 3 * MS_HOUR],
  ['hour', 6, 6 * MS_HOUR],
  ['hour', 12, 12 * MS_HOUR],
  ['day', 1, MS_DAY],
  ['day', 2, 2 * MS_DAY],
  ['week', 1, MS_WEEK],
  ['month', 1, MS_MONTH],
  ['month', 3, 3 * MS_MONTH],
  ['year', 1, MS_YEAR],
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
    case 'second':
      cur = floorSecond(start, step);
      break;
    case 'minute':
      cur = floorMinute(start, step);
      break;
    case 'hour':
      cur = floorHour(start, step);
      break;
    case 'day':
      cur = floorDay(start, step);
      break;
    case 'week':
      cur = floorWeek(start);
      break;
    case 'month':
      cur = floorMonth(start, step);
      break;
    case 'year':
      cur = floorYear(start);
      break;
  }

  // advance to >= start
  while (+cur < +start) {
    switch (unit) {
      case 'second':
        cur = stepSecond(cur, step);
        break;
      case 'minute':
        cur = stepMinute(cur, step);
        break;
      case 'hour':
        cur = stepHour(cur, step);
        break;
      case 'day':
        cur = stepDay(cur, step);
        break;
      case 'week':
        cur = stepWeek(cur, step);
        break;
      case 'month':
        cur = stepMonth(cur, step);
        break;
      case 'year':
        cur = stepYear(cur, step);
        break;
    }
  }

  while (+cur <= +stop) {
    ticks.push(new Date(+cur));
    switch (unit) {
      case 'second':
        cur = stepSecond(cur, step);
        break;
      case 'minute':
        cur = stepMinute(cur, step);
        break;
      case 'hour':
        cur = stepHour(cur, step);
        break;
      case 'day':
        cur = stepDay(cur, step);
        break;
      case 'week':
        cur = stepWeek(cur, step);
        break;
      case 'month':
        cur = stepMonth(cur, step);
        break;
      case 'year':
        cur = stepYear(cur, step);
        break;
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

export function timeTicks(domain: readonly [Date, Date], count = 10): ReadonlyArray<Date> {
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

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function timeTickFormat(date: Date): string {
  const ms = date.getMilliseconds();
  const s = date.getSeconds();
  const m = date.getMinutes();
  const h = date.getHours();
  const D = date.getDate();
  const M = date.getMonth();

  if (ms !== 0) return `.${String(ms).padStart(3, '0')}`;
  if (s !== 0) return `:${pad2(s)}`;
  if (m !== 0 || h !== 0) return `${pad2(h)}:${pad2(m)}`;
  if (D !== 1) return `${D} ${MONTHS_SHORT[M]}`;
  if (M !== 0) return MONTHS_SHORT[M] as string;
  return String(date.getFullYear());
}

// ── Public: timeNice ──────────────────────────────────────────────────────────
// Expand domain to align with the best tick interval.

export function timeNice(domain: readonly [Date, Date], count = 10): readonly [Date, Date] {
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
    case 'second':
      floor = floorSecond(start, step);
      ceil = stepSecond(floorSecond(stop, step), step);
      break;
    case 'minute':
      floor = floorMinute(start, step);
      ceil = stepMinute(floorMinute(stop, step), step);
      break;
    case 'hour':
      floor = floorHour(start, step);
      ceil = stepHour(floorHour(stop, step), step);
      break;
    case 'day':
      floor = floorDay(start, step);
      ceil = stepDay(floorDay(stop, step), step);
      break;
    case 'week':
      floor = floorWeek(start);
      ceil = stepWeek(floorWeek(stop), step);
      break;
    case 'month':
      floor = floorMonth(start, step);
      ceil = stepMonth(floorMonth(stop, step), step);
      break;
    case 'year':
      floor = floorYear(start);
      ceil = stepYear(floorYear(stop), step);
      break;
  }

  return [floor, ceil];
}

// ── timeFormat + timeParse ────────────────────────────────────────────────────
// D3 parity: d3-time-format (d3-main/src/time-format/)
// Supports: %Y %y %m %d %H %I %M %S %L %p %a %b %B %j %f %%

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MONTHS_SHORT_FMT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function pad2f(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}
function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

/**
 * Format a Date using a strftime-like specifier string.
 *
 * Supported directives:
 * `%Y` 4-digit year · `%y` 2-digit year · `%m` month 01–12 · `%d` day 01–31
 * `%H` hour 00–23 · `%I` hour 01–12 · `%M` minute · `%S` second · `%L` ms 000–999
 * `%p` AM/PM · `%P` am/pm · `%a` short weekday · `%A` full weekday
 * `%b` short month · `%B` full month · `%j` day of year 001–366
 * `%e` day 1–31 space-padded · `%f` microseconds (ms × 1000)
 * `%%` literal percent
 */
export function timeFormat(specifier: string): (date: Date) => string {
  return (date: Date): string => {
    let result = '';
    let i = 0;
    while (i < specifier.length) {
      const ch = specifier[i];
      if (ch !== '%') {
        result += ch;
        i++;
        continue;
      }
      const dir = specifier[i + 1] ?? '';
      i += 2;
      switch (dir) {
        case 'Y':
          result += pad4(date.getFullYear());
          break;
        case 'y':
          result += pad2f(date.getFullYear() % 100);
          break;
        case 'm':
          result += pad2f(date.getMonth() + 1);
          break;
        case 'd':
          result += pad2f(date.getDate());
          break;
        case 'e':
          result += String(date.getDate()).padStart(2, ' ');
          break;
        case 'H':
          result += pad2f(date.getHours());
          break;
        case 'I':
          result += pad2f(date.getHours() % 12 || 12);
          break;
        case 'M':
          result += pad2f(date.getMinutes());
          break;
        case 'S':
          result += pad2f(date.getSeconds());
          break;
        case 'L':
          result += pad3(date.getMilliseconds());
          break;
        case 'f':
          result += `${pad3(date.getMilliseconds())}000`;
          break;
        case 'p':
          result += date.getHours() < 12 ? 'AM' : 'PM';
          break;
        case 'P':
          result += date.getHours() < 12 ? 'am' : 'pm';
          break;
        case 'a':
          result += DAYS_SHORT[date.getDay()] ?? '';
          break;
        case 'A':
          result += DAYS_LONG[date.getDay()] ?? '';
          break;
        case 'b':
        case 'h':
          result += MONTHS_SHORT_FMT[date.getMonth()] ?? '';
          break;
        case 'B':
          result += MONTHS_LONG[date.getMonth()] ?? '';
          break;
        case 'j': {
          const start = new Date(date.getFullYear(), 0, 0);
          result += pad3(Math.floor((+date - +start) / MS_DAY));
          break;
        }
        case '%':
          result += '%';
          break;
        default:
          result += `%${dir}`;
      }
    }
    return result;
  };
}

/**
 * Parse a date string using a strftime-like specifier.
 * Returns a Date or null if parsing fails.
 * Supports the same directives as `timeFormat`.
 */
export function timeParse(specifier: string): (str: string) => Date | null {
  return (str: string): Date | null => {
    let year = 1900,
      month = 0,
      day = 1;
    let hours = 0,
      minutes = 0,
      seconds = 0,
      ms = 0;
    let isPM = false,
      hasAmPm = false,
      hasHour12 = false;
    let si = 0; // string index
    let fi = 0; // specifier index

    while (fi < specifier.length && si <= str.length) {
      const ch = specifier[fi];
      if (ch !== '%') {
        if (str[si] !== ch) return null;
        fi++;
        si++;
        continue;
      }
      const dir = specifier[fi + 1] ?? '';
      fi += 2;

      const numMatch = (len: number): number | null => {
        const s = str.slice(si, si + len);
        if (!/^\d+$/.test(s)) return null;
        si += s.length;
        return parseInt(s, 10);
      };

      switch (dir) {
        case 'Y': {
          const v = numMatch(4);
          if (v === null) return null;
          year = v;
          break;
        }
        case 'y': {
          const v = numMatch(2);
          if (v === null) return null;
          year = v < 69 ? 2000 + v : 1900 + v;
          break;
        }
        case 'm': {
          const v = numMatch(2);
          if (v === null) return null;
          month = v - 1;
          break;
        }
        case 'd':
        case 'e': {
          const v = numMatch(2);
          if (v === null) return null;
          day = v;
          break;
        }
        case 'H': {
          const v = numMatch(2);
          if (v === null) return null;
          hours = v;
          break;
        }
        case 'I': {
          const v = numMatch(2);
          if (v === null) return null;
          hours = v;
          hasHour12 = true;
          break;
        }
        case 'M': {
          const v = numMatch(2);
          if (v === null) return null;
          minutes = v;
          break;
        }
        case 'S': {
          const v = numMatch(2);
          if (v === null) return null;
          seconds = v;
          break;
        }
        case 'L': {
          const v = numMatch(3);
          if (v === null) return null;
          ms = v;
          break;
        }
        case 'p':
        case 'P': {
          const upper = str.slice(si, si + 2).toUpperCase();
          if (upper === 'AM') {
            isPM = false;
            hasAmPm = true;
            si += 2;
          } else if (upper === 'PM') {
            isPM = true;
            hasAmPm = true;
            si += 2;
          }
          break;
        }
        case 'b':
        case 'h': {
          let found = false;
          for (let m = 0; m < MONTHS_SHORT_FMT.length; m++) {
            const abbr = MONTHS_SHORT_FMT[m] as string;
            if (str.slice(si, si + abbr.length).toLowerCase() === abbr.toLowerCase()) {
              month = m;
              si += abbr.length;
              found = true;
              break;
            }
          }
          if (!found) return null;
          break;
        }
        case 'B': {
          let found = false;
          for (let m = 0; m < MONTHS_LONG.length; m++) {
            const name = MONTHS_LONG[m] as string;
            if (str.slice(si, si + name.length).toLowerCase() === name.toLowerCase()) {
              month = m;
              si += name.length;
              found = true;
              break;
            }
          }
          if (!found) return null;
          break;
        }
        case '%': {
          if (str[si] !== '%') return null;
          si++;
          break;
        }
      }
    }

    if (hasAmPm && hasHour12) {
      if (isPM && hours < 12) hours += 12;
      else if (!isPM && hours === 12) hours = 0;
    }

    return new Date(year, month, day, hours, minutes, seconds, ms);
  };
}
