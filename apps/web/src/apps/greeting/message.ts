import { Schema } from 'effect';
import { m } from 'foldkit/message';

export const Reset = m('Reset', {});
export const Message = Schema.Union([Reset]);
export type Message = typeof Message.Type;
