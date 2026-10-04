import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as StreamgraphMessage } from '../../ui/streamgraph-chart';

export const Message = defineMessageUnion({
  ReceivedStreamgraphMessage: { message: Schema.Unknown },
});
export type ReceivedStreamgraphMessage = Omit<
  typeof Message.ReceivedStreamgraphMessage.Type,
  'message'
> & {
  readonly message: StreamgraphMessage;
};
export type Message = typeof Message.Type;
