import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as DSBMessage } from '../../ui/diverging-stacked-bar';

export const Message = defineMessageUnion({
  GotDSBMessage: { message: Schema.Unknown },
});
export type GotDSBMessage = Omit<typeof Message.GotDSBMessage.Type, 'message'> & {
  readonly message: DSBMessage;
};
export type Message = typeof Message.Type;
