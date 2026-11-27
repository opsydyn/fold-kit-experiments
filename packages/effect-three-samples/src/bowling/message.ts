import { UiSchema } from '@effect/ui';
import { SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';

export const Message = UiSchema.TaggedEnum({
  ChangedAim: { aim: Schema.Number },
  ChangedAngle: { angle: Schema.Number },
  ChangedSpeed: { speed: Schema.Number },
  ClickedRoll: {},
  ClickedNewGame: {},
  /** Replay this game's rolls from a fresh rack, and check the pins fall the same. */
  ClickedReplay: {},
  /** The page's address fragment, read at start: a replay link starts that replay. */
  ReadFragment: { fragment: Schema.String },
  /** Rack `shot` has rested: rolling may begin. */
  RackRested: { shot: Schema.Number },
  /** A pin's head left or reached a spot, or the ball reached the pit. */
  Collided: { collision: SceneSchema.CollisionDetail },
  /** The ball hit something harder than its threshold. */
  Struck: { force: Schema.Number },
  /** Time for the pins to settle after shot `shot`: count what is standing. */
  Settled: { shot: Schema.Number },
  MeasuredScoreboard: { measured: SceneSchema.LabelMeasuredDetail },
  MadeGesture: { gesture: SceneSchema.Gesture },
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
