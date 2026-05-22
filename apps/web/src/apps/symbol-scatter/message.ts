import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ScatterMessage } from '../../ui/symbol-scatter-chart';

export const GotScatterMessage = m('GotScatterMessage', { inner: Schema.Unknown });
export type GotScatterMessage = Omit<typeof GotScatterMessage.Type, 'inner'> & {
  readonly inner: ScatterMessage;
};

export const Message = Schema.Union([GotScatterMessage]);
export type Message = typeof Message.Type;
