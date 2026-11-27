import { Mount } from '@effect/ui';
import { Stream } from 'effect';

import { widthChanges } from '#example/measurement';

import { Message } from './message';

export const MeasureLineChart = Mount.makeStream(
  'MeasureLineChart',
  { args: {} },
  (element: HTMLElement) =>
    Stream.map(widthChanges(element), (width) => Message.RecordedChartWidth({ width })),
);
