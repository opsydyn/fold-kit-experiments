import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Curve } from './model';

export const Message = defineMessageUnion({
  HighlightedSeries: { key: Schema.NullOr(Schema.String) },
  ChoseCurve: { curve: Curve },
});
export type Message = typeof Message.Type;
