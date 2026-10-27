/**
 * Constellations, an Easter egg: a few of the far stars are architecture diagrams, but
 * only from one place. Each diagram's stars sit at different depths along the rays from
 * its vantage point, so from anywhere else they are scattered sky; turn the camera to the
 * vantage and they line up, brighten and join, and the readout names the diagram.
 */
import { line, points, type SceneNode, type Vec3 } from '@opsydyn/effect-three';
import { Match, Option } from 'effect';

import { cameraDistance, type Model, themeOf } from './model';
import { viewOf } from './placement';
import { onSphere } from './space';
import { skies as skyKinds, themes } from './themes';

/** A point of a diagram, in degrees across and up the vantage's view from its centre. */
type Degrees = readonly [number, number];

export type Constellation = Readonly<{
  id: string;
  name: string;
  /** Where to stand: the camera's bearing and elevation round the radar, in degrees. */
  vantage: Readonly<{ bearing: number; elevation: number }>;
  /** The diagram's outlines, each a closed loop of corners. */
  outlines: ReadonlyArray<ReadonlyArray<Degrees>>;
}>;

/**
 * Every diagram hangs here in its vantage's view: up and to the left, in the corner the
 * round radar leaves empty, clear of its labels and inside even a square stage.
 */
export const skyCentre: Degrees = [-13, 13];

const square = (half: number, [x, y]: Degrees = [0, 0]): ReadonlyArray<Degrees> => [
  [x - half, y - half],
  [x + half, y - half],
  [x + half, y + half],
  [x - half, y + half],
];

const hexagonCorner = (radius: number, corner: number): Degrees => {
  const angle = (corner / 6) * 2 * Math.PI + Math.PI / 6;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
};

const hexagon = (radius: number): ReadonlyArray<Degrees> =>
  Array.from({ length: 6 }, (_, corner) => hexagonCorner(radius, corner));

const bar = (y: number): ReadonlyArray<Degrees> => [
  [-3.4, y - 0.55],
  [3.4, y - 0.55],
  [3.4, y + 0.55],
  [-3.4, y + 0.55],
];

export const constellations: ReadonlyArray<Constellation> = [
  {
    id: 'hexagonal',
    name: 'Hexagonal architecture: the domain inside, ports and adapters round it',
    // Five turns of the Turn buttons from home: one diagram the keyboard can find too.
    vantage: { bearing: 150, elevation: 20 },
    outlines: [hexagon(2.8), hexagon(1.2)],
  },
  {
    id: 'layered',
    name: 'Layered architecture: presentation, domain, data, each leaning on the one below',
    vantage: { bearing: -110, elevation: 40 },
    outlines: [bar(-1.5), bar(0), bar(1.5)],
  },
  {
    id: 'c4',
    name: 'The C4 model: context, containers, components, code',
    vantage: { bearing: 30, elevation: -30 },
    outlines: [square(2.8), square(2), square(1.25), square(0.55)],
  },
];

/** How far a star lies from the vantage along its ray: far beyond the radar, still in view. */
const depthRange = { near: 34, far: 70 } as const;

/** A small seeded generator, so the sky is the same on every visit. */
const seeded = (seed: number) => {
  let state = seed;
  return (): number => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

/** The point `share` of the way from one corner to the next. */
const between = ([x, y]: Degrees, [nextX, nextY]: Degrees, share: number): Degrees => [
  x + (nextX - x) * share,
  y + (nextY - y) * share,
];

/** Stars about every 0.7° along one side, from its corner up to the next corner. */
const starsOnSide = (from: Degrees, to: Degrees): ReadonlyArray<Degrees> => {
  const steps = Math.max(1, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.7));
  return Array.from({ length: steps }, (_, step) => between(from, to, step / steps));
};

/** Corners joined by stars, so each outline reads as a line of light. */
const starsAlong = (outline: ReadonlyArray<Degrees>): ReadonlyArray<Degrees> =>
  outline.flatMap((corner, index) =>
    starsOnSide(corner, outline[(index + 1) % outline.length] ?? corner),
  );

/** The vantage's camera position: where the diagram lines up. */
export const vantageOf = (constellation: Constellation): Vec3 =>
  onSphere(constellation.vantage.bearing, constellation.vantage.elevation, cameraDistance);

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

