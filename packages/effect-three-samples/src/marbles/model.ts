import { perspectiveCamera, SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';

/** The two colours of marble: the grate holds teal and lets gold fall through. */
export const Colour = Schema.Literals(['gold', 'teal']);
export type Colour = typeof Colour.Type;

/** The two bins, as the sensor colliders that guard them are named. */
export const Bin = Schema.Literals(['gold-bin', 'teal-bin']);
export type Bin = typeof Bin.Type;

const Count = Schema.Struct({ gold: Schema.Number, teal: Schema.Number });

export const Model = Schema.Struct({
  assetBase: Schema.String,
  /** Emptying the machine starts a new round: every marble gets a new key. */
  round: Schema.Number,
  /** Marbles poured of each colour this round. Where each is belongs to Rapier. */
  poured: Count,
  /** Marbles that have dropped into each bin, by colour, as the sensors reported them. */
  goldBin: Count,
  tealBin: Count,
  /** The wheel's motor speed, radians a second; negative turns it clockwise. */
  wheelSpeed: Schema.Number,
  /** Hits on the wheel harder than its contact-force threshold, and the hardest. */
  knocks: Schema.Number,
  hardest: Schema.Number,
  showColliders: Schema.Boolean,
  camera: SceneSchema.Camera,
});
export type Model = typeof Model.Type;

/** Marbles per pour, and most of one colour in the machine. */
export const pour = 12;
export const mostOfOne = 60;

export const wheelSpeeds = { slowest: 0.5, fastest: 6, start: 2 } as const;

export const homeCamera = perspectiveCamera({
  fov: 38,
  position: [2.6, 4.2, 11.5],
  lookAt: [0, 3, 0],
  damping: 0.08,
  // Turns slowly (once every two minutes) while nobody touches it; a drag takes over
  // from where it got to.
  autoRotate: 0.25,
});

const none = { gold: 0, teal: 0 };

export const initialModel = (assetBase: string): Model => ({
  assetBase,
  round: 0,
  poured: { gold: pour, teal: pour },
  goldBin: none,
  tealBin: none,
  wheelSpeed: -wheelSpeeds.start,
  knocks: 0,
  hardest: 0,
  showColliders: false,
  camera: homeCamera,
});
