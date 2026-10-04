import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as LogScatterMessage } from '../../ui/log-scatter-chart';

export const Message = defineMessageUnion({
  ReceivedLogScatterMessage: { message: Schema.Unknown },
});
export type ReceivedLogScatterMessage = Omit<
  typeof Message.ReceivedLogScatterMessage.Type,
  'message'
> & {
  readonly message: LogScatterMessage;
};
export type Message = typeof Message.Type;
