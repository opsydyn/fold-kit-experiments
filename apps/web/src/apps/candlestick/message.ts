import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as CandleMessage } from '../../ui/candlestick-chart';

export const GotCandleMessage = m('GotCandleMessage', { message: Schema.Unknown });
export type GotCandleMessage = Omit<typeof GotCandleMessage.Type, 'message'> & {
  readonly message: CandleMessage;
};

export const Message = Schema.Union([GotCandleMessage]);
export type Message = typeof Message.Type;
