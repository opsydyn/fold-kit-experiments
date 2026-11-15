import { randomLcg } from '@opsydyn/foldkit-viz/math/random';
import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

/** 55 seeded random sites, so the diagram is the same on every render. */
function sites(seed: number): ReadonlyArray<Row> {
  const rng = randomLcg(seed);
  return Array.from({ length: 55 }, (_, i) => ({ x: rng(), y: rng(), site: i + 1 }));
}

export const spec: PlotSpec = {
  width: 440,
  height: 260,
  title: 'Voronoi diagram',
  description: 'Fifty-five random sites, each with the region of the plane nearest to it.',
  margins: { top: 4, right: 4, bottom: 4, left: 4 },
  data: sites(7),
  x: { domain: [0, 1], axis: false, label: '' },
  y: { domain: [0, 1], axis: false, label: '' },
  color: { scheme: 'purples', legend: false },
  marks: [
    { mark: 'voronoi', x: 'x', y: 'y', fill: 'y', stroke: { value: '#0f0f1a' }, title: 'site' },
    { mark: 'dot', x: 'x', y: 'y', r: { value: 2 }, fill: { value: '#ffffff' } },
  ],
};
