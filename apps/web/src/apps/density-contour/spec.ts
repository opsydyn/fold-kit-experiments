import { randomLcg, randomNormal } from '@opsydyn/foldkit-viz/math/random';
import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

/** 180 points in two overlapping clusters, seeded so the chart is stable. */
function generatePoints(seed: number): ReadonlyArray<Row> {
  const rng = randomLcg(seed);
  const x1 = randomNormal(1.2, 0.42, rng),
    y1 = randomNormal(2.8, 0.52, rng),
    x2 = randomNormal(1.6, 0.38, rng),
    y2 = randomNormal(2.1, 0.45, rng);
  return [
    ...Array.from({ length: 80 }, () => ({ x: x1(), y: y1() })),
    ...Array.from({ length: 100 }, () => ({ x: x2(), y: y2() })),
  ];
}

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Point density',
  description: 'Contours of point density over 180 points in two overlapping clusters.',
  data: generatePoints(42),
  x: { label: 'x', domain: [0, 3] },
  y: { label: 'y', domain: [0.5, 4] },
  marks: [
    { mark: 'dot', x: 'x', y: 'y', r: { value: 2 }, fill: { value: '#94a3b8' }, opacity: 0.6 },
    { mark: 'density', x: 'x', y: 'y', stroke: { value: '#6366f1' }, bandwidth: 50, thresholds: 6 },
  ],
};
