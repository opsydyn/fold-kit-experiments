import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as TreeMessage } from '../../ui/tidy-tree-chart';

export const Message = defineMessageUnion({
  GotTreeMessage: { message: Schema.Unknown },
});
export type GotTreeMessage = Omit<typeof Message.GotTreeMessage.Type, 'message'> & {
  readonly message: TreeMessage;
};
export type Message = typeof Message.Type;
