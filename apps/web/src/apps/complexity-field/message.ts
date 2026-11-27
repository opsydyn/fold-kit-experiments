import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

export const Message = UiSchema.TaggedEnum({
  InspectedModule: { key: Schema.NullOr(Schema.String) },
  SelectedModule: { key: Schema.String },
});
export type Message = typeof Message.Type;
