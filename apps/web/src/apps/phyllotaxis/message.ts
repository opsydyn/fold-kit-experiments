import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as PhyllotaxisMessage } from '../../ui/phyllotaxis-chart';

export const Message = defineMessageUnion({
  GotPhyllotaxisMessage: { message: Schema.Unknown },
});
export type GotPhyllotaxisMessage = Omit<typeof Message.GotPhyllotaxisMessage.Type, 'message'> & {
  readonly message: PhyllotaxisMessage;
};
export type Message = typeof Message.Type;
