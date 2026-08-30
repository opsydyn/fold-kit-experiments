import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as TreemapMessage } from '../../ui/treemap-chart';

export const Message = defineMessageUnion({
  GotTreemapMessage: { message: Schema.Unknown },
});
export type GotTreemapMessage = Omit<typeof Message.GotTreemapMessage.Type, 'message'> & {
  readonly message: TreemapMessage;
};
export type Message = typeof Message.Type;
