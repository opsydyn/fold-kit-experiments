import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as HeatmapMessage } from '../../ui/heatmap-chart';

export const Message = defineMessageUnion({
  GotHeatmapMessage: { message: Schema.Unknown },
});
export type GotHeatmapMessage = Omit<typeof Message.GotHeatmapMessage.Type, 'message'> & {
  readonly message: HeatmapMessage;
};
export type Message = typeof Message.Type;
