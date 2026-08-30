import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  Ticked: { deltaTimeMs: Schema.Number },
});
export type Message = typeof Message.Type;
