import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

const VALUES = [42, 38, 55, 61, 78, 94, 88, 102, 91, 73, 58, 47];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Monthly trend',
  description: 'One value for each month of the year, rising to a peak in August.',
  data: MONTHS.map((month, i) => ({ month, value: VALUES[i] ?? 0 })),
  x: { label: '' },
  y: { label: 'Value', zero: true },
  marks: [
    { mark: 'line', x: 'month', y: 'value', stroke: { value: '#6366f1' }, strokeWidth: 2 },
    { mark: 'dot', x: 'month', y: 'value', fill: { value: '#6366f1' }, title: 'value' },
  ],
};
