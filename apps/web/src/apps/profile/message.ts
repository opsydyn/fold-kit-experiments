import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

export const Message = UiSchema.TaggedEnum({
  RestoredUsername: { username: Schema.String },
  UpdatedDraft: { value: Schema.String },
  ClickedSave: {},
  CompletedSaveUsername: { username: Schema.String },
});
export type Message = typeof Message.Type;
