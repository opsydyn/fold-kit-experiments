import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

export const Message = UiSchema.TaggedEnum({
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
