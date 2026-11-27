import { UiSchema } from '@effect/ui';

export const Message = UiSchema.TaggedEnum({
  ZoomedIn: {},
  ZoomedOut: {},
  PannedWest: {},
  PannedEast: {},
  PannedNorth: {},
  PannedSouth: {},
  ResetView: {},
});
export type Message = typeof Message.Type;
