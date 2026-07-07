import { Schema } from 'effect';

import * as ColorSpaces from '../../ui/color-spaces-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: ColorSpaces.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = ColorSpaces.init();
  return [{ chart }, []];
};
