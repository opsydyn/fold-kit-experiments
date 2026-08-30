import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as SankeyMessage } from '../../ui/sankey-chart';

export const Message = defineMessageUnion({
  GotSankeyMessage: { message: Schema.Unknown },
});
export type GotSankeyMessage = Omit<typeof Message.GotSankeyMessage.Type, 'message'> & {
  readonly message: SankeyMessage;
};
export type Message = typeof Message.Type;
