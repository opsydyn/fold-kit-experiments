import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { Message as PlotPanelMessage } from '../../ui/plot-panel/core';

export const Message = UiSchema.TaggedEnum({
  ChangedMinimumExperience: { years: Schema.Number },
  ReceivedScatterMessage: { message: PlotPanelMessage },
  ReceivedHistogramMessage: { message: PlotPanelMessage },
});
export type Message = typeof Message.Type;
