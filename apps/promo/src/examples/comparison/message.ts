import { HighlightedSource } from '@opsydyn/dataset-explorer/highlighting';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import type * as Comparison from '../../../../web/src/apps/comparison/main';

export const Message = defineMessageUnion({
  AcquiredHighlighter: {},
  FailedHighlighter: {},
  ReleasedHighlighter: {},
  SettledHighlightedSource: { highlightedSource: HighlightedSource },
  // oxlint-disable-next-line foldkit/got-prefix-requires-submodel-payload
  GotWorkbenchMessage: { message: Schema.Unknown },
  SelectedFile: { name: Schema.String },
  ClickedCopy: {},
  ClickedDownload: {},
  ClickedPlayground: {},
  SucceededAction: { action: Schema.Literals(['copy', 'download', 'playground']) },
  FailedAction: { error: Schema.String },
});
export type GotWorkbenchMessage = Omit<typeof Message.GotWorkbenchMessage.Type, 'message'> & {
  readonly message: Comparison.Message;
};
export type Message = typeof Message.Type;
