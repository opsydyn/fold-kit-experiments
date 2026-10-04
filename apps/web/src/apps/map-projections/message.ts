import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as MapMessage } from '../../ui/map-projections-chart';

export const Message = defineMessageUnion({
  ReceivedMapMessage: { message: Schema.Unknown },
});
export type ReceivedMapMessage = Omit<typeof Message.ReceivedMapMessage.Type, 'message'> & {
  readonly message: MapMessage;
};
export type Message = typeof Message.Type;
