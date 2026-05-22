import { Schema } from 'effect';
import * as ParallelCoordsChart from '../../ui/parallel-coords-chart';

export const Model = Schema.Struct({ parallelCoords: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'parallelCoords'> & {
  readonly parallelCoords: ParallelCoordsChart.Model;
};

// Columns: MPG, HP, Weight (lb), 0-60 (s), Year
const AXES: ReadonlyArray<ParallelCoordsChart.Axis> = [
  { label: 'MPG' },
  { label: 'HP' },
  { label: 'Wt (lb)' },
  { label: '0-60s' },
  { label: 'Year' },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [parallelCoords] = ParallelCoordsChart.init({
    axes: AXES,
    records: [
      { label: 'Prius', color: '#10b981', values: [52, 121, 3010, 9.8, 2020] },
      { label: 'Civic', color: '#3b82f6', values: [36, 158, 2877, 7.8, 2023] },
      { label: 'VW Golf TDI', color: '#06b6d4', values: [43, 184, 3043, 7.5, 2019] },
      { label: 'Mazda CX-5', color: '#f59e0b', values: [28, 187, 3655, 7.4, 2023] },
      { label: 'Silverado', color: '#6366f1', values: [14, 310, 4520, 7.1, 2022] },
      { label: 'Mustang GT', color: '#ef4444', values: [18, 450, 3813, 4.2, 2021] },
      { label: 'BMW M3', color: '#8b5cf6', values: [20, 503, 3827, 3.8, 2023] },
      { label: 'Charger SRT', color: '#ec4899', values: [13, 797, 4586, 3.6, 2022] },
    ],
  });
  return [{ parallelCoords }, []];
};
