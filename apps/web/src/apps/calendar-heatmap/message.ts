import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as CalendarMessage } from '../../ui/calendar-heatmap-chart';

export const GotCalendarMessage = m('GotCalendarMessage', { message: Schema.Unknown });
export type GotCalendarMessage = Omit<typeof GotCalendarMessage.Type, 'message'> & {
  readonly message: CalendarMessage;
};

export const Message = Schema.Union([GotCalendarMessage]);
export type Message = typeof Message.Type;
