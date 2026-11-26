import { UiSchema } from '@effect/ui';
import { SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';
import { Colour } from './model';

export const Message = UiSchema.TaggedEnum({
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
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
