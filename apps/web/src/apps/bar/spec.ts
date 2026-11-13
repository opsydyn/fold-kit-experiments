import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Monthly figures',
  description: 'One value for each month from January to June.',
  data: [
    { month: 'Jan', value: 42 },
    { month: 'Feb', value: 68 },
    { month: 'Mar', value: 55 },
    { month: 'Apr', value: 91 },
    { month: 'May', value: 73 },
    { month: 'Jun', value: 38 },
  ],
  x: { label: '' },
  y: { label: 'Value' },
  marks: [{ mark: 'bar', x: 'month', y: 'value', fill: { value: '#6366f1' }, title: 'value' }],
};
