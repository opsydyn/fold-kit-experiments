import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as BubbleMessage } from '../../ui/bubble-chart';

export const GotBubbleMessage = m('GotBubbleMessage', { inner: Schema.Unknown });
export type GotBubbleMessage = Omit<typeof GotBubbleMessage.Type, 'inner'> & {
  readonly inner: BubbleMessage;
};

export const Message = Schema.Union([GotBubbleMessage]);
export type Message = typeof Message.Type;
