import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as LineMessage } from '../../ui/line-chart';

export const GotLineMessage = m('GotLineMessage', { message: Schema.Unknown });
export type GotLineMessage = Omit<typeof GotLineMessage.Type, 'message'> & {
  readonly message: LineMessage;
};

export const Message = Schema.Union([GotLineMessage]);
export type Message = typeof Message.Type;
