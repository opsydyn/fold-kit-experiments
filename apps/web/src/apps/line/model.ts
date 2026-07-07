import { Schema } from 'effect';

import * as LineChart from '../../ui/line-chart';

export const Model = Schema.Struct({ line: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'line'> & {
  readonly line: LineChart.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [line] = LineChart.init({
    points: [
      { label: 'Jan', value: 42 },
      { label: 'Feb', value: 38 },
      { label: 'Mar', value: 55 },
      { label: 'Apr', value: 61 },
      { label: 'May', value: 78 },
      { label: 'Jun', value: 94 },
      { label: 'Jul', value: 88 },
      { label: 'Aug', value: 102 },
      { label: 'Sep', value: 91 },
      { label: 'Oct', value: 73 },
      { label: 'Nov', value: 58 },
      { label: 'Dec', value: 47 },
    ],
  });
  return [{ line }, []];
};
