import { Schema } from 'effect';
import { m } from 'foldkit/message';

export const FetchedHealth = m('FetchedHealth', {
  status: Schema.String,
  uptimeSeconds: Schema.Number,
  startedAt: Schema.String,
  timestamp: Schema.String,
});

export const FetchFailed = m('FetchFailed', { error: Schema.String });

export const TickedFrame = m('TickedFrame', { deltaTimeMs: Schema.Number });

export const Message = Schema.Union([FetchedHealth, FetchFailed, TickedFrame]);
export type Message = typeof Message.Type;
