import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as DSBMessage } from '../../ui/diverging-stacked-bar';

export const Message = defineMessageUnion({
  ReceivedDSBMessage: { message: Schema.Unknown },
});
export type ReceivedDSBMessage = Omit<typeof Message.ReceivedDSBMessage.Type, 'message'> & {
  readonly message: DSBMessage;
};
export type Message = typeof Message.Type;
