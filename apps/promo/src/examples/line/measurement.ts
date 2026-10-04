import { Stream } from 'effect';
import { Mount } from 'foldkit';

import { widthChanges } from '#example/measurement';

import { Message } from './message';

export const MeasureLineChart = Mount.defineStream('MeasureLineChart', {
  messages: [Message.RecordedChartWidth],
  execute: ({ element }) =>
    Stream.map(widthChanges(element), (width) => Message.RecordedChartWidth({ width })),
});
