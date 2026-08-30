import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as BumpMessage } from '../../ui/bump-chart';

export const Message = defineMessageUnion({
  GotBumpMessage: { message: Schema.Unknown },
});
export type GotBumpMessage = Omit<typeof Message.GotBumpMessage.Type, 'message'> & {
  readonly message: BumpMessage;
};
export type Message = typeof Message.Type;
