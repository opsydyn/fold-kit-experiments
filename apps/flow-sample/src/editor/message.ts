import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
export const Message = defineMessageUnion({
  ObservedFlowInput: { message: Schema.Unknown },
  SelectedExample: { example: Schema.Literals(['release', 'onion', 'grouped-onion']) },
  ClickedAdd: {},
  ClickedArrange: { engine: Schema.Literals(['elk', 'force']) },
  ClickedSave: {},
  ClickedExport: {},
  ChoseImportFiles: { files: Schema.Array(Schema.instanceOf(File)) },
  SucceededImport: { id: Schema.Number, json: Schema.String },
  FailedImport: { id: Schema.Number },
  FailedExport: {},
  CompletedExport: {},

  ClickedLoad: {},
  SucceededLayout: { result: Schema.Unknown },
  FailedLayout: { requestId: Schema.String },
  SucceededSave: {},
  FailedStorage: {},
  SucceededLoad: { json: Schema.String },
});
export type Message = typeof Message.Type;
