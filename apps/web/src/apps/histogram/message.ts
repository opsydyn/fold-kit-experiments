import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as HistogramMessage } from '../../ui/histogram-chart';

export const Message = defineMessageUnion({
  GotHistogramMessage: { message: Schema.Unknown },
});
export type GotHistogramMessage = Omit<typeof Message.GotHistogramMessage.Type, 'message'> & {
  readonly message: HistogramMessage;
};
export type Message = typeof Message.Type;
