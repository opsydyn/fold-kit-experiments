import { Schema } from 'effect';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';

// 65 synthetic data points: response time (ms) vs error rate (%)
// Distribution peaks around 150-250ms; error rate correlates with response time.
export const ALL_POINTS: ReadonlyArray<Scatter.Point> = [
  { x: 22, y: 0.1, label: '' },
  { x: 30, y: 0.3, label: '' },
  { x: 38, y: 0.1, label: '' },
  { x: 45, y: 0.5, label: '' },
  { x: 52, y: 0.2, label: '' },
  { x: 61, y: 0.7, label: '' },
  { x: 68, y: 0.4, label: '' },
  { x: 75, y: 0.9, label: '' },
  { x: 83, y: 0.6, label: '' },
  { x: 90, y: 1.1, label: '' },
  { x: 98, y: 0.8, label: '' },
  { x: 105, y: 1.4, label: '' },
  { x: 112, y: 1.0, label: '' },
  { x: 120, y: 1.7, label: '' },
  { x: 127, y: 1.3, label: '' },
  { x: 135, y: 2.0, label: '' },
  { x: 142, y: 1.6, label: '' },
  { x: 148, y: 2.3, label: '' },
  { x: 155, y: 1.9, label: '' },
  { x: 162, y: 2.6, label: '' },
  { x: 168, y: 2.2, label: '' },
  { x: 175, y: 2.9, label: '' },
  { x: 182, y: 2.5, label: '' },
  { x: 188, y: 3.2, label: '' },
  { x: 195, y: 2.8, label: '' },
  { x: 202, y: 3.5, label: '' },
  { x: 210, y: 3.1, label: '' },
  { x: 217, y: 3.8, label: '' },
  { x: 224, y: 3.4, label: '' },
  { x: 231, y: 4.1, label: '' },
  { x: 238, y: 3.7, label: '' },
  { x: 245, y: 4.4, label: '' },
  { x: 253, y: 4.0, label: '' },
  { x: 260, y: 4.7, label: '' },
  { x: 268, y: 4.3, label: '' },
  { x: 275, y: 5.0, label: '' },
  { x: 283, y: 4.6, label: '' },
  { x: 291, y: 5.3, label: '' },
  { x: 298, y: 4.9, label: '' },
  { x: 306, y: 5.6, label: '' },
  { x: 315, y: 5.2, label: '' },
  { x: 323, y: 5.9, label: '' },
  { x: 332, y: 5.5, label: '' },
  { x: 341, y: 6.2, label: '' },
  { x: 350, y: 5.8, label: '' },
  { x: 360, y: 6.5, label: '' },
  { x: 370, y: 6.1, label: '' },
  { x: 381, y: 6.8, label: '' },
  { x: 392, y: 7.3, label: '' },
  { x: 403, y: 6.9, label: '' },
  { x: 416, y: 7.6, label: '' },
  { x: 429, y: 8.0, label: '' },
  { x: 442, y: 7.5, label: '' },
  { x: 457, y: 8.4, label: '' },
  { x: 472, y: 8.9, label: '' },
  { x: 487, y: 8.3, label: '' },
  { x: 503, y: 9.2, label: '' },
  { x: 520, y: 9.7, label: '' },
  { x: 537, y: 9.1, label: '' },
  { x: 555, y: 10.4, label: '' },
  { x: 573, y: 10.9, label: '' },
  { x: 592, y: 10.3, label: '' },
  { x: 612, y: 11.6, label: '' },
  { x: 633, y: 12.1, label: '' },
  { x: 655, y: 13.0, label: '' },
];

export const Model = Schema.Struct({
  histogram: Schema.Unknown,
  scatter: Schema.Unknown,
  allPoints: Schema.Unknown,
});
export type Model = Omit<typeof Model.Type, 'histogram' | 'scatter' | 'allPoints'> & {
  readonly histogram: Histogram.Model;
  readonly scatter: Scatter.Model;
  readonly allPoints: ReadonlyArray<Scatter.Point>;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [histogram] = Histogram.init({
    data: ALL_POINTS.map((p) => ({ value: p.x })),
    binCount: 12,
    color: '#6366f1',
    xLabel: 'Response time (ms)',
    dims: { width: 440, height: 260 },
    enableBrush: true,
  });

  const [scatter] = Scatter.init({
    points: ALL_POINTS as ReadonlyArray<Scatter.Point>,
    config: {
      color: '#6366f1',
      activeColor: '#4338ca',
      xLabel: 'Response time (ms)',
      yLabel: 'Error rate (%)',
    },
    dims: { width: 380, height: 260 },
  });

  return [{ histogram, scatter, allPoints: ALL_POINTS }, []];
};
