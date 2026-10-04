import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as CandleMessage } from '../../ui/candlestick-chart';

export const Message = defineMessageUnion({
  ReceivedCandleMessage: { message: Schema.Unknown },
});
export type ReceivedCandleMessage = Omit<typeof Message.ReceivedCandleMessage.Type, 'message'> & {
  readonly message: CandleMessage;
};
export type Message = typeof Message.Type;
