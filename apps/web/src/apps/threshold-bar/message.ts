import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as ThresholdBarMessage } from '../../ui/threshold-bar-chart';

export const Message = defineMessageUnion({
  ReceivedThresholdBarMessage: { message: Schema.Unknown },
});
export type ReceivedThresholdBarMessage = Omit<
  typeof Message.ReceivedThresholdBarMessage.Type,
  'message'
> & {
  readonly message: ThresholdBarMessage;
};
export type Message = typeof Message.Type;
