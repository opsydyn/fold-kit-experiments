import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as RadialMessage } from '../../ui/radial-tree-chart';

export const GotRadialMessage = m('GotRadialMessage', { message: Schema.Unknown });
export type GotRadialMessage = Omit<typeof GotRadialMessage.Type, 'message'> & {
  readonly message: RadialMessage;
};

export const Message = Schema.Union([GotRadialMessage]);
export type Message = typeof Message.Type;
