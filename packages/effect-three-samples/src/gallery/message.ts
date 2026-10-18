import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  ClickedPlaque: { id: Schema.String },
  ClickedAway: {},
  ToggledLights: {},
  ChangedNote: { note: Schema.String },
  /** A measured label was laid out: its block, for the panel behind it. */
  MeasuredLabel: { measured: SceneSchema.LabelMeasuredDetail },
  MadeGesture: { gesture: SceneSchema.Gesture },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
