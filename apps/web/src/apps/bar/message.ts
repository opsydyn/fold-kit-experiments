import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as BarMessage } from '../../ui/bar-chart';

export const Message = defineMessageUnion({
  GotBarMessage: { message: Schema.Unknown },
});
export type GotBarMessage = Omit<typeof Message.GotBarMessage.Type, 'message'> & {
  readonly message: BarMessage;
};
export type Message = typeof Message.Type;
