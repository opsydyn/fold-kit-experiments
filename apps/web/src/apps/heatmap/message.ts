import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as HeatmapMessage } from '../../ui/heatmap-chart';

export const Message = defineMessageUnion({
  ReceivedHeatmapMessage: { message: Schema.Unknown },
});
export type ReceivedHeatmapMessage = Omit<typeof Message.ReceivedHeatmapMessage.Type, 'message'> & {
  readonly message: HeatmapMessage;
};
export type Message = typeof Message.Type;
