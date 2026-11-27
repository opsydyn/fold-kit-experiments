import { UiSchema } from '@effect/ui';
import { HighlightedSource } from '@opsydyn/dataset-explorer/highlighting-core';
import { SourceLine } from '@opsydyn/dataset-explorer/source-line-core';
import { Schema } from 'effect';

import { Action, Dataset, SourceName } from './model';

export const Message = UiSchema.TaggedEnum({
  MountedHistogram: {},
  NavigatedSourceLine: SourceLine.fields,
  CompletedSourceLineFocus: {},
  SettledHighlightedSource: { highlightedSource: HighlightedSource },
  RecordedChartWidth: { width: Schema.Number },
  SelectedDataset: { dataset: Dataset },
  ChangedBinCount: { value: Schema.String },
  SelectedFile: { name: SourceName },
  ClickedReset: {},
  ClickedCopy: {},
  ClickedDownload: {},
  ClickedPlayground: {},
  SucceededAction: { action: Action },
  FailedAction: { error: Schema.String },
});
export type Message = typeof Message.Type;
