import { Schema } from 'effect';

import * as EasingCurves from '../../ui/easing-curves-chart';
import type { AppInitProps } from '../types';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: EasingCurves.Model;
};

export const init = (_props: AppInitProps) => {
  const { model: chart } = EasingCurves.init();
  return { model: { chart } };
};
