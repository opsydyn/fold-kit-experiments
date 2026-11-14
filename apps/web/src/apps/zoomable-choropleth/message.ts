import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  ZoomedIn: {},
  ZoomedOut: {},
  PannedWest: {},
  PannedEast: {},
  PannedNorth: {},
  PannedSouth: {},
  ResetView: {},
});
export type Message = typeof Message.Type;
