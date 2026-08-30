import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as DivBarMessage } from '../../ui/diverging-bar-chart';

export const Message = defineMessageUnion({
  GotDivBarMessage: { message: Schema.Unknown },
});
export type GotDivBarMessage = Omit<typeof Message.GotDivBarMessage.Type, 'message'> & {
  readonly message: DivBarMessage;
};
export type Message = typeof Message.Type;
