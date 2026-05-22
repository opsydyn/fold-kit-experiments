import { Schema } from 'effect';
import * as ScatterChart from '../../ui/symbol-scatter-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: ScatterChart.Model;
};

// Auto MPG dataset — 32 cars, mpg vs horsepower, origin = USA/Europe/Japan
const AUTO_DATA: ReadonlyArray<ScatterChart.ScatterDatum> = [
  { x: 130, y: 18, category: 'USA' },
  { x: 165, y: 15, category: 'USA' },
  { x: 150, y: 18, category: 'USA' },
  { x: 150, y: 16, category: 'USA' },
  { x: 140, y: 17, category: 'USA' },
  { x: 198, y: 15, category: 'USA' },
  { x: 220, y: 14, category: 'USA' },
  { x: 215, y: 14, category: 'USA' },
  { x: 225, y: 14, category: 'USA' },
  { x: 190, y: 15, category: 'USA' },
  { x: 170, y: 15, category: 'USA' },
  { x: 160, y: 14, category: 'USA' },
  { x: 150, y: 15, category: 'USA' },
  { x: 225, y: 14, category: 'USA' },
  { x: 95, y: 24, category: 'USA' },
  { x: 95, y: 22, category: 'USA' },
  { x: 97, y: 18, category: 'USA' },
  { x: 85, y: 21, category: 'USA' },
  { x: 88, y: 27, category: 'USA' },
  { x: 46, y: 26, category: 'Europe' },
  { x: 87, y: 25, category: 'Europe' },
  { x: 90, y: 24, category: 'Europe' },
  { x: 113, y: 25, category: 'Europe' },
  { x: 90, y: 26, category: 'Europe' },
  { x: 70, y: 31, category: 'Europe' },
  { x: 76, y: 32, category: 'Europe' },
  { x: 60, y: 28, category: 'Japan' },
  { x: 70, y: 35, category: 'Japan' },
  { x: 72, y: 33, category: 'Japan' },
  { x: 100, y: 28, category: 'Japan' },
  { x: 88, y: 32, category: 'Japan' },
  { x: 86, y: 36, category: 'Japan' },
  { x: 90, y: 27, category: 'Japan' },
  { x: 100, y: 26, category: 'Japan' },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [chart] = ScatterChart.init({
    data: AUTO_DATA,
    categories: ['USA', 'Europe', 'Japan'],
    xLabel: 'Horsepower',
    yLabel: 'MPG',
  });
  return [{ chart }, []];
};
