/**
 * The Kafka comet, an Easter egg: searching for "kafka" sends a comet of messages along
 * every "Builds on" edge in turn, from each foundation to the entry that builds on it, a
 * log replayed edge after edge. Pure: where the comet is follows from its clock.
 */
import {
  basic,
  group,
  mesh,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  sphere,
  type Vec3,
} from '@opsydyn/effect-three';
import { Option } from 'effect';

import type { RadarRelationship, RelationshipType } from './data';
import { isVisible, type Model, positionOf, relationshipsOf } from './model';
import { alongPath } from './relay';
import { blipPosition, edgeArc } from './space';
import { summoned } from './summon';

/** How long the comet takes over one edge, in milliseconds. */
export const cometLeg = 1800;

/** The messages trailing the head, each a little further back along the edge. */
const trail = [0, 0.04, 0.08, 0.12, 0.16, 0.2] as const;

/** Whether the comet is out: summoned by its word. */
export const cometShows = (model: Model): boolean =>
  Option.contains(summoned(model.query), 'kafka');

/** Whether the comet moves: out, and the reader has not asked for less motion. */
export const cometMoves = (model: Model): boolean => cometShows(model) && !model.reducedMotion;

/** The relationship the comet rides: what one entry is built on is what feeds it. */
const rides: ReadonlySet<RelationshipType> = new Set(['builds-on']);

/** The edges the comet rides: every visible "Builds on" relationship, in the dataset's order. */
export const cometRoute = (model: Model): ReadonlyArray<RadarRelationship> =>
  relationshipsOf(model).filter(
    ({ type, from, to }) => rides.has(type) && isVisible(model, from) && isVisible(model, to),
  );

/** The arc of one edge, from the foundation to the entry that builds on it. */
const arcOf = (model: Model, { from, to }: RadarRelationship): ReadonlyArray<Vec3> =>
  Option.match(Option.all([positionOf(model, to), positionOf(model, from)]), {
    onNone: () => [],
    onSome: ([foundation, builder]) => edgeArc(blipPosition(foundation), blipPosition(builder)),
  });

/** Where the comet is: which edge, and how far along it, from the clock. */
export const cometAt = (
  model: Model,
): Option.Option<Readonly<{ edge: RadarRelationship; along: number }>> => {
  const route = cometRoute(model);
  const leg = Math.floor(model.cometClock / cometLeg);
  return Option.map(Option.fromNullishOr(route[leg % Math.max(1, route.length)]), (edge) => ({
    edge,
    along: (model.cometClock % cometLeg) / cometLeg,
  }));
};

/** One message of the comet: the head first, then the trail, each smaller and further back. */
const messageNode = (arc: ReadonlyArray<Vec3>, along: number, index: number): SceneNode => {
  const size = 1 - index / trail.length;
  return mesh({
    key: `egg:comet:${index}`,
    position: alongPath(arc, Math.max(0, along - (trail[index] ?? 0))),
    scale: [size, size, size],
    geometry: sharedGeometry('egg:comet'),
    material: sharedMaterial(`egg:comet:${Math.min(1, index)}`),
  });
};

/** The comet: a bright head and its trail of messages, each a point on the edge's arc. */
const cometNode = (model: Model, edge: RadarRelationship, along: number): SceneNode => {
  const arc = arcOf(model, edge);
  return group({
    key: 'egg:comet',
    children: trail.map((_, index) => messageNode(arc, along, index)),
  });
};

export const cometNodes = (model: Model): ReadonlyArray<SceneNode> =>
  Option.match(
    Option.filter(cometAt(model), () => cometShows(model)),
    {
      onNone: () => [],
      onSome: ({ edge, along }) => [cometNode(model, edge, along)],
    },
  );

/** One frame of the comet's clock. */
export const advanceComet = (model: Model, deltaTimeMs: number): Model => ({
  ...model,
  cometClock: model.cometClock + deltaTimeMs,
});

export const cometGeometries = [
  { id: 'egg:comet', geometry: sphere({ radius: 0.065, widthSegments: 12, heightSegments: 8 }) },
];

export const cometMaterials = [
  // The head burns white; its messages trail off in the "Builds on" blue.
  { id: 'egg:comet:0', material: basic({ color: 0xffffff }) },
  { id: 'egg:comet:1', material: basic({ color: 0x8fbaf2, opacity: 0.7, transparent: true }) },
];
