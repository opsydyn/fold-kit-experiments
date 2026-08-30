import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as EasingMessage } from '../../ui/easing-curves-chart';

export const Message = defineMessageUnion({
  GotEasingMessage: { message: Schema.Unknown },
});
export type GotEasingMessage = Omit<typeof Message.GotEasingMessage.Type, 'message'> & {
  readonly message: EasingMessage;
};
export type Message = typeof Message.Type;
