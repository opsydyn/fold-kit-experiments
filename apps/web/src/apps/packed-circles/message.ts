import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as PackedMessage } from '../../ui/packed-circles-chart';

export const Message = defineMessageUnion({
  GotPackedMessage: { message: Schema.Unknown },
});
export type GotPackedMessage = Omit<typeof Message.GotPackedMessage.Type, 'message'> & {
  readonly message: PackedMessage;
};
export type Message = typeof Message.Type;
