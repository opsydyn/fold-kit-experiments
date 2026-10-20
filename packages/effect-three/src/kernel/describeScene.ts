/**
 * What a scene contains, for an assistant (roadmap, "Beyond parity" 3): its camera, its
 * things with their kind, size, colour and place, its lights, the box they fill and its
 * staging, as data (`describeScene`) and as a few lines of text (`formatSummary`) an
 * agent reads before it acts. An agent that reads the Model can describe a scene
 * without three.js, so sizes come from the geometry's parameters and the node's scale:
 * close enough to place things beside one another and to frame a shot.
 *
 * @module
 */
import type {
  GeometryRef,
  Rgb,
  SceneDescription,
  SceneNode,
  ShapeGeometry,
  Vec3,
} from './description.ts';
import type { Box } from './orbit.ts';

export type ThingSummary = {
  readonly key: string;
  /** The node's kind, with its geometry's for a mesh: `Mesh (Box)`. */
  readonly kind: string;
  /** In its parent's space; for things at the top, the world's. */
  readonly position: Vec3;
  /** Width, height and depth, from the geometry and scale; `null` when not known. */
  readonly size: Vec3 | null;
  readonly colour: Rgb | null;
  /** The group it is in, `null` at the top. */
  readonly parent: string | null;
};

export type LightSummary = {
  readonly key: string;
  readonly kind: string;
  readonly colour: Rgb;
  readonly intensity: number;
  readonly position: Vec3 | null;
};

export type SceneSummary = {
  readonly camera: {
    readonly kind: 'Perspective' | 'Orthographic';
    readonly position: Vec3;
    readonly lookAt: Vec3;
  };
  readonly things: ReadonlyArray<ThingSummary>;
  readonly lights: ReadonlyArray<LightSummary>;
  /** The box the top-level things of known size fill, `null` with none. */
  readonly bounds: Box | null;
  readonly staging: ReadonlyArray<string>;
};

/** Width, height and depth of a shape, unscaled; `undefined` for text and shapes. */
const extentOf = (geometry: ShapeGeometry): Vec3 | undefined => {
  switch (geometry._tag) {
    case 'Box':
    case 'RoundedBox':
      return [geometry.width, geometry.height, geometry.depth];
    case 'Sphere':
      return [geometry.radius * 2, geometry.radius * 2, geometry.radius * 2];
    case 'Cone':
      return [geometry.radius * 2, geometry.height, geometry.radius * 2];
    case 'Cylinder': {
      const across = Math.max(geometry.radiusTop, geometry.radiusBottom) * 2;
      return [across, geometry.height, across];
    }
    case 'Capsule':
      return [geometry.radius * 2, geometry.height + geometry.radius * 2, geometry.radius * 2];
    case 'Torus': {
      const across = (geometry.radius + geometry.tube) * 2;
      return [across, across, geometry.tube * 2];
    }
    case 'Plane':
      return [geometry.width, geometry.height, 0];
    case 'Circle':
      return [geometry.radius * 2, geometry.radius * 2, 0];
    case 'Ring':
      return [geometry.outerRadius * 2, geometry.outerRadius * 2, 0];
    default:
      return undefined;
  }
};

const scaled = (extent: Vec3, scale: Vec3): Vec3 => [
  extent[0] * Math.abs(scale[0]),
  extent[1] * Math.abs(scale[1]),
  extent[2] * Math.abs(scale[2]),
];

/** The shape a geometry reference draws: its own, a shared one's, or none (lent). */
const shapeOf = (
  geometry: GeometryRef,
  description: SceneDescription,
): ShapeGeometry | undefined => {
  if (geometry._tag === 'LentGeometry') return undefined;
  if (geometry._tag !== 'SharedGeometry') return geometry;
  return description.resources.geometries.find((entry) => entry.id === geometry.id)?.geometry;
};

const sizeOf = (node: SceneNode, description: SceneDescription): Vec3 | null => {
  if (node._tag !== 'Mesh') return null;
  const shape = shapeOf(node.geometry, description);
  const extent = shape === undefined ? undefined : extentOf(shape);
  return extent === undefined ? null : scaled(extent, node.scale);
};

const colourOf = (node: SceneNode): Rgb | null =>
  node._tag === 'Mesh' && 'color' in node.material ? node.material.color : null;

const kindOf = (node: SceneNode): string =>
  node._tag === 'Mesh' ? `Mesh (${node.geometry._tag})` : node._tag;

const isLight = (node: SceneNode): boolean => node._tag.endsWith('Light');

