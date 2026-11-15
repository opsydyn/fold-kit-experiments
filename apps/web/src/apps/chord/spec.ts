import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

// Tech sector cross-investment flows, in billions of dollars.
const SECTORS = [
  { name: 'Cloud', color: '#3b82f6' },
  { name: 'Software', color: '#8b5cf6' },
  { name: 'Devices', color: '#f97316' },
  { name: 'Social', color: '#ec4899' },
  { name: 'AI', color: '#14b8a6' },
];
const MATRIX = [
  [11, 28, 15, 10, 32],
  [28, 9, 12, 8, 24],
  [15, 12, 18, 6, 9],
  [10, 8, 6, 5, 18],
  [32, 24, 9, 18, 14],
];

const flows: ReadonlyArray<Row> = SECTORS.flatMap((from, i) =>
  SECTORS.map((to, j) => ({ from: from.name, to: to.name, billions: MATRIX[i]?.[j] ?? 0 })),
);

export const spec: PlotSpec = {
  width: 440,
  height: 340,
  title: 'Tech sector cross-investment',
  description: 'Investment flows between five tech sectors, in billions of dollars.',
  data: flows,
  color: {
    label: 'Sector',
    domain: SECTORS.map((s) => s.name),
    range: SECTORS.map((s) => s.color),
  },
  marks: [{ mark: 'chord', source: 'from', target: 'to', value: 'billions' }],
};
