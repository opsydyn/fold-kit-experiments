import { Schema } from 'effect';

import * as CurveComparison from '../../ui/curve-comparison-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: CurveComparison.Model;
};

// 10 points with a non-monotone shape to make curve differences visible
const DATA: ReadonlyArray<readonly [number, number]> = [
  [0, 20],
  [1, 80],
  [2, 45],
  [3, 60],
  [4, 10],
  [5, 95],
  [6, 30],
  [7, 70],
  [8, 50],
  [9, 90],
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = CurveComparison.init({
    data: DATA,
    xLabel: 'x',
    yLabel: 'y',
  });
  return [{ chart }, []];
};
