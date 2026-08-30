import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ThresholdBarMessage } from '../../ui/threshold-bar-chart';

export const Message = defineMessageUnion({
  GotThresholdBarMessage: { message: Schema.Unknown },
});
export type GotThresholdBarMessage = Omit<typeof Message.GotThresholdBarMessage.Type, 'message'> & {
  readonly message: ThresholdBarMessage;
};
export type Message = typeof Message.Type;
