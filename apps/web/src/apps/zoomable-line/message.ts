import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  ZoomedIn: {},
  ZoomedOut: {},
  PannedEarlier: {},
  PannedLater: {},
  ResetView: {},
});
export type Message = typeof Message.Type;
