import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

// Website traffic index (0 to 100) by weekday and three-hour block.
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'];
const TRAFFIC = [
  [4, 2, 6, 38, 72, 68, 55, 32],
  [5, 2, 7, 40, 75, 71, 57, 34],
  [5, 3, 7, 41, 74, 70, 56, 33],
  [4, 2, 8, 42, 76, 73, 59, 35],
  [6, 3, 9, 45, 82, 79, 64, 42],
  [12, 7, 14, 28, 61, 88, 91, 68],
  [10, 6, 11, 22, 52, 84, 89, 63],
];

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Traffic by hour',
  description: 'Website traffic index by day of the week and time of day.',
  data: DAYS.flatMap((day, r) =>
    HOURS.map((hour, c) => {
      const traffic = TRAFFIC[r]?.[c] ?? 0;
      return { day, hour, traffic, label: `${day} ${hour}: ${traffic}` };
    }),
  ),
  x: { label: '', padding: 0.05 },
  y: { label: '', padding: 0.05 },
  color: { scheme: 'oranges', label: 'Traffic index' },
  marks: [{ mark: 'cell', x: 'hour', y: 'day', fill: 'traffic', title: 'label' }],
};
