import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as DonutMessage } from '../../ui/donut-chart';

export const GotDonutMessage = m('GotDonutMessage', { message: Schema.Unknown });
export type GotDonutMessage = Omit<typeof GotDonutMessage.Type, 'message'> & {
  readonly message: DonutMessage;
};

export const Message = Schema.Union([GotDonutMessage]);
export type Message = typeof Message.Type;
