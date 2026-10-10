import { HighlightedSource } from '@opsydyn/dataset-explorer/highlighting';
import { SourceLine } from '@opsydyn/dataset-explorer/source-lines';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Action, Curve, Panel, SourceName } from './model';

export const Message = defineMessageUnion({
  NavigatedSourceLine: SourceLine.fields,
  CompletedSourceLineFocus: {},
  AcquiredHighlighter: {},
  FailedHighlighter: {},
  ReleasedHighlighter: {},
  SettledHighlightedSource: { highlightedSource: HighlightedSource },
  RecordedChartWidth: { width: Schema.Number },
  SelectedPanel: { panel: Panel },
  ClickedRestartEditor: {},
  SucceededEditor: { revision: Schema.Number },
  FailedEditor: { revision: Schema.Number, error: Schema.String },
  SelectedCurve: { curve: Curve },
  ChangedPoint: { index: Schema.Number, value: Schema.String },
  ChangedDomain: { value: Schema.String },
  SelectedFile: { name: SourceName },
  ClickedReset: {},
  ClickedCopy: {},
  ClickedDownload: {},
  ClickedPlayground: {},
  SucceededAction: { action: Action },
  FailedAction: { error: Schema.String },
});
export type Message = typeof Message.Type;
