import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as CalendarMessage } from '../../ui/calendar-heatmap-chart';

export const GotCalendarMessage = m('GotCalendarMessage', { inner: Schema.Unknown });
export type GotCalendarMessage = Omit<typeof GotCalendarMessage.Type, 'inner'> & {
  readonly inner: CalendarMessage;
};

export const Message = Schema.Union([GotCalendarMessage]);
export type Message = typeof Message.Type;
