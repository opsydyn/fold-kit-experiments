import { Schema } from 'effect';

import * as WR from '../../ui/wind-rose-chart';
export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & { readonly chart: WR.Model };
export const init = (_: unknown): readonly [Model, readonly []] => {
  const [chart] = WR.init({
    segments: [
      { label: 'N', value: 12, color: '#6366f1' },
      { label: 'NE', value: 8, color: '#818cf8' },
      { label: 'E', value: 15, color: '#4f46e5' },
      { label: 'SE', value: 6, color: '#7c3aed' },
      { label: 'S', value: 20, color: '#a855f7' },
      { label: 'SW', value: 9, color: '#c084fc' },
      { label: 'W', value: 18, color: '#8b5cf6' },
      { label: 'NW', value: 5, color: '#a78bfa' },
    ],
    centerLabel: 'Wind',
    dims: { width: 300, height: 300 },
  });
  return [{ chart }, []];
};
