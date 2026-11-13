import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

// Each measure against its target, as a share of the target so they share an axis.
const measures = [
  { label: 'Revenue', value: 270, target: 300, ranges: [200, 250, 350] },
  { label: 'Profit', value: 45, target: 50, ranges: [30, 40, 60] },
  { label: 'Orders', value: 1800, target: 2000, ranges: [1200, 1600, 2200] },
  { label: 'Sat. score', value: 4.2, target: 4.5, ranges: [3.0, 3.8, 5.0] },
  { label: 'Churn rate', value: 3.8, target: 3.0, ranges: [2.5, 4.0, 5.0] },
];
const greys = ['#9ca3af', '#c4c9d0', '#e5e7eb'];

const bands: ReadonlyArray<Row> = measures.flatMap((m) =>
  m.ranges.map((upper, i) => ({
    measure: m.label,
    from: i === 0 ? 0 : (m.ranges[i - 1] ?? 0) / m.target,
    to: upper / m.target,
    band: ['lower range', 'middle range', 'upper range'][i] ?? '',
  })),
);

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Against target',
  description: 'Each measure as a share of its target, over its qualitative ranges.',
  x: { label: 'Share of target', domain: [0, 1.8] },
  y: { label: '', padding: 0.35 },
  color: { domain: ['lower range', 'middle range', 'upper range'], range: greys, legend: false },
  marks: [
    { mark: 'bar', data: bands, x: 'to', x0: 'from', y: 'measure', fill: 'band', title: 'band' },
    {
      mark: 'link',
      data: measures.map((m) => ({ measure: m.label, share: m.value / m.target, value: m.value })),
      x1: { value: 0 },
      x2: 'share',
      y1: 'measure',
      stroke: { value: '#1e40af' },
      strokeWidth: 7,
      title: 'value',
    },
    { mark: 'rule', x: { value: 1 }, stroke: { value: '#111827' }, strokeWidth: 2 },
  ],
};
