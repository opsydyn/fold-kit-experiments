import { Effect, Stream, Schema } from 'effect';
import { Dom, Subscription } from 'foldkit';

import { Message, type Model } from './state';
export { Model, Message, init, update } from './state';
export { view } from './view';
export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  playback: entry(
    { playing: Schema.Boolean, run: Schema.Number },
    {
      modelToDependencies: (model) => ({
        playing: model.playback.cursor.status === 'playing' && model.visible,
        run: model.run,
      }),
      dependenciesToStream: ({ playing, run }) =>
        Stream.tick(1000).pipe(
          Stream.drop(1),
          Stream.map(() => Message.AdvancedPlayback({ run })),
          Stream.when(Effect.sync(() => playing)),
        ),
    },
  ),
  reduced: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-reduced-motion: reduce)',
      mapMatches: (reduced) => Message.ChangedReducedMotion({ reduced }),
    }),
  ),
  scheme: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-color-scheme: dark)',
      mapMatches: (dark) => Message.ChangedSystemTheme({ dark }),
    }),
  ),
  visibility: Subscription.persistentEntry(
    Stream.fromEffect(
      Effect.sync(() =>
        Message.ChangedVisibility({ visible: document.visibilityState === 'visible' }),
      ),
    ).pipe(
      Stream.concat(
        Dom.streamFromEvent({
          target: () => document,
          type: 'visibilitychange',
          mapEvent: () =>
            Message.ChangedVisibility({ visible: document.visibilityState === 'visible' }),
        }),
      ),
    ),
  ),
}));
