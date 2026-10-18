import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Colour } from './model';

export const Message = defineMessageUnion({
  ClickedPour: { colour: Colour },
  ClickedEmpty: {},
  ClickedFaster: {},
  ClickedSlower: {},
  ClickedReverse: {},
  ToggledColliders: {},
  /** Bodies began or stopped touching: a marble meeting a bin's sensor counts. */
  Collided: { collision: SceneSchema.CollisionDetail },
  /** Something hit the wheel harder than its threshold. */
  KnockedWheel: { force: Schema.Number },
  MadeGesture: { gesture: SceneSchema.Gesture },
  AutoRotated: { turned: SceneSchema.AutoRotatedDetail },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
