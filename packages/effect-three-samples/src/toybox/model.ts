import { perspectiveCamera, SceneSchema, xr } from '@opsydyn/effect-three';
import { Schema } from 'effect';

import { Paint, paintAt } from '../palette';

/** What a toy is: a crate or a ball. */
export const Kind = Schema.Literals(['crate', 'ball']);
export type Kind = typeof Kind.Type;

/**
 * A toy in the box. Where it is belongs to the simulation once it is dropped: the Model
 * holds where it was dropped from, and how often it has been kicked.
 */
export const Toy = Schema.Struct({
  id: Schema.Number,
  kind: Kind,
  paint: Paint,
  x: Schema.Number,
  z: Schema.Number,
  /** Each kick has a new id, so the simulation applies it once. */
  kick: Schema.NullOr(
    Schema.Struct({
      id: Schema.Number,
      impulse: Schema.Tuple([Schema.Number, Schema.Number, Schema.Number]),
    }),
  ),
});
export type Toy = typeof Toy.Type;

/**
 * Virtual reality: whether the browser can present it, and whether it is. The button
 * shows only when it can.
 */
export const Vr = Schema.Literals(['checking', 'unavailable', 'ready', 'entering', 'presenting']);
export type Vr = typeof Vr.Type;

export const Model = Schema.Struct({
  toys: Schema.Array(Toy),
  nextId: Schema.Number,
  /** Tidying up starts a new round: every toy gets a new key and drops again. */
  round: Schema.Number,
  /** Collisions that began between toys and anything but marbles, as the simulation reported them. */
  bumps: Schema.Number,
  /** Marbles poured in: one instanced node, a body per marble. */
  marbles: Schema.Number,
  /** Whether the physics world draws its colliders and joints as lines. */
  showColliders: Schema.Boolean,
  camera: SceneSchema.Camera,
  vr: Vr,
  /** Where the player stands in VR: thumbsticks turn and step, by changing it. */
  player: SceneSchema.Xr,
});
export type Model = typeof Model.Type;

/** The tray's inner half-width: toys drop inside it. */
export const reach = 2.6;

/** Where the `index`th toy drops from: a loose spiral over the middle of the tray. */
export const dropPoint = (index: number) => {
  const angle = index * 2.4;
  const radius = Math.min(reach - 0.6, 0.5 + index * 0.18);
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
};

export const toyAt = (id: number): Toy => ({
  id,
  kind: id % 3 === 0 ? 'ball' : 'crate',
  paint: paintAt(id),
  ...dropPoint(id),
  kick: null,
});

export const firstToys = 8;

/** Marbles per pour, and most in the box. */
export const pour = 16;
export const mostMarbles = 96;

export const homeCamera = perspectiveCamera({
  fov: 40,
  position: [0, 6.5, 8.5],
  lookAt: [0, 0.4, 0],
  damping: 0.1,
});

export const initialModel: Model = {
  toys: Array.from({ length: firstToys }, (_, id) => toyAt(id)),
  nextId: firstToys,
  round: 0,
  bumps: 0,
  marbles: 0,
  showColliders: false,
  camera: homeCamera,
  vr: 'checking',
  // In front of the tray, facing it.
  player: xr({ origin: [0, 0, 4.2] }),
};
