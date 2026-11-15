import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

// Each reading, banded green, amber or red by its own thresholds.
const READINGS = [
  { metric: 'CPU %', value: 67, max: 100, amber: 60, red: 80 },
  { metric: 'Memory %', value: 82, max: 100, amber: 60, red: 80 },
  { metric: 'Latency ms', value: 38, max: 200, amber: 100, red: 150 },
];

/** A filled slice for the reading and an empty one for the rest of the scale. */
const slices: ReadonlyArray<Row> = READINGS.flatMap((r) => {
  const status = r.value >= r.red ? 'high' : r.value >= r.amber ? 'elevated' : 'normal';
  return [
    {
      metric: r.metric,
      part: status,
      amount: r.value,
      reading: String(r.value),
      label: `${r.metric}: ${r.value}`,
    },
    {
      metric: r.metric,
      part: 'rest',
      amount: r.max - r.value,
      reading: String(r.value),
      label: `${r.metric}: ${r.value} of ${r.max}`,
    },
  ];
});

export const spec: PlotSpec = {
  width: 440,
  height: 200,
  title: 'System metrics',
  description: 'CPU, memory and latency readings as gauges, coloured by their thresholds.',
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
  data: slices,
  facet: { x: 'metric' },
  color: {
    domain: ['normal', 'elevated', 'high', 'rest'],
    range: ['#22c55e', '#f59e0b', '#ef4444', 'rgba(148, 163, 184, 0.25)'],
    legend: false,
  },
  marks: [
    {
      mark: 'arc',
      value: 'amount',
      fill: 'part',
      inner: 0.7,
      start: -120,
      end: 120,
      text: 'reading',
      title: 'label',
    },
  ],
};
