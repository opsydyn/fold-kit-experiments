import { Schema } from 'effect';
import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';

// 30 salary vs experience data points
const POINTS: ReadonlyArray<Scatter.Point> = [
  { x: 1, y: 55000, label: '1yr' },
  { x: 2, y: 62000, label: '2yr' },
  { x: 2, y: 58000, label: '2yr' },
  { x: 3, y: 68000, label: '3yr' },
  { x: 3, y: 72000, label: '3yr' },
  { x: 4, y: 75000, label: '4yr' },
  { x: 4, y: 80000, label: '4yr' },
  { x: 5, y: 82000, label: '5yr' },
  { x: 5, y: 88000, label: '5yr' },
  { x: 5, y: 78000, label: '5yr' },
  { x: 6, y: 90000, label: '6yr' },
  { x: 6, y: 95000, label: '6yr' },
  { x: 7, y: 98000, label: '7yr' },
  { x: 7, y: 105000, label: '7yr' },
  { x: 8, y: 108000, label: '8yr' },
  { x: 8, y: 102000, label: '8yr' },
  { x: 9, y: 115000, label: '9yr' },
  { x: 9, y: 112000, label: '9yr' },
  { x: 10, y: 120000, label: '10yr' },
  { x: 10, y: 125000, label: '10yr' },
  { x: 11, y: 118000, label: '11yr' },
  { x: 12, y: 130000, label: '12yr' },
  { x: 12, y: 135000, label: '12yr' },
  { x: 13, y: 128000, label: '13yr' },
  { x: 14, y: 140000, label: '14yr' },
  { x: 15, y: 145000, label: '15yr' },
  { x: 15, y: 138000, label: '15yr' },
  { x: 16, y: 152000, label: '16yr' },
  { x: 18, y: 160000, label: '18yr' },
  { x: 20, y: 175000, label: '20yr' },
];

export const Model = Schema.Struct({ scatter: Schema.Unknown, histogram: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'scatter' | 'histogram'> & {
  readonly scatter: Scatter.Model;
  readonly histogram: Histogram.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [scatter] = Scatter.init({
    points: POINTS,
    config: {
      color: '#6366f1',
      activeColor: '#4338ca',
      xLabel: 'Years experience',
      yLabel: 'Salary ($)',
    },
    dims: { width: 380, height: 260 },
  });

  const [histogram] = Histogram.init({
    data: POINTS.map((p) => ({ value: p.y })),
    binCount: 8,
    color: '#6366f1',
    xLabel: 'Salary ($)',
    dims: { width: 360, height: 260 },
  });

  return [{ scatter, histogram }, []];
};
