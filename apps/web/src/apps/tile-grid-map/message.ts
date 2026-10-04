import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as TGMessage } from '../../ui/tile-grid-map';
export const Message = defineMessageUnion({
  ReceivedTGMessage: { message: Schema.Unknown },
});
export type ReceivedTGMessage = Omit<typeof Message.ReceivedTGMessage.Type, 'message'> & {
  readonly message: TGMessage;
};
export type Message = typeof Message.Type;
