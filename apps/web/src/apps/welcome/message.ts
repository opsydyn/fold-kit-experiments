import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  ReceivedUsername: { username: Schema.String },
});
export type Message = typeof Message.Type;
