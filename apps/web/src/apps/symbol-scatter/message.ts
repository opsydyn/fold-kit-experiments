import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ScatterMessage } from '../../ui/symbol-scatter-chart';

export const Message = defineMessageUnion({
  ReceivedScatterMessage: { message: Schema.Unknown },
});
export type ReceivedScatterMessage = Omit<typeof Message.ReceivedScatterMessage.Type, 'message'> & {
  readonly message: ScatterMessage;
};
export type Message = typeof Message.Type;
