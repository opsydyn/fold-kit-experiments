import { UiSchema } from '@effect/ui';
import { HighlightedSource } from '@opsydyn/dataset-explorer/highlighting-core';
import { SourceLine } from '@opsydyn/dataset-explorer/source-line-core';
import { Schema } from 'effect';

import * as Workbench from '../../../../web/src/apps/comparison/workbench-state';
import { Action } from './model';

export const Message = UiSchema.TaggedEnum({
  MountedSourceViewer: {},
  NavigatedSourceLine: SourceLine.fields,
  CompletedSourceLineFocus: {},
  SettledHighlightedSource: { highlightedSource: HighlightedSource },
  ReceivedWorkbenchMessage: { message: Workbench.Message },
  SelectedFile: { name: Schema.String },
  ClickedCopy: {},
  ClickedDownload: {},
  ClickedPlayground: {},
  SucceededAction: { action: Action },
  FailedAction: { error: Schema.String },
});
export type Message = typeof Message.Type;
