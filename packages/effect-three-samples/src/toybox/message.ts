import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Vec3 = Schema.Tuple([Schema.Number, Schema.Number, Schema.Number]);

export const Message = defineMessageUnion({
  ClickedToy: { key: Schema.String, direction: Vec3 },
  ClickedDrop: {},
  ClickedTidy: {},
  ClickedPour: {},
  ToggledColliders: {},
  /** Two bodies began or stopped touching; `marble` if either was a marble. */
  Bumped: { started: Schema.Boolean, marble: Schema.Boolean },
  MadeGesture: { gesture: SceneSchema.Gesture },
  CheckedVr: { supported: Schema.Boolean },
  ClickedEnterVr: {},
  ClickedExitVr: {},
  FailedVr: {},
  ChangedVrSession: { presenting: Schema.Boolean },
  PushedStick: { stick: SceneSchema.XrStickDetail },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
