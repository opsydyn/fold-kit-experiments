import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as BoxMessage } from '../../ui/box-plot-chart';

export const Message = defineMessageUnion({
  ReceivedBoxMessage: { message: Schema.Unknown },
});
export type ReceivedBoxMessage = Omit<typeof Message.ReceivedBoxMessage.Type, 'message'> & {
  readonly message: BoxMessage;
};
export type Message = typeof Message.Type;
