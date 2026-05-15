import { Schema } from 'effect';
import { m } from 'foldkit/message';

export const Ticked = m('Ticked', { deltaTimeMs: Schema.Number });
export const Message = Schema.Union([Ticked]);
export type Message = typeof Message.Type;
