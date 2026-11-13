import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

/** 200 synthetic salaries in thousands: contributors near 66k, seniors near 112k. */
function generateSalaries(): ReadonlyArray<Row> {
  let s = 0xc0ffee;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const normal = (mean: number, sd: number): number => {
    const u = Math.max(1e-6, next());
    const v = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const rows: Row[] = [];
  for (let i = 0; i < 130; i += 1)
    rows.push({ salary: Math.max(38, Math.min(95, Math.round(normal(66, 9)))) });
  for (let i = 0; i < 70; i += 1)
    rows.push({ salary: Math.max(85, Math.min(160, Math.round(normal(112, 14)))) });
  return rows;
}

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Salary distribution',
  description: 'Two hundred salaries binned into a histogram, showing two peaks.',
  data: generateSalaries(),
  x: { label: 'Salary ($k)' },
  y: { label: 'People' },
  marks: [
    {
      mark: 'rect',
      x: 'salary',
      fill: { value: '#6366f1' },
      inset: 1,
      title: 'count',
      transform: { type: 'bin', thresholds: 12 },
    },
  ],
};
