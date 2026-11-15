import { randomLcg, randomNormal } from '@opsydyn/foldkit-viz/math/random';
import pl from 'nodejs-polars';

/**
 * The million synthetic requests /explore draws, built the same way (same seed,
 * same three clusters), held here as a Polars frame instead of row objects.
 */

export const REQUEST_COUNT = 1_000_000;

const CLUSTERS = [
  { latency: 120, spread: 0.25, payload: 40 },
  { latency: 420, spread: 0.2, payload: 160 },
  { latency: 1_600, spread: 0.3, payload: 90 },
] as const;

/** Latency and payload columns for `count` requests, deterministic for a seed. */
export function requestColumns(count: number, seed = 2026) {
  const rng = randomLcg(seed);
  const normal = randomNormal(0, 1, rng);
  const latency = new Float64Array(count);
  const payload = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    const pick = rng();
    const cluster = pick < 0.6 ? CLUSTERS[0] : pick < 0.9 ? CLUSTERS[1] : CLUSTERS[2];
    const value = cluster.latency * Math.exp(cluster.spread * normal());
    latency[i] = Math.round(value);
    payload[i] = Math.max(1, Math.round(cluster.payload + 0.04 * value + 18 * normal()));
  }
  return { latency, payload };
}

/** The requests as a Polars frame. */
export function requestFrame(count = REQUEST_COUNT, seed = 2026): pl.DataFrame {
  const { latency, payload } = requestColumns(count, seed);
  return pl.DataFrame({
    latency: pl.Series('latency', latency),
    payload: pl.Series('payload', payload),
  });
}
