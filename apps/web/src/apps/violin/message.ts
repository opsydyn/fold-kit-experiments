import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ViolinMessage } from '../../ui/violin-chart';

export const Message = defineMessageUnion({
  GotViolinMessage: { message: Schema.Unknown },
});
export type GotViolinMessage = Omit<typeof Message.GotViolinMessage.Type, 'message'> & {
  readonly message: ViolinMessage;
};
export type Message = typeof Message.Type;
