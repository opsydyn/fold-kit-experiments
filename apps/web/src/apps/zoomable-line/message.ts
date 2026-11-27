import { UiSchema } from '@effect/ui';

export const Message = UiSchema.TaggedEnum({
  ZoomedIn: {},
  ZoomedOut: {},
  PannedEarlier: {},
  PannedLater: {},
  ResetView: {},
});
export type Message = typeof Message.Type;
