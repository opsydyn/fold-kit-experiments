import { Schema } from 'effect';

import * as RadarChart from '../../ui/radar-chart';

export const Model = Schema.Struct({ radar: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'radar'> & {
  readonly radar: RadarChart.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [radar] = RadarChart.init({
    axes: ['Performance', 'Expressiveness', 'Type Safety', 'Ecosystem', 'Dev Speed'],
    maxValue: 10,
    series: [
      {
        label: 'TypeScript',
        color: '#3b82f6',
        values: [7, 8, 9, 9, 7],
      },
      {
        label: 'Rust',
        color: '#f97316',
        values: [10, 6, 10, 6, 4],
      },
      {
        label: 'Python',
        color: '#22c55e',
        values: [4, 10, 4, 10, 9],
      },
    ],
  });
  return [{ radar }, []];
};
