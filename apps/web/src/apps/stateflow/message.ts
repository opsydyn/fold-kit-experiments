import { UiSchema } from '@effect/ui';
import { HighlightedSource } from '@opsydyn/dataset-explorer/highlighting-core';
import { Schema } from 'effect';

import { LayoutChoice } from './model';
import { ReplayEvent } from './ports';

export const Message = UiSchema.TaggedEnum({
  SettledHighlightedSource: { highlightedSource: HighlightedSource },
  ClickedPlay: {},
  ClickedPause: {},
  ClickedStep: {},
  ClickedStepBack: {},
  ClickedReset: {},
  ClickedEnd: {},
  ScrubbedTo: { cursor: Schema.Number },
  ChoseSpecimen: { specimen: Schema.String },
  ChoseLayout: { layout: LayoutChoice },
  ClickedLive: {},
  ClickedClearRecording: {},
  ReceivedLiveEvent: { specimen: Schema.String, event: Schema.String },
  ClickedCopyLink: {},
  ClickedCopyTest: { edge: Schema.String },
  CompletedCopy: { what: Schema.Literals(['link', 'test']), copied: Schema.Boolean },
  ChangedReducedMotion: { isReducedMotion: Schema.Boolean },
  ChangedNarrow: { isNarrow: Schema.Boolean },
  AdvancedReplay: { deltaTimeMs: Schema.Number },
  SelectedTrace: { sequence: Schema.Number },
  SelectedNode: { node: Schema.String },
  SelectedEdge: { edge: Schema.String },
  ReceivedReplayEvent: { event: ReplayEvent },
  CompletedReportTransition: { sequence: Schema.Number },
});

export type Message = typeof Message.Type;
