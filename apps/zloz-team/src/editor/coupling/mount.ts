import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';

import { Message } from './message';

/** Runtime-owned read-only measurement; closing the panel disconnects its observer. */
export const ObserveCouplingWidth = Mount.defineStream('ObserveCouplingWidth', {
  messages: [Message.RecordedWidth],
  execute: ({ element }) =>
    Stream.callback<typeof Message.RecordedWidth.Type>((queue) => {
      const acquire = Effect.sync(() => {
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries)
            Queue.offerUnsafe(queue, Message.RecordedWidth({ width: entry.contentRect.width }));
        });
        observer.observe(element);
        Queue.offerUnsafe(
          queue,
          Message.RecordedWidth({ width: element.getBoundingClientRect().width }),
        );
        return observer;
      });
      return Effect.acquireRelease(acquire, (observer) => Effect.sync(() => observer.disconnect()));
    }),
});
