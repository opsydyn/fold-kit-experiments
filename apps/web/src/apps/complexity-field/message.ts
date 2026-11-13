import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  InspectedModule: { key: Schema.NullOr(Schema.String) },
  SelectedModule: { key: Schema.String },
});
export type Message = typeof Message.Type;
