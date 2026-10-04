import { Effect, Queue, Stream } from 'effect';

/** The observer belongs to the Mount stream's scope, never to the view or Model. */
export function widthChanges(element: Element): Stream.Stream<number> {
  return Stream.callback<number>(
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
        // Keep the callback scope alive until Mount unmounts; acquireRelease disconnects the observer.
        // oxlint-disable-next-line linteffect/no-effect-never
        Effect.andThen(Effect.never),
      ),
    { bufferSize: 1, strategy: 'sliding' },
  ).pipe(
    Stream.filter((width) => Number.isFinite(width) && width > 0),
    Stream.changes,
  );
}
