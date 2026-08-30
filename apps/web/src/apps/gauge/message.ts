import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as GaugeMessage } from '../../ui/gauge-chart';

export const Message = defineMessageUnion({
  GotGaugeMessage: { message: Schema.Unknown },
});
export type GotGaugeMessage = Omit<typeof Message.GotGaugeMessage.Type, 'message'> & {
  readonly message: GaugeMessage;
};
export type Message = typeof Message.Type;
