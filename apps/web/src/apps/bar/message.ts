import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as BarMessage } from '../../ui/bar-chart';

export const GotBarMessage = m('GotBarMessage', { inner: Schema.Unknown });
export type GotBarMessage = Omit<typeof GotBarMessage.Type, 'inner'> & {
  readonly inner: BarMessage;
};

export const Message = Schema.Union([GotBarMessage]);
export type Message = typeof Message.Type;
