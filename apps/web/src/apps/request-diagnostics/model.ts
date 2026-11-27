import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import * as PlotPanel from '../../ui/plot-panel/core';
import { DiagnosticsRoute, NavigationValue } from './navigation';

export const Point = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  label: Schema.String,
});
export type Point = typeof Point.Type;

export const CancellationReason = Schema.Literals(['Reload', 'RouteExit']);
export type CancellationReason = typeof CancellationReason.Type;

export const ExplorerState = UiSchema.TaggedEnum({
  Idle: {},
  Loading: {},
  Cancelling: { reason: CancellationReason },
  Ready: { points: Schema.Array(Point) },
  Selecting: {
    points: Schema.Array(Point),
    allPoints: Schema.Array(Point),
  },
  Filtered: {
    points: Schema.Array(Point),
    allPoints: Schema.Array(Point),
    domain: Schema.Tuple([Schema.Number, Schema.Number]),
  },
  Failed: { error: Schema.String },
});
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

export const Model = Schema.Struct({
  explorer: ExplorerState,
  histogram: PlotPanel.PortableModel,
  scatter: PlotPanel.PortableModel,
  lastTransition: Schema.String,
  navigation: NavigationValue,
  route: DiagnosticsRoute,
});
export type Model = typeof Model.Type;

/** Latency binned into a histogram the pointer can brush to filter the scatter. */
export const histogramFor = (points: ReadonlyArray<Point>): PlotPanel.Model =>
  PlotPanel.init({
    spec: {
      width: 480,
      height: 265,
      data: points,
      x: { label: 'Response time (ms)' },
      y: { label: 'Requests' },
      marks: [
        {
          mark: 'rect',
          x: 'x',
          fill: { value: '#38bdf8' },
          inset: 1,
          title: 'count',
          transform: { type: 'bin', thresholds: 10 },
        },
      ],
    },
    brush: true,
  }).model;

/** Error rate against latency, one dot per request. */
const scatterFor = (points: ReadonlyArray<Point>): PlotPanel.Model =>
  PlotPanel.init({
    spec: {
      width: 380,
      height: 265,
      data: points,
      x: { label: 'Response time (ms)' },
      y: { label: 'Error rate (%)' },
      marks: [
        { mark: 'dot', x: 'x', y: 'y', r: { value: 5 }, fill: { value: '#38bdf8' }, title: 'x' },
      ],
    },
  }).model;

export const initModel: Model = {
  explorer: ExplorerState.Loading(),
  histogram: histogramFor(samplePoints),
  scatter: scatterFor(samplePoints),
  lastTransition: 'Loading -> waiting for metrics',
  navigation: { phase: 'coldLoad', path: '/', previousPath: null },
  route: { _tag: 'Index' },
};

export const chartsFor = (points: ReadonlyArray<Point>): Pick<Model, 'histogram' | 'scatter'> => ({
  histogram: histogramFor(points),
  scatter: scatterFor(points),
});
