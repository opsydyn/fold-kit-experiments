import { Schema } from 'effect';
import * as DensityContour from '../../ui/density-contour-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: DensityContour.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = DensityContour.init({ seed: 42 });
  return [{ chart }, []];
};