const lightOf = (node: SceneNode): ReadonlyArray<LightSummary> => {
  if (!isLight(node) || !('color' in node) || !('intensity' in node)) return [];
  return [
    {
      key: node.key,
      kind: node._tag,
      colour: node.color,
      intensity: node.intensity,
      position: 'position' in node ? node.position : null,
    },
  ];
};

const thingsIn = (
  nodes: ReadonlyArray<SceneNode>,
  parent: string | null,
  description: SceneDescription,
): ReadonlyArray<ThingSummary> =>
  nodes.flatMap((node) => [
    ...(isLight(node)
      ? []
      : [
          {
            key: node.key,
            kind: kindOf(node),
            position: 'position' in node ? node.position : ([0, 0, 0] as const),
            size: sizeOf(node, description),
            colour: colourOf(node),
            parent,
          },
        ]),
    ...(node._tag === 'Group' ? thingsIn(node.children, node.key, description) : []),
  ]);

const lightsIn = (nodes: ReadonlyArray<SceneNode>): ReadonlyArray<LightSummary> =>
  nodes.flatMap((node) => [
    ...lightOf(node),
    ...(node._tag === 'Group' ? lightsIn(node.children) : []),
  ]);

/** The box top-level things of known size fill, each taken as a box round its place. */
export const thingsBounds = (things: ReadonlyArray<ThingSummary>): Box | null => {
  const sized = things.filter((thing) => thing.parent === null && thing.size !== null);
  if (sized.length === 0) return null;
  const edge = (axis: 0 | 1 | 2, sign: 1 | -1): ReadonlyArray<number> =>
    sized.map((thing) => thing.position[axis] + sign * ((thing.size?.[axis] ?? 0) / 2));
  const low = (axis: 0 | 1 | 2) => Math.min(...edge(axis, -1));
  const high = (axis: 0 | 1 | 2) => Math.max(...edge(axis, 1));
  return { min: [low(0), low(1), low(2)], max: [high(0), high(1), high(2)] };
};

const stagingOf = (description: SceneDescription): ReadonlyArray<string> => [
  ...(description.environment === null ? [] : ['environment lighting']),
  ...(description.sky === null ? [] : ['sky']),
  ...(description.render.shadows === 'off' ? [] : [`${description.render.shadows} shadows`]),
  ...(description.contactShadows === null ? [] : ['contact shadows']),
  ...description.render.effects.map((effect) => effect._tag.toLowerCase()),
  ...(description.physics === null ? [] : ['physics']),
];

/** What `description` contains, for an assistant to read. */
export const describeScene = (description: SceneDescription): SceneSummary => {
  const things = thingsIn(description.children, null, description);
  return {
    camera: {
      kind: description.camera._tag,
      position: description.camera.position,
      lookAt: description.camera.lookAt,
    },
    things,
    lights: lightsIn(description.children),
    bounds: thingsBounds(things),
    staging: stagingOf(description),
  };
};

const number = (value: number): string => String(Math.round(value * 100) / 100);
const point = (at: Vec3): string => `(${at.map(number).join(', ')})`;
const hex = (colour: Rgb): string => `#${colour.toString(16).padStart(6, '0')}`;

const thingLine = (thing: ThingSummary): string =>
  [
    `- ${thing.key}: ${thing.kind}`,
    thing.size === null ? '' : `, ${thing.size.map(number).join(' × ')}`,
    thing.colour === null ? '' : `, ${hex(thing.colour)}`,
    `, at ${point(thing.position)}`,
    thing.parent === null ? '' : ` in ${thing.parent}`,
  ].join('');

const lightLine = (light: LightSummary): string =>
  `- ${light.key}: ${light.kind}, ${hex(light.colour)} × ${number(light.intensity)}${
    light.position === null ? '' : ` at ${point(light.position)}`
  }`;

/** The summary as a few lines of text, for a prompt or a tool's answer. */
export const formatSummary = (summary: SceneSummary): string =>
  [
    `Camera: ${summary.camera.kind.toLowerCase()} at ${point(summary.camera.position)}, looking at ${point(summary.camera.lookAt)}`,
    `Things (${summary.things.length})${
      summary.bounds === null
        ? ''
        : `, within ${point(summary.bounds.min)} to ${point(summary.bounds.max)}`
    }:`,
    ...summary.things.map(thingLine),
    `Lights (${summary.lights.length}):`,
    ...summary.lights.map(lightLine),
    `Staging: ${summary.staging.length === 0 ? 'none' : summary.staging.join(', ')}`,
  ].join('\n');
