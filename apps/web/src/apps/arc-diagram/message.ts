import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ArcMessage } from '../../ui/arc-diagram';

export const Message = defineMessageUnion({
  GotArcMessage: { message: Schema.Unknown },
});
export type GotArcMessage = Omit<typeof Message.GotArcMessage.Type, 'message'> & {
  readonly message: ArcMessage;
};
export type Message = typeof Message.Type;
