import {
  History,
  perspectiveCamera,
  type SceneNode,
  SceneSchema,
  type Vec3,
} from '@opsydyn/effect-three';
import { BoxSelect, TransformGizmo, ViewportGizmo } from '@opsydyn/effect-three-foldkit';
import { Option, Schema } from 'effect';

import { nodeOf, placed } from './document';

const Nodes = Schema.Array(SceneSchema.SceneNode);

export const Model = Schema.Struct({
  /** The document: the scene's top-level nodes, as they are now (moving, mid-drag). */
  nodes: Nodes,
  /** Every finished change to the document, as a branching history. */
  history: SceneSchema.History(Nodes),
  /** Geometries and materials the document's nodes share by id, from a file opened. */
  resources: SceneSchema.ResourceDefinitions,
  /** The document as last saved or loaded: the review panel lists what changed since. */
  saved: Nodes,
  /** The nodes when the current drag began. */
  before: Schema.Option(Nodes),
  selected: Schema.Array(Schema.String),
  gizmo: TransformGizmo.Model,
  box: BoxSelect.Model,
  view: ViewportGizmo.Model,
  /** Whether the last press was on the viewport gizmo (see the arrange sample). */
  pressedView: Schema.Boolean,
  camera: SceneSchema.Camera,
  snapping: Schema.Boolean,
  /** How the scene is lit: the editor's staging, not part of the document. */
  mood: Schema.Literals(['studio', 'daylight', 'sunset', 'night']),
  /** Why the inspector's last edit, or the last file loaded, was refused. */
  issue: Schema.Option(Schema.String),
});
export type Model = typeof Model.Type;

const standing = (position: Vec3) => ({
  position,
  rotation: [0, 0, 0] as const,
  scale: [1, 1, 1] as const,
});

export const startNodes: ReadonlyArray<SceneNode> = [
  placed(nodeOf('crate', 'crate-1'), standing([-1.2, 0.4, 0])),
  placed(nodeOf('ball', 'ball-1'), standing([0.4, 0.45, -0.6])),
  nodeOf('light', 'light-1'),
];

export const init = () => ({
  model: {
    nodes: startNodes,
    history: History.make<ReadonlyArray<SceneNode>>(startNodes, 'Opened'),
    resources: { geometries: [], materials: [] },
    saved: startNodes,
    before: Option.none(),
    selected: ['crate-1'],
    gizmo: TransformGizmo.init('gizmo', { size: 1.2 }),
    box: BoxSelect.init(),
    view: ViewportGizmo.init('view'),
    pressedView: false,
    camera: perspectiveCamera({
      fov: 45,
      position: [4.5, 4, 6.5],
      lookAt: [0, 0.4, 0],
      damping: 0.15,
    }),
    snapping: false,
    mood: 'studio' as const,
    issue: Option.none(),
  } satisfies Model,
});
