import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as BarMessage } from '../../ui/bar-chart';

export const Message = defineMessageUnion({
  ReceivedBarMessage: { message: Schema.Unknown },
});
export type ReceivedBarMessage = Omit<typeof Message.ReceivedBarMessage.Type, 'message'> & {
  readonly message: BarMessage;
};
export type Message = typeof Message.Type;
