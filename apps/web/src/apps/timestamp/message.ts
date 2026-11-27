import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

export const Message = UiSchema.TaggedEnum({
  FormattedStart: { label: Schema.String },
  Ticked: { deltaTimeMs: Schema.Number },
});
export type Message = typeof Message.Type;
