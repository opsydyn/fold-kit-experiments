import { Schema } from 'effect';

import * as Corr from '../../ui/correlation-matrix';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & { readonly chart: Corr.Model };

// Pre-computed correlation matrix for tech stock returns (2020–2024)
// Values represent typical pairwise correlations between these assets
const MATRIX: Corr.CorrelationMatrix = {
  labels: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'BRK-B', 'BTC'],
  values: [
    //AAPL  MSFT  GOOGL  AMZN  NVDA  META  BRK-B   BTC
    1.0,
    0.89,
    0.83,
    0.76,
    0.71,
    0.74,
    0.62,
    0.38, // AAPL
    0.89,
    1.0,
    0.86,
    0.79,
    0.75,
    0.76,
    0.64,
    0.35, // MSFT
    0.83,
    0.86,
    1.0,
    0.82,
    0.72,
    0.79,
    0.58,
    0.33, // GOOGL
    0.76,
    0.79,
    0.82,
    1.0,
    0.68,
    0.77,
    0.55,
    0.3, // AMZN
    0.71,
    0.75,
    0.72,
    0.68,
    1.0,
    0.69,
    0.5,
    0.44, // NVDA
    0.74,
    0.76,
    0.79,
    0.77,
    0.69,
    1.0,
    0.52,
    0.36, // META
    0.62,
    0.64,
    0.58,
    0.55,
    0.5,
    0.52,
    1.0,
    0.18, // BRK-B
    0.38,
    0.35,
    0.33,
    0.3,
    0.44,
    0.36,
    0.18,
    1.0, // BTC
  ],
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = Corr.init({ matrix: MATRIX });
  return [{ chart }, []];
};
