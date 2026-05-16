import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as DonutMessage } from '../../ui/donut-chart';

export const GotDonutMessage = m('GotDonutMessage', { inner: Schema.Unknown });
export type GotDonutMessage = Omit<typeof GotDonutMessage.Type, 'inner'> & {
  readonly inner: DonutMessage;
};

export const Message = Schema.Union([GotDonutMessage]);
export type Message = typeof Message.Type;
