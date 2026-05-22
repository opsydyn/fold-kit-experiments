import { Schema } from 'effect';
import * as EasingCurves from '../../ui/easing-curves-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: EasingCurves.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = EasingCurves.init();
  return [{ chart }, []];
};
