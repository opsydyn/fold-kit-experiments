import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  ClickedPlayground: {},
  ClickedEditor: {},
  ClickedCloseEditor: {},
  ClickedRestartEditor: {},
  SucceededEditor: { revision: Schema.Number },
  FailedEditor: { revision: Schema.Number, error: Schema.String },
  SucceededPlayground: {},
  FailedPlayground: { error: Schema.String },
});
export type Message = typeof Message.Type;
