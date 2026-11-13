import { compilePlot, highlightPoints, indexPlot } from '@opsydyn/foldkit-viz/plot';
import type { PlotGeometry, PlotIndex, PlotSpec } from '@opsydyn/foldkit-viz/plot';

import { bins, rows } from './data';

export const SCATTER = { width: 720, height: 420 } as const;
export const HISTOGRAM = { width: 720, height: 180 } as const;

type Range = readonly [number, number];

const scatterSpec = (domain: Range | null): PlotSpec => {
  const dots = {
    mark: 'dot' as const,
    x: 'latency',
    y: 'payload',
    dense: true,
    r: { value: 1.2 },
    fill: { value: '#6aa7e8' },
    opacity: 0.35,
  };
  return {
    ...SCATTER,
    // Zooming narrows the domain, so marks are clipped to the plot area.
    clip: true,
    title: 'One million requests',
    description: 'Latency against payload for one million requests, on a log latency axis.',
    data: rows,
    x:
      domain === null
        ? { type: 'log', label: 'Latency (ms)' }
        : { type: 'log', label: 'Latency (ms)', domain },
    y: { label: 'Payload (KB)' },
    marks: [dots],
  };
};

const histogramSpec = (brushed: Range | null): PlotSpec => {
  const bars = {
    mark: 'bar' as const,
    x: 'label',
    y: 'count',
    fill: { value: '#6aa7e8' },
    title: 'count',
  };
  return {
    ...HISTOGRAM,
    title: 'Latency distribution',
    description: 'Requests per latency bin; drag across it to highlight those requests above.',
    margins: { top: 20, right: 16, bottom: 40, left: 64 },
    data: bins,
    x: { label: 'Latency (ms), bin centre', padding: 0.05 },
    y: { label: 'Requests' },
    marks: [
      brushed === null
        ? bars
        : { ...bars, highlight: { field: 'x0', range: [brushed[0] - 1e-9, brushed[1] - 1e-9] } },
    ],
  };
};

/**
 * Compiling a million rows takes over a tenth of a second, so the plain
 * geometry and its hover index are kept per zoom. A brush only restyles the
 * packed points with highlightPoints, which keeps the index valid, and every
 * hover reuses both, moving only the overlay.
 */
type Compiled = Readonly<{ geometry: PlotGeometry; index: PlotIndex }>;
const plain = new Map<string, Compiled>();
const scatters = new Map<string, Compiled>();
const histograms = new Map<string, PlotGeometry>();

const remember = <V>(cache: Map<string, V>, key: string, value: V): V => {
  if (cache.size >= 4) cache.delete(cache.keys().next().value ?? '');
  cache.set(key, value);
  return value;
};

export const scatterKey = (domain: Range | null, brushed: Range | null): string =>
  JSON.stringify([domain, brushed]);

function plainScatter(domain: Range | null): Compiled {
  const key = JSON.stringify(domain);
  const cached = plain.get(key);
  if (cached !== undefined) return cached;
  const geometry = compilePlot(scatterSpec(domain));
  return remember(plain, key, { geometry, index: indexPlot(geometry) });
}

export function scatter(domain: Range | null, brushed: Range | null): Compiled {
  const key = scatterKey(domain, brushed);
  const cached = scatters.get(key);
  if (cached !== undefined) return cached;
  const base = plainScatter(domain);
  if (brushed === null) return remember(scatters, key, base);
  const geometry = highlightPoints(base.geometry, 0, rows, { field: 'latency', range: brushed });
  return remember(scatters, key, { geometry, index: base.index });
}

/** The scatter already compiled under a key, for the Mount that paints it. */
export const scatterByKey = (key: string): Compiled | undefined => scatters.get(key);

export function histogram(brushed: Range | null): PlotGeometry {
  const key = JSON.stringify(brushed);
  const cached = histograms.get(key);
  if (cached !== undefined) return cached;
  return remember(histograms, key, compilePlot(histogramSpec(brushed)));
}
