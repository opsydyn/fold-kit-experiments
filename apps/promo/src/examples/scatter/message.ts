import { UiSchema } from '@effect/ui';
import { HighlightedSource } from '@opsydyn/dataset-explorer/highlighting-core';
import { SourceLine } from '@opsydyn/dataset-explorer/source-line-core';
import { Schema } from 'effect';

import { Action, Axis, Group, SourceName } from './model';

export const Message = UiSchema.TaggedEnum({
  MountedScatter: {},
  NavigatedSourceLine: SourceLine.fields,
  CompletedSourceLineFocus: {},
  SettledHighlightedSource: { highlightedSource: HighlightedSource },
  RecordedChartWidth: { width: Schema.Number },
  PressedChartKey: { key: Schema.String },
  SelectedGroup: { group: Group },
  ChangedDomain: { axis: Axis, value: Schema.String },
  SelectedPoint: { id: Schema.String },
  SelectedFile: { name: SourceName },
  ClickedReset: {},
  ClickedCopy: {},
  ClickedDownload: {},
  ClickedPlayground: {},
  SucceededAction: { action: Action },
  FailedAction: { error: Schema.String },
});
export type Message = typeof Message.Type;
