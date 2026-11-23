import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { Message as PlotPanelMessage } from '../../ui/plot-panel';

export const Message = defineMessageUnion({
  ChangedMinimumExperience: { years: Schema.Number },
  ReceivedScatterMessage: { message: Schema.Unknown },
  ReceivedHistogramMessage: { message: Schema.Unknown },
});
export type ReceivedScatterMessage = Omit<typeof Message.ReceivedScatterMessage.Type, 'message'> & {
  readonly message: PlotPanelMessage;
};
export type ReceivedHistogramMessage = Omit<
  typeof Message.ReceivedHistogramMessage.Type,
  'message'
> & {
  readonly message: PlotPanelMessage;
};
export type Message = typeof Message.Type;
