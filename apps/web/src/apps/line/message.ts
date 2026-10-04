import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as LineMessage } from '../../ui/line-chart';

export const Message = defineMessageUnion({
  ReceivedLineMessage: { message: Schema.Unknown },
});
export type ReceivedLineMessage = Omit<typeof Message.ReceivedLineMessage.Type, 'message'> & {
  readonly message: LineMessage;
};
export type Message = typeof Message.Type;
