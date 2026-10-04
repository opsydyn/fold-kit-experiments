import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as TreemapMessage } from '../../ui/treemap-chart';

export const Message = defineMessageUnion({
  ReceivedTreemapMessage: { message: Schema.Unknown },
});
export type ReceivedTreemapMessage = Omit<typeof Message.ReceivedTreemapMessage.Type, 'message'> & {
  readonly message: TreemapMessage;
};
export type Message = typeof Message.Type;
