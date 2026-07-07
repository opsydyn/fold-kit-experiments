import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as EasingMessage } from '../../ui/easing-curves-chart';

export const GotEasingMessage = m('GotEasingMessage', { message: Schema.Unknown });
export type GotEasingMessage = Omit<typeof GotEasingMessage.Type, 'message'> & {
  readonly message: EasingMessage;
};

export const Message = Schema.Union([GotEasingMessage]);
export type Message = typeof Message.Type;
