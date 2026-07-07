import { Schema } from 'effect';

import * as BubbleChart from '../../ui/bubble-chart';

export const Model = Schema.Struct({ bubble: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'bubble'> & { readonly bubble: BubbleChart.Model };

const DATA: ReadonlyArray<BubbleChart.Point> = [
  { label: 'Laptops', x: 1200, y: 4.2, value: 180 },
  { label: 'Headphones', x: 280, y: 4.5, value: 320 },
  { label: 'Smartphones', x: 950, y: 4.3, value: 290 },
  { label: 'Tablets', x: 650, y: 4.1, value: 140 },
  { label: 'Monitors', x: 480, y: 4.4, value: 160 },
  { label: 'Keyboards', x: 120, y: 4.6, value: 410 },
  { label: 'Mice', x: 80, y: 4.5, value: 520 },
  { label: 'Webcams', x: 150, y: 4.2, value: 230 },
  { label: 'Speakers', x: 350, y: 4.4, value: 280 },
];

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [bubble] = BubbleChart.init({
    points: DATA,
    config: {
      xLabel: 'Price ($)',
      yLabel: 'Rating',
      valueLabel: 'Monthly sales',
    },
  });
  return [{ bubble }, []];
};
