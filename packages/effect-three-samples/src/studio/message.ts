import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

export const Vec3 = Schema.Tuple([Schema.Number, Schema.Number, Schema.Number]);

export const Message = defineMessageUnion({
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
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
