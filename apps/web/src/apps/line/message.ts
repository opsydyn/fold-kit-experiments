import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as LineMessage } from '../../ui/line-chart';

export const GotLineMessage = m('GotLineMessage', { inner: Schema.Unknown });
export type GotLineMessage = Omit<typeof GotLineMessage.Type, 'inner'> & {
  readonly inner: LineMessage;
};

export const Message = Schema.Union([GotLineMessage]);
export type Message = typeof Message.Type;
