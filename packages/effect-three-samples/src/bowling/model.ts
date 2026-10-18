import { perspectiveCamera, SceneSchema } from '@opsydyn/effect-three';
import { Schema } from 'effect';

/** The ten pins, by the numbers bowlers give them: 1 at the front, 7 to 10 at the back. */
export const pinIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'] as const;
export type PinId = (typeof pinIds)[number];

export type Block = readonly [number, number, number, number];

export const Phase = Schema.Literals(['aiming', 'rolling', 'settling', 'over']);
export type Phase = typeof Phase.Type;

export const Model = Schema.Struct({
  assetBase: Schema.String,
  /** Pins knocked down by each roll so far: the scoresheet is derived from these. */
  rolls: Schema.Array(Schema.Number),
  /** Each fresh rack gets new pin keys, so the pins stand up again. */
  rack: Schema.Number,
  /** Each ball gets a new key; its roll is an impulse with this id. */
  shot: Schema.Number,
  /** Pins whose heads are on their spots, as the spots' sensors report it. */
  standing: Schema.Array(Schema.String),
  /** The pins standing when this roll began: they stay drawn until it is counted. */
  before: Schema.Array(Schema.String),
  phase: Phase,
  /** Where the ball starts across the lane, metres from the middle. */
  aim: Schema.Number,
  /** Its line, degrees from straight down the lane (positive to the right). */
  angle: Schema.Number,
  /** How fast it leaves, metres a second. */
  speed: Schema.Number,
  /** The hardest the ball hit anything this roll, as contact forces reported. */
  impact: Schema.Number,
  /** The scoreboard label's laid-out block, for the panel behind it. */
  layout: Schema.NullOr(Schema.Tuple([Schema.Number, Schema.Number, Schema.Number, Schema.Number])),
  camera: SceneSchema.Camera,
});
export type Model = typeof Model.Type;

export const limits = {
  aim: { min: -0.38, max: 0.38 },
  angle: { min: -4, max: 4 },
  speed: { min: 4, max: 10 },
} as const;

export const homeCamera = perspectiveCamera({
  fov: 48,
  position: [0.9, 1.3, 8.3],
  lookAt: [0, 0.15, -1.8],
  damping: 0.08,
});

export const initialModel = (assetBase: string): Model => ({
  assetBase,
  rolls: [],
  rack: 0,
  shot: 0,
  standing: [...pinIds],
  before: [...pinIds],
  phase: 'aiming',
  aim: 0.08,
  angle: -0.6,
  speed: 8,
  impact: 0,
  layout: null,
  camera: homeCamera,
});
