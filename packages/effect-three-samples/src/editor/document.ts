/**
 * The document the editor edits: a scene's top-level nodes, as plain `SceneNode`s. What
 * can be added, how each node is placed for the gizmo, and how a hit on the scene finds
 * the node it belongs to. The editor's own staging (floor, grid, light markers, gizmos)
 * is drawn around the document and never saved in it.
 */
import {
  box,
  cone,
  fixed,
  type Placement,
  pointLight,
  type Rotation,
  setAt,
  roundedBox,
  type SceneNode,
  mesh,
  sphere,
  standard,
  torus,
  type Vec3,
} from '@opsydyn/effect-three';
import { Schema } from 'effect';

import { paintColour } from '../palette';

/** What the editor can add. */
export const Addable = Schema.Literals(['crate', 'box', 'ball', 'cone', 'ring', 'light']);
export type Addable = typeof Addable.Type;

export const addables: ReadonlyArray<Addable> = Addable.literals;

const addedColour = {
  crate: paintColour.coral,
  box: paintColour.periwinkle,
  ball: paintColour.blue,
  cone: paintColour.gold,
  ring: paintColour.mint,
} as const;

const addedGeometry = {
  crate: roundedBox({ width: 0.8, height: 0.8, depth: 0.8, radius: 0.06 }),
  box: box({ width: 1, height: 0.5, depth: 0.6 }),
  ball: sphere({ radius: 0.45, widthSegments: 32, heightSegments: 16 }),
  cone: cone({ radius: 0.4, height: 0.9, radialSegments: 24 }),
  ring: torus({ radius: 0.35, tube: 0.12, radialSegments: 12, tubularSegments: 40 }),
} as const;

/** A new node of `kind` under `key`, standing on the floor at the middle. */
export const nodeOf = (kind: Addable, key: string): SceneNode =>
  kind === 'light'
    ? pointLight({ key, position: [0, 2.5, 0], intensity: 8, color: 0xfff1d6 })
    : mesh({
        key,
        position: [0, 0.5, 0],
        rotation: fixed([0, 0, 0]),
        geometry: addedGeometry[kind],
        material: standard({ color: addedColour[kind], roughness: 0.45, metalness: 0.05 }),
        castShadow: true,
      });

/** The first `${kind}-n` not yet a key in `nodes`. */
export const freshKey = (nodes: ReadonlyArray<SceneNode>, kind: string): string => {
  const taken = new Set(nodes.map((node) => node.key));
  const numbered = Array.from({ length: nodes.length + 1 }, (_, index) => `${kind}-${index + 1}`);
  return numbered.find((key) => !taken.has(key)) ?? `${kind}-${nodes.length + 1}`;
};

type Turn = Vec3 | Rotation;

/** A node's turn as Euler angles: a fixed rotation's, a bare one's, or none. */
const eulerOf = (turn: Turn): Vec3 => {
  if (!('_tag' in turn)) return turn;
  return turn._tag === 'Fixed' ? turn.euler : [0, 0, 0];
};

/** Where a node is, for the gizmo: what it has of position, turn and scale. */
export const placementOf = (node: SceneNode): Placement => ({
  position: 'position' in node ? node.position : [0, 0, 0],
  rotation: 'rotation' in node ? eulerOf(node.rotation) : [0, 0, 0],
  scale: 'scale' in node ? node.scale : [1, 1, 1],
});

/** The turn written back as the node keeps it: bare angles, or a fixed rotation. */
const turnLike = (turn: Turn, euler: Vec3): Turn => ('_tag' in turn ? fixed(euler) : euler);

/** The node at `placement`: each of position, turn and scale it has, set. */
export const placed = (node: SceneNode, placement: Placement): SceneNode => {
  const turn =
    'rotation' in node ? turnLike(node.rotation, placement.rotation) : placement.rotation;
  const fields = [
    ['position', placement.position],
    ['rotation', turn],
    ['scale', placement.scale],
  ] as const;
  const moved = fields
    .filter(([name]) => name in node)
    .reduce<unknown>((at, [name, value]) => setAt(at, [name], value), node);
  // SAFETY: only fields `node` has are replaced, each with a value of its own type.
  return moved as SceneNode;
};

/** A copy of `node` under a fresh key, a step to the side. */
export const duplicated = (nodes: ReadonlyArray<SceneNode>, node: SceneNode): SceneNode => {
  const { position, rotation, scale } = placementOf(node);
  const key = freshKey(nodes, node.key.replace(/-\d+$/, ''));
  return placed(
    { ...node, key },
    { position: [position[0] + 1, position[1], position[2]], rotation, scale },
  );
};

/** Light markers are the editor's: drawn under `marker:${key}` so the light can be picked. */
export const markerKey = (key: string): string => `marker:${key}`;

/**
 * The document node a hit is on: its top-level ancestor (a group's, for a mesh inside
 * one), a light for its marker, or nothing for the editor's own staging.
 */
export const nodeKeyOf = (
  nodes: ReadonlyArray<SceneNode>,
  hit: { readonly key: string; readonly path: ReadonlyArray<string> },
): string | undefined => {
  const top = hit.path.at(-1) ?? hit.key;
  const key = top.startsWith('marker:') ? top.slice('marker:'.length) : top;
  return nodes.some((node) => node.key === key) ? key : undefined;
};

/** Each node's position, for the selection box. */
export const selectableOf = (nodes: ReadonlyArray<SceneNode>) =>
  nodes.map((node) => ({ key: node.key, at: placementOf(node).position }));
