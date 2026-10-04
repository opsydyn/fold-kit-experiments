import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as EasingMessage } from '../../ui/easing-curves-chart';

export const Message = defineMessageUnion({
  ReceivedEasingMessage: { message: Schema.Unknown },
});
export type ReceivedEasingMessage = Omit<typeof Message.ReceivedEasingMessage.Type, 'message'> & {
  readonly message: EasingMessage;
};
export type Message = typeof Message.Type;
