import { Schema } from 'effect';
import * as BarChart from '../../ui/bar-chart';

export const Model = Schema.Struct({ bar: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'bar'> & {
  readonly bar: BarChart.Model;
};

const BARS: ReadonlyArray<BarChart.Bar> = [
  { label: 'Jan', value: 42 },
  { label: 'Feb', value: 68 },
  { label: 'Mar', value: 55 },
  { label: 'Apr', value: 91 },
  { label: 'May', value: 73 },
  { label: 'Jun', value: 38 },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [bar] = BarChart.init({ bars: BARS });
  return [{ bar }, []];
};
