import { Schema } from 'effect';
import { ts } from 'foldkit/schema';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { NavigationValue } from './navigation';

export const Point = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  label: Schema.String,
});
export type Point = typeof Point.Type;

export const Idle = ts('Idle');
export const Loading = ts('Loading');
export const CancellationReason = Schema.Literals(['Reload', 'RouteExit']);
export type CancellationReason = typeof CancellationReason.Type;

export const Cancelling = ts('Cancelling', { reason: CancellationReason });
export const Ready = ts('Ready', { points: Schema.Array(Point) });
export const Selecting = ts('Selecting', {
  points: Schema.Array(Point),
  allPoints: Schema.Array(Point),
});
export const Filtered = ts('Filtered', {
  points: Schema.Array(Point),
  allPoints: Schema.Array(Point),
  domain: Schema.Tuple([Schema.Number, Schema.Number]),
});
export const Failed = ts('Failed', { error: Schema.String });

export const ExplorerState = Schema.Union([
  Idle,
  Loading,
  Cancelling,
  Ready,
  Selecting,
  Filtered,
  Failed,
]);
export type ExplorerState = typeof ExplorerState.Type;

export const samplePoints: ReadonlyArray<Point> = [
  { x: 22, y: 0.1, label: '' },
  { x: 45, y: 0.5, label: '' },
  { x: 75, y: 0.9, label: '' },
  { x: 105, y: 1.4, label: '' },
  { x: 135, y: 2, label: '' },
  { x: 175, y: 2.9, label: '' },
  { x: 217, y: 3.8, label: '' },
  { x: 260, y: 4.7, label: '' },
  { x: 306, y: 5.6, label: '' },
  { x: 350, y: 5.8, label: '' },
  { x: 403, y: 6.9, label: '' },
  { x: 457, y: 8.4, label: '' },
  { x: 520, y: 9.7, label: '' },
  { x: 592, y: 10.3, label: '' },
  { x: 655, y: 13, label: '' },
];

export type Model = Readonly<{
  explorer: ExplorerState;
  histogram: Histogram.Model;
  scatter: Scatter.Model;
  lastTransition: string;
  navigation: NavigationValue;
  route: import('./navigation').DiagnosticsRoute;
}>;

export const Model = Schema.Struct({
  explorer: Schema.Unknown,
  histogram: Schema.Unknown,
  scatter: Schema.Unknown,
  lastTransition: Schema.String,
  navigation: NavigationValue,
  route: Schema.Unknown,
});

const makeHistogram = (points: ReadonlyArray<Point>): Histogram.Model =>
  Histogram.init({
    data: points.map(({ x }) => ({ value: x })),
    binCount: 10,
    color: '#38bdf8',
    xLabel: 'Response time (ms)',
    dims: { width: 480, height: 265 },
    enableBrush: true,
  })[0];

const makeScatter = (points: ReadonlyArray<Point>): Scatter.Model =>
  Scatter.init({
    points,
    config: {
      color: '#38bdf8',
      activeColor: '#f97316',
      xLabel: 'Response time (ms)',
      yLabel: 'Error rate (%)',
    },
    dims: { width: 380, height: 265 },
  })[0];

export const initModel: Model = {
  explorer: Loading(),
  histogram: makeHistogram(samplePoints),
  scatter: makeScatter(samplePoints),
  lastTransition: 'Loading -> waiting for metrics',
  navigation: { phase: 'coldLoad', path: '/', previousPath: null },
  route: { _tag: 'Index' },
};

export const chartsFor = (points: ReadonlyArray<Point>): Pick<Model, 'histogram' | 'scatter'> => ({
  histogram: makeHistogram(points),
  scatter: makeScatter(points),
});