/** The point `depth` from the vantage along the ray that shows at `point` in its view. */
const placeOnRay = (constellation: Constellation, point: Degrees, depth: number): Vec3 => {
  const eye = vantageOf(constellation);
  const view = viewOf(eye, [0, 0, 0]);
  const across = Math.tan(radians(point[0] + skyCentre[0]));
  const up = Math.tan(radians(point[1] + skyCentre[1]));
  const ray: Vec3 = [
    view.forward[0] + view.right[0] * across + view.up[0] * up,
    view.forward[1] + view.right[1] * across + view.up[1] * up,
    view.forward[2] + view.right[2] * across + view.up[2] * up,
  ];
  const length = Math.hypot(...ray);
  return [
    eye[0] + (ray[0] / length) * depth,
    eye[1] + (ray[1] / length) * depth,
    eye[2] + (ray[2] / length) * depth,
  ];
};

/** A diagram's stars in the scene, each at its own depth, and its outlines joined up. */
/** A diagram's stars, and the same stars by outline for joining up. */
export type Sky = Readonly<{
  stars: ReadonlyArray<Vec3>;
  outlines: ReadonlyArray<ReadonlyArray<Vec3>>;
}>;

export const starsOf = (constellation: Constellation): Sky => {
  const next = seeded(constellation.id.length * 7919 + constellation.vantage.bearing + 360);
  const depth = () => depthRange.near + next() * (depthRange.far - depthRange.near);
  const outlines = constellation.outlines.map((outline) =>
    starsAlong(outline).map((point) => placeOnRay(constellation, point, depth())),
  );
  return { stars: outlines.flat(), outlines };
};

/** Within this many degrees of the vantage, a diagram lines up. */
export const alignment = 8;

const angleBetween = (a: Vec3, b: Vec3): number => {
  const cosine = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
  return (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI;
};

/** The diagram the camera has lined up, if any. */
export const alignedOf = (model: Model): Option.Option<Constellation> =>
  Option.filter(
    Option.fromNullishOr(
      constellations.find(
        (constellation) =>
          angleBetween(model.camera.position, vantageOf(constellation)) < alignment,
      ),
    ),
    () => hasSky(model),
  );

const skies = constellations.map((constellation) => ({
  constellation,
  ...starsOf(constellation),
}));

/** A diagram scattered among the stars, or lined up from its vantage. */
type SkyState = keyof typeof looks;

/** How a diagram's stars look: faint as any other star, or bright and joined when lined up. */
const looks = {
  scattered: { size: 1.2, opacity: 0.55, joined: false },
  lined: { size: 2.4, opacity: 0.95, joined: true },
} as const;

/** One diagram in the sky: its stars, and while lined up, its outlines joined. */
const skyNodes = (
  { constellation, stars, outlines }: (typeof skies)[number],
  state: SkyState,
): ReadonlyArray<SceneNode> => {
  const look = looks[state];
  return [
    points({
      key: `egg:sky:${constellation.id}`,
      positions: stars,
      size: look.size,
      sizeAttenuation: false,
      color: 0xdfe6ff,
      opacity: look.opacity,
      transparent: true,
    }),
    ...outlines
      .map((outline, index) =>
        line({
          key: `egg:sky:${constellation.id}:${index}`,
          points: [...outline, outline[0] ?? [0, 0, 0]],
          color: 0x9fb4ff,
          opacity: 0.45,
          transparent: true,
        }),
      )
      .filter(() => look.joined),
  ];
};

/** Whether a diagram is lined up: the camera stands at its vantage. */
const skyStateOf = (lined: Option.Option<string>, id: string): SkyState =>
  Match.value(Option.contains(lined, id)).pipe(
    Match.when(true, (): SkyState => 'lined'),
    Match.orElse((): SkyState => 'scattered'),
  );

/** The diagrams hide among the stars: a theme with no sky has none. */
export const hasSky = (model: Model): boolean => skyKinds[themes[themeOf(model)].sky].deep;

export const constellationNodes = (model: Model): ReadonlyArray<SceneNode> => {
  const lined = Option.map(alignedOf(model), ({ id }) => id);
  return skies
    .filter(() => hasSky(model))
    .flatMap((sky) => skyNodes(sky, skyStateOf(lined, sky.constellation.id)));
};

/** What the readout says while a diagram is lined up. */
export const constellationReadout = (model: Model): Option.Option<string> =>
  Option.map(alignedOf(model), ({ name }) => `Constellation: ${name}`);
