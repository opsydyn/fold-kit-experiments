import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as HistogramMessage } from '../../ui/histogram-chart';
import type { Message as ScatterMessage } from '../../ui/scatter-chart';

export const Message = defineMessageUnion({
  ReceivedScatterMessage: { message: Schema.Unknown },
  ReceivedHistogramMessage: { message: Schema.Unknown },
});
export type ReceivedScatterMessage = Omit<typeof Message.ReceivedScatterMessage.Type, 'message'> & {
  readonly message: ScatterMessage;
};
export type ReceivedHistogramMessage = Omit<
  typeof Message.ReceivedHistogramMessage.Type,
  'message'
> & {
  readonly message: HistogramMessage;
};
export type Message = typeof Message.Type;
