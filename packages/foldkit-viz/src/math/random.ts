// Seeded random number generators — D3 d3-random parity

export type Rng = () => number;

// LCG from d3-random/src/lcg.js
export function randomLcg(seed = Date.now()): Rng {
  const mul = 0x19660d;
  const inc = 0x3c6ef35f;
  const eps = 1 / 0x100000000;
  let state = seed | 0;
  return (): number => {
    state = (mul * state + inc) | 0;
    return eps * (state >>> 0);
  };
}

export function randomUniform(min = 0, max = 1, rng: Rng = Math.random): () => number {
  return (): number => min + (max - min) * rng();
}

// Rejection circle method (D3 d3-random/src/normal.js)
export function randomNormal(mu = 0, sigma = 1, rng: Rng = Math.random): () => number {
  return (): number => {
    let x: number;
    let y: number;
    let r: number;
    do {
      x = rng() * 2 - 1;
      y = rng() * 2 - 1;
      r = x * x + y * y;
    } while (!r || r > 1);
    return mu + sigma * y * Math.sqrt((-2 * Math.log(r)) / r);
  };
}

export function randomLogNormal(mu = 0, sigma = 1, rng: Rng = Math.random): () => number {
  const normal = randomNormal(mu, sigma, rng);
  return (): number => Math.exp(normal());
}
