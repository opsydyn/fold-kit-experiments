import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as CalendarMessage } from '../../ui/calendar-heatmap-chart';

export const Message = defineMessageUnion({
  GotCalendarMessage: { message: Schema.Unknown },
});
export type GotCalendarMessage = Omit<typeof Message.GotCalendarMessage.Type, 'message'> & {
  readonly message: CalendarMessage;
};
export type Message = typeof Message.Type;
