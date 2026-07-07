import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as TimelineMessage } from '../../ui/timeline-chart';

export const GotTimelineMessage = m('GotTimelineMessage', { message: Schema.Unknown });
export type GotTimelineMessage = Omit<typeof GotTimelineMessage.Type, 'message'> & {
  readonly message: TimelineMessage;
};

export const Message = Schema.Union([GotTimelineMessage]);
export type Message = typeof Message.Type;
