import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as GraphMessage } from '../../ui/force-graph';

export const Message = defineMessageUnion({
  GotGraphMessage: { message: Schema.Unknown },
});
export type GotGraphMessage = Omit<typeof Message.GotGraphMessage.Type, 'message'> & {
  readonly message: GraphMessage;
};
export type Message = typeof Message.Type;
