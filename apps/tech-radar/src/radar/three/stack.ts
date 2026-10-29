/**
 * The stack's own Easter eggs: the three projects this radar is built with, each summoned
 * by its name and each showing the idea it is built on. Pure: every frame follows from
 * `stackClock`, the time since the word was typed, and under reduced motion each egg holds
 * a still picture of its idea.
 *
 * - "astro": a rocket crosses the sky, and in its wake a few blips light up as islands
 *   while the rest stay still. Astro ships HTML and hydrates only the islands.
 * - "foldkit": space folds into one point, then unfolds through every edition in turn.
 *   An update folds every Message into one Model, and here the fold runs over time.
 * - "effect": a fiber forks from Effect to each category. One fails with a typed error and
 *   is retried on an exponential Schedule until every fiber joins.
 *
 * @module
 */
import {
  basic,
  billboard,
  cone,
  cylinder,
  fixed,
  group,
  line,
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

import { type Category, categoryIds, categoryLabels } from './data';
import type { RadarPosition } from './layout';
import { categoryCenter } from './layout';
import { editionsOf, isVisible, type Model, positionOf, presentOf, themeOf } from './model';
import { alongPath, easeInOut } from './relay';
import { bearingOf, blipPosition, onSphere } from './space';
import { type MagicWord, summoned } from './summon';
import { themes } from './themes';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** How far through a stretch of `length` milliseconds starting at `start` the clock is. */
const through = (clock: number, start: number, length: number): number =>
  clamp01((clock - start) / length);

const isSummoned = (model: Model, word: MagicWord): boolean =>
  Option.contains(summoned(model.query), word);

const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scaledBy = (point: Vec3, by: number): Vec3 => [point[0] * by, point[1] * by, point[2] * by];

/**
 * A rotation that turns +z along `direction`: a yaw round y, then a pitch round x, as
 * three's XYZ Euler order applies them to a point (z first, then y, then x).
 */
const aimedAlong = (direction: Vec3): Vec3 => {
  const length = Math.hypot(...direction) || 1;
  const [x, y, z] = scaledBy(direction, 1 / length);
  return [Math.atan2(-y, z), Math.asin(Math.min(1, Math.max(-1, x))), 0];
};

// ---------------------------------------------------------------------------------------
// Astro: the rocket and its islands.

/** One crossing of the sky, then a rest before the next. */
export const astroFlight = { crossingMs: 5200, restMs: 1600 } as const;

/** How far across the sky the rocket is, 0 to 1: held mid-sky under reduced motion. */
export const astroProgress = (model: Model): number =>
  Match.value(model.reducedMotion).pipe(
    Match.when(true, () => 0.5),
    Match.orElse(() =>
      through(
        model.stackClock % (astroFlight.crossingMs + astroFlight.restMs),
        0,
        astroFlight.crossingMs,
      ),
    ),
  );

/** The rocket's course: low on the stage's left to high on its right, whatever the bearing. */
const rocketAt = (model: Model, progress: number): Vec3 =>
  onSphere(bearingOf(model.camera.position) - 80 + 160 * progress, -18 + 58 * progress, 4.4);

/** The exhaust: puffs left behind along the course, smaller the older they are. */
const smoke = [0.03, 0.06, 0.09, 0.12, 0.15, 0.18] as const;

const rocketNode = (model: Model, progress: number): SceneNode => {
  const at = rocketAt(model, progress);
  const heading = minus(rocketAt(model, progress + 0.01), at);
  const flicker = 1 + 0.15 * Math.sin(model.stackClock / 40);
  return group({
    key: 'egg:astro',
    children: [
      group({
        key: 'egg:astro:rocket',
        position: at,
        rotation: fixed(aimedAlong(heading)),
        children: [
          mesh({
            key: 'egg:astro:body',
            rotation: fixed([Math.PI / 2, 0, 0]),
            geometry: sharedGeometry('egg:astro:body'),
            material: sharedMaterial('egg:astro:hull'),
          }),
          mesh({
            key: 'egg:astro:nose',
            position: [0, 0, 0.23],
            rotation: fixed([Math.PI / 2, 0, 0]),
            geometry: sharedGeometry('egg:astro:nose'),
            material: sharedMaterial('egg:astro:nose'),
          }),
          mesh({
            key: 'egg:astro:flame',
            position: [0, 0, -0.25],
            rotation: fixed([-Math.PI / 2, 0, 0]),
            scale: [1, flicker, 1],
            geometry: sharedGeometry('egg:astro:flame'),
            material: sharedMaterial('egg:astro:flame'),
          }),
        ],
      }),
      ...smoke
        .filter((back) => progress - back > 0)
        .map((back, index) => {
          const size = 1 - index / smoke.length;
          return mesh({
            key: `egg:astro:smoke:${index}`,
            position: rocketAt(model, progress - back),
            scale: [size, size, size],
            geometry: sharedGeometry('egg:astro:smoke'),
            material: sharedMaterial('egg:astro:smoke'),
          });
        }),
    ],
  });
};

/** A blip's bearing from the camera's, in degrees from -180 to 180: left of centre is negative. */
const offsetFromBearing = (model: Model, position: RadarPosition): number =>
  ((((position.longitude - bearingOf(model.camera.position)) % 360) + 540) % 360) - 180;

/** The islands: one blip in three, the rest left as static HTML. */
export const islandsOf = (model: Model): ReadonlyArray<RadarPosition> =>
  presentOf(model)
    .filter(({ entry }) => isVisible(model, entry.id))
    .filter((_, index) => index % 3 === 0);

/** Whether the rocket has passed over an island yet: once past, it is hydrated. */
const hydrated = (model: Model, position: RadarPosition, progress: number): boolean =>
  progress >= 1 || offsetFromBearing(model, position) <= -80 + 160 * progress;

const islandNodes = (model: Model, progress: number): ReadonlyArray<SceneNode> =>
  islandsOf(model)
    .filter((position) => hydrated(model, position, progress))
    .map((position, index) => {
      const pulse = Match.value(model.reducedMotion).pipe(
        Match.when(true, () => 1),
        Match.orElse(() => 1 + 0.2 * Math.sin(model.stackClock / 160 + index)),
      );
      return mesh({
        key: `egg:astro:island:${position.entry.id}`,
        position: blipPosition(position),
        rotation: billboard(),
        scale: [pulse, pulse, pulse],
        geometry: sharedGeometry('egg:astro:island'),
        material: sharedMaterial('egg:astro:island'),
      });
    });

const astroNodes = (model: Model): ReadonlyArray<SceneNode> => {
  const progress = astroProgress(model);
  return [rocketNode(model, progress), ...islandNodes(model, progress)];
};

// ---------------------------------------------------------------------------------------
// FoldKit: space folds into one point, then unfolds through every edition.

export const foldTiming = { inMs: 1400, holdMs: 700, editionMs: 900, settleMs: 400 } as const;

/** How long the whole fold takes, for the radar's number of editions. */
export const foldLength = (model: Model): number =>
  foldTiming.inMs +
  foldTiming.holdMs +
  editionsOf(model).length * foldTiming.editionMs +
  foldTiming.settleMs;

/**
 * The fold at a moment: how far space is drawn in (1 is as it stands, 0 a point), how far
 * it has turned, which edition shows, and the brightness of the point it folds into.
 */
export type Fold = Readonly<{
  squeeze: number;
  twist: number;
  edition: Option.Option<number>;
  core: number;
  stage: 'folding' | 'folded' | 'unfolding';
}>;

/** The fold under way, if "foldkit" is summoned and the fold has not yet played out. */
export const foldOf = (model: Model): Option.Option<Fold> => {
  const clock = model.stackClock;
  const playing = isSummoned(model, 'foldkit') && !model.reducedMotion && clock < foldLength(model);
  const folded = foldTiming.inMs + foldTiming.holdMs;
  const editions = editionsOf(model).length;
  const fold = Match.value(clock).pipe(
    Match.when(
      (at) => at < foldTiming.inMs,
      (at): Fold => {
        const drawn = easeInOut(through(at, 0, foldTiming.inMs));
        return {
          squeeze: 1 - drawn,
          twist: Math.PI * drawn,
          edition: Option.none(),
          core: drawn,
          stage: 'folding',
        };
      },
    ),
    Match.when(
      (at) => at < folded,
      (at): Fold => ({
        squeeze: 0,
        twist: Math.PI,
        edition: Option.none(),
        core: 1 + 0.4 * Math.sin(Math.PI * through(at, foldTiming.inMs, foldTiming.holdMs)),
        stage: 'folded',
      }),
    ),
    Match.orElse((at): Fold => {
      const opened = easeInOut(through(at, folded, foldTiming.editionMs));
      const step = Math.floor((at - folded) / foldTiming.editionMs);
      return {
        squeeze: opened,
        twist: Math.PI * (1 - opened),
        edition: Option.some(Math.min(editions - 1, step)),
        core: 1 - opened,
        stage: 'unfolding',
      };
    }),
  );
  return Option.liftPredicate(fold, () => playing);
};

/** A point of the radar as the fold has it: turned round the vertical axis and drawn in. */
export const foldedPoint = (point: Vec3, fold: Option.Option<Fold>): Vec3 =>
  Option.match(fold, {
    onNone: () => point,
    onSome: ({ squeeze, twist }) => {
      const [x, y, z] = point;
      const [cos, sin] = [Math.cos(twist), Math.sin(twist)];
      return scaledBy([x * cos + z * sin, y, -x * sin + z * cos], squeeze);
    },
  });

/**
 * The radar as the fold shows it: every entry, whatever the search, in the edition the
 * fold has reached. Outside a fold, the radar as it is.
 */
export const stagedModel = (model: Model): Model =>
  Option.match(foldOf(model), {
    onNone: () => model,
    onSome: ({ edition }) => ({
      ...model,
      query: '',
      edition: Option.getOrElse(edition, () => model.edition),
    }),
  });

const foldNodes = (model: Model): ReadonlyArray<SceneNode> =>
  Option.match(foldOf(model), {
    onNone: () => [],
    onSome: ({ core }) => [
      mesh({
        key: 'egg:fold:core',
        scale: [core * 0.5 + 0.001, core * 0.5 + 0.001, core * 0.5 + 0.001],
        geometry: sharedGeometry('egg:fold:core'),
        material: sharedMaterial('egg:fold:core'),
      }),
    ],
  });

/** What the fold says at its stage: drawing in, one point, or the edition unfolding. */
const foldStageReadout = (model: Model, { stage, edition }: Fold): string =>
  Match.value(stage).pipe(
    Match.when('folding', () => 'FoldKit: folding every Message into one Model'),
    Match.when('folded', () => 'FoldKit: one Model'),
    Match.orElse(
      () =>
        `FoldKit: (model, message) → model · ${Option.match(
          Option.flatMap(edition, (index) => Option.fromNullishOr(editionsOf(model)[index])),
          { onNone: () => 'unfolding', onSome: ({ label }) => label },
        )}`,
    ),
  );

const foldReadout = (model: Model): string =>
  Option.match(foldOf(model), {
    onNone: () => 'FoldKit: (model, message) → model, folded over every edition',
    onSome: (fold) => foldStageReadout(model, fold),
  });

// ---------------------------------------------------------------------------------------
// Effect: fibers, a typed failure, and retries on an exponential Schedule.

/** The fiber that fails, twice, before it joins: Platforms, where software meets the world. */
export const failingFiber: Category = 'platforms';

/**
 * The fibers' clock: each grows in `growMs`; the failing one reaches `failAt` of the way in
 * `failGrowMs`, sparks for `sparkMs`, waits out its retry delay (doubling) and tries again.
 */
export const fiberTiming = {
  growMs: 1200,
  staggerMs: 140,
  failAt: 0.55,
  failGrowMs: 700,
  sparkMs: 300,
  retryDelaysMs: [500, 1000],
  joinedMs: 3200,
} as const;

/** A failed attempt: when it started, failed, and when the next began. */
type Attempt = Readonly<{ start: number; fail: number; retryAt: number; delay: number }>;

const attempts: ReadonlyArray<Attempt> = fiberTiming.retryDelaysMs.reduce<ReadonlyArray<Attempt>>(
  (done, delay) => {
    const start = done.at(-1)?.retryAt ?? 0;
    const fail = start + fiberTiming.failGrowMs;
    return [...done, { start, fail, retryAt: fail + fiberTiming.sparkMs + delay, delay }];
  },
  [],
);

/** When the last try starts, and when every fiber has joined. */
const lastTry = attempts.at(-1)?.retryAt ?? 0;
export const joinedAt = lastTry + fiberTiming.growMs;
const cycleMs = joinedAt + fiberTiming.joinedMs;

/** Where the effect's clock is in its loop: held at the end under reduced motion. */
const fiberClock = (model: Model): number =>
  Match.value(model.reducedMotion).pipe(
    Match.when(true, () => joinedAt),
    Match.orElse(() => model.stackClock % cycleMs),
  );

/** How far one fiber reaches, 0 to 1, and the spark of a failure if one is going off. */
export type FiberState = Readonly<{ reach: number; spark: Option.Option<number> }>;

/** The failing fiber during a failed attempt: growing, then sparking as it falls back. */
const attemptState = ({ start, fail }: Attempt, clock: number): FiberState => {
  const sparked = through(clock, fail, fiberTiming.sparkMs);
  return clock < fail
    ? {
        reach: fiberTiming.failAt * through(clock, start, fiberTiming.failGrowMs),
        spark: Option.none(),
      }
    : {
        reach: fiberTiming.failAt * (1 - sparked),
        spark: Option.filter(Option.some(sparked), (size) => size < 1),
      };
};

export const fiberState = (category: Category, clock: number): FiberState => {
  const order = categoryIds.indexOf(category);
  const steady: FiberState = {
    reach: through(clock, order * fiberTiming.staggerMs, fiberTiming.growMs),
    spark: Option.none(),
  };
  const lastAttempt: FiberState = {
    reach: through(clock, lastTry, fiberTiming.growMs),
    spark: Option.none(),
  };
  const failing = Option.fromNullishOr(
    attempts.find(({ start, retryAt }) => clock >= start && clock < retryAt),
  );
  return category === failingFiber
    ? Option.match(failing, {
        onNone: () => lastAttempt,
        onSome: (attempt) => attemptState(attempt, clock),
      })
    : steady;
};

/** Where the fibers fork from: Effect's own blip when it shows, the centre otherwise. */
const forkPoint = (model: Model): Vec3 =>
  Option.match(
    Option.filter(positionOf(model, 'effect'), ({ entry }) => isVisible(model, entry.id)),
    { onNone: () => [0, 0, 0], onSome: blipPosition },
  );

/** A fiber's thread from the fork to its category's middle, bowed outward. */
const fiberPath = (from: Vec3, category: Category): ReadonlyArray<Vec3> => {
  const [longitude, latitude] = categoryCenter(category);
  const to = onSphere(longitude, latitude, 3.3);
  const middle = scaledBy([from[0] + to[0], from[1] + to[1], from[2] + to[2]], 0.5);
  const bow: Vec3 = Math.hypot(...middle) < 0.1 ? [0, 1, 0] : scaledBy(middle, 0.5);
  const control: Vec3 = [middle[0] + bow[0], middle[1] + bow[1], middle[2] + bow[2]];
  return Array.from({ length: 25 }, (_, index) => {
    const t = index / 24;
    const [a, b, c] = [(1 - t) ** 2, 2 * (1 - t) * t, t ** 2];
    return [
      a * from[0] + b * control[0] + c * to[0],
      a * from[1] + b * control[1] + c * to[1],
      a * from[2] + b * control[2] + c * to[2],
    ];
  });
};

/** The part of a path up to `reach` of the way along it. */
const pathTo = (path: ReadonlyArray<Vec3>, reach: number): ReadonlyArray<Vec3> => {
  const whole = Math.floor(reach * (path.length - 1));
  return [...path.slice(0, whole + 1), alongPath(path, reach)];
};

const fiberNodes = (model: Model): ReadonlyArray<SceneNode> => {
  const clock = fiberClock(model);
  const from = forkPoint(model);
  const colours = themes[themeOf(model)].categories;
  return categoryIds.flatMap((category) => {
    const { reach, spark } = fiberState(category, clock);
    const path = fiberPath(from, category);
    const tip = alongPath(path, reach);
    const thread = [
      line({
        key: `egg:effect:fiber:${category}`,
        points: pathTo(path, reach),
        color: colours[category],
        width: 3,
        opacity: 0.9,
        transparent: true,
      }),
      mesh({
        key: `egg:effect:head:${category}`,
        position: tip,
        geometry: sharedGeometry('egg:effect:head'),
        material: sharedMaterial('egg:effect:head'),
      }),
    ];
    const sparks = Option.match(spark, {
      onNone: () => [],
      onSome: (size) => [
        mesh({
          key: `egg:effect:spark:${category}`,
          position: alongPath(path, fiberTiming.failAt),
          scale: [size * 1.6 + 0.001, size * 1.6 + 0.001, size * 1.6 + 0.001],
          geometry: sharedGeometry('egg:effect:spark'),
          material: sharedMaterial('egg:effect:spark'),
        }),
      ],
    });
    return reach > 0 ? [...thread, ...sparks] : sparks;
  });
};

/** What the effect says as it runs: the fork, each failure and its retry, the join. */
export const effectReadout = (clock: number): string => {
  const failingName = categoryLabels[failingFiber];
  const waiting = attempts.findIndex(({ fail, retryAt }) => clock >= fail && clock < retryAt);
  const retrying = attempts.findIndex(({ retryAt }, index) => {
    const next = attempts[index + 1]?.start ?? joinedAt;
    return clock >= retryAt && clock < Math.min(next, joinedAt);
  });
  return Match.value({ waiting, retrying, joined: clock >= joinedAt }).pipe(
    Match.when(
      { joined: true },
      () => 'Effect: every fiber joined. It failed, it was typed, it was retried on a Schedule.',
    ),
    Match.when(
      ({ waiting: index }) => index >= 0,
      ({ waiting: index }) =>
        `Effect: ${failingName} failed with a typed error. Retrying in ${attempts[index]?.delay ?? 0} ms (Schedule.exponential)`,
    ),
    Match.when(
      ({ retrying: index }) => index >= 0,
      ({ retrying: index }) => `Effect: retrying ${failingName}, attempt ${index + 2}`,
    ),
    Match.orElse(() => 'Effect: forking a fiber for each category'),
  );
};

// ---------------------------------------------------------------------------------------
// What the three share.

/** Whether one of the three is out and its clock should run. */
export const stackEggMoves = (model: Model): boolean =>
  !model.reducedMotion &&
  (isSummoned(model, 'astro') ||
    isSummoned(model, 'effect') ||
    (isSummoned(model, 'foldkit') && model.stackClock < foldLength(model)));

/** One frame of the stack eggs' clock. */
export const advanceStackEgg = (model: Model, deltaTimeMs: number): Model => ({
  ...model,
  stackClock: model.stackClock + deltaTimeMs,
});

/** The clock after a search: back to zero when the search summons a different word. */
export const stackClockAfter = (model: Model, query: string): number =>
  Option.getOrNull(summoned(model.query)) === Option.getOrNull(summoned(query))
    ? model.stackClock
    : 0;

/** What the readout says while one of the three plays. */
export const stackReadout = (model: Model): Option.Option<string> =>
  Option.flatMap(summoned(model.query), (word) =>
    Match.value(word).pipe(
      Match.when('foldkit', () => Option.some(foldReadout(model))),
      Match.when('effect', () => Option.some(effectReadout(fiberClock(model)))),
      Match.orElse(() => Option.none<string>()),
    ),
  );

/** One word's egg. */
const wordNodes = (model: Model, word: MagicWord): ReadonlyArray<SceneNode> =>
  Match.value(word).pipe(
    Match.when('astro', () => astroNodes(model)),
    Match.when('foldkit', () => foldNodes(model)),
    Match.when('effect', () => fiberNodes(model)),
    Match.orElse(() => []),
  );

export const stackNodes = (model: Model): ReadonlyArray<SceneNode> =>
  Option.match(summoned(model.query), {
    onNone: () => [],
    onSome: (word) => wordNodes(model, word),
  });

export const stackGeometries = [
  {
    id: 'egg:astro:body',
    geometry: cylinder({ radiusTop: 0.07, radiusBottom: 0.07, height: 0.32, radialSegments: 16 }),
  },
  { id: 'egg:astro:nose', geometry: cone({ radius: 0.07, height: 0.14, radialSegments: 16 }) },
  { id: 'egg:astro:flame', geometry: cone({ radius: 0.05, height: 0.18, radialSegments: 12 }) },
  {
    id: 'egg:astro:smoke',
    geometry: sphere({ radius: 0.045, widthSegments: 10, heightSegments: 6 }),
  },
  {
    id: 'egg:astro:island',
    geometry: torus({ radius: 0.16, tube: 0.012, radialSegments: 6, tubularSegments: 40 }),
  },
  { id: 'egg:fold:core', geometry: sphere({ radius: 1, widthSegments: 24, heightSegments: 16 }) },
  {
    id: 'egg:effect:head',
    geometry: sphere({ radius: 0.045, widthSegments: 10, heightSegments: 6 }),
  },
  {
    id: 'egg:effect:spark',
    geometry: sphere({ radius: 0.12, widthSegments: 12, heightSegments: 8 }),
  },
];

export const stackMaterials = [
  { id: 'egg:astro:hull', material: standard({ color: 0xe8e8f0, metalness: 0.4, roughness: 0.4 }) },
  // Astro's orange.
  { id: 'egg:astro:nose', material: standard({ color: 0xff5d01, roughness: 0.5 }) },
  { id: 'egg:astro:flame', material: basic({ color: 0xffc04d }) },
  { id: 'egg:astro:smoke', material: basic({ color: 0xff8a3d, opacity: 0.5, transparent: true }) },
  { id: 'egg:astro:island', material: basic({ color: 0xff5d01, opacity: 0.9, transparent: true }) },
  { id: 'egg:fold:core', material: basic({ color: 0xf2f0ff, opacity: 0.85, transparent: true }) },
  { id: 'egg:effect:head', material: basic({ color: 0xffffff }) },
  {
    id: 'egg:effect:spark',
    material: basic({ color: 0xff4d4d, opacity: 0.75, transparent: true }),
  },
];
