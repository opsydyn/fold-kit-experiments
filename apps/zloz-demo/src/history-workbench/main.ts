import { Subscription } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Queue, Stream } from 'effect';

import { init, Message, Model, update } from './state';
import { view } from './view';

function preference(name: string, query: string, send: (matches: boolean) => Message) {
  return Subscription.make(
    name,
    Stream.callback<Message>((queue) => {
      const watch = Effect.sync(() => {
        const media = window.matchMedia(query);
        const listener = () => Queue.offerUnsafe(queue, send(media.matches));
        media.addEventListener('change', listener);
        listener();
        return () => media.removeEventListener('change', listener);
      });
      return Effect.acquireRelease(watch, Effect.sync);
    }),
  );
}

const reducedMotion = preference('reduced-motion', '(prefers-reduced-motion: reduce)', (reduced) =>
  Message.ChangedReducedMotion({ reduced }),
);
const colorScheme = preference('color-scheme', '(prefers-color-scheme: dark)', (dark) =>
  Message.ChangedSystemTheme({ dark }),
);
const visibility = Subscription.make(
  'visibility',
  Stream.suspend(() => {
    const snapshot = () =>
      Message.ChangedVisibility({ visible: document.visibilityState === 'visible' });
    return Stream.concat(
      Stream.fromEffect(Effect.sync(snapshot)),
      Stream.map(Stream.fromEventListener(document, 'visibilitychange'), snapshot),
    );
  }),
);

function workbenchModel(model: typeof Model.Type): Model {
  // SAFETY: The island initializes editor snapshots and transfers them as JSON.
  return model as Model;
}

export default Html.component({
  name: 'ZlozHistoryWorkbench',
  model: Model,
  message: Message,
}).make({
  init: ($) => {
    const initial = init();
    return $.set(initial.model).run(...(initial.commands ?? []));
  },
  update: ($, message) => {
    const next = update(workbenchModel($.model), message);
    return $.set(next.model).run(...(next.commands ?? []));
  },
  subscriptions: ($) => {
    const model = workbenchModel($.model);
    const followPlayback = model.playback.cursor.status === 'playing' && model.visible;
    return [
      reducedMotion,
      colorScheme,
      visibility,
      ...(followPlayback
        ? [
            Subscription.make('playback', model.run, (run) =>
              Stream.tick(1000).pipe(
                Stream.drop(1),
                Stream.map(() => Message.AdvancedPlayback({ run })),
              ),
            ),
          ]
        : []),
    ];
  },
  view: (h, model) => view(h, workbenchModel(model)),
});
