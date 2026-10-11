import { scatterGeometry } from '@opsydyn/foldkit-viz/chart/cartesian';

export type Datum = Readonly<{ id: string; month: number; value: number; series: string }>;
export const data: ReadonlyArray<Datum> = [
  { id: 'jan', month: 1, value: 12, series: 'Core' },
  { id: 'feb', month: 2, value: 18, series: 'Core' },
  { id: 'mar', month: 3, value: 15, series: 'Core' },
];

export const createGeometry = (rows: ReadonlyArray<Datum>, width = 600) =>
  scatterGeometry(
    rows,
    {
      x: (datum) => datum.month,
      y: (datum) => datum.value,
      datumKey: (datum) => datum.id,
      seriesKey: (datum) => datum.series,
    },
    {
      frame: { width, height: 280, margins: { top: 16, right: 24, bottom: 40, left: 48 } },
      includeZero: { x: false, y: true },
    },
  );
