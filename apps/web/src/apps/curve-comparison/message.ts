import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as CurveMessage } from '../../ui/curve-comparison-chart';

export const Message = defineMessageUnion({
  ReceivedCurveMessage: { message: Schema.Unknown },
});
export type ReceivedCurveMessage = Omit<typeof Message.ReceivedCurveMessage.Type, 'message'> & {
  readonly message: CurveMessage;
};
export type Message = typeof Message.Type;
