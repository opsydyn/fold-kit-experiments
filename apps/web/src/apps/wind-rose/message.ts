import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as WRMessage } from '../../ui/wind-rose-chart';
export const Message = defineMessageUnion({
  GotWRMessage: { message: Schema.Unknown },
});
export type GotWRMessage = Omit<typeof Message.GotWRMessage.Type, 'message'> & {
  readonly message: WRMessage;
};
export type Message = typeof Message.Type;
