import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as LogScatterMessage } from '../../ui/log-scatter-chart';

export const GotLogScatterMessage = m('GotLogScatterMessage', { inner: Schema.Unknown });
export type GotLogScatterMessage = Omit<typeof GotLogScatterMessage.Type, 'inner'> & {
  readonly inner: LogScatterMessage;
};

export const Message = Schema.Union([GotLogScatterMessage]);
export type Message = typeof Message.Type;
