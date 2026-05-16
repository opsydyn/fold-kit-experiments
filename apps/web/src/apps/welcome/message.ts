import { Schema } from 'effect';
import { m } from 'foldkit/message';

export const ReceivedUsername = m('ReceivedUsername', { username: Schema.String });

export const Message = Schema.Union([ReceivedUsername]);
export type Message = typeof Message.Type;
