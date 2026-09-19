import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type { ReplayEvent } from './ports';

export const Message = defineMessageUnion({
  ClickedPlay: {},
  ClickedPause: {},
  ClickedStep: {},
  ClickedReset: {},
  AdvancedReplay: {},
  SelectedTrace: { sequence: Schema.Number },
  SelectedNode: { node: Schema.String },
  ReceivedReplayEvent: { event: Schema.Unknown },
  CompletedReportTransition: { sequence: Schema.Number },
});

export type ReceivedReplayEvent = Omit<typeof Message.ReceivedReplayEvent.Type, 'event'> & {
  readonly event: ReplayEvent;
};
export type Message = typeof Message.Type;
