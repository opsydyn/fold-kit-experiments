import { Schema } from 'effect';
import * as AreaChart from '../../ui/area-chart';

export const Model = Schema.Struct({ area: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'area'> & {
  readonly area: AreaChart.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [area] = AreaChart.init({
    points: [
      { label: 'Jan', value: 28 },
      { label: 'Feb', value: 35 },
      { label: 'Mar', value: 42 },
      { label: 'Apr', value: 58 },
      { label: 'May', value: 65 },
      { label: 'Jun', value: 74 },
      { label: 'Jul', value: 68 },
      { label: 'Aug', value: 83 },
      { label: 'Sep', value: 97 },
      { label: 'Oct', value: 112 },
      { label: 'Nov', value: 124 },
      { label: 'Dec', value: 118 },
    ],
  });
  return [{ area }, []];
};
