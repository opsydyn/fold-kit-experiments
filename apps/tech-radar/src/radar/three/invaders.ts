/**
 * Conway's Law invaders, an Easter egg: the Konami code sends four ranks of pixel aliens,
 * one rank per category in its colour, marching across the sky in formation. Systems copy
 * the shape of the teams that build them: four teams, four ranks. Pure: the march is a
 * function of the time since the code was entered.
 */
import {
  billboard,
  box,
  group,
  instance,
  instances,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  type Vec3,
} from '@opsydyn/effect-three';
import { Option } from 'effect';

import { categoryIds } from './data';
import type { Model } from './model';
import { viewOf } from './placement';

/** The Konami code, as the key-binding stream spells it. */
export const konamiCode = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'B',
  'A',
] as const;

/** How long an invasion lasts, and how often the formation takes a step. */
export const invasionLength = 14000;
export const marchStep = 600;

/** The alien, in two poses that alternate with each step. An original sprite, 9 × 7. */
const poses = [
  ['...XXX...', '.XXXXXXX.', 'XX.XXX.XX', 'XXXXXXXXX', '.X.X.X.X.', 'X.......X', '.X.....X.'],
  ['...XXX...', '.XXXXXXX.', 'XX.XXX.XX', 'XXXXXXXXX', '.X.X.X.X.', '.X.....X.', 'X.......X'],
] as const;

/** One pixel of the alien, in pixels from its top left. */
type Pixel = readonly [number, number];

/** The cells of a pose that are lit. */
const lit: ReadonlySet<string> = new Set(['X']);

/** The lit pixels of one row of a pose. */
const pixelsInRow = (row: string, y: number): ReadonlyArray<Pixel> =>
  [...row].flatMap(
    (cell, x): ReadonlyArray<Pixel> => [[x, y] as const].filter(() => lit.has(cell)),
  );

/** The lit pixels of a pose. */
const pixelsOf = (pose: ReadonlyArray<string>): ReadonlyArray<Pixel> => pose.flatMap(pixelsInRow);

const poseFrames = poses.map(pixelsOf);

/** A pixel's size, and the formation's shape: six aliens a rank, a rank per category. */
const pixel = 0.034;
const perRank = 6;
const alienPitch = 13 * pixel;
const rankPitch = 10 * pixel;

/** How far the formation is from the camera, and how high in the view. */
const formationDistance = 7;
const formationLift = 0.2;

/** Steps sideways before a turn, and how far each step and each drop moves. */
const stepsPerSweep = 8;
const sideStep = 2 * pixel;
const dropStep = 4 * pixel;

/** Where the march has got to after `step` steps: across and down, in the formation's plane. */
export const marchAt = (step: number): readonly [number, number] => {
  const sweep = Math.floor(step / stepsPerSweep);
  const along = step % stepsPerSweep;
  // Out on even sweeps, back on odd ones.
  const across = along + (sweep % 2) * (stepsPerSweep - 2 * along);
  return [(across - stepsPerSweep / 2) * sideStep, -sweep * dropStep];
};

/** The step the formation is on: it keeps still under reduced motion. */
export const stepOf = (model: Model, elapsed: number): number =>
  Number(!model.reducedMotion) * Math.floor(elapsed / marchStep);

/** `from` moved by `distance` along `direction`. */
const moved = (from: Vec3, direction: Vec3, distance: number): Vec3 => [
  from[0] + direction[0] * distance,
  from[1] + direction[1] * distance,
  from[2] + direction[2] * distance,
];

/** Where the formation hangs: in front of the radar, up the camera's view. */
export const formationAt = (camera: Vec3): Vec3 => {
  const view = viewOf(camera, [0, 0, 0]);
  return moved(
    moved(camera, view.forward, formationDistance),
    view.up,
    formationDistance * formationLift,
  );
};

/** One alien's pixels in a rank, centred at `x` across and `y` up. */
const alienPixels = (
  frame: ReadonlyArray<Pixel>,
  alien: number,
  x: number,
  y: number,
): ReadonlyArray<ReturnType<typeof instance>> =>
  frame.map(([px, py]) =>
    instance({
      key: `${alien}:${px}:${py}`,
      position: [x + (px - 4) * pixel, y - (py - 3) * pixel, 0],
    }),
  );

/** One rank's pixels, as instances of one small cube. */
const rankNode = (rank: number, step: number): SceneNode => {
  const category = categoryIds[rank] ?? 'techniques';
  const frame = poseFrames[step % poseFrames.length] ?? [];
  const [marchX, marchY] = marchAt(step);
  const y = ((categoryIds.length - 1) / 2 - rank) * rankPitch + marchY;
  return instances({
    key: `egg:invaders:rank:${rank}`,
    geometry: sharedGeometry('egg:pixel'),
    material: sharedMaterial(`dot:${category}`),
    instances: Array.from({ length: perRank }, (_, alien) =>
      alienPixels(frame, alien, (alien - (perRank - 1) / 2) * alienPitch + marchX, y),
    ).flat(),
  });
};

export const invaderNodes = (model: Model): ReadonlyArray<SceneNode> =>
  Option.match(model.invasion, {
    onNone: () => [],
    onSome: (elapsed) => [
      group({
        key: 'egg:invaders',
        position: formationAt(model.camera.position),
        rotation: billboard(),
        children: categoryIds.map((_, rank) => rankNode(rank, stepOf(model, elapsed))),
      }),
    ],
  });

/** One frame of an invasion: it ends once its time is up. */
export const advanceInvasion = (model: Model, deltaTimeMs: number): Model => ({
  ...model,
  invasion: Option.filter(
    Option.map(model.invasion, (elapsed) => elapsed + deltaTimeMs),
    (elapsed) => elapsed < invasionLength,
  ),
});

/** What the readout says while the invaders march. */
export const invasionReadout = (model: Model): Option.Option<string> =>
  Option.map(
    model.invasion,
    () =>
      "Conway's Law: a system copies the shape of the teams that build it. Four teams, four ranks.",
  );

export const invaderGeometries = [
  { id: 'egg:pixel', geometry: box({ width: pixel, height: pixel, depth: pixel }) },
];
