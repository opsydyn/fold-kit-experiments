/**
 * The buffers a render kit draws points from, made from their look: given points as
 * they are, Drei's sparkles and stars scattered as Drei scatters them (`Sparkles.tsx`,
 * `Stars.tsx` at `bf6f4ad`) but from a seed, so the same look gives the same buffers.
 *
 * @module
 */
import { Color, Spherical, Vector3 } from 'three';

import type { PointLook } from './description.ts';
import { seededRandom } from './seeded.ts';

/** Per-point attributes: three numbers a point for positions, colours and noise. */
export type PointBuffers = {
  readonly count: number;
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly sizes: Float32Array;
  /** Sparkles only: each mote's drift speed, opacity and noise. */
  readonly speeds: Float32Array;
  readonly opacities: Float32Array;
  readonly noise: Float32Array;
};

const linear = new Color();

const dots = (look: Extract<PointLook, { readonly _tag: 'Dots' }>): PointBuffers => {
  const count = look.positions.length;
  const colors = new Float32Array(count * 3);
  for (let point = 0; point < count; point++) {
    linear.setHex(look.colors?.[point] ?? look.color).toArray(colors, point * 3);
  }
  return {
    count,
    positions: Float32Array.from(look.positions.flat()),
    colors,
    sizes: Float32Array.from({ length: count }, (_, point) => look.sizes?.[point] ?? 1),
    speeds: new Float32Array(0),
    opacities: new Float32Array(0),
    noise: new Float32Array(0),
  };
};

/** Drei's `Sparkles`: positions spread through the box, random sizes unless given. */
const sparkles = (look: Extract<PointLook, { readonly _tag: 'Sparkles' }>): PointBuffers => {
  const random = seededRandom(look.seed);
  // three's `MathUtils.randFloatSpread`, as Drei spreads them, from the seed.
  const spread = (range: number) => range * (0.5 - random());
  const { count } = look;
  const positions = new Float32Array(count * 3);
  for (let point = 0; point < count; point++) {
    positions[point * 3] = spread(look.scale[0]);
    positions[point * 3 + 1] = spread(look.scale[1]);
    positions[point * 3 + 2] = spread(look.scale[2]);
  }
  const colors = new Float32Array(count * 3);
  linear.setHex(look.color);
  for (let point = 0; point < count; point++) linear.toArray(colors, point * 3);
  const noise = new Float32Array(count * 3);
  for (let point = 0; point < count; point++) noise.set(look.noise, point * 3);
  return {
    count,
    positions,
    colors,
    sizes: Float32Array.from({ length: count }, () => look.size ?? random()),
    speeds: new Float32Array(count).fill(look.speed),
    opacities: new Float32Array(count).fill(look.opacity),
    noise,
  };
};

/** Drei's `Stars`: a shell of stars, nearer ones later, hues round the colour wheel. */
const stars = (look: Extract<PointLook, { readonly _tag: 'Stars' }>): PointBuffers => {
  const random = seededRandom(look.seed);
  const { count } = look;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = Float32Array.from({ length: count }, () => (0.5 + 0.5 * random()) * look.factor);
  const place = new Vector3();
  const spherical = new Spherical();
  const increment = look.depth / count;
  let radius = look.radius + look.depth;
  for (let star = 0; star < count; star++) {
    radius -= increment * random();
    place.setFromSpherical(
      spherical.set(radius, Math.acos(1 - random() * 2), random() * 2 * Math.PI),
    );
    place.toArray(positions, star * 3);
    linear.setHSL(star / count, look.saturation, 0.9).toArray(colors, star * 3);
  }
  return {
    count,
    positions,
    colors,
    sizes,
    speeds: new Float32Array(0),
    opacities: new Float32Array(0),
    noise: new Float32Array(0),
  };
};

/** The buffers for a look. */
export const pointBuffers = (look: PointLook): PointBuffers => {
  switch (look._tag) {
    case 'Dots':
      return dots(look);
    case 'Sparkles':
      return sparkles(look);
    case 'Stars':
      return stars(look);
  }
};

/** Whether a look moves on its own: sparkles drift and stars twinkle in scene time. */
export const animatedLook = (look: PointLook): boolean => look._tag !== 'Dots';
