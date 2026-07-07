import { Schema } from 'effect';

import * as HeatmapChart from '../../ui/heatmap-chart';

export const Model = Schema.Struct({ heatmap: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'heatmap'> & {
  readonly heatmap: HeatmapChart.Model;
};

// Website traffic index (0–100) by day-of-week × hour block
// Rows: Mon–Sun, Cols: 12am 3am 6am 9am 12pm 3pm 6pm 9pm
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'];

const RAW: ReadonlyArray<ReadonlyArray<number>> = [
  [4, 2, 6, 38, 72, 68, 55, 32],
  [5, 2, 7, 40, 75, 71, 57, 34],
  [5, 3, 7, 41, 74, 70, 56, 33],
  [4, 2, 8, 42, 76, 73, 59, 35],
  [6, 3, 9, 45, 82, 79, 64, 42],
  [12, 7, 14, 28, 61, 88, 91, 68],
  [10, 6, 11, 22, 52, 84, 89, 63],
];

const data: ReadonlyArray<HeatmapChart.CellDatum> = RAW.flatMap((row, r) =>
  row.map((value, c) => ({ row: r, col: c, value })),
);

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [heatmap] = HeatmapChart.init({
    data,
    rowLabels: DAYS,
    colLabels: HOURS,
    colors: ['#f0f9ff', '#bae6fd', '#38bdf8', '#0284c7', '#075985'],
    domain: [0, 100],
  });
  return [{ heatmap }, []];
};
