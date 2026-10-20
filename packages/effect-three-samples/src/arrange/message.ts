import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Message = defineMessageUnion({
  PressedScene: {
    key: Schema.String,
    point: SceneSchema.Vec3,
    origin: SceneSchema.Vec3,
    direction: SceneSchema.Vec3,
  },
  DraggedScene: { origin: SceneSchema.Vec3, direction: SceneSchema.Vec3 },
  ReleasedScene: {},
  ClickedThing: { key: Schema.String, point: SceneSchema.Vec3 },
  MovedOver: { point: SceneSchema.Vec3 },
  ClickedNothing: {},
  HoveredScene: { key: Schema.String },
  LeftScene: { key: Schema.String },
  MadeGesture: { gesture: SceneSchema.Gesture },
  EndedGesture: {},
  ChoseMode: { mode: Schema.Literals(['translate', 'rotate', 'scale']) },
  ClickedSpace: {},
  ClickedSnapping: {},
  ClickedPivot: {},
  ClickedMeasure: {},
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedBranch: {},
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
