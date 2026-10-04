import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ViolinMessage } from '../../ui/violin-chart';

export const Message = defineMessageUnion({
  ReceivedViolinMessage: { message: Schema.Unknown },
});
export type ReceivedViolinMessage = Omit<typeof Message.ReceivedViolinMessage.Type, 'message'> & {
  readonly message: ViolinMessage;
};
export type Message = typeof Message.Type;
