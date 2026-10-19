/**
 * A small seeded random generator (mulberry32): the same numbers for the same seed on
 * every page load, so randomly scattered scene parts are reproducible.
 *
 * @module
 */

/** A generator of numbers in [0, 1) from `seed`, as `Math.random` would give them. */
export const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
