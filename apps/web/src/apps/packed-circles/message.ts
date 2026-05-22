import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as PackedMessage } from '../../ui/packed-circles-chart';

export const GotPackedMessage = m('GotPackedMessage', { inner: Schema.Unknown });
export type GotPackedMessage = Omit<typeof GotPackedMessage.Type, 'inner'> & {
  readonly inner: PackedMessage;
};

export const Message = Schema.Union([GotPackedMessage]);
export type Message = typeof Message.Type;
