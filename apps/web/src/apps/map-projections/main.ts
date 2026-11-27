import { plotChart } from '@opsydyn/foldkit-viz/effect-ui/plot';
import { compilePlot } from '@opsydyn/foldkit-viz/plot';

import { staticChart } from '../spec-app';
import { specs } from './spec';

const geometries = specs.map(compilePlot);

export const Chart = staticChart((h) =>
  h.div
    .style({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' })
    .children(...geometries.map((geometry) => plotChart(h, geometry, { legend: false }))),
);
