import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

import { DatasetId } from './data';
import { HighlightedSource } from './highlighting-core';
import { Completion } from './query';
import { SourceName } from './source';
import { SourceLine } from './source-line-core';

export const Message = UiSchema.TaggedEnum({
  MountedExplorer: {},
  NavigatedSourceLine: SourceLine.fields,
  CompletedSourceLineFocus: {},
  SettledHighlightedSource: { highlightedSource: HighlightedSource },
  RecordedChartWidth: { width: Schema.Number },
  SelectedSource: { name: SourceName },
  ClickedDataset: { dataset: DatasetId },
  ClickedRefresh: {},
  ClickedFailedRefresh: {},
  ClickedResponseRace: {},
  GotDatasetMessage: { message: Completion },
});
export type Message = typeof Message.Type;
