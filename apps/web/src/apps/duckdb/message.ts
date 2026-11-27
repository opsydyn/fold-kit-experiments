import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { Kind, Ran } from './model';

export const Message = UiSchema.TaggedEnum({
  ClickedLoad: {},
  SelectedBins: { bins: Schema.Number },
  SelectedKind: { kind: Kind },
  AcquiredDuckDB: {},
  FailedDuckDB: { reason: Schema.String },
  RanQueries: { revision: Schema.Int, ran: Ran },
  FailedQueries: { revision: Schema.Int, reason: Schema.String },
});
export type Message = typeof Message.Type;
