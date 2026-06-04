// Linear congruential generator — D3 lcg.js parity (deterministic random for jiggle)
export function lcg(): () => number {
  let s = 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

// Returns a tiny random jiggle to break coincident-node degeneracy — D3 jiggle.js parity
export function jiggle(random: () => number): number {
  return (random() - 0.5) * 1e-6;
}
