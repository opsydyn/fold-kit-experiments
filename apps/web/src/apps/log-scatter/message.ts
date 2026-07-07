import { Schema } from 'effect';
import { m } from 'foldkit/message';

import type { Message as LogScatterMessage } from '../../ui/log-scatter-chart';

export const GotLogScatterMessage = m('GotLogScatterMessage', { message: Schema.Unknown });
export type GotLogScatterMessage = Omit<typeof GotLogScatterMessage.Type, 'message'> & {
  readonly message: LogScatterMessage;
};

export const Message = Schema.Union([GotLogScatterMessage]);
export type Message = typeof Message.Type;
