import { glide, perspectiveCamera, SceneSchema, xr } from '@opsydyn/effect-three';
import { Option, Schema } from 'effect';

import { Other, Relay, reportSeconds } from './wire';

/** Whether the browser can present a mode, and whether it is. */
export const Support = Schema.Literals(['checking', 'unavailable', 'ready']);
export type Support = typeof Support.Type;

/** Not presenting, or presenting in VR or AR. */
export const Session = Schema.Literals(['none', 'entering', 'immersive-vr', 'immersive-ar']);
export type Session = typeof Session.Type;

export const Vec3 = Schema.Tuple([Schema.Number, Schema.Number, Schema.Number]);

/** The plants there are to place. */
export const PlantKind = Schema.Literals(['fern', 'cactus', 'tulip']);
export type PlantKind = typeof PlantKind.Type;

/** A plant someone placed: on the page or in VR on the room's floor; in AR, at an anchor. */
export const Plant = Schema.Struct({ id: Schema.String, at: Vec3, kind: PlantKind });
export type Plant = typeof Plant.Type;

export const Model = Schema.Struct({
  assetBase: Schema.String,
  sceneFailure: Schema.NullOr(Schema.String),
  vr: Support,
  ar: Support,
  session: Session,
  plants: Schema.Array(Plant),
  nextPlant: Schema.Number,
  /** What a click on the floor plants. */
  kind: PlantKind,
  /** What an AR session has detected, as it last reported. */
  planes: Schema.Array(SceneSchema.XrPlane),
  meshes: Schema.Array(SceneSchema.XrMesh),
  /** Where the player stands: gliding moves them, and the Model keeps where. */
  player: SceneSchema.Xr,
  camera: SceneSchema.Camera,
  /** This player's name among the others, once it has one. */
  self: Schema.Option(Schema.String),
  /** The relay the page names, if any: without one, tabs of this browser share the room. */
  relay: Schema.Option(Relay),
  /** The other players presenting the room, where they last said they were. */
  others: Schema.Array(Other),
});
export type Model = typeof Model.Type;

export const mostPlants = 12;

export const homeCamera = perspectiveCamera({
  fov: 50,
  position: [2.6, 2.3, 4.6],
  lookAt: [0, 0.8, 0],
  damping: 0.08,
});

export const initialModel = (assetBase: string): Model => ({
  assetBase,
  sceneFailure: null,
  vr: 'checking',
  ar: 'checking',
  session: 'none',
  plants: [{ id: 'plant-0', at: [-0.9, 0, 0.9], kind: 'fern' }],
  nextPlant: 1,
  kind: 'fern',
  planes: [],
  meshes: [],
  // In front of the sofa, facing the room's back wall.
  // While presenting, where the head and hands are is reported for the others to see.
  player: xr({
    origin: [0, 0, 2.2],
    glide: glide(),
    hitTest: true,
    planes: true,
    meshes: true,
    poses: reportSeconds,
  }),
  camera: homeCamera,
  self: Option.none(),
  relay: Option.none(),
  others: [],
});
