import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as TreeMessage } from '../../ui/tidy-tree-chart';

export const Message = defineMessageUnion({
  ReceivedTreeMessage: { message: Schema.Unknown },
});
export type ReceivedTreeMessage = Omit<typeof Message.ReceivedTreeMessage.Type, 'message'> & {
  readonly message: TreeMessage;
};
export type Message = typeof Message.Type;
