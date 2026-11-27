import { Mount } from '@effect/ui';
import { Stream } from 'effect';

import { widthChanges } from '#example/measurement';

import { Message } from './message';

export const MeasureHistogramChart = Mount.makeStream(
  'MeasureHistogramChart',
  { args: {} },
  (element: HTMLElement) =>
    Stream.map(widthChanges(element), (width) => Message.RecordedChartWidth({ width })),
);
