import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as DonutMessage } from '../../ui/donut-chart';

export const Message = defineMessageUnion({
  ReceivedDonutMessage: { message: Schema.Unknown },
});
export type ReceivedDonutMessage = Omit<typeof Message.ReceivedDonutMessage.Type, 'message'> & {
  readonly message: DonutMessage;
};
export type Message = typeof Message.Type;
