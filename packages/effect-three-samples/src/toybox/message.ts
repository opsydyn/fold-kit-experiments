import { UiSchema } from '@effect/ui';
import { SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';

export const Vec3 = Schema.Tuple([Schema.Number, Schema.Number, Schema.Number]);

export const Message = UiSchema.TaggedEnum({
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
  Glided: { moved: SceneSchema.XrMovedDetail },
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
