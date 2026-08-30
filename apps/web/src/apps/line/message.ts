import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as LineMessage } from '../../ui/line-chart';

export const Message = defineMessageUnion({
  GotLineMessage: { message: Schema.Unknown },
});
export type GotLineMessage = Omit<typeof Message.GotLineMessage.Type, 'message'> & {
  readonly message: LineMessage;
};
export type Message = typeof Message.Type;
