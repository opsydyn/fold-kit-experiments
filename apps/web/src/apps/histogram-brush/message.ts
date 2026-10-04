import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as HistogramMessage } from '../../ui/histogram-chart';
import type { Message as ScatterMessage } from '../../ui/scatter-chart';

export const Message = defineMessageUnion({
  ReceivedHistogramMessage: { message: Schema.Unknown },
  ReceivedScatterMessage: { message: Schema.Unknown },
});
export type ReceivedHistogramMessage = Omit<
  typeof Message.ReceivedHistogramMessage.Type,
  'message'
> & {
  readonly message: HistogramMessage;
};
export type ReceivedScatterMessage = Omit<typeof Message.ReceivedScatterMessage.Type, 'message'> & {
  readonly message: ScatterMessage;
};
export type Message = typeof Message.Type;
