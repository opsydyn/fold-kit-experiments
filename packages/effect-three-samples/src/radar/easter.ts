/**
 * The radar's Easter eggs: small hidden extras, each a real architecture idea. Every egg is
 * a trigger read from the Model, turned into scene nodes appended after the radar's own.
 * Eggs live beyond the outer shell, never take part in label placement, and keep still
 * under reduced motion. Their keys start `egg:`, so a hover or click on one never reads as
 * a blip's.
 */
import {
  basic,
  behave,
  cone,
  fixed,
  group,
  mesh,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  sphere,
  standard,
  torus,
  type Vec3,
} from '@opsydyn/effect-three';
import { Match, Option } from 'effect';

import type { RadarPosition } from './layout';
import { editionsOf, type Model, presentOf } from './model';
import { easeInOut } from './relay';
import { bearingOf, blipPosition, elevationOf } from './space';
import { playStep } from './timeline';

/** Every egg's scene keys start `egg:`, so hovers and clicks on one route to the egg. */
export const isEggKey = (key: string): boolean => /^egg:/.test(key);

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

// ---------------------------------------------------------------------------------------
// The abduction: Strangler Fig. When an edition drops an entry, a saucer hovers over where
// it was and, while the timeline plays, beams a ghost of it up and away.

/**
 * The entries that left the radar in the `index`th edition: on it in the edition before,
 * absent from this one. Each comes with the slot and ring it held before it left.
 */
export const departuresIn = (model: Model, index: number): ReadonlyArray<RadarPosition> => {
  const editions = editionsOf(model);
  const absent = new Set(editions[index]?.absent ?? []);
  return Match.value(index > 0 && index < editions.length).pipe(
    Match.when(true, () =>
      presentOf({ ...model, edition: index - 1 }).filter(({ entry }) => absent.has(entry.id)),
    ),
    Match.orElse(() => []),
  );
};

/** How far from the centre the saucer hovers: beyond the outer shell and its blips. */
export const saucerRadius = 3.75;

const saucerKey = (id: string): string => `egg:saucer:${id}`;

/** Reads the departed entry's id back from a saucer's key or any of its parts. */
export const idOfSaucer = (key: string): Option.Option<string> =>
  Option.fromNullishOr(/^egg:saucer:([^:]+)(?::|$)/.exec(key)?.[1]);

/**
 * How far the ghost has risen up the beam, 0 at the blip to 1 at the saucer: through
 * the edition's step while the timeline plays, eased; waiting at the bottom otherwise,
 * and always under reduced motion.
 */
export const liftOf = (model: Model): number =>
  Match.value(model.playing && !model.reducedMotion).pipe(
    Match.when(true, () => easeInOut(Math.min(1, model.playClock / playStep))),
    Match.orElse(() => 0),
  );

/** Where along the radial line a point sits: its distance from the centre. */
const heightOf = (point: Vec3): number => Math.hypot(...point);

/** The ghost's distance from the centre: from the blip's old place up to the saucer's hull. */
export const ghostHeight = (position: RadarPosition, lift: number): number => {
  const from = heightOf(blipPosition(position));
  return from + (saucerRadius - 0.12 - from) * lift;
};

/** The saucer gently bobs while it waits, unless motion is reduced. */
const hover = (model: Model) =>
  Match.value(model.reducedMotion).pipe(
    Match.when(true, () => null),
    Match.orElse(() => behave('float', { speed: 2, rotationIntensity: 0.4, floatIntensity: 0.4 })),
  );

/**
 * One saucer over a departed entry. Its parts are built along the local y axis, which two
 * turns (to the blip's longitude, then down from the pole to its latitude) point out
 * through the blip's old place: the hull at `saucerRadius`, the beam down to the blip and
 * the ghost somewhere between.
 */
