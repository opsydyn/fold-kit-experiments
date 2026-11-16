import { Schema } from 'effect';

import type { AppInitProps } from '../types';
import { KINDS } from './engine';

export const Kind = Schema.Literals(KINDS);

/** What DuckDB sent back for the current bins and kind: the two specs with their bins, as JSON. */
export const Ran = Schema.Struct({
  bins: Schema.Number,
  kind: Kind,
  histogram: Schema.Unknown,
  grid: Schema.Unknown,
  ms: Schema.Number,
  statements: Schema.Array(Schema.String),
});
export type Ran = typeof Ran.Type;

export const Model = Schema.Struct({
  /**
   * DuckDB-Wasm's lifecycle: off until the visitor asks, then starting while
   * its worker loads and the table is made, ready, or failed with a reason.
   */
  engine: Schema.Literals(['off', 'starting', 'ready', 'failed']),
  failure: Schema.String,
  bins: Schema.Number,
  kind: Kind,
  /** Whether a query for the current bins and kind is in flight. */
  querying: Schema.Boolean,
  ran: Schema.NullOr(Ran),
});
export type Model = typeof Model.Type;

const initialModel: Model = {
  engine: 'off',
  failure: '',
  bins: 40,
  kind: 'all',
  querying: false,
  ran: null,
};

export const init = (_props: AppInitProps) => ({ model: initialModel });
