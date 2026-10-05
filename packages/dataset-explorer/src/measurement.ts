import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';

import { Message } from './message';

// ResizeObserver belongs to Mount's scope. Widths enter the Model as facts;
// the observer never writes chart attributes or holds application state.
export const MeasureDatasetChart = Mount.defineStream('MeasureDatasetChart', {
  messages: [Message.RecordedChartWidth],
  execute: ({ element }) =>
    Stream.callback<number>(
      (queue) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const observer = new ResizeObserver((entries) => {
              for (const entry of entries) Queue.offerUnsafe(queue, entry.contentRect.width);
            });
            observer.observe(element);
            Queue.offerUnsafe(queue, element.getBoundingClientRect().width);
            return observer;
          }),
          (observer) => Effect.sync(() => observer.disconnect()),
        ).pipe(
          // Keep observing until Mount unmounts and disconnects the observer.
          // oxlint-disable-next-line linteffect/no-effect-never
          Effect.andThen(Effect.never),
        ),
      { bufferSize: 1, strategy: 'sliding' },
    ).pipe(
      Stream.filter((width) => Number.isFinite(width) && width > 0),
      Stream.changes,
      Stream.map((width) => Message.RecordedChartWidth({ width })),
    ),
});
