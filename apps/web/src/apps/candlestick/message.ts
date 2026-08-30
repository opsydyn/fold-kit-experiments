import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as CandleMessage } from '../../ui/candlestick-chart';

export const Message = defineMessageUnion({
  GotCandleMessage: { message: Schema.Unknown },
});
export type GotCandleMessage = Omit<typeof Message.GotCandleMessage.Type, 'message'> & {
  readonly message: CandleMessage;
};
export type Message = typeof Message.Type;
