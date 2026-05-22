import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as BoxMessage } from '../../ui/box-plot-chart';

export const GotBoxMessage = m('GotBoxMessage', { inner: Schema.Unknown });
export type GotBoxMessage = Omit<typeof GotBoxMessage.Type, 'inner'> & {
  readonly inner: BoxMessage;
};

export const Message = Schema.Union([GotBoxMessage]);
export type Message = typeof Message.Type;
