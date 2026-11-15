import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

const revenue = [28, 35, 42, 58, 65, 74, 68, 83, 97, 112, 124, 118];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Monthly revenue',
  description: 'Revenue in thousands of dollars for each month of the year.',
  data: months.map((month, i) => ({ month, revenue: revenue[i] ?? 0 })),
  x: { label: '' },
  y: { label: 'Revenue ($k)' },
  marks: [
    { mark: 'area', x: 'month', y: 'revenue', fill: { value: '#6366f1' }, opacity: 0.25 },
    { mark: 'line', x: 'month', y: 'revenue', stroke: { value: '#6366f1' }, strokeWidth: 2 },
    { mark: 'dot', x: 'month', y: 'revenue', fill: { value: '#6366f1' }, title: 'revenue' },
  ],
};
