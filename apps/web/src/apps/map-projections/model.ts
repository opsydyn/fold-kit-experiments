import { Schema } from 'effect';

import * as MapProjections from '../../ui/map-projections-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: MapProjections.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = MapProjections.init();
  return [{ chart }, []];
};
