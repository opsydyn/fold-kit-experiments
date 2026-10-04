import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as CalendarMessage } from '../../ui/calendar-heatmap-chart';

export const Message = defineMessageUnion({
  ReceivedCalendarMessage: { message: Schema.Unknown },
});
export type ReceivedCalendarMessage = Omit<
  typeof Message.ReceivedCalendarMessage.Type,
  'message'
> & {
  readonly message: CalendarMessage;
};
export type Message = typeof Message.Type;
