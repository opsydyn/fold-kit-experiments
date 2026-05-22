import { Schema } from 'effect';
import * as HistogramChart from '../../ui/histogram-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: HistogramChart.Model;
};

// 200 synthetic employee salaries (USD thousands), bimodal distribution:
// individual contributors clustered ~60-80k, seniors/leads clustered ~100-130k
function generateSalaries(): ReadonlyArray<HistogramChart.HistogramDatum> {
  let s = 0xc0ffee;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  // Box-Muller for normal distribution
  const normal = (mean: number, sd: number): number => {
    const u = Math.max(1e-6, next());
    const v = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const data: HistogramChart.HistogramDatum[] = [];
  for (let i = 0; i < 130; i++) {
    data.push({ value: Math.max(38, Math.min(95, Math.round(normal(66, 9)))) });
  }
  for (let i = 0; i < 70; i++) {
    data.push({ value: Math.max(85, Math.min(160, Math.round(normal(112, 14)))) });
  }
  return data;
}

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = HistogramChart.init({
    data: generateSalaries(),
    binCount: 12,
    color: '#6366f1',
    xLabel: 'Salary ($k)',
  });
  return [{ chart }, []];
};
