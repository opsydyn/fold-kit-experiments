import { Subscription } from '@effect/ui';
import { Effect, Queue, Stream } from 'effect';

import { animationFrames } from '../../ui/shared/animation-frames';
import { liveEnvelopes } from './live';
import { Message } from './message';
import type { Model } from './model';

/** Phone width: the graph's ranks run down the page. */
export const narrowQuery = '(max-width: 640px)';
const motionQuery = '(prefers-reduced-motion: reduce)';

function mediaQuery(query: string, message: (matches: boolean) => Message) {
  return Stream.callback<Message>((queue) => {
    const open = Effect.sync(() => {
      const list = globalThis.window?.matchMedia(query);
      if (!list) return () => {};
      const change = ({ matches }: MediaQueryListEvent) =>
        Queue.offerUnsafe(queue, message(matches));
      list.addEventListener('change', change);
      Queue.offerUnsafe(queue, message(list.matches));
      return () => list.removeEventListener('change', change);
    });
    const listen = Effect.acquireRelease(open, Effect.sync);
    // The subscription owns the listener until its scope closes.
    // oxlint-disable-next-line linteffect/no-effect-never
    return Effect.andThen(listen, Effect.never);
  });
}

export const subscriptions = ({ model }: { readonly model: Model }) => [
  Subscription.make(
    'ReducedMotion',
    mediaQuery(motionQuery, (isReducedMotion) => Message.ChangedReducedMotion({ isReducedMotion })),
  ),
  Subscription.make(
    'NarrowLayout',
    mediaQuery(narrowQuery, (isNarrow) => Message.ChangedNarrow({ isNarrow })),
  ),
  model.playback === 'playing' &&
    model.cursor < model.events.length &&
    Subscription.make(
      'PlaybackFrames',
      animationFrames.pipe(Stream.map((deltaTimeMs) => Message.AdvancedReplay({ deltaTimeMs }))),
    ),
  model.live &&
    Subscription.make(
      'LiveRecording',
      liveEnvelopes.pipe(
        Stream.map(({ specimen, event }) => Message.ReceivedLiveEvent({ specimen, event })),
      ),
    ),
];
