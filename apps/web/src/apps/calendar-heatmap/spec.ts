import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A year of deterministic daily commit counts: quiet weekends, busier sprints. */
function generateYear(year: number): ReadonlyArray<Row> {
  const startDow = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  let s = (year * 1337) >>> 0;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const days: Row[] = [];
  for (let d = 0; d < 365; d += 1) {
    const date = new Date(Date.UTC(year, 0, 1 + d));
    const dow = (startDow + d) % 7;
    const week = Math.floor((startDow + d) / 7);
    const r1 = next(),
      r2 = next();
    const sprint = Math.floor(d / 28) % 3 === 1;
    const weekend = dow === 0 || dow === 6;
    const count = weekend
      ? r1 < 0.15
        ? Math.ceil(r2 * 3)
        : 0
      : r1 < (sprint ? 0.82 : 0.65)
        ? Math.ceil(r2 * (sprint ? 18 : 12))
        : 0;
    const label = `${MONTHS[date.getUTCMonth()] ?? ''} ${date.getUTCDate()}: ${count} commits`;
    days.push({ week: String(week), day: DAYS[dow] ?? '', count, label });
  }
  return days;
}

export const spec: PlotSpec = {
  width: 440,
  height: 150,
  title: 'Commits in 2025',
  description: 'Daily commit counts across 2025, one column per week and one row per weekday.',
  margins: { top: 8, right: 8, bottom: 16, left: 36 },
  data: generateYear(2025),
  x: { axis: false, label: '', padding: 0.15 },
  y: { label: '', padding: 0.15, domain: DAYS },
  color: { scheme: 'greens', label: 'Commits' },
  marks: [{ mark: 'cell', x: 'week', y: 'day', fill: 'count', title: 'label' }],
};
