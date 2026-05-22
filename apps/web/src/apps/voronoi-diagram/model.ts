import { Schema } from 'effect';
import * as Voronoi from '../../ui/voronoi-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: Voronoi.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = Voronoi.init(7);
  return [{ chart }, []];
};
