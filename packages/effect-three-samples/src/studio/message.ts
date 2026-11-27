import { UiSchema } from '@effect/ui';
import { SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';

export const Vec3 = Schema.Tuple([Schema.Number, Schema.Number, Schema.Number]);

export const Message = UiSchema.TaggedEnum({
  HoveredPiece: { key: Schema.String },
  LeftPiece: { key: Schema.String },
  ClickedPiece: { key: Schema.String },
  DoubleClickedPiece: { key: Schema.String },
  OpenedPieceMenu: { key: Schema.String },
  PressedPiece: { key: Schema.String, origin: Vec3, direction: Vec3 },
  DraggedPiece: { key: Schema.String, origin: Vec3, direction: Vec3 },
  DroppedPiece: {},
  ClickedEmptySpace: {},
  ClickedShadows: {},
  ClickedToneMapping: {},
  ClickedLens: {},
  /** A drag, wheel or pinch on the canvas: it orbits the camera. */
  MadeGesture: { gesture: SceneSchema.Gesture },
  PressedArrow: {
    key: Schema.Literals(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']),
    turning: Schema.Boolean,
  },
  MeasuredPiece: { key: Schema.String, min: Vec3, max: Vec3 },
  ClickedFrame: {},
  ReceivedSceneLifecycle: { lifecycle: SceneStart },
});
export type Message = typeof Message.Type;
