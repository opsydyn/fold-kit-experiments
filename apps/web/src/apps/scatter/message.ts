import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as ScatterMessage } from '../../ui/scatter-chart';

export const GotScatterMessage = m('GotScatterMessage', { message: Schema.Unknown });
export type GotScatterMessage = Omit<typeof GotScatterMessage.Type, 'message'> & {
  readonly message: ScatterMessage;
};

export const Message = Schema.Union([GotScatterMessage]);
export type Message = typeof Message.Type;
