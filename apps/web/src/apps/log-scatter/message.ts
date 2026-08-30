import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as LogScatterMessage } from '../../ui/log-scatter-chart';

export const Message = defineMessageUnion({
  GotLogScatterMessage: { message: Schema.Unknown },
});
export type GotLogScatterMessage = Omit<typeof Message.GotLogScatterMessage.Type, 'message'> & {
  readonly message: LogScatterMessage;
};
export type Message = typeof Message.Type;
