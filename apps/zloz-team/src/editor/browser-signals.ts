import { Effect, Queue, Stream } from 'effect';

import { motionChangeEvent, motionQuery, prefersReducedMotion } from '../appearance/preferences';

export function boardWidths() {
  return Stream.callback<boolean>((queue) => {
    const watch = Effect.sync(() => {
      const media = window.matchMedia('(max-width: 1080px)');
      const changed = () => Queue.offerUnsafe(queue, media.matches);
      media.addEventListener('change', changed);
      changed();
      return () => media.removeEventListener('change', changed);
    });
    return Effect.acquireRelease(watch, Effect.sync);
  });
}

export function historyMotion() {
  return Stream.callback<boolean>((queue) => {
    const watch = Effect.sync(() => {
      const media = window.matchMedia(motionQuery);
      const page = document;
      const changedSystemMotion = () => Queue.offerUnsafe(queue, prefersReducedMotion());
      const changedBoardMotion = (event: Event) =>
        Queue.offerUnsafe(
          queue,
          (event instanceof CustomEvent && event.detail === 'reduce') || media.matches,
        );
      media.addEventListener('change', changedSystemMotion);
      page.addEventListener(motionChangeEvent, changedBoardMotion);
      changedSystemMotion();
      return () => {
        media.removeEventListener('change', changedSystemMotion);
        page.removeEventListener(motionChangeEvent, changedBoardMotion);
      };
    });
    return Effect.acquireRelease(watch, Effect.sync);
  });
}

export function historyVisibility() {
  return Stream.callback<boolean>((queue) => {
    const watch = Effect.sync(() => {
      const page = document;
      const changed = () => Queue.offerUnsafe(queue, page.visibilityState === 'visible');
      page.addEventListener('visibilitychange', changed);
      changed();
      return () => page.removeEventListener('visibilitychange', changed);
    });
    return Effect.acquireRelease(watch, Effect.sync);
  });
}
