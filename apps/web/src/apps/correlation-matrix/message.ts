import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as CorrMessage } from '../../ui/correlation-matrix';

export const Message = defineMessageUnion({
  ReceivedCorrMessage: { message: Schema.Unknown },
});
export type ReceivedCorrMessage = Omit<typeof Message.ReceivedCorrMessage.Type, 'message'> & {
  readonly message: CorrMessage;
};
export type Message = typeof Message.Type;
