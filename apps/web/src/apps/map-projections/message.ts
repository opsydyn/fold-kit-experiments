import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as MapMessage } from '../../ui/map-projections-chart';

export const Message = defineMessageUnion({
  GotMapMessage: { message: Schema.Unknown },
});
export type GotMapMessage = Omit<typeof Message.GotMapMessage.Type, 'message'> & {
  readonly message: MapMessage;
};
export type Message = typeof Message.Type;
