import { Schema } from 'effect';
import * as ThresholdBar from '../../ui/threshold-bar-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: ThresholdBar.Model;
};

const ENDPOINTS: ReadonlyArray<ThresholdBar.Endpoint> = [
  { label: 'GET /api/users', ms: 42 },
  { label: 'GET /api/products', ms: 88 },
  { label: 'POST /api/search', ms: 215 },
  { label: 'GET /api/orders', ms: 340 },
  { label: 'POST /api/reports', ms: 490 },
  { label: 'GET /api/analytics', ms: 680 },
  { label: 'POST /api/export', ms: 920 },
  { label: 'GET /api/full-dump', ms: 1240 },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = ThresholdBar.init({ endpoints: ENDPOINTS });
  return [{ chart }, []];
};
