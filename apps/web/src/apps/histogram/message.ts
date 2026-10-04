import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as HistogramMessage } from '../../ui/histogram-chart';

export const Message = defineMessageUnion({
  ReceivedHistogramMessage: { message: Schema.Unknown },
});
export type ReceivedHistogramMessage = Omit<
  typeof Message.ReceivedHistogramMessage.Type,
  'message'
> & {
  readonly message: HistogramMessage;
};
export type Message = typeof Message.Type;
