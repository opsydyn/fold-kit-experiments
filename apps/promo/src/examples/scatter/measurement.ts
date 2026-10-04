import { Stream } from 'effect';
import { Mount } from 'foldkit';

import { widthChanges } from '#example/measurement';

import { Message } from './message';

export const MeasureScatterChart = Mount.defineStream('MeasureScatterChart', {
  messages: [Message.RecordedChartWidth],
  execute: ({ element }) =>
    Stream.map(widthChanges(element), (width) => Message.RecordedChartWidth({ width })),
});
