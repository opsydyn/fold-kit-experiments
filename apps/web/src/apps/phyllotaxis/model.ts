import { Schema } from 'effect';
import * as PhyllotaxisChart from '../../ui/phyllotaxis-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: PhyllotaxisChart.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = PhyllotaxisChart.init();
  return [{ chart }, []];
};