const saucerNode = (model: Model, position: RadarPosition): SceneNode => {
  const { id, category } = position.entry;
  const key = saucerKey(id);
  const at = blipPosition(position);
  const from = heightOf(at);
  const lift = liftOf(model);
  const shrink = 1 - 0.6 * lift;
  return group({
    key,
    rotation: fixed([0, radians(bearingOf(at)), 0]),
    children: [
      group({
        key: `${key}:radial`,
        rotation: fixed([radians(90 - elevationOf(at)), 0, 0]),
        children: [
          group({
            key: `${key}:craft`,
            position: [0, saucerRadius, 0],
            interactive: true,
            behaviour: hover(model),
            children: [
              mesh({
                key: `${key}:hull`,
                scale: [1, 0.3, 1],
                geometry: sharedGeometry('egg:hull'),
                material: sharedMaterial('egg:metal'),
              }),
              mesh({
                key: `${key}:dome`,
                position: [0, 0.065, 0],
                geometry: sharedGeometry('egg:dome'),
                material: sharedMaterial('egg:dome'),
              }),
              mesh({
                key: `${key}:rim`,
                rotation: fixed([Math.PI / 2, 0, 0]),
                geometry: sharedGeometry('egg:rim'),
                material: sharedMaterial('egg:lights'),
              }),
            ],
          }),
          mesh({
            key: `${key}:beam`,
            position: [0, (saucerRadius + from) / 2, 0],
            scale: [1, saucerRadius - from, 1],
            geometry: sharedGeometry('egg:beam'),
            material: sharedMaterial('egg:beam'),
          }),
          mesh({
            key: `${key}:ghost`,
            position: [0, ghostHeight(position, lift), 0],
            scale: [shrink, shrink, shrink],
            geometry: sharedGeometry('dot'),
            material: sharedMaterial(`dot:${category}`),
          }),
        ],
      }),
    ],
  });
};

/** A saucer over each entry that left the radar in the shown edition. */
export const abductionNodes = (model: Model): ReadonlyArray<SceneNode> =>
  departuresIn(model, model.edition).map((position) => saucerNode(model, position));

/** What the readout says over a saucer. */
const saucerReadout = (model: Model, id: string): Option.Option<string> =>
  Option.map(
    Option.fromNullishOr(departuresIn(model, model.edition).find(({ entry }) => entry.id === id)),
    ({ entry }) => `Strangler Fig: ${entry.name} was replaced, bit by bit, and left the radar`,
  );

// ---------------------------------------------------------------------------------------
// What every egg shares.

/** What the readout says while the pointer is over an egg. */
export const eggReadout = (model: Model): Option.Option<string> =>
  Option.flatMap(model.hoveredEgg, (key) =>
    Option.flatMap(idOfSaucer(key), (id) => saucerReadout(model, id)),
  );

/** Every egg's nodes, for the scene to append after the radar's own. */
export const eggNodes = (model: Model): ReadonlyArray<SceneNode> => [...abductionNodes(model)];

export const eggGeometries = [
  { id: 'egg:hull', geometry: sphere({ radius: 0.26, widthSegments: 24, heightSegments: 12 }) },
  { id: 'egg:dome', geometry: sphere({ radius: 0.1, widthSegments: 16, heightSegments: 8 }) },
  {
    id: 'egg:rim',
    geometry: torus({ radius: 0.26, tube: 0.015, radialSegments: 6, tubularSegments: 32 }),
  },
  // Apex up, height 1: each beam is scaled to reach from its blip to its saucer.
  { id: 'egg:beam', geometry: cone({ radius: 0.2, height: 1, radialSegments: 24 }) },
];

export const eggMaterials = [
  { id: 'egg:metal', material: standard({ color: 0xb8bcc8, metalness: 0.6, roughness: 0.35 }) },
  {
    id: 'egg:dome',
    material: standard({ color: 0x9fe8c8, emissive: 0x2a6a50, opacity: 0.85, transparent: true }),
  },
  { id: 'egg:lights', material: basic({ color: 0xffd36b }) },
  {
    id: 'egg:beam',
    // Faint and depth-free like the shells: it shines through them down to the blip.
    material: basic({ color: 0x9fe8c8, opacity: 0.14, transparent: true, depthTest: false }),
  },
];
