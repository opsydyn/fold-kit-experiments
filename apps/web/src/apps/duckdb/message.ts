import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Kind, Ran } from './model';

export const Message = defineMessageUnion({
  ClickedLoad: {},
  SelectedBins: { bins: Schema.Number },
  SelectedKind: { kind: Kind },
  AcquiredDuckDB: {},
  FailedDuckDB: { reason: Schema.String },
  ReleasedDuckDB: {},
  RanQueries: { ran: Ran },
  FailedQueries: { reason: Schema.String },
});
export type Message = typeof Message.Type;
