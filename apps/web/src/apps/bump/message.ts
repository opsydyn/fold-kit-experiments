import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as BumpMessage } from '../../ui/bump-chart';

export const Message = defineMessageUnion({
  ReceivedBumpMessage: { message: Schema.Unknown },
});
export type ReceivedBumpMessage = Omit<typeof Message.ReceivedBumpMessage.Type, 'message'> & {
  readonly message: BumpMessage;
};
export type Message = typeof Message.Type;
