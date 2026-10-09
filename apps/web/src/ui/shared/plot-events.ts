import { Effect, Queue, Schema, Stream } from 'effect';

export const PlotPosition = Schema.Struct({
  clientX: Schema.Number,
  clientY: Schema.Number,
  left: Schema.Number,
  top: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
});

/** Measure in the Mount scope; enter the normal DOM dispatcher without a Stream queue hop. */
export const forwardPointerPositions = Effect.fn('forwardPointerPositions')(function* (
  element: Element,
  eventName: string,
) {
  const acquire = Effect.sync(() => {
    const listener = (event: Event) => {
      if (!(event instanceof PointerEvent)) return;
      const { left, top, width, height } = element.getBoundingClientRect();
      const detail = { clientX: event.clientX, clientY: event.clientY, left, top, width, height };
      // Element-local and synchronous: later leave/key/other-chart facts cannot be overtaken.
      element.dispatchEvent(new CustomEvent(eventName, { detail }));
    };
    element.addEventListener('pointermove', listener);
    return listener;
  });
  yield* Effect.acquireRelease(acquire, (listener) =>
    Effect.sync(() => element.removeEventListener('pointermove', listener)),
  );
});

/** Match the promo measurement pattern: the Mount scope owns its observer. */
// This stream is the shared lifecycle boundary, not an alias for a one-shot Effect.
// oxlint-disable-next-line linteffect/no-effect-wrapper-alias
export function widthChanges(element: Element): Stream.Stream<number> {
  return Stream.callback<number>(
    (queue) => {
      const acquire = Effect.sync(() => {
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) Queue.offerUnsafe(queue, entry.contentRect.width);
        });
        observer.observe(element);
        Queue.offerUnsafe(queue, element.getBoundingClientRect().width);
        return observer;
      });
      return Effect.acquireRelease(acquire, (observer) =>
        Effect.sync(() => observer.disconnect()),
      ).pipe(
        // The callback stays alive until its owning Mount is removed.
        // oxlint-disable-next-line linteffect/no-effect-never
        Effect.andThen(Effect.never),
      );
    },
    { bufferSize: 1, strategy: 'sliding' },
  ).pipe(
    Stream.filter((width) => Number.isFinite(width) && width > 0),
    Stream.changes,
  );
}
