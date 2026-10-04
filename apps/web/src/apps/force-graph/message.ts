import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as GraphMessage } from '../../ui/force-graph';

export const Message = defineMessageUnion({
  ReceivedGraphMessage: { message: Schema.Unknown },
});
export type ReceivedGraphMessage = Omit<typeof Message.ReceivedGraphMessage.Type, 'message'> & {
  readonly message: GraphMessage;
};
export type Message = typeof Message.Type;
