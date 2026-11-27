import { UiSchema } from '@effect/ui';
import { Schema } from 'effect';

export const Message = UiSchema.TaggedEnum({
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
