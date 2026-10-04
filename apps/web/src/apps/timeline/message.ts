import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as TimelineMessage } from '../../ui/timeline-chart';

export const Message = defineMessageUnion({
  ReceivedTimelineMessage: { message: Schema.Unknown },
});
export type ReceivedTimelineMessage = Omit<
  typeof Message.ReceivedTimelineMessage.Type,
  'message'
> & {
  readonly message: TimelineMessage;
};
export type Message = typeof Message.Type;
