import { Option, Schema } from 'effect';

export const Vec3 = Schema.Tuple([Schema.Number, Schema.Number, Schema.Number]);
export type Vec3 = typeof Vec3.Type;

export const Model = Schema.Struct({
  /** The curve's control points, in the plane z = 0: each a handle you can drag. */
  controls: Schema.Array(Vec3),
  /** The handle being dragged, by its index. */
  held: Schema.Option(Schema.Number),
  /** Whether the curve itself is drawn dashed. */
  dashed: Schema.Boolean,
  /** Whether the comet glitters (sparkles round it). */
  glitter: Schema.Boolean,
});
export type Model = typeof Model.Type;

/** Where the handles start: a wave across the stage. */
export const startControls: ReadonlyArray<Vec3> = [
  [-3, -0.4, 0],
  [-1.6, 1.1, 0],
  [0, -0.5, 0],
  [1.6, 1.2, 0],
  [3, 0.1, 0],
];

export const init = () => ({
  model: {
    controls: startControls,
    held: Option.none(),
    dashed: false,
    glitter: true,
  } satisfies Model,
});
