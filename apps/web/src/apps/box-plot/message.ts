import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as BoxMessage } from '../../ui/box-plot-chart';

export const Message = defineMessageUnion({
  GotBoxMessage: { message: Schema.Unknown },
});
export type GotBoxMessage = Omit<typeof Message.GotBoxMessage.Type, 'message'> & {
  readonly message: BoxMessage;
};
export type Message = typeof Message.Type;
