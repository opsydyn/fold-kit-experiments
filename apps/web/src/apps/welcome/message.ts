import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

export const Message = UiSchema.TaggedEnum({
  ReceivedUsername: { username: Schema.String },
});
export type Message = typeof Message.Type;
