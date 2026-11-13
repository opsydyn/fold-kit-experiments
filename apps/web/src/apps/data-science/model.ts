import { randomLcg, randomNormal } from '@opsydyn/foldkit-viz/math/random';
import { Schema } from 'effect';

import type { AppInitProps } from '../types';

export const Downsampler = Schema.Literals(['m4', 'lttb']);
export type Downsampler = typeof Downsampler.Type;
export const Fit = Schema.Literals(['linear', 'quadratic', 'loess']);
export type Fit = typeof Fit.Type;

/** Only the reader's choices live in the Model; the datasets are fixed and rebuilt from seeds. */
export const Model = Schema.Struct({ downsampler: Downsampler, fit: Fit });
export type Model = typeof Model.Type;

const initialModel: Model = { downsampler: 'm4', fit: 'linear' };

export const init = (_props: AppInitProps) => ({ model: initialModel });

export type Point = Readonly<{ id: string; x: number; y: number }>;

const DAY = 86_400_000;

/** Daily active users over 18 months: exponential growth with a weekly cycle. */
const buildUsers = (): ReadonlyArray<Point> => {
  const noise = randomNormal(0, 0.06, randomLcg(7));
  const start = Date.UTC(2025, 4, 1);
  return Array.from({ length: 550 }, (_, day) => {
    const weekly = 1 + 0.15 * Math.sin((2 * Math.PI * day) / 7);
    return {
      id: `u${day}`,
      x: start + day * DAY,
      y: Math.round(120 * Math.exp(day / 110) * weekly * Math.exp(noise())),
    };
  });
};

/** 120 noisy observations of a gently curved relationship. */
const buildObservations = (): ReadonlyArray<Point> => {
  const rng = randomLcg(11);
  const noise = randomNormal(0, 1.2, rng);
  return Array.from({ length: 120 }, (_, i) => {
    const x = rng() * 10;
    return { id: `o${i}`, x, y: 1 + 0.6 * x + 0.08 * x * x + noise() };
  });
};

/** A 100,000-point random walk, one sample per second. */
const buildWalk = (): ReadonlyArray<Point> => {
  const step = randomNormal(0, 1, randomLcg(23));
  let y = 0;
  return Array.from({ length: 100_000 }, (_, i) => {
    y += step();
    return { id: `w${i}`, x: i, y };
  });
};

/** 20,000 correlated pairs for a density view. */
const buildCloud = (): ReadonlyArray<Point> => {
  const normal = randomNormal(0, 1, randomLcg(31));
  return Array.from({ length: 20_000 }, (_, i) => {
    const x = normal();
    return { id: `c${i}`, x, y: 0.6 * x + 0.8 * normal() };
  });
};

export const users = buildUsers();
export const observations = buildObservations();
export const walk = buildWalk();
export const cloud = buildCloud();
