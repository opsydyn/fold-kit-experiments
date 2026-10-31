/**
 * How a comparison of two editions looks on the 3D radar (see compare.ts for what each
 * change is). Every mark is a function of the change and of how far the arrivals have
 * played, so the frame clock only advances a number in the Model:
 *
 * - ▲ / ▼ moved: a ghost where it stood, a line to where it stands, a chevron on the line.
 * - ✦ new, first light: a shockwave and a burst of rays as it ignites, then a halo.
 * - ↺ returned, a periodic comet: it comes round its orbit, and its tail stays behind it,
 *   fading into the sky.
 * - ◌ left, an event horizon: a dashed ring collapses on where it stood, round an ember.
 *
 * Rings and rays face the camera, so they read as circles and stars from any side.
 */
import {
  line,
  mesh,
  type SceneNode,
  sharedGeometry,
  sharedMaterial,
  type Vec3,
} from '@opsydyn/effect-three';
import { Option } from 'effect';

import { bodyOf } from './bodies';
import { arrivalProgress, comparedWith, type Move, movesOf } from './compare';
import type { Model } from './model';
import { viewOf } from './placement';
import { onSphere, shellRadius } from './space';
import type { Tokens } from './themes';

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v: Vec3, by: number): Vec3 => [v[0] * by, v[1] * by, v[2] * by];
const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (v: Vec3): Vec3 => scale(v, 1 / (Math.hypot(...v) || 1));
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Decelerating: quick to start, settling at the end. */
const easeOut = (t: number): number => 1 - (1 - t) ** 3;

/** `a` mixed `t` of the way towards `b`, as colours. */
const mix = (a: number, b: number, t: number): number =>
  [16, 8, 0].reduce((colour, shift) => {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    return colour | (Math.round(from + (to - from) * t) << shift);
  }, 0);

type Facing = Readonly<{ right: Vec3; up: Vec3; forward: Vec3 }>;

/** A circle round `centre`, facing the camera. */
const circle = (facing: Facing, centre: Vec3, radius: number): ReadonlyArray<Vec3> =>
  Array.from({ length: 41 }, (_, i) => {
    const angle = (i / 40) * Math.PI * 2;
    return add(
      centre,
      add(
        scale(facing.right, Math.cos(angle) * radius),
        scale(facing.up, Math.sin(angle) * radius),
      ),
    );
  });

/** ✦ First light: a shockwave and rays while it ignites, a halo once it has. */
const firstLight = (move: Move, colour: number, facing: Facing, played: number) => {
  const flare = easeOut(played);
  const burning = played < 1;
  const rays = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const way = add(scale(facing.right, Math.cos(angle)), scale(facing.up, Math.sin(angle)));
    return [
      add(move.to, scale(way, 0.14 + 0.32 * flare)),
      add(move.to, scale(way, 0.18 + 0.58 * flare)),
    ] as const;
  }).flat();
  return [
    ...[
      line({
        key: `flare:${move.id}`,
        points: circle(facing, move.to, 0.14 + 0.8 * flare),
        color: colour,
        width: 2,
        opacity: 0.9 * (1 - played),
        transparent: true,
      }),
      line({
        key: `burst:${move.id}`,
        points: rays,
        segments: true,
        color: colour,
        width: 1.5,
        opacity: 1 - played,
        transparent: true,
      }),
    ].filter(() => burning),
    line({
      key: `halo:${move.id}`,
      points: circle(facing, move.to, 0.26),
      color: colour,
      width: 1.5,
      opacity: 0.3 + 0.45 * played,
      transparent: true,
    }),
  ];
};

/** How far behind its head a comet's tail reaches, and how far round it comes, in degrees. */
const tail = { length: 42, approach: 50 } as const;

/** ↺ A periodic comet: round its orbit to where it stands, its tail fading into the sky. */
const comet = (move: Move, colour: number, tokens: Tokens, played: number) => {
  const radius = shellRadius(move.ring);
  const head = move.longitude - tail.approach * (1 - easeOut(played));
  const steps = 18;
  const along = Array.from({ length: steps }, (_, i) => i / (steps - 1));
  return [
    line({
      key: `comet:${move.id}`,
      points: along.map((t) => onSphere(head - t * tail.length, move.latitude, radius)),
      vertexColors: along.map((t) => mix(colour, tokens.page, t)),
      width: 4,
      opacity: 0.95,
      transparent: true,
    }),
    ...[
      mesh({
        key: `comet-head:${move.id}`,
        geometry: sharedGeometry('dot'),
        material: sharedMaterial(`dot:${move.category}`),
        position: onSphere(head, move.latitude, radius),
      }),
    ].filter(() => played < 1),
  ];
};

/** ◌ An event horizon: a dashed ring collapsing on where it stood, round an ember. */
const horizon = (move: Move, colour: number, facing: Facing, played: number) => [
  line({
    key: `horizon:${move.id}`,
    points: circle(facing, move.from, 0.24 + 0.6 * (1 - easeOut(played))),
    color: colour,
    width: 1.5,
    opacity: 0.35 + 0.35 * played,
    transparent: true,
    dashed: true,
    dashSize: 0.06,
    gapSize: 0.05,
  }),
  mesh({
    key: `ember:${move.id}`,
    geometry: sharedGeometry('dot'),
    material: sharedMaterial(`ghost:${move.category}`),
    position: move.from,
  }),
];

/** ▲ / ▼ Moved: a ghost where it stood, a line to where it stands, a chevron the way it went. */
const moved = (move: Move, colour: number, facing: Facing) => {
  const way = unit(minus(move.to, move.from));
  const across = unit(cross(way, facing.forward));
  const middle = scale(add(move.from, move.to), 0.5);
  const tip = add(middle, scale(way, 0.07));
  const back = add(middle, scale(way, -0.05));
  return [
    mesh({
      key: `ghost:${move.id}`,
      geometry: sharedGeometry(`body:${bodyOf[move.category]}`),
      material: sharedMaterial(`ghost:${move.category}`),
      position: move.from,
    }),
    line({
      key: `move:${move.id}`,
      points: [move.from, move.to],
      color: colour,
      width: 2,
      opacity: 0.85,
      transparent: true,
    }),
    line({
      key: `chevron:${move.id}`,
      points: [add(back, scale(across, 0.07)), tip, tip, add(back, scale(across, -0.07))],
      segments: true,
      color: colour,
      width: 2.5,
    }),
  ];
};

/** Every mark of the comparison, when there is one. */
export const comparisonMarks = (model: Model, tokens: Tokens): ReadonlyArray<SceneNode> =>
  Option.match(comparedWith(model), {
    onNone: () => [],
    onSome: (from) => {
      const facing = viewOf(model.camera.position, model.camera.lookAt);
      const played = arrivalProgress(model);
      return movesOf(model, from).flatMap((move): ReadonlyArray<SceneNode> => {
        const colour = tokens.categories[move.category];
        return {
          new: () => firstLight(move, colour, facing, played),
          returned: () => comet(move, colour, tokens, played),
          left: () => horizon(move, colour, facing, played),
          in: () => moved(move, colour, facing),
          out: () => moved(move, colour, facing),
        }[move.kind]();
      });
    },
  });
