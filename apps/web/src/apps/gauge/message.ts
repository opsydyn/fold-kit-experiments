import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as GaugeMessage } from '../../ui/gauge-chart';

export const Message = defineMessageUnion({
  ReceivedGaugeMessage: { message: Schema.Unknown },
});
export type ReceivedGaugeMessage = Omit<typeof Message.ReceivedGaugeMessage.Type, 'message'> & {
  readonly message: GaugeMessage;
};
export type Message = typeof Message.Type;
