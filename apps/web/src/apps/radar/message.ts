import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as RadarMessage } from '../../ui/radar-chart';

export const Message = defineMessageUnion({
  GotRadarMessage: { message: Schema.Unknown },
});
export type GotRadarMessage = Omit<typeof Message.GotRadarMessage.Type, 'message'> & {
  readonly message: RadarMessage;
};
export type Message = typeof Message.Type;
