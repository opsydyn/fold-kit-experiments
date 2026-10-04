import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as RadialMessage } from '../../ui/radial-tree-chart';

export const Message = defineMessageUnion({
  ReceivedRadialMessage: { message: Schema.Unknown },
});
export type ReceivedRadialMessage = Omit<typeof Message.ReceivedRadialMessage.Type, 'message'> & {
  readonly message: RadialMessage;
};
export type Message = typeof Message.Type;
