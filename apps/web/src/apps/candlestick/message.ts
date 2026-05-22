import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as CandleMessage } from '../../ui/candlestick-chart';

export const GotCandleMessage = m('GotCandleMessage', { inner: Schema.Unknown });
export type GotCandleMessage = Omit<typeof GotCandleMessage.Type, 'inner'> & {
  readonly inner: CandleMessage;
};

export const Message = Schema.Union([GotCandleMessage]);
export type Message = typeof Message.Type;
