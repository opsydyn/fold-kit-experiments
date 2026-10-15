/**
 * Sample data: monthly visits by channel, generated from a seed with foldkit-viz's
 * D3-parity LCG, so the same seed always gives the same chart. Not real figures.
 */
import { randomLcg } from '@opsydyn/foldkit-viz/math/random';

import type { Month, Series } from './model';

/** Typical size of each series, so the tallest row sits at the back. */
const typical = { search: 62, social: 38, direct: 24 } satisfies Record<Series, number>;

const row = (next: () => number, trend: number) => ({
  search: Math.round(typical.search * trend * (0.7 + next() * 0.6)),
  social: Math.round(typical.social * trend * (0.6 + next() * 0.8)),
  direct: Math.round(typical.direct * trend * (0.7 + next() * 0.6)),
});

export const valuesFor = (seed: number) => {
  const next = randomLcg(seed);
  const growth = 0.85 + next() * 0.3;
  const month = (index: number) => row(next, growth ** (index / 3));
  return {
    Jan: month(0),
    Feb: month(1),
    Mar: month(2),
    Apr: month(3),
    May: month(4),
    Jun: month(5),
  };
};

export type Values = ReturnType<typeof valuesFor>;

/** The total of the given series for a month. */
export const totalOf = (values: Values, month: Month, shown: ReadonlyArray<Series>): number =>
  shown.reduce((sum, series) => sum + values[month][series], 0);
