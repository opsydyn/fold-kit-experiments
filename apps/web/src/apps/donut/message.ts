import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as DonutMessage } from '../../ui/donut-chart';

export const Message = defineMessageUnion({
  GotDonutMessage: { message: Schema.Unknown },
});
export type GotDonutMessage = Omit<typeof Message.GotDonutMessage.Type, 'message'> & {
  readonly message: DonutMessage;
};
export type Message = typeof Message.Type;
