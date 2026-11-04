import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
export const Message = defineMessageUnion({
  ObservedFlowInput: { message: Schema.Unknown },
  SelectedExample: { example: Schema.Literals(['release', 'onion', 'grouped-onion']) },
  ClickedAdd: {},
  ClickedArrange: {},
  ClickedSave: {},
  ClickedLoad: {},
  SucceededLayout: { result: Schema.Unknown },
  FailedLayout: { requestId: Schema.String },
  SucceededSave: {},
  FailedStorage: {},
  SucceededLoad: { json: Schema.String },
});
export type Message = typeof Message.Type;
