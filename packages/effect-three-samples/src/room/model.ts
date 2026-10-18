import { glide, perspectiveCamera, SceneSchema, xr } from '@opsydyn/effect-three';
import { Schema } from 'effect';

/** Whether the browser can present a mode, and whether it is. */
export const Support = Schema.Literals(['checking', 'unavailable', 'ready']);
export type Support = typeof Support.Type;

/** Not presenting, or presenting in VR or AR. */
export const Session = Schema.Literals(['none', 'entering', 'immersive-vr', 'immersive-ar']);
export type Session = typeof Session.Type;

export const Vec3 = Schema.Tuple([Schema.Number, Schema.Number, Schema.Number]);

/** A plant someone placed: on the page or in VR on the room's floor; in AR, at an anchor. */
export const Plant = Schema.Struct({ id: Schema.String, at: Vec3 });
export type Plant = typeof Plant.Type;

export const Model = Schema.Struct({
  assetBase: Schema.String,
  vr: Support,
  ar: Support,
  session: Session,
  plants: Schema.Array(Plant),
  nextPlant: Schema.Number,
  /** What an AR session has detected, as it last reported. */
  planes: Schema.Array(SceneSchema.XrPlane),
  meshes: Schema.Array(SceneSchema.XrMesh),
  /** Where the player stands: gliding moves them, and the Model keeps where. */
  player: SceneSchema.Xr,
  camera: SceneSchema.Camera,
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
  vr: 'checking',
  ar: 'checking',
  session: 'none',
  plants: [{ id: 'plant-0', at: [-0.9, 0, 0.9] }],
  nextPlant: 1,
  planes: [],
  meshes: [],
  // In front of the sofa, facing the room's back wall.
  player: xr({ origin: [0, 0, 2.2], glide: glide(), hitTest: true, planes: true, meshes: true }),
  camera: homeCamera,
});
