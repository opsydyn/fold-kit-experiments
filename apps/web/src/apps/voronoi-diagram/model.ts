import { Schema } from 'effect';

import * as Voronoi from '../../ui/voronoi-chart';
import type { AppInitProps } from '../types';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: Voronoi.Model;
};

export const init = (_props: AppInitProps) => {
  const { model: chart } = Voronoi.init(7);
  return { model: { chart } };
};
