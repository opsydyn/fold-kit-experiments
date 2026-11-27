import { UiSchema } from '@effect/ui';
import { SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';

export const Message = UiSchema.TaggedEnum({
  ClickedPlaque: { id: Schema.String },
  ClickedAway: {},
  ToggledLights: {},
  ChangedNote: { note: Schema.String },
  /** A measured label was laid out: its block, for the panel behind it. */
  MeasuredLabel: { measured: SceneSchema.LabelMeasuredDetail },
  MadeGesture: { gesture: SceneSchema.Gesture },
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
