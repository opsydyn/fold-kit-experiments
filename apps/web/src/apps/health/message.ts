import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  FetchedHealth: {
    status: Schema.String,
    uptimeSeconds: Schema.Number,
    startedAt: Schema.String,
    timestamp: Schema.String,
  },
  FetchFailed: { error: Schema.String },
  TickedFrame: { deltaTimeMs: Schema.Number },
});
export type Message = typeof Message.Type;
