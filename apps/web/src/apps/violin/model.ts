import { Schema } from 'effect';

import * as ViolinChart from '../../ui/violin-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: ViolinChart.Model;
};

// Salary by level — 50 synthetic values per group via LCG + Box-Muller
function generateSalaries(): ReadonlyArray<ViolinChart.ViolinSeries> {
  let s = 0xfeed1234;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const normal = (mean: number, sd: number): number => {
    const u = Math.max(1e-9, next());
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  const group = (label: string, mean: number, sd: number, n: number): ViolinChart.ViolinSeries => ({
    label,
    values: Array.from({ length: n }, () => Math.round(normal(mean, sd))),
  });

  return [
    group('IC1', 52, 4, 50),
    group('IC2', 76, 6, 50),
    group('IC3', 102, 8, 50),
    group('IC4', 136, 10, 50),
    group('IC5', 170, 12, 50),
  ];
}

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = ViolinChart.init({
    series: generateSalaries(),
    yLabel: '$k',
  });
  return [{ chart }, []];
};
