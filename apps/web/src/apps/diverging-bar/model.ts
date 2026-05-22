import { Schema } from 'effect';
import * as DivBar from '../../ui/diverging-bar-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: DivBar.Model;
};

// Monthly YoY revenue growth for a fictional tech company
const BARS: ReadonlyArray<DivBar.Bar> = [
  { label: 'Jan', value: 0.12 },
  { label: 'Feb', value: 0.08 },
  { label: 'Mar', value: -0.03 },
  { label: 'Apr', value: -0.11 },
  { label: 'May', value: -0.18 },
  { label: 'Jun', value: -0.07 },
  { label: 'Jul', value: 0.04 },
  { label: 'Aug', value: 0.15 },
  { label: 'Sep', value: 0.22 },
  { label: 'Oct', value: 0.31 },
  { label: 'Nov', value: 0.19 },
  { label: 'Dec', value: 0.27 },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = DivBar.init({
    bars: BARS,
    xLabel: 'Year-over-year revenue growth',
  });
  return [{ chart }, []];
};
