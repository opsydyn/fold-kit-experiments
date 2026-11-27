import { UiSchema } from '@effect/ui';
import { SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';
import { Record } from './replay';
import { Wire } from './wire';

export const Message = UiSchema.TaggedEnum({
  // The table.
  ClickedTable: { point: SceneSchema.Vec3 },
  ClickedRebuild: {},
  // The world reached a step; at a check step, a leader's world sends a snapshot too.
  ReachedStep: {
    run: Schema.Int,
    step: Schema.Int,
    checksum: Schema.String,
    snapshot: Schema.NullOr(Schema.String),
  },
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
  // Playing together (see session.ts).
  NamedTab: {
    peer: Schema.String,
    at: Schema.Number,
    relay: Schema.Option(Schema.String),
    /** Whether the page asks to predict (`?predict=1`). */
    predict: Schema.Boolean,
    /** A game to replay, from the page's `#replay=…`. */
    record: Schema.Option(Record),
  },
  WaitedForWelcome: {},
  HeardWire: { wire: Wire, at: Schema.Number },
  TickedTurn: { at: Schema.Number },
  LeftPage: {},
  ChangedVisibility: { hidden: Schema.Boolean },
  CompletedSay: {},
  ConnectedRelay: {},
  FailedRelay: { reason: Schema.String },
  LostRelay: {},
  ClickedReconnect: {},
});
export type Message = typeof Message.Type;
