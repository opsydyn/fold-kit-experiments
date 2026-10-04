import { Schema } from 'effect';

import * as ColorSpaces from '../../ui/color-spaces-chart';
import type { AppInitProps } from '../types';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: ColorSpaces.Model;
};

export const init = (_props: AppInitProps) => {
  const { model: chart } = ColorSpaces.init();
  return { model: { chart } };
};
