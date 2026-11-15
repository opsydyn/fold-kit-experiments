import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

const WIND = [
  { direction: 'N', frequency: 12 },
  { direction: 'NE', frequency: 8 },
  { direction: 'E', frequency: 15 },
  { direction: 'SE', frequency: 6 },
  { direction: 'S', frequency: 20 },
  { direction: 'SW', frequency: 9 },
  { direction: 'W', frequency: 18 },
  { direction: 'NW', frequency: 5 },
];

export const spec: PlotSpec = {
  width: 320,
  height: 320,
  title: 'Wind frequency by direction',
  description: 'How often the wind blows from each of eight directions, in per cent.',
  coordinates: 'polar',
  polar: { inner: 0.12 },
  data: WIND.map((w) => ({ ...w, label: `${w.direction}: ${w.frequency}%` })),
  x: { label: '', padding: 0.06 },
  y: { label: '%', ticks: 4 },
  color: { scheme: 'purples', legend: false },
  marks: [{ mark: 'bar', x: 'direction', y: 'frequency', fill: 'frequency', title: 'label' }],
};
