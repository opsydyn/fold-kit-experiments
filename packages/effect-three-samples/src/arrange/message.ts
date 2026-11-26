import { UiSchema } from '@effect/ui';
import { SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';

export const Message = UiSchema.TaggedEnum({
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
  EditedThing: {
    key: Schema.String,
    path: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
    value: Schema.Union([Schema.Number, Schema.String, Schema.Boolean]),
  },
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedBranch: {},
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
