import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Action, Curve, SourceName } from './model';

export const Message = defineMessageUnion({
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
