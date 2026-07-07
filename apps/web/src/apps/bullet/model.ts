import { Schema } from 'effect';

import * as Bullet from '../../ui/bullet-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & { readonly chart: Bullet.Model };

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = Bullet.init({
    data: [
      { label: 'Revenue', value: 270, target: 300, ranges: [200, 250, 350] },
      { label: 'Profit', value: 45, target: 50, ranges: [30, 40, 60] },
      { label: 'Orders', value: 1800, target: 2000, ranges: [1200, 1600, 2200] },
      { label: 'Sat. score', value: 4.2, target: 4.5, ranges: [3.0, 3.8, 5.0] },
      { label: 'Churn rate', value: 3.8, target: 3.0, ranges: [5.0, 4.0, 2.5] },
    ],
    color: '#1e40af',
    targetColor: '#111',
  });
  return [{ chart }, []];
};
