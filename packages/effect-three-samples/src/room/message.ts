import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { PlantKind, Vec3 } from './model';
import { Wire } from './wire';

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
  /** The left hand's teleport arc let go over the floor: the player stands there. */
  Teleported: { teleported: SceneSchema.XrTeleportedDetail },
  /** Where this player's head and hands are, every so often while presenting. */
  ReportedPoses: { poses: SceneSchema.XrPosesDetail },
  NamedPlayer: { peer: Schema.String, relay: Schema.Option(Schema.String) },
  /** Another room page said where its player is, or that they left. */
  HeardPresence: { wire: Wire, at: Schema.Number },
  /** Time to let go of players unheard for too long. */
  TickedPresence: { at: Schema.Number },
  LeftPage: {},
  CompletedSay: {},
  ConnectedRelay: {},
  FailedRelay: { reason: Schema.String },
  LostRelay: {},
  ReleasedRelay: {},
  MadeGesture: { gesture: SceneSchema.Gesture },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
