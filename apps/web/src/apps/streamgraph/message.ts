import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as StreamgraphMessage } from '../../ui/streamgraph-chart';

export const Message = defineMessageUnion({
  GotStreamgraphMessage: { message: Schema.Unknown },
});
export type GotStreamgraphMessage = Omit<typeof Message.GotStreamgraphMessage.Type, 'message'> & {
  readonly message: StreamgraphMessage;
};
export type Message = typeof Message.Type;
