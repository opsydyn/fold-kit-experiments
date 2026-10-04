import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as PackedMessage } from '../../ui/packed-circles-chart';

export const Message = defineMessageUnion({
  ReceivedPackedMessage: { message: Schema.Unknown },
});
export type ReceivedPackedMessage = Omit<typeof Message.ReceivedPackedMessage.Type, 'message'> & {
  readonly message: PackedMessage;
};
export type Message = typeof Message.Type;
