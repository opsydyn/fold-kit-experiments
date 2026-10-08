import { Effect, Queue, Stream } from 'effect';
import { Dom } from 'foldkit';

export type PlotPosition = Readonly<{
  clientX: number;
  clientY: number;
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export function pointerPositions(element: Element): Stream.Stream<PlotPosition> {
  return Dom.streamFromEvent({
    target: element,
    type: 'pointermove',
    mapEvent: (event) => {
      const { left, top, width, height } = element.getBoundingClientRect();
      return { clientX: event.clientX, clientY: event.clientY, left, top, width, height };
    },
  });
}

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
