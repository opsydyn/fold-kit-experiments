import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as WRMessage } from '../../ui/wind-rose-chart';
export const Message = defineMessageUnion({
  ReceivedWRMessage: { message: Schema.Unknown },
});
export type ReceivedWRMessage = Omit<typeof Message.ReceivedWRMessage.Type, 'message'> & {
  readonly message: WRMessage;
};
export type Message = typeof Message.Type;
