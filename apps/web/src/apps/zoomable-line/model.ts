import { Schema } from 'effect';

import * as ZoomableLineChart from '../../ui/zoomable-line-chart';

export const Model = Schema.Struct({ chart: Schema.Unknown });
export type Model = Omit<typeof Model.Type, 'chart'> & {
  readonly chart: ZoomableLineChart.Model;
};

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Trading days per month (approximate), non-leap year
const TRADING_DAYS = [21, 19, 22, 21, 22, 20, 22, 23, 20, 23, 20, 20];

function generateStockData(): ReadonlyArray<ZoomableLineChart.StockPoint> {
  let s = 0xdeadbeef;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  const points: Array<ZoomableLineChart.StockPoint> = [];
  let price = 148;

  for (let month = 0; month < 12; month++) {
    const days = TRADING_DAYS[month] ?? 21;
    for (let day = 0; day < days; day++) {
      const isFirstOfMonth = day === 0;
      const change = (next() - 0.48) * 4.2;
      const drift = 0.05;
      price = Math.max(80, price + drift + change);
      points.push({
        value: Math.round(price * 100) / 100,
        monthLabel: isFirstOfMonth ? (MONTH_NAMES[month] ?? '') : null,
      });
    }
  }

  return points;
}

export const init = (_props: unknown): readonly [Model, readonly []] => {
  const points = generateStockData();
  const [chart] = ZoomableLineChart.init({ points, color: '#6366f1' });
  return [{ chart }, []];
};
