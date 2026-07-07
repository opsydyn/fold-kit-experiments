import { Schema } from 'effect';

import * as CalendarHeatmapChart from '../../ui/calendar-heatmap-chart';

export const Model = Schema.Struct({ calendar: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'calendar'> & {
  readonly calendar: CalendarHeatmapChart.Model;
};

const MONTH_NAMES = [
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
];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function generateYear(year: number): {
  days: ReadonlyArray<Omit<CalendarHeatmapChart.DayEntry, 'color'>>;
  monthLabels: ReadonlyArray<CalendarHeatmapChart.MonthLabel>;
} {
  const startDow = new Date(year, 0, 1).getDay(); // 0=Sun, for 2025 = 3 (Wed)
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const mdays = isLeap ? [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] : MONTH_DAYS;
  const numDays = mdays.reduce((a, b) => a + b, 0);

  const days: Array<Omit<CalendarHeatmapChart.DayEntry, 'color'>> = [];
  const monthLabels: CalendarHeatmapChart.MonthLabel[] = [];

  // Simple LCG for deterministic pseudo-random data
  let s = (year * 1337) >>> 0;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  let month = 0;
  let dayOfMonth = 1;

  for (let d = 0; d < numDays; d++) {
    const dow = (startDow + d) % 7;
    const weekIdx = Math.floor((startDow + d) / 7);

    // New month — record label position
    if (d === 0 || dayOfMonth === 1) {
      monthLabels.push({ label: MONTH_NAMES[month] ?? '', weekIndex: weekIdx });
    }

    const r1 = next();
    const r2 = next();
    const isWeekend = dow === 0 || dow === 6;
    // Alternating sprint / quiet periods every ~28 days
    const sprint = Math.floor(d / 28) % 3 === 1;

    let count = 0;
    if (isWeekend) {
      if (r1 < 0.15) count = Math.ceil(r2 * 3);
    } else {
      const threshold = sprint ? 0.82 : 0.65;
      if (r1 < threshold) count = sprint ? Math.ceil(r2 * 18) : Math.ceil(r2 * 12);
    }

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
    const displayDate = `${MONTH_NAMES[month]} ${dayOfMonth}`;

    days.push({ date: dateStr, displayDate, count, weekIndex: weekIdx, dayIndex: dow });

    // Advance date
    dayOfMonth++;
    if (dayOfMonth > (mdays[month] ?? 31)) {
      dayOfMonth = 1;
      month++;
    }
  }

  return { days, monthLabels };
}

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const { days, monthLabels } = generateYear(2025);
  const [calendar] = CalendarHeatmapChart.init({ days, monthLabels, year: 2025 });
  return [{ calendar }, []];
};
