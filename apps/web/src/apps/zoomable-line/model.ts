import { Schema } from 'effect';

import type { AppInitProps } from '../types';

export const Model = Schema.Struct({
  /** The visible dates in epoch milliseconds when zoomed; null shows the whole year. */
  domain: Schema.NullOr(Schema.Tuple([Schema.Number, Schema.Number])),
});
export type Model = typeof Model.Type;

export const init = (_props: AppInitProps) => ({ model: { domain: null } satisfies Model });
