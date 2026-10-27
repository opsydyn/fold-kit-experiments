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
  billboard,
  box,
  cone,
  cylinder,
  ease,
  fixed,
  group,
  mesh,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  sphere,
  spin,
  standard,
  torus,
  type Vec3,
} from '@opsydyn/effect-three';
import { Match, Option } from 'effect';

import { capGeometries, capMaterials, capNodes, capReadout, isCapKey } from './capMoons';
import type { RadarPosition } from './layout';
import { editionsOf, type Model, type MonolithState, presentOf } from './model';
import { easeInOut } from './relay';
import { bearingOf, blipPosition, elevationOf, isBirdsEye, onSphere } from './space';
import { answers, summoned, summonedMonolith } from './summon';
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
/**
 * The fallacies of distributed computing (L Peter Deutsch and others at Sun): what a
 * saucer's beam is quietly relying on. Each visit to a saucer reads the next.
 */
export const fallacies = [
  'the network is reliable',
  'latency is zero',
  'bandwidth is infinite',
  'the network is secure',
  'topology doesn’t change',
  'there is one administrator',
  'transport cost is zero',
  'the network is homogeneous',
] as const;

/** The fallacy for the latest visit to a saucer, counting from the first. */
export const fallacyOf = (visits: number): string => {
  const index = (Math.max(1, visits) - 1) % fallacies.length;
  return `Fallacy ${index + 1} of ${fallacies.length}: ${fallacies[index] ?? ''}`;
};

/** What a saucer is told: the Strangler Fig, then the fallacy for this visit. */
const saucerReadout = (model: Model, id: string): Option.Option<string> =>
  Option.map(
    Option.fromNullishOr(departuresIn(model, model.edition).find(({ entry }) => entry.id === id)),
    ({ entry }) =>
      `Strangler Fig: ${entry.name} was replaced, bit by bit, and left the radar · ${fallacyOf(model.saucerVisits)}`,
  );

// ---------------------------------------------------------------------------------------
// The Monolith: monolith versus microservices. In the universe view a black slab in the
// film's proportions, 1 : 4 : 9, floats beside the radar. A click shatters it into
// microservices drifting round where it stood; another puts it back together.

export const isMonolithKey = (key: string): boolean => /^egg:monolith(?::|$)/.test(key);

/** Where the Monolith floats, as an offset from the camera's bearing: off to the left. */
const monolithPlaces = {
  above: { bearing: -90, latitude: 0, radius: 3.55 },
  side: { bearing: -75, latitude: 30, radius: 3.9 },
} as const;

/** Where the Monolith floats for a camera: beside the radar, on the stage's left. */
export const monolithAt = (camera: Vec3): Vec3 => {
  const place = Match.value(isBirdsEye(camera)).pipe(
    Match.when(true, () => monolithPlaces.above),
    Match.orElse(() => monolithPlaces.side),
  );
  return onSphere(bearingOf(camera) + place.bearing, place.latitude, place.radius);
};

/** Whether the Monolith is out: from above, where the radar reads as a map, or when called. */
export const monolithShows = (model: Model): boolean =>
  isBirdsEye(model.camera.position) || Option.isSome(summonedMonolith(model.query));

/** The slab, built of 3 × 8 blocks one deep: 0.1 thick, 0.4 wide and 0.9 tall. */
const slab = { columns: 3, rows: 8, width: 0.4, height: 0.9, depth: 0.1 } as const;
export const blockCount = slab.columns * slab.rows;
const blockWidth = slab.width / slab.columns;
const blockHeight = slab.height / slab.rows;

/** A block's place in the whole slab, which it tiles exactly. */
export const wholeAt = (index: number): Vec3 => [
  ((index % slab.columns) - (slab.columns - 1) / 2) * blockWidth,
  (Math.floor(index / slab.columns) - (slab.rows - 1) / 2) * blockHeight,
  0,
];

/** Two loose rings the microservices drift on, round where the slab stood. */
const ringRadii = [0.22, 0.34] as const;

/** A block's place once shattered: alternately on the inner and outer ring, a little deep. */
export const shatteredAt = (index: number): Vec3 => {
  const radius = ringRadii[index % 2] ?? 0;
  const angle = (index / blockCount) * 2 * Math.PI + (index % 2) * 0.13;
  return [radius * Math.cos(angle), radius * Math.sin(angle), (((index * 5) % 3) - 1) * 0.05];
};

