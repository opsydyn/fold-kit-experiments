import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Wire } from './wire';

export const Message = defineMessageUnion({
  // The table.
  ClickedTable: { point: SceneSchema.Vec3 },
  ClickedRebuild: {},
  ReachedStep: { run: Schema.Int, step: Schema.Int, checksum: Schema.String },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
  // Playing together (see session.ts).
  NamedTab: { peer: Schema.String, at: Schema.Number, relay: Schema.Option(Schema.String) },
  WaitedForWelcome: {},
  HeardWire: { wire: Wire, at: Schema.Number },
  TickedTurn: { at: Schema.Number },
  LeftPage: {},
  ChangedVisibility: { hidden: Schema.Boolean },
  CompletedSay: {},
  ConnectedRelay: {},
  FailedRelay: { reason: Schema.String },
  LostRelay: {},
  ReleasedRelay: {},
  ClickedReconnect: {},
});
export type Message = typeof Message.Type;
