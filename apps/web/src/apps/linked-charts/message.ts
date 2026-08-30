import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as HistogramMessage } from '../../ui/histogram-chart';
import type { Message as ScatterMessage } from '../../ui/scatter-chart';

export const Message = defineMessageUnion({
  GotScatterMessage: { message: Schema.Unknown },
  GotHistogramMessage: { message: Schema.Unknown },
});
export type GotScatterMessage = Omit<typeof Message.GotScatterMessage.Type, 'message'> & {
  readonly message: ScatterMessage;
};
export type GotHistogramMessage = Omit<typeof Message.GotHistogramMessage.Type, 'message'> & {
  readonly message: HistogramMessage;
};
export type Message = typeof Message.Type;
