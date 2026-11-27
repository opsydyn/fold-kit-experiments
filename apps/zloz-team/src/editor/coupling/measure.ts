import { Effect, Queue, Stream } from 'effect';

import { Message } from './message';

/** Each mounted chart owns its observer for the lifetime of the panel. */
export function observeWidth(element: Element) {
  return Stream.callback<typeof Message.cases.RecordedWidth.Type>((queue) => {
    const acquire = Effect.sync(() => {
      const report = (width: number) => Queue.offerUnsafe(queue, Message.RecordedWidth({ width }));
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) report(entry.contentRect.width);
      });
      observer.observe(element);
      report(element.getBoundingClientRect().width);
      return observer;
    });
    const observe = Effect.acquireRelease(acquire, (observer) =>
      Effect.sync(() => observer.disconnect()),
    );
    // Keep the observer live until the render scope closes.
    // oxlint-disable-next-line linteffect/no-effect-never
    return Effect.andThen(observe, Effect.never);
  });
}
