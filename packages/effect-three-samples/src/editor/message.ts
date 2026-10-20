import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Addable } from './document';
import { Wire } from './wire';

const Path = Schema.Array(Schema.Union([Schema.String, Schema.Number]));

export const Message = defineMessageUnion({
  // The scene.
  PressedScene: {
    key: Schema.String,
    path: Schema.Array(Schema.String),
    origin: SceneSchema.Vec3,
    direction: SceneSchema.Vec3,
  },
  DraggedScene: { origin: SceneSchema.Vec3, direction: SceneSchema.Vec3 },
  ReleasedScene: {},
  ClickedScene: { key: Schema.String, path: Schema.Array(Schema.String) },
  ClickedNothing: {},
  HoveredScene: { key: Schema.String },
  LeftScene: { key: Schema.String },
  MadeGesture: { gesture: SceneSchema.Gesture },
  EndedGesture: {},
  // Intents, as an assistant (or a person) asks for them: put a thing somewhere, frame a
  // shot of some things (none: everything), light the scene with a mood.
  PlacedThing: { kind: Addable, at: SceneSchema.Vec3 },
  FramedShot: {
    subject: Schema.Array(Schema.String),
    angle: Schema.Literals(['front', 'back', 'left', 'right', 'top', 'three-quarter', 'low']),
  },
  ChoseMood: { mood: Schema.Literals(['studio', 'daylight', 'sunset', 'night']) },
  // The outliner and toolbar.
  ClickedAdd: { kind: Addable },
  ClickedOutlined: { key: Schema.String },
  ClickedDuplicate: {},
  ClickedDelete: {},
  ChoseMode: { mode: Schema.Literals(['translate', 'rotate', 'scale']) },
  ClickedSnapping: {},
  // History.
  ClickedUndo: {},
  ClickedRedo: {},
  ClickedStep: { id: Schema.Number },
  // The inspector.
  EditedNode: {
    key: Schema.String,
    path: Path,
    value: Schema.Union([Schema.Number, Schema.String, Schema.Boolean]),
  },
  // Files.
  ClickedSave: {},
  ChoseFiles: { files: Schema.Array(Schema.instanceOf(File)) },
  ReadFile: { text: Schema.String },
  CompletedDownload: {},
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
  // Editing together (see session.ts).
  NamedTab: { peer: Schema.String, at: Schema.Number },
  WaitedForWelcome: {},
  HeardWire: { wire: Wire, at: Schema.Number },
  TickedTurn: { at: Schema.Number },
  LeftPage: {},
  CompletedSay: {},
});
export type Message = typeof Message.Type;
