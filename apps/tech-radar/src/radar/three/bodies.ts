/**
 * Blips as small worlds. Each category has its own body, so identity rests on shape and
 * surface as well as colour; each relationship is a moon in its type's colour; and how
 * much of a blip shows depends on the camera's distance, as its labels do. Pure: the
 * scene turns these into nodes.
 */
import type { Vec3 } from '@opsydyn/effect-three';

import type { Category } from './data';
import { nameDistance } from './space';

/** A blip's body radius: every body keeps today's footprint, so position and size keep their meaning. */
export const bodyRadius = 0.12;

export type Body = 'glass' | 'faceted' | 'rocky' | 'ringed';

/** Each category's body: glass techniques, faceted tools, rocky platforms, ringed languages. */
export const bodyOf = {
  techniques: 'glass',
  tools: 'faceted',
  platforms: 'rocky',
  'languages-frameworks': 'ringed',
} as const satisfies Readonly<Record<Category, Body>>;

/** The body's name in the legend, so the shapes are explained in words too. */
export const bodyLabels = {
  glass: 'glass',
  faceted: 'faceted metal',
  rocky: 'rocky world',
  ringed: 'ringed giant',
} as const satisfies Readonly<Record<Body, string>>;

/** Sphere segments per body: low-poly facets read as cut metal and rock. */
export const bodySegments = {
  glass: { widthSegments: 32, heightSegments: 16 },
  faceted: { widthSegments: 8, heightSegments: 6 },
  rocky: { widthSegments: 12, heightSegments: 8 },
  ringed: { widthSegments: 24, heightSegments: 12 },
} as const satisfies Readonly<Record<Body, { widthSegments: number; heightSegments: number }>>;

/** The giant's ring: just outside the body, tilted off the radar's equator. */
export const planetRing = { radius: 0.19, tube: 0.012, tilt: [1.2, 0, 0.35] } as const;

/** Moons: small, just outside the giant's ring, in a plane tilted by the blip's id. */
export const moonRadius = 0.028;
export const moonOrbit = 0.24;
/** One turn every eight seconds; scene time stops under reduced motion, so they hold. */
export const moonSpeed = (2 * Math.PI) / 8;

/**
 * A blip's distant form: a plain dot, softly lit in its category colour, the same size as
 * its body so that changing form never reads as changing size (size means pinned).
 */
export const dotRadius = bodyRadius;

/**
 * Camera distances where a blip changes form: up close the full world (body, ring and
 * moons), then the body alone, then a dot. The nearest step matches the name distance,
 * so a blip gains its moons as it gains its name.
 */
export const detailDistances = [0, nameDistance, 11] as const;

/** A small, stable number from an id: the same blip always tilts and starts the same way. */
export const hashOf = (id: string): number =>
  [...id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 2147483647, 7);

/** How a blip's moons orbit: the plane's tilt and where the first moon starts. */
export type Orbit = Readonly<{ tilt: Vec3; phase: number }>;

export const orbitOf = (id: string): Orbit => {
  const hash = hashOf(id);
  return {
    tilt: [((hash % 60) - 30) * (Math.PI / 180), 0, (((hash >> 6) % 60) - 30) * (Math.PI / 180)],
    phase: ((hash >> 12) % 360) * (Math.PI / 180),
  };
};

/** Where the `index`th of `count` moons sits on its orbit, evenly spaced. */
export const moonOffset = (index: number, count: number): Vec3 => {
  const angle = (2 * Math.PI * index) / Math.max(1, count);
  return [Math.cos(angle) * moonOrbit, 0, Math.sin(angle) * moonOrbit];
};

/**
 * A faint starfield, placed once from a fixed seed: still dots, not effect-three's
 * twinkling `stars`, so an idle radar renders only when something changes. They lie in a
 * shell far beyond the zoom limit, a little brighter or dimmer each.
 */
/** A star: where it sits, and how many pixels across it shows. */
export type Star = Readonly<{ position: Vec3; size: number }>;

/** One star from four draws of the generator: a direction, a distance in the shell, a size. */
function starAt(next: () => number): Star {
  const z = next() * 2 - 1;
  const angle = next() * 2 * Math.PI;
  const radius = 26 + next() * 14;
  const across = Math.sqrt(1 - z * z) * radius;
  return {
    position: [across * Math.cos(angle), z * radius, across * Math.sin(angle)],
    size: 0.8 + next() * 1.4,
  };
}

function makeStarField() {
  let seed = 20261026;
  const next = (): number => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const stars = Array.from({ length: 700 }, () => starAt(next));
  return {
    positions: stars.map(({ position }) => position),
    sizes: stars.map(({ size }) => size),
  };
}

export const starField = makeStarField();
