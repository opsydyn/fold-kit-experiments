import { HighlightedSource } from '@opsydyn/dataset-explorer/highlighting';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Action, Axis, Group, SourceName } from './model';

export const Message = defineMessageUnion({
  AcquiredHighlighter: {},
  FailedHighlighter: {},
  ReleasedHighlighter: {},
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
