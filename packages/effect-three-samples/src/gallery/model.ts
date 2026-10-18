import { perspectiveCamera, SceneSchema, type Vec3 } from '@opsydyn/effect-three';
import { Schema } from 'effect';

/** A label's laid-out block, `[minX, minY, maxX, maxY]`, as `LabelMeasured` reports it. */
export const Block = Schema.Tuple([Schema.Number, Schema.Number, Schema.Number, Schema.Number]);
export type Block = typeof Block.Type;

export const Model = Schema.Struct({
  assetBase: Schema.String,
  /** Whether the labels take the scene's lights (a lit material) or troika's own, unlit. */
  lit: Schema.Boolean,
  /** The plaque the camera has walked up to, if any. */
  focus: Schema.NullOr(Schema.String),
  /** What the visitor wrote on the wall. */
  note: Schema.String,
  /** Each measured label's laid-out block: the panels behind them are sized from these. */
  layouts: Schema.Record(Schema.String, Block),
  camera: SceneSchema.Camera,
});
export type Model = typeof Model.Type;

/** The gallery wall: an arc of this radius round the visitor, centred here. */
export const wall = { radius: 6, centre: [0, 0, 4] as Vec3 } as const;

/** Where on the wall an angle (degrees; 0 straight ahead, positive to the right) is. */
export const onWall = (degrees: number, y: number, inset = 0): Vec3 => {
  const angle = (degrees * Math.PI) / 180;
  const radius = wall.radius - inset;
  return [
    wall.centre[0] + Math.sin(angle) * radius,
    y,
    wall.centre[2] - Math.cos(angle) * radius,
  ];
};

/** The turn about y that faces something at `degrees` back towards the visitor. */
export const facing = (degrees: number): Vec3 => [0, (-degrees * Math.PI) / 180, 0];

export type Plaque = {
  readonly id: string;
  readonly degrees: number;
  readonly text: string;
  readonly fontSize: number;
  readonly maxWidth: number;
};

export const noteLimit = 90;

export const homeCamera = perspectiveCamera({
  fov: 58,
  position: [0, 1.8, 5.6],
  lookAt: [0, 2.2, -2],
  damping: 0.06,
});

export const initialModel = (assetBase: string): Model => ({
  assetBase,
  lit: true,
  focus: null,
  note: 'Type here: the panel grows to fit.',
  layouts: {},
  camera: homeCamera,
});
