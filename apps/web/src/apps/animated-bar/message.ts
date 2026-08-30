import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  Ticked: { dt: Schema.Number },
  HoveredBar: { index: Schema.Number },
  BlurredBar: {},
});
export type Message = typeof Message.Type;
