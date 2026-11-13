import { randomLcg, randomNormal } from '@opsydyn/foldkit-viz/math/random';
import type { Row } from '@opsydyn/foldkit-viz/plot';

/** One million synthetic requests: latency against payload, in three clusters. */
export const POINT_COUNT = 1_000_000;

export type Request = Readonly<{ latency: number; payload: number }>;

const buildRequests = (): ReadonlyArray<Request> => {
  const rng = randomLcg(2026);
  const normal = randomNormal(0, 1, rng);
  const clusters = [
    { share: 0.6, latency: 120, spread: 0.25, payload: 40 },
    { share: 0.3, latency: 420, spread: 0.2, payload: 160 },
    { share: 0.1, latency: 1_600, spread: 0.3, payload: 90 },
  ];
  return Array.from({ length: POINT_COUNT }, () => {
    const pick = rng();
    const cluster = pick < 0.6 ? clusters[0] : pick < 0.9 ? clusters[1] : clusters[2];
    const c = cluster ?? clusters[0] ?? { latency: 100, spread: 0.2, payload: 50 };
    const latency = c.latency * Math.exp(c.spread * normal());
    return {
      latency: Math.round(latency),
      payload: Math.max(1, Math.round(c.payload + 0.04 * latency + 18 * normal())),
    };
  });
};

export const requests: ReadonlyArray<Request> = buildRequests();
export const rows: ReadonlyArray<Row> = requests;

/** Latency in 48 equal bins, for the histogram that brushes the scatter. */
export type Bin = Readonly<{ label: string; x0: number; x1: number; count: number }>;

const buildBins = (): ReadonlyArray<Bin> => {
  let lo = Number.POSITIVE_INFINITY,
    hi = Number.NEGATIVE_INFINITY;
  for (const r of requests) {
    if (r.latency < lo) lo = r.latency;
    if (r.latency > hi) hi = r.latency;
  }
  const count = 48;
  const width = (hi - lo) / count;
  const counts = new Array<number>(count).fill(0);
  for (const r of requests) counts[Math.min(count - 1, Math.floor((r.latency - lo) / width))] += 1;
  return counts.map((n, i) => ({
    label: String(Math.round(lo + (i + 0.5) * width)),
    x0: lo + i * width,
    x1: lo + (i + 1) * width,
    count: n,
  }));
};

export const bins: ReadonlyArray<Bin> = buildBins();
export const latencyExtent: readonly [number, number] = [bins[0]?.x0 ?? 0, bins.at(-1)?.x1 ?? 1];
