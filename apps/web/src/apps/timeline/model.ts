import { Schema } from 'effect';

import * as TimelineChart from '../../ui/timeline-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: TimelineChart.Model;
};

// Product launch — Q1/Q2 2025 project plan
const TASKS: ReadonlyArray<TimelineChart.TimelineTask> = [
  { name: 'Discovery', start: new Date('2025-01-06'), end: new Date('2025-01-24') },
  { name: 'Design', start: new Date('2025-01-20'), end: new Date('2025-02-14') },
  { name: 'Backend API', start: new Date('2025-02-03'), end: new Date('2025-03-14') },
  { name: 'Frontend', start: new Date('2025-02-17'), end: new Date('2025-03-28') },
  { name: 'Integration', start: new Date('2025-03-24'), end: new Date('2025-04-11') },
  { name: 'QA & Testing', start: new Date('2025-04-07'), end: new Date('2025-04-25') },
  { name: 'Launch', start: new Date('2025-04-21'), end: new Date('2025-05-02') },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = TimelineChart.init({ tasks: TASKS, tickCount: 6 });
  return [{ chart }, []];
};
