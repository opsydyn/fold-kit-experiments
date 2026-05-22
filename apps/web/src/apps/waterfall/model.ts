import { Schema } from 'effect';
import * as WaterfallChart from '../../ui/waterfall-chart';

export const Model = Schema.Struct({ waterfall: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'waterfall'> & {
  readonly waterfall: WaterfallChart.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [waterfall] = WaterfallChart.init({
    entries: [
      { label: 'Revenue', value: 850, type: 'total' },
      { label: 'COGS', value: -320, type: 'delta' },
      { label: 'Gross', value: 530, type: 'total' },
      { label: 'R&D', value: -85, type: 'delta' },
      { label: 'S&M', value: -75, type: 'delta' },
      { label: 'G&A', value: -20, type: 'delta' },
      { label: 'EBITDA', value: 350, type: 'total' },
      { label: 'D&A', value: -45, type: 'delta' },
      { label: 'EBIT', value: 305, type: 'total' },
      { label: 'Int.', value: -25, type: 'delta' },
      { label: 'Tax', value: -68, type: 'delta' },
      { label: 'Net', value: 212, type: 'total' },
    ],
  });
  return [{ waterfall }, []];
};
