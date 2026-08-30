import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as TGMessage } from '../../ui/tile-grid-map';
export const Message = defineMessageUnion({
  GotTGMessage: { message: Schema.Unknown },
});
export type GotTGMessage = Omit<typeof Message.GotTGMessage.Type, 'message'> & {
  readonly message: TGMessage;
};
export type Message = typeof Message.Type;
