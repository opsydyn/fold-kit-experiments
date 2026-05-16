import { Schema } from 'effect';
import * as ScatterChart from '../../ui/scatter-chart';

export const Model = Schema.Struct({ scatter: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'scatter'> & {
  readonly scatter: ScatterChart.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [scatter] = ScatterChart.init({
    points: [
      { label: 'Alice', x: 2, y: 52 },
      { label: 'Bob', x: 5, y: 68 },
      { label: 'Carol', x: 8, y: 85 },
      { label: 'Dave', x: 1, y: 46 },
      { label: 'Eve', x: 12, y: 105 },
      { label: 'Frank', x: 4, y: 62 },
      { label: 'Grace', x: 7, y: 80 },
      { label: 'Hank', x: 3, y: 57 },
      { label: 'Iris', x: 10, y: 96 },
      { label: 'Jack', x: 6, y: 74 },
      { label: 'Kim', x: 15, y: 122 },
      { label: 'Leo', x: 9, y: 90 },
      { label: 'Mia', x: 11, y: 99 },
      { label: 'Nick', x: 14, y: 116 },
      { label: 'Olivia', x: 13, y: 110 },
    ],
    config: {
      xLabel: 'Experience (yrs)',
      yLabel: 'Salary ($k)',
    },
  });
  return [{ scatter }, []];
};
