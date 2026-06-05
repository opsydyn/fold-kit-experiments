import { Schema } from 'effect';
import * as TG from '../../ui/tile-grid-map';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & { readonly chart: TG.Model };

// US state tile grid — [col, row] positions approximate the US map shape.
// Value = GDP index (illustrative, not real data).
const US_STATES: ReadonlyArray<TG.TileCell> = [
  { id: 'AK', label: 'AK', col: 0, row: 5, value: 55 },
  { id: 'HI', label: 'HI', col: 1, row: 6, value: 68 },
  { id: 'WA', label: 'WA', col: 1, row: 0, value: 82 },
  { id: 'MT', label: 'MT', col: 2, row: 0, value: 45 },
  { id: 'ND', label: 'ND', col: 3, row: 0, value: 48 },
  { id: 'MN', label: 'MN', col: 4, row: 0, value: 72 },
  { id: 'WI', label: 'WI', col: 5, row: 1, value: 66 },
  { id: 'MI', label: 'MI', col: 6, row: 1, value: 70 },
  { id: 'VT', label: 'VT', col: 9, row: 0, value: 60 },
  { id: 'ME', label: 'ME', col: 10, row: 0, value: 42 },
  { id: 'OR', label: 'OR', col: 1, row: 1, value: 79 },
  { id: 'ID', label: 'ID', col: 2, row: 1, value: 50 },
  { id: 'SD', label: 'SD', col: 3, row: 1, value: 44 },
  { id: 'IA', label: 'IA', col: 4, row: 2, value: 62 },
  { id: 'IL', label: 'IL', col: 5, row: 2, value: 88 },
  { id: 'IN', label: 'IN', col: 6, row: 2, value: 67 },
  { id: 'OH', label: 'OH', col: 7, row: 2, value: 75 },
  { id: 'PA', label: 'PA', col: 8, row: 2, value: 84 },
  { id: 'NY', label: 'NY', col: 9, row: 1, value: 96 },
  { id: 'NH', label: 'NH', col: 10, row: 1, value: 61 },
  { id: 'CA', label: 'CA', col: 1, row: 2, value: 100 },
  { id: 'NV', label: 'NV', col: 2, row: 2, value: 58 },
  { id: 'WY', label: 'WY', col: 2, row: 2, value: 47 },
  { id: 'NE', label: 'NE', col: 3, row: 2, value: 57 },
  { id: 'MO', label: 'MO', col: 4, row: 3, value: 65 },
  { id: 'KY', label: 'KY', col: 6, row: 3, value: 56 },
  { id: 'WV', label: 'WV', col: 7, row: 3, value: 38 },
  { id: 'VA', label: 'VA', col: 8, row: 3, value: 80 },
  { id: 'MD', label: 'MD', col: 9, row: 2, value: 83 },
  { id: 'DE', label: 'DE', col: 10, row: 2, value: 71 },
  { id: 'NJ', label: 'NJ', col: 10, row: 3, value: 90 },
  { id: 'CT', label: 'CT', col: 10, row: 4, value: 85 },
  { id: 'RI', label: 'RI', col: 11, row: 4, value: 59 },
  { id: 'MA', label: 'MA', col: 11, row: 3, value: 87 },
  { id: 'AZ', label: 'AZ', col: 2, row: 3, value: 73 },
  { id: 'CO', label: 'CO', col: 3, row: 3, value: 76 },
  { id: 'KS', label: 'KS', col: 4, row: 4, value: 60 },
  { id: 'AR', label: 'AR', col: 5, row: 4, value: 46 },
  { id: 'TN', label: 'TN', col: 6, row: 4, value: 63 },
  { id: 'NC', label: 'NC', col: 7, row: 4, value: 74 },
  { id: 'SC', label: 'SC', col: 8, row: 4, value: 55 },
  { id: 'DC', label: 'DC', col: 9, row: 3, value: 99 },
  { id: 'NM', label: 'NM', col: 3, row: 4, value: 44 },
  { id: 'OK', label: 'OK', col: 4, row: 5, value: 51 },
  { id: 'LA', label: 'LA', col: 5, row: 5, value: 54 },
  { id: 'MS', label: 'MS', col: 6, row: 5, value: 36 },
  { id: 'AL', label: 'AL', col: 6, row: 5, value: 43 },
  { id: 'GA', label: 'GA', col: 7, row: 5, value: 69 },
  { id: 'TX', label: 'TX', col: 4, row: 6, value: 94 },
  { id: 'FL', label: 'FL', col: 8, row: 6, value: 81 },
];

export const init = (_: unknown): readonly [Model, readonly []] => {
  const [chart] = TG.init({
    cells: US_STATES,
    tileSize: 32,
    colorLow: '#dbeafe',
    colorHigh: '#1d4ed8',
    legendLabel: 'GDP index',
  });
  return [{ chart }, []];
};