/** How each block sits, whole or shattered: microservices are smaller, and askew. */
const blockPose = (state: MonolithState, index: number) =>
  Match.value(state).pipe(
    Match.when('whole', () => ({
      position: wholeAt(index),
      rotation: fixed([0, 0, 0]),
      scale: [1, 1, 1] as const,
    })),
    Match.orElse(() => ({
      position: shatteredAt(index),
      rotation: fixed([(index * 0.7) % Math.PI, (index * 1.1) % Math.PI, 0]),
      scale: [0.75, 0.75, 0.75] as const,
    })),
  );

/** Only microservices drift: a whole slab keeps still. */
const drifts = { whole: false, shattered: true } as const satisfies Readonly<
  Record<MonolithState, boolean>
>;

/** Microservices drift, each at its own pace; the whole slab, and a calm reader's, keep still. */
const drift = (model: Model, index: number) =>
  Match.value(drifts[model.monolith] && !model.reducedMotion).pipe(
    Match.when(true, () =>
      behave('float', { speed: 1.5, phase: index, rotationIntensity: 1, floatIntensity: 0.4 }),
    ),
    Match.orElse(() => null),
  );

const regroup = ease({ seconds: 0.9 });

/**
 * The Monolith: a group turned to face the camera, floating beside the radar, its blocks
 * easing between the slab and the drift. One interactive group, so a click anywhere on it
 * is the Monolith's.
 */
const monolithNode = (model: Model): SceneNode =>
  group({
    key: 'egg:monolith',
    position: monolithAt(model.camera.position),
    rotation: billboard(),
    transition: ease({ seconds: 0.6 }),
    interactive: true,
    children: [
      // Unseen, where the slab stood: a click in the middle of the drift still lands on it.
      mesh({
        key: 'egg:monolith:core',
        geometry: sharedGeometry('egg:core'),
        material: sharedMaterial('egg:unseen'),
      }),
      ...Array.from({ length: blockCount }, (_, index) =>
        mesh({
          key: `egg:monolith:block:${index}`,
          ...blockPose(model.monolith, index),
          transition: regroup,
          behaviour: drift(model, index),
          geometry: sharedGeometry('egg:block'),
          material: sharedMaterial('egg:monolith'),
        }),
      ),
    ],
  });

export const monolithNodes = (model: Model): ReadonlyArray<SceneNode> =>
  [monolithNode(model)].filter(() => monolithShows(model));

/** What the readout says over the Monolith, whole or shattered. */
const monolithReadouts = {
  whole: 'A monolith. Click to decompose it.',
  shattered: 'Microservices. Click to put the distributed monolith back together.',
} as const satisfies Readonly<Record<MonolithState, string>>;

// ---------------------------------------------------------------------------------------
// The probe: COBOL. Searching for it sends a small Voyager-style probe round the far sky,
// dish turned back to the radar: still running, very far away.

/** How far out the probe circles, how high, and how slowly. */
export const probeOrbit = { radius: 7, height: 2.6, radiansPerSecond: 0.12 } as const;

/** The probe circles the radar, unless motion is reduced: then it holds where it is. */
const probeCourse = (model: Model) =>
  Match.value(model.reducedMotion).pipe(
    Match.when(true, () => fixed([0, -0.5, 0])),
    Match.orElse(() => spin({ axis: 'y', radiansPerSecond: probeOrbit.radiansPerSecond })),
  );

const probeNode = (model: Model): SceneNode =>
  group({
    key: 'egg:probe',
    rotation: probeCourse(model),
    children: [
      group({
        key: 'egg:probe:craft',
        position: [0, probeOrbit.height, probeOrbit.radius],
        interactive: true,
        children: [
          mesh({
            key: 'egg:probe:bus',
            geometry: sharedGeometry('egg:bus'),
            material: sharedMaterial('egg:gold'),
          }),
          // The dish faces back down its orbit's radius, towards the radar.
          mesh({
            key: 'egg:probe:dish',
            position: [0, 0, -0.09],
            rotation: fixed([-Math.PI / 2, 0, 0]),
            geometry: sharedGeometry('egg:dish'),
            material: sharedMaterial('egg:metal'),
          }),
          mesh({
            key: 'egg:probe:boom',
            position: [0.32, 0, 0],
            rotation: fixed([0, 0, Math.PI / 2]),
            geometry: sharedGeometry('egg:boom'),
            material: sharedMaterial('egg:metal'),
          }),
        ],
      }),
    ],
  });

export const probeNodes = (model: Model): ReadonlyArray<SceneNode> =>
  [probeNode(model)].filter(() => Option.contains(summoned(model.query), 'cobol'));

