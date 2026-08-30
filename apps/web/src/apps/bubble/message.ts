import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as BubbleMessage } from '../../ui/bubble-chart';

export const Message = defineMessageUnion({
  GotBubbleMessage: { message: Schema.Unknown },
});
export type GotBubbleMessage = Omit<typeof Message.GotBubbleMessage.Type, 'message'> & {
  readonly message: BubbleMessage;
};
export type Message = typeof Message.Type;
