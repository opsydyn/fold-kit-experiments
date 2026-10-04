import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ArcMessage } from '../../ui/arc-diagram';

export const Message = defineMessageUnion({
  ReceivedArcMessage: { message: Schema.Unknown },
});
export type ReceivedArcMessage = Omit<typeof Message.ReceivedArcMessage.Type, 'message'> & {
  readonly message: ArcMessage;
};
export type Message = typeof Message.Type;
