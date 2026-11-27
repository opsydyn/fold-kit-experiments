import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { Curve } from './model';

export const Message = UiSchema.TaggedEnum({
  HighlightedSeries: { key: Schema.NullOr(Schema.String) },
  ChoseCurve: { curve: Curve },
});
export type Message = typeof Message.Type;
