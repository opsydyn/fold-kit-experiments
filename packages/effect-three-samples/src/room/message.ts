import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { PlantKind, Vec3 } from './model';

export const Mode = Schema.Literals(['immersive-vr', 'immersive-ar']);
export type Mode = typeof Mode.Type;

export const Message = defineMessageUnion({
  CheckedSupport: { mode: Mode, supported: Schema.Boolean },
  ClickedEnter: { mode: Mode },
  ClickedExit: {},
  FailedEnter: {},
  ChangedSession: { mode: Schema.NullOr(Mode) },
  /** A click (or a controller's select) on the floor: plant the chosen kind there. */
  ClickedFloor: { point: Vec3 },
  ChoseKind: { kind: PlantKind },
  /**
   * A plant placed at a point on the floor (`y` is ignored): what a click becomes, and
   * what an agent or a script sends to arrange the room.
   */
  PlacedPlant: { at: Vec3, kind: PlantKind },
  ClickedPlant: { id: Schema.String },
  ClickedClear: {},
  /** In AR, a select whose ray met a real surface. */
  SelectedSurface: { surface: SceneSchema.XrSurfaceDetail },
  DetectedPlanes: { detected: SceneSchema.XrPlanesDetail },
  DetectedMeshes: { detected: SceneSchema.XrMeshesDetail },
  Glided: { moved: SceneSchema.XrMovedDetail },
  MadeGesture: { gesture: SceneSchema.Gesture },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
