import { UiSchema } from '@effect/ui';
import { BrowserInput } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';
export const Message = UiSchema.TaggedEnum({
  ObservedBrowserInput: { event: BrowserInput },
  ChangedNodeLabel: { id: Schema.String, label: Schema.String },
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedDelete: {},
  ClickedAdd: {},
  ClickedArrange: {},
  ClickedFit: {},
  ClickedSave: {},
  ClickedLoad: {},
  SucceededLayout: { result: Schema.Unknown },
  FailedLayout: { requestId: Schema.String },
  SucceededSave: {},
  FailedStorage: {},
  SucceededLoad: { json: Schema.String },
});
export type Message = typeof Message.Type;
