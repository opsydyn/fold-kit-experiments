import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

import { prices } from './data';

/** The price line over the visible dates; null shows the whole year. */
export const priceSpec = (domain: readonly [number, number] | null): PlotSpec => ({
  width: 440,
  height: 280,
  title: 'Daily closing price',
  description: 'A year of daily closing prices; zoom and pan through the dates.',
  // A zoomed domain cuts through the line, so marks are clipped to the plot area.
  clip: true,
  data: prices,
  x: domain === null ? { label: '' } : { label: '', domain },
  y: { label: 'Price ($)' },
  marks: [
    { mark: 'area', x: 'date', y: 'close', fill: { value: '#6366f1' }, opacity: 0.12 },
    {
      mark: 'line',
      x: 'date',
      y: 'close',
      stroke: { value: '#6366f1' },
      strokeWidth: 1.5,
      title: 'label',
    },
  ],
});
