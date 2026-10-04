import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as BubbleMessage } from '../../ui/bubble-chart';

export const Message = defineMessageUnion({
  ReceivedBubbleMessage: { message: Schema.Unknown },
});
export type ReceivedBubbleMessage = Omit<typeof Message.ReceivedBubbleMessage.Type, 'message'> & {
  readonly message: BubbleMessage;
};
export type Message = typeof Message.Type;
