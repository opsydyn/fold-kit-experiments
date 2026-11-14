import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

// Illustrative npm weekly downloads (millions) for front-end frameworks in 2024.
// In stacking order, from the bottom of the stream.
const SERIES = [
  {
    key: 'Svelte',
    color: '#fb923c',
    values: [0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0],
  },
  {
    key: 'Vue',
    color: '#4ade80',
    values: [4.5, 4.6, 4.7, 4.8, 4.9, 5.0, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6],
  },
  {
    key: 'React',
    color: '#38bdf8',
    values: [18.2, 18.6, 19.1, 19.4, 19.8, 20.3, 20.8, 21.2, 21.7, 22.1, 22.6, 23.1],
  },
  {
    key: 'Angular',
    color: '#f87171',
    values: [3.8, 3.9, 3.9, 4.0, 4.0, 4.1, 4.1, 4.2, 4.2, 4.3, 4.3, 4.4],
  },
  {
    key: 'Solid',
    color: '#c084fc',
    values: [0.3, 0.35, 0.42, 0.48, 0.55, 0.62, 0.68, 0.75, 0.82, 0.88, 0.95, 1.02],
  },
];

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Framework downloads',
  description:
    'Weekly npm downloads for five frameworks through 2024, as a streamgraph centred on its baseline.',
  data: SERIES.flatMap((s) =>
    s.values.map((millions, i) => ({
      month: `2024-${String(i + 1).padStart(2, '0')}-01`,
      framework: s.key,
      millions,
    })),
  ),
  x: { label: '' },
  y: { label: '', axis: false },
  color: { domain: SERIES.map((s) => s.key), range: SERIES.map((s) => s.color) },
  marks: [
    {
      mark: 'area',
      x: 'month',
      y: 'millions',
      fill: 'framework',
      // React, the largest, sits in the middle of the stream.
      stack: { offset: 'center', order: 'input' },
      curve: 'catmullRom',
      opacity: 0.9,
      title: 'framework',
    },
  ],
};
