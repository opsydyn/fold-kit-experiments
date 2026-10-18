import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  ChangedAim: { aim: Schema.Number },
  ChangedAngle: { angle: Schema.Number },
  ChangedSpeed: { speed: Schema.Number },
  ClickedRoll: {},
  ClickedNewGame: {},
  /** A pin's head left or reached a spot, or the ball reached the pit. */
  Collided: { collision: SceneSchema.CollisionDetail },
  /** The ball hit something harder than its threshold. */
  Struck: { force: Schema.Number },
  /** Time for the pins to settle after shot `shot`: count what is standing. */
  Settled: { shot: Schema.Number },
  MeasuredScoreboard: { measured: SceneSchema.LabelMeasuredDetail },
  MadeGesture: { gesture: SceneSchema.Gesture },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
