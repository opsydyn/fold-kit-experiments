import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as TimelineMessage } from '../../ui/timeline-chart';

export const Message = defineMessageUnion({
  GotTimelineMessage: { message: Schema.Unknown },
});
export type GotTimelineMessage = Omit<typeof Message.GotTimelineMessage.Type, 'message'> & {
  readonly message: TimelineMessage;
};
export type Message = typeof Message.Type;
