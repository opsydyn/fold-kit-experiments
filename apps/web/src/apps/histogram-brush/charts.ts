import { bin } from '@opsydyn/foldkit-viz/math/bin';
import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import type { PlotAxis, PlotGeometry, PlotSpec } from '@opsydyn/foldkit-viz/plot';

import { requests } from './data';

export const HISTOGRAM = { width: 440, height: 260 } as const;
export const SCATTER = { width: 380, height: 260 } as const;
const THRESHOLDS = 12;
const COLOUR = '#6366f1';

type Range = readonly [number, number];

const latencies = requests.map((r) => Number(r.ms));

/** The histogram's bin edges, the same ones its bin transform draws. */
export const binEdges: ReadonlyArray<Range> = bin(latencies, { thresholds: THRESHOLDS }).map(
  (b) => [b.x0, b.x1],
);

/** The bins a pixel range across the histogram touches, as one latency range. */
export function snapToBins(lo: number, hi: number): Range | null {
  const touched = binEdges.filter(([x0, x1]) => x1 > lo && x0 < hi);
  const first = touched[0],
    last = touched.at(-1);
  return first === undefined || last === undefined ? null : [first[0], last[1]];
}

export const histogramSpec = (brushed: Range | null): PlotSpec => {
  const bars = {
    mark: 'rect' as const,
    x: 'ms',
    fill: { value: COLOUR },
    inset: 1,
    title: 'count',
    transform: { type: 'bin' as const, thresholds: THRESHOLDS },
  };
  return {
    ...HISTOGRAM,
    title: 'Response times',
    description: 'Requests binned by response time; drag across the bars to select a range.',
    data: requests,
    x: { label: 'Response time (ms)' },
    y: { label: 'Requests' },
    marks: [
      brushed === null
        ? bars
        : // A bin is kept when it starts inside the brushed range.
          { ...bars, highlight: { field: 'x1', range: [brushed[0], brushed[1] - 1e-9] } },
    ],
  };
};

export const scatterSpec = (brushed: Range | null): PlotSpec => {
  const dots = {
    mark: 'dot' as const,
    x: 'ms',
    y: 'errors',
    fill: { value: COLOUR },
    r: { value: 4 },
  };
  return {
    ...SCATTER,
    title: 'Errors by response time',
    description:
      'Each request’s error rate against its response time; the brushed range stays bright.',
    data: requests,
    x: { label: 'Response time (ms)' },
    y: { label: 'Error rate (%)' },
    marks: [brushed === null ? dots : { ...dots, highlight: { field: 'ms', range: brushed } }],
  };
};

/** Both charts for a brush; there are only a few dozen rows, so they compile on demand. */
export const histogram = (brushed: Range | null): PlotGeometry =>
  compilePlot(histogramSpec(brushed));
export const scatter = (brushed: Range | null): PlotGeometry => compilePlot(scatterSpec(brushed));

/** Where a value sits on a linear axis, in plot pixels. */
export function pixelOf(axis: PlotAxis, value: number): number {
  const [d0 = 0, d1 = 1] = axis.domain.map(Number);
  const [r0, r1] = axis.range;
  return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}
