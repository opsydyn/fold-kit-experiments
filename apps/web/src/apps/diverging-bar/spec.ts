import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

// Monthly year-over-year revenue growth for a fictional tech company.
const GROWTH = [0.12, 0.08, -0.03, -0.11, -0.18, -0.07, 0.04, 0.15, 0.22, 0.31, 0.19, 0.27];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Revenue growth',
  description: 'Year-over-year revenue growth by month; declines fall below zero.',
  data: MONTHS.map((month, i) => {
    const growth = GROWTH[i] ?? 0;
    return {
      month,
      growth,
      direction: growth < 0 ? 'decline' : 'growth',
      label: `${month}: ${growth > 0 ? '+' : ''}${Math.round(growth * 100)}%`,
    };
  }),
  x: { label: '' },
  y: { label: 'Year-over-year growth' },
  color: { domain: ['growth', 'decline'], range: ['#10b981', '#ef4444'] },
  marks: [
    { mark: 'bar', x: 'month', y: 'growth', fill: 'direction', title: 'label' },
    { mark: 'rule', y: { value: 0 }, stroke: { value: 'currentColor' } },
  ],
};
