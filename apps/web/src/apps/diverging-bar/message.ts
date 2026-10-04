import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as DivBarMessage } from '../../ui/diverging-bar-chart';

export const Message = defineMessageUnion({
  ReceivedDivBarMessage: { message: Schema.Unknown },
});
export type ReceivedDivBarMessage = Omit<typeof Message.ReceivedDivBarMessage.Type, 'message'> & {
  readonly message: DivBarMessage;
};
export type Message = typeof Message.Type;
