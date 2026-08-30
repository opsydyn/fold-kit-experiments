import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as CurveMessage } from '../../ui/curve-comparison-chart';

export const Message = defineMessageUnion({
  GotCurveMessage: { message: Schema.Unknown },
});
export type GotCurveMessage = Omit<typeof Message.GotCurveMessage.Type, 'message'> & {
  readonly message: CurveMessage;
};
export type Message = typeof Message.Type;
