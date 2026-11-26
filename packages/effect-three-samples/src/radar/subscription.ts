import { Subscription } from '@effect/ui';
import { HtmlSubscription } from '@effect/ui/html';
import { Cause, Effect, Option, Queue, Stream } from 'effect';

import { cometMoves } from './comet';
import { konamiCode } from './invaders';
import { Message } from './message';
import type { Model } from './model';
import { isPlaying } from './tour';

const frame = (name: string, message: (time: { deltaTimeMs: number }) => Message) =>
  Subscription.make(
    name,
    Stream.callback<Message>((queue) =>
      Effect.gen(function* () {
        const frames = yield* HtmlSubscription.AnimationFrames;
        let previous = frames.now();
        const watch = Effect.sync(() =>
          frames.listen((now) => {
            const deltaTimeMs = Math.max(0, now - previous);
            previous = now;
            Queue.offerUnsafe(queue, message({ deltaTimeMs }));
          }),
        );
        yield* Effect.acquireRelease(watch, Effect.sync);
      }),
    ),
  );

const subscribeToMedia =
  (query: string, send: (matches: boolean) => Message, queue: Queue.Queue<Message, Cause.Done>) =>
  () => {
    const media = window.matchMedia(query);
    const listener = () => Queue.offerUnsafe(queue, send(media.matches));
    media.addEventListener('change', listener);
    listener();
    return () => media.removeEventListener('change', listener);
  };

const preference = (name: string, query: string, send: (matches: boolean) => Message) =>
  Subscription.make(
    name,
    Stream.callback<Message>((queue) => {
      const watch = Effect.sync(subscribeToMedia(query, send, queue));
      return Effect.acquireRelease(watch, Effect.sync);
    }),
  );

const editing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.closest('input, textarea, select') !== null);

const watchKonami = (queue: Queue.Queue<Message, Cause.Done>) => () => {
  let index = 0;
  let updated = 0;
  const keydown = (event: KeyboardEvent) => {
    if (event.repeat || event.isComposing || editing(event.target)) return;
    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    if (event.timeStamp - updated >= 3000) index = 0;
    updated = event.timeStamp;
    index = key === konamiCode[index] ? index + 1 : Number(key === konamiCode[0]);
    if (index !== konamiCode.length) return;
    index = 0;
    Queue.offerUnsafe(queue, Message.EnteredKonamiCode());
  };
  document.addEventListener('keydown', keydown);
  return () => document.removeEventListener('keydown', keydown);
};

const konami = Subscription.make(
  'konami',
  Stream.callback<Message>((queue) => {
    const watch = Effect.sync(watchKonami(queue));
    return Effect.acquireRelease(watch, Effect.sync);
  }),
);

export const subscriptions = ({ model }: { readonly model: Model }) => [
  model.playing && frame('playback', Message.AdvancedPlayback),
  Option.isSome(model.journey) && frame('relay', Message.AdvancedRelay),
  Option.isSome(model.invasion) && frame('invasion', Message.AdvancedInvasion),
  isPlaying(model.tour) && frame('tour', Message.AdvancedTour),
  cometMoves(model) && frame('comet', Message.AdvancedComet),
  konami,
  preference('pointer-input', '(hover: hover)', (hover) =>
    Message.ChangedPointerInput({ input: hover ? 'hover' : 'touch' }),
  ),
  preference('color-scheme', '(prefers-color-scheme: light)', (light) =>
    Message.ChangedColorScheme({ scheme: light ? 'light' : 'dark' }),
  ),
  preference('contrast', '(prefers-contrast: more), (forced-colors: active)', (more) =>
    Message.ChangedContrast({ contrast: more ? 'more' : 'standard' }),
  ),
  preference('reduced-motion', '(prefers-reduced-motion: reduce)', (isReducedMotion) =>
    Message.ChangedReducedMotion({ isReducedMotion }),
  ),
];
