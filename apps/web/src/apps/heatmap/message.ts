import { Schema } from 'effect';
import { m } from 'foldkit/message';
import type { Message as HeatmapMessage } from '../../ui/heatmap-chart';

export const GotHeatmapMessage = m('GotHeatmapMessage', { inner: Schema.Unknown });
export type GotHeatmapMessage = Omit<typeof GotHeatmapMessage.Type, 'inner'> & {
  readonly inner: HeatmapMessage;
};

export const Message = Schema.Union([GotHeatmapMessage]);
export type Message = typeof Message.Type;