const isProbeKey = (key: string): boolean => /^egg:probe(?::|$)/.test(key);

// ---------------------------------------------------------------------------------------
// What every egg shares.

/** What the readout says while the pointer is over an egg. */
export const eggReadout = (model: Model): Option.Option<string> =>
  Option.orElse(hoveredReadout(model), () =>
    Option.flatMap(summoned(model.query), (word) => Option.fromNullishOr(answers[word])),
  );

/** Reads what one egg says when the pointer is over a key, if the key is that egg's. */
type EggReader = (model: Model, key: string) => Option.Option<string>;

/** A reader for an egg recognised by its key alone. */
const saying =
  (matches: (key: string) => boolean, say: (model: Model) => string): EggReader =>
  (model, key) =>
    Option.map(Option.liftPredicate(key, matches), () => say(model));

const eggReaders: ReadonlyArray<EggReader> = [
  (model, key) => Option.flatMap(idOfSaucer(key), (id) => saucerReadout(model, id)),
  (model, key) =>
    Option.filter(
      saying(isMonolithKey, ({ monolith }) => monolithReadouts[monolith])(model, key),
      () => monolithShows(model),
    ),
  saying(isProbeKey, () => 'COBOL: still running, very far away'),
  saying(isCapKey, capReadout),
];

/** The first of these that has something. */
const firstSome = (options: ReadonlyArray<Option.Option<string>>): Option.Option<string> =>
  Option.flatten(Option.fromNullishOr(options.find(Option.isSome)));

/** What the egg under the pointer says. */
const hoveredReadout = (model: Model): Option.Option<string> =>
  Option.flatMap(model.hoveredEgg, (key) => firstSome(eggReaders.map((read) => read(model, key))));

/** Every egg's nodes, for the scene to append after the radar's own. */
export const eggNodes = (model: Model): ReadonlyArray<SceneNode> => [
  ...abductionNodes(model),
  ...monolithNodes(model),
  ...probeNodes(model),
  ...capNodes(model),
];

export const eggGeometries = [
  ...capGeometries,
  { id: 'egg:hull', geometry: sphere({ radius: 0.26, widthSegments: 24, heightSegments: 12 }) },
  { id: 'egg:dome', geometry: sphere({ radius: 0.1, widthSegments: 16, heightSegments: 8 }) },
  {
    id: 'egg:rim',
    geometry: torus({ radius: 0.26, tube: 0.015, radialSegments: 6, tubularSegments: 32 }),
  },
  { id: 'egg:bus', geometry: box({ width: 0.12, height: 0.08, depth: 0.12 }) },
  {
    id: 'egg:dish',
    geometry: cylinder({ radiusTop: 0.2, radiusBottom: 0.04, height: 0.06, radialSegments: 24 }),
  },
  {
    id: 'egg:boom',
    geometry: cylinder({ radiusTop: 0.008, radiusBottom: 0.008, height: 0.5, radialSegments: 6 }),
  },
  { id: 'egg:core', geometry: sphere({ radius: 0.36, widthSegments: 12, heightSegments: 8 }) },
  { id: 'egg:block', geometry: box({ width: blockWidth, height: blockHeight, depth: slab.depth }) },
  // Apex up, height 1: each beam is scaled to reach from its blip to its saucer.
  { id: 'egg:beam', geometry: cone({ radius: 0.2, height: 1, radialSegments: 24 }) },
];

export const eggMaterials = [
  ...capMaterials,
  { id: 'egg:metal', material: standard({ color: 0xb8bcc8, metalness: 0.6, roughness: 0.35 }) },
  {
    id: 'egg:dome',
    material: standard({ color: 0x9fe8c8, emissive: 0x2a6a50, opacity: 0.85, transparent: true }),
  },
  { id: 'egg:lights', material: basic({ color: 0xffd36b }) },
  { id: 'egg:gold', material: standard({ color: 0xc9a24a, metalness: 0.8, roughness: 0.35 }) },
  { id: 'egg:unseen', material: basic({ opacity: 0, transparent: true }) },
  // Black, but glossy enough to catch the key light, so it reads against the night.
  { id: 'egg:monolith', material: standard({ color: 0x0a0a10, metalness: 0.7, roughness: 0.18 }) },
  {
    id: 'egg:beam',
    // Faint and depth-free like the shells: it shines through them down to the blip.
    material: basic({ color: 0x9fe8c8, opacity: 0.14, transparent: true, depthTest: false }),
  },
];
