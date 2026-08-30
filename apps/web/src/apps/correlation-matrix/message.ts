import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as CorrMessage } from '../../ui/correlation-matrix';

export const Message = defineMessageUnion({
  GotCorrMessage: { message: Schema.Unknown },
});
export type GotCorrMessage = Omit<typeof Message.GotCorrMessage.Type, 'message'> & {
  readonly message: CorrMessage;
};
export type Message = typeof Message.Type;
