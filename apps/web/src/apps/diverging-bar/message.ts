import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as DivBarMessage } from '../../ui/diverging-bar-chart';

export const GotDivBarMessage = m('GotDivBarMessage', { message: Schema.Unknown });
export type GotDivBarMessage = Omit<typeof GotDivBarMessage.Type, 'message'> & {
  readonly message: DivBarMessage;
};

export const Message = Schema.Union([GotDivBarMessage]);
export type Message = typeof Message.Type;
