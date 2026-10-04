import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as RadarMessage } from '../../ui/radar-chart';

export const Message = defineMessageUnion({
  ReceivedRadarMessage: { message: Schema.Unknown },
});
export type ReceivedRadarMessage = Omit<typeof Message.ReceivedRadarMessage.Type, 'message'> & {
  readonly message: RadarMessage;
};
export type Message = typeof Message.Type;
