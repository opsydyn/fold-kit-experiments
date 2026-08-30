import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  UpdatedDraft: { value: Schema.String },
  ClickedSave: {},
  CompletedSaveUsername: {},
});
export type Message = typeof Message.Type;
