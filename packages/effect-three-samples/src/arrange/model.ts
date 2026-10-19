import { perspectiveCamera, SceneSchema } from '@opsydyn/effect-three';
import {
  BoxSelect,
  PivotControls,
  TransformGizmo,
  ViewportGizmo,
} from '@opsydyn/effect-three-foldkit';
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
  /** What is selected; the gizmo sits on the first and moves the rest alike. */
  selected: Schema.Array(Schema.String),
  /** The transform gizmo: a Foldkit submodel. */
  gizmo: TransformGizmo.Model,
  /** Drei-style pivot controls, every handle at once: the other way to move things. */
  pivot: PivotControls.Model,
  /** Which of the two is on the selection. */
  style: Schema.Literals(['transform', 'pivot']),
  /** The selection box a shift-drag draws: a Foldkit submodel too. */
  box: BoxSelect.Model,
  /** The axes in the corner that turn the camera to look along one: a third. */
  view: ViewportGizmo.Model,
  /**
   * Whether the last press was on the viewport gizmo: its head turns away from under the
   * pointer, and letting go there is no click on nothing to clear the selection.
   */
  pressedView: Schema.Boolean,
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
    selected: ['crate'],
    gizmo: TransformGizmo.init('gizmo', { size: 1.4 }),
    pivot: PivotControls.init('pivot', { scale: 0.9, depthTest: false }),
    style: 'transform' as const,
    box: BoxSelect.init(),
    view: ViewportGizmo.init('view'),
    pressedView: false,
    camera: perspectiveCamera({
      fov: 45,
      position: [3.5, 3.2, 5.5],
      lookAt: [0, 0.3, 0],
      damping: 0.15,
    }),
    past: [],
    future: [],
    before: Option.none(),
    snapping: false,
  } satisfies Model,
});
