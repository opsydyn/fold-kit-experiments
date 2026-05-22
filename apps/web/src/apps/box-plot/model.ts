import { Schema } from 'effect';
import * as BoxChart from '../../ui/box-plot-chart';

export const Model = Schema.Struct({ box: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'box'> & {
  readonly box: BoxChart.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [box] = BoxChart.init({
    series: [
      { label: 'IC1', values: [42, 45, 47, 48, 50, 52, 55, 58, 60, 65] },
      { label: 'IC2', values: [65, 68, 70, 72, 75, 78, 80, 82, 88, 92] },
      { label: 'IC3', values: [88, 90, 95, 98, 100, 105, 108, 110, 115, 120] },
      { label: 'IC4', values: [125, 128, 130, 132, 135, 138, 140, 142, 145, 150] },
      { label: 'IC5', values: [160, 165, 168, 170, 172, 175, 178, 180, 185, 190] },
    ],
    config: { yLabel: '$k' },
  });
  return [{ box }, []];
};
