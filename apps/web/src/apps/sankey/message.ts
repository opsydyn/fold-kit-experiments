import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as SankeyMessage } from '../../ui/sankey-chart';

export const Message = defineMessageUnion({
  ReceivedSankeyMessage: { message: Schema.Unknown },
});
export type ReceivedSankeyMessage = Omit<typeof Message.ReceivedSankeyMessage.Type, 'message'> & {
  readonly message: SankeyMessage;
};
export type Message = typeof Message.Type;
