import { perspectiveCamera, SceneSchema } from '@opsydyn/effect-three';
import { TransformGizmo } from '@opsydyn/effect-three-foldkit';
import { Option, Schema } from 'effect';

import { paintColour } from '../palette';

export const Kind = Schema.Literals(['crate', 'ball', 'cone', 'ring']);
export type Kind = typeof Kind.Type;

/** Something on the table, and where it is. */
export const Thing = Schema.Struct({
  key: Schema.String,
  kind: Kind,
  colour: Schema.Number,
  placement: SceneSchema.Placement,
});
export type Thing = typeof Thing.Type;

export const Model = Schema.Struct({
  things: Schema.Array(Thing),
  selected: Schema.Option(Schema.String),
  /** The transform gizmo: a Foldkit submodel. */
  gizmo: TransformGizmo.Model,
  camera: SceneSchema.Camera,
  /** The things as they were before each finished move, newest last: undo goes back. */
  past: Schema.Array(Schema.Array(Thing)),
  /** Moves undone, newest first: redo goes forward. */
  future: Schema.Array(Schema.Array(Thing)),
  /** The things when the current drag began. */
  before: Schema.Option(Schema.Array(Thing)),
  snapping: Schema.Boolean,
});
export type Model = typeof Model.Type;

const at = (x: number, z: number) => ({
  position: [x, 0.4, z] as const,
  rotation: [0, 0, 0] as const,
  scale: [1, 1, 1] as const,
});

export const startThings: ReadonlyArray<Thing> = [
  { key: 'crate', kind: 'crate', colour: paintColour.coral, placement: at(-1.5, 0) },
  { key: 'ball', kind: 'ball', colour: paintColour.blue, placement: at(0, -0.8) },
  { key: 'cone', kind: 'cone', colour: paintColour.gold, placement: at(1.5, 0.2) },
  { key: 'ring', kind: 'ring', colour: paintColour.mint, placement: at(0.2, 1.3) },
];

export const init = () => ({
  model: {
    things: startThings,
    selected: Option.some('crate'),
    gizmo: TransformGizmo.init('gizmo', { size: 1.4 }),
    camera: perspectiveCamera({ fov: 45, position: [3.5, 3.2, 5.5], lookAt: [0, 0.3, 0] }),
    past: [],
    future: [],
    before: Option.none(),
    snapping: false,
  } satisfies Model,
});
