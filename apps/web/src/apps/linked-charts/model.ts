import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { Option, Schema } from 'effect';
import { foldChildInits } from 'foldkit/update';

import * as PlotPanel from '../../ui/plot-panel';
import type { Inspection, KeyedPoint } from '../../ui/shared/inspection';
import { Message } from './message';

// 30 salary vs experience data points
export const POINTS: ReadonlyArray<KeyedPoint> = [
  { id: 'salary-1', x: 1, y: 55000, label: '1yr' },
  { id: 'salary-2', x: 2, y: 62000, label: '2yr' },
  { id: 'salary-3', x: 2, y: 58000, label: '2yr' },
  { id: 'salary-4', x: 3, y: 68000, label: '3yr' },
  { id: 'salary-5', x: 3, y: 72000, label: '3yr' },
  { id: 'salary-6', x: 4, y: 75000, label: '4yr' },
  { id: 'salary-7', x: 4, y: 80000, label: '4yr' },
  { id: 'salary-8', x: 5, y: 82000, label: '5yr' },
  { id: 'salary-9', x: 5, y: 88000, label: '5yr' },
  { id: 'salary-10', x: 5, y: 78000, label: '5yr' },
  { id: 'salary-11', x: 6, y: 90000, label: '6yr' },
  { id: 'salary-12', x: 6, y: 95000, label: '6yr' },
  { id: 'salary-13', x: 7, y: 98000, label: '7yr' },
  { id: 'salary-14', x: 7, y: 105000, label: '7yr' },
  { id: 'salary-15', x: 8, y: 108000, label: '8yr' },
  { id: 'salary-16', x: 8, y: 102000, label: '8yr' },
  { id: 'salary-17', x: 9, y: 115000, label: '9yr' },
  { id: 'salary-18', x: 9, y: 112000, label: '9yr' },
  { id: 'salary-19', x: 10, y: 120000, label: '10yr' },
  { id: 'salary-20', x: 10, y: 125000, label: '10yr' },
  { id: 'salary-21', x: 11, y: 118000, label: '11yr' },
  { id: 'salary-22', x: 12, y: 130000, label: '12yr' },
  { id: 'salary-23', x: 12, y: 135000, label: '12yr' },
  { id: 'salary-24', x: 13, y: 128000, label: '13yr' },
  { id: 'salary-25', x: 14, y: 140000, label: '14yr' },
  { id: 'salary-26', x: 15, y: 145000, label: '15yr' },
  { id: 'salary-27', x: 15, y: 138000, label: '15yr' },
  { id: 'salary-28', x: 16, y: 152000, label: '16yr' },
  { id: 'salary-29', x: 18, y: 160000, label: '18yr' },
  { id: 'salary-30', x: 20, y: 175000, label: '20yr' },
];

/** Salary against experience, one dot per person, keyed by id for linking. */
const scatterSpec: PlotSpec = {
  width: 380,
  height: 260,
  data: POINTS,
  x: { label: 'Years experience' },
  y: { label: 'Salary ($)' },
  marks: [
    {
      mark: 'dot',
      x: 'x',
      y: 'y',
      key: 'id',
      r: { value: 5 },
      fill: { value: '#6366f1' },
      title: 'label',
    },
  ],
};

/** The same salaries binned, so a bar's range links to the points inside it. */
const histogramSpec: PlotSpec = {
  width: 360,
  height: 260,
  data: POINTS,
  x: { label: 'Salary ($)' },
  y: { label: 'People' },
  marks: [
    {
      mark: 'rect',
      x: 'y',
      fill: { value: '#6366f1' },
      inset: 1,
      title: 'count',
      transform: { type: 'bin', thresholds: 8 },
    },
  ],
};

export const Model = Schema.Struct({
  scatter: Schema.Unknown,
  histogram: Schema.Unknown,
  inspection: Schema.Unknown,
});
export type Model = Omit<typeof Model.Type, 'scatter' | 'histogram' | 'inspection'> & {
  readonly scatter: PlotPanel.Model;
  readonly histogram: PlotPanel.Model;
  readonly inspection: Option.Option<Inspection>;
};

export const initChartModels = () =>
  foldChildInits(
    {
      scatter: PlotPanel.init({ spec: scatterSpec }),
      histogram: PlotPanel.init({ spec: histogramSpec }),
    },
    {
      toParentModel: ({ scatter, histogram }): Model => ({
        scatter,
        histogram,
        inspection: Option.none(),
      }),
      folds: {
        scatter: {
          toParentMessage: (message) => Message.ReceivedScatterMessage({ message }),
        },
        histogram: {
          toParentMessage: (message) => Message.ReceivedHistogramMessage({ message }),
        },
      },
    },
  );

export const init = () => initChartModels();
