import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as BoxMessage } from '../../ui/box-plot-chart';

export const GotBoxMessage = m('GotBoxMessage', { message: Schema.Unknown });
export type GotBoxMessage = Omit<typeof GotBoxMessage.Type, 'message'> & {
  readonly message: BoxMessage;
};

export const Message = Schema.Union([GotBoxMessage]);
export type Message = typeof Message.Type;
