import { Schema } from 'effect';
import * as DonutChart from '../../ui/donut-chart';

export const Model = Schema.Struct({ donut: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'donut'> & {
  readonly donut: DonutChart.Model;
};

const SEGMENTS: ReadonlyArray<DonutChart.Segment> = [
  { label: 'Design', value: 42, color: '#6366f1' },
  { label: 'Development', value: 38, color: '#8b5cf6' },
  { label: 'Marketing', value: 15, color: '#a78bfa' },
  { label: 'Operations', value: 5, color: '#c4b5fd' },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [donut] = DonutChart.init({ segments: SEGMENTS });
  return [{ donut }, []];
};
