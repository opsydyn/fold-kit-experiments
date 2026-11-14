import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

import { countries, countriesWithData } from './world';

export const spec: PlotSpec = {
  width: 480,
  height: 280,
  title: 'World internet penetration',
  description:
    'Share of each country’s population using the internet; grey where there is no figure.',
  margins: { top: 4, right: 4, bottom: 4, left: 4 },
  projection: { type: 'naturalEarth1' },
  color: { scheme: 'blues', label: 'Internet %', domain: [0, 100] },
  marks: [
    {
      mark: 'geo',
      features: countries,
      fill: { value: '#2a2a3a' },
      stroke: { value: '#0f0f1a' },
      title: 'label',
    },
    {
      mark: 'geo',
      features: countriesWithData,
      fill: 'internet',
      stroke: { value: '#0f0f1a' },
      title: 'label',
    },
  ],
};
