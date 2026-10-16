import { SceneSchema } from '@opsydyn/effect-three';
import { Option, Schema } from 'effect';

import { homeCamera } from './cameras';

/** The pieces on the studio floor. */
export const Piece = Schema.Literals(['torus', 'capsule', 'cone', 'ball', 'crate']);
export type Piece = typeof Piece.Type;
export const pieces: ReadonlyArray<Piece> = Piece.literals;

/** Surface finishes, each a different three.js material kind. */
export const Finish = Schema.Literals(['matte', 'glossy', 'metal', 'lacquer', 'flat']);
export type Finish = typeof Finish.Type;
export const finishes: ReadonlyArray<Finish> = Finish.literals;

export const Placement = Schema.Struct({
  piece: Piece,
  x: Schema.Number,
  z: Schema.Number,
  finish: Finish,
});
export type Placement = typeof Placement.Type;

/** A drag in progress: the piece and where on the floor it was grabbed, relative to it. */
export const Grab = Schema.Struct({
  piece: Piece,
  offsetX: Schema.Number,
  offsetZ: Schema.Number,
});
export type Grab = typeof Grab.Type;

export const Lens = Schema.Literals(['perspective', 'orthographic', 'split']);
export type Lens = typeof Lens.Type;

export const Shadows = Schema.Literals(['soft', 'off']);
export type Shadows = typeof Shadows.Type;

export const Tone = Schema.Literals(['none', 'aces']);
export type Tone = typeof Tone.Type;

export const Model = Schema.Struct({
  placements: Schema.Array(Placement),
  selected: Schema.Option(Piece),
  hovered: Schema.Option(Piece),
  grab: Schema.Option(Grab),
  shadows: Shadows,
  tone: Tone,
  lens: Lens,
  /** The camera, orbited by gestures on the canvas. */
  camera: SceneSchema.Camera,
});
export type Model = typeof Model.Type;

/** Where each piece starts, and returns to on a double-click. */
export const home = {
  torus: { x: -2.4, z: -0.6 },
  capsule: { x: -1.1, z: 0.8 },
  cone: { x: 0.3, z: -0.9 },
  ball: { x: 1.5, z: 0.7 },
  crate: { x: 2.6, z: -0.4 },
} satisfies Record<Piece, { readonly x: number; readonly z: number }>;

const startingFinish = {
  torus: 'lacquer',
  capsule: 'glossy',
  cone: 'matte',
  ball: 'metal',
  crate: 'flat',
} satisfies Record<Piece, Finish>;

export const init = () => ({
  model: {
    placements: pieces.map((piece) => ({ piece, ...home[piece], finish: startingFinish[piece] })),
    selected: Option.none(),
    hovered: Option.none(),
    grab: Option.none(),
    shadows: 'soft',
    tone: 'none',
    lens: 'perspective',
    camera: homeCamera.perspective,
  } satisfies Model,
});

/** The floor is a square from -limit to +limit on x and z. */
export const limit = 3.6;
