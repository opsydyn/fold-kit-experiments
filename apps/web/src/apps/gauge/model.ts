import { Schema } from 'effect';
import * as GaugeChart from '../../ui/gauge-chart';

export const Model = Schema.Struct({ gauge: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'gauge'> & {
  readonly gauge: GaugeChart.Model;
};

const THRESHOLDS = [
  { at: 0, color: '#22c55e' },
  { at: 60, color: '#f59e0b' },
  { at: 80, color: '#ef4444' },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [gauge] = GaugeChart.init({
    entries: [
      {
        label: 'CPU',
        sublabel: 'utilisation %',
        value: 67,
        min: 0,
        max: 100,
        thresholds: THRESHOLDS,
      },
      {
        label: 'Memory',
        sublabel: 'utilisation %',
        value: 82,
        min: 0,
        max: 100,
        thresholds: THRESHOLDS,
      },
      {
        label: 'Latency',
        sublabel: 'p99 ms',
        value: 38,
        min: 0,
        max: 200,
        thresholds: [
          { at: 0, color: '#22c55e' },
          { at: 100, color: '#f59e0b' },
          { at: 150, color: '#ef4444' },
        ],
      },
    ],
  });
  return [{ gauge }, []];
};
