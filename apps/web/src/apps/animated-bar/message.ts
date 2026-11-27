import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

export const Message = UiSchema.TaggedEnum({
  Ticked: { dt: Schema.Number },
  HoveredBar: { index: Schema.Number },
  BlurredBar: {},
});
export type Message = typeof Message.Type;
