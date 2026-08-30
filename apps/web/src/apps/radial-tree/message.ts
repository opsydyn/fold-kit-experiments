import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as RadialMessage } from '../../ui/radial-tree-chart';

export const Message = defineMessageUnion({
  GotRadialMessage: { message: Schema.Unknown },
});
export type GotRadialMessage = Omit<typeof Message.GotRadialMessage.Type, 'message'> & {
  readonly message: RadialMessage;
};
export type Message = typeof Message.Type;
