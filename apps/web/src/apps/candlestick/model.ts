import { Schema } from 'effect';

import * as CandleChart from '../../ui/candlestick-chart';

export const Model = Schema.Struct({ candle: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'candle'> & {
  readonly candle: CandleChart.Model;
};

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const [candle] = CandleChart.init({
    candles: [
      { label: 'Apr 1', open: 142.5, high: 145.8, low: 141.2, close: 144.6 },
      { label: 'Apr 2', open: 144.6, high: 147.3, low: 143.5, close: 146.9 },
      { label: 'Apr 3', open: 146.9, high: 148.2, low: 144.8, close: 145.3 },
      { label: 'Apr 4', open: 145.3, high: 146.5, low: 142.1, close: 142.8 },
      { label: 'Apr 7', open: 142.8, high: 143.9, low: 139.6, close: 140.5 },
      { label: 'Apr 8', open: 140.5, high: 142.7, low: 138.9, close: 141.8 },
      { label: 'Apr 9', open: 141.8, high: 144.6, low: 141.2, close: 143.9 },
      { label: 'Apr 10', open: 143.9, high: 147.1, low: 143.4, close: 146.5 },
      { label: 'Apr 11', open: 146.5, high: 149.8, low: 145.9, close: 149.2 },
      { label: 'Apr 14', open: 149.2, high: 151.4, low: 148.3, close: 150.8 },
      { label: 'Apr 15', open: 150.8, high: 153.2, low: 150.1, close: 152.6 },
      { label: 'Apr 16', open: 152.6, high: 154.9, low: 151.8, close: 151.4 },
      { label: 'Apr 17', open: 151.4, high: 152.3, low: 148.7, close: 149.8 },
      { label: 'Apr 22', open: 149.8, high: 151.6, low: 148.2, close: 150.5 },
      { label: 'Apr 23', open: 150.5, high: 153.8, low: 150.1, close: 153.2 },
      { label: 'Apr 24', open: 153.2, high: 156.4, low: 152.7, close: 155.9 },
      { label: 'Apr 25', open: 155.9, high: 158.2, low: 155.1, close: 157.4 },
      { label: 'Apr 28', open: 157.4, high: 159.8, low: 156.5, close: 158.9 },
      { label: 'Apr 29', open: 158.9, high: 161.2, low: 157.8, close: 160.3 },
      { label: 'Apr 30', open: 160.3, high: 162.5, low: 158.6, close: 159.1 },
      { label: 'May 1', open: 159.1, high: 160.4, low: 156.2, close: 157.8 },
      { label: 'May 2', open: 157.8, high: 159.3, low: 155.4, close: 156.2 },
      { label: 'May 5', open: 156.2, high: 158.7, low: 155.8, close: 158.1 },
      { label: 'May 6', open: 158.1, high: 161.3, low: 157.6, close: 160.8 },
      { label: 'May 7', open: 160.8, high: 163.5, low: 160.2, close: 162.4 },
      { label: 'May 8', open: 162.4, high: 165.1, low: 161.8, close: 164.7 },
      { label: 'May 9', open: 164.7, high: 166.3, low: 162.5, close: 163.2 },
      { label: 'May 12', open: 163.2, high: 165.8, low: 162.9, close: 165.4 },
      { label: 'May 13', open: 165.4, high: 168.2, low: 164.8, close: 167.6 },
      { label: 'May 14', open: 167.6, high: 170.4, low: 166.9, close: 169.8 },
    ],
  });
  return [{ candle }, []];
};
