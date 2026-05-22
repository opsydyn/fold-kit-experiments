import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as EasingMessage } from '../../ui/easing-curves-chart';

export const GotEasingMessage = m('GotEasingMessage', { inner: Schema.Unknown });
export type GotEasingMessage = Omit<typeof GotEasingMessage.Type, 'inner'> & {
  readonly inner: EasingMessage;
};

export const Message = Schema.Union([GotEasingMessage]);
export type Message = typeof Message.Type;
