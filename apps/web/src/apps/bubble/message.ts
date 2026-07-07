import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as BubbleMessage } from '../../ui/bubble-chart';

export const GotBubbleMessage = m('GotBubbleMessage', { message: Schema.Unknown });
export type GotBubbleMessage = Omit<typeof GotBubbleMessage.Type, 'message'> & {
  readonly message: BubbleMessage;
};

export const Message = Schema.Union([GotBubbleMessage]);
export type Message = typeof Message.Type;
