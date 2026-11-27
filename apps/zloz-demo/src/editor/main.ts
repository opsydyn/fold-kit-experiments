import { Command, Subscription, UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Effect, Queue, Schema, Stream } from 'effect';

import { LoadThemePreference } from './command';
import { Message as WorkbenchMessage } from './message';
import { init as initModel, type Model as WorkbenchModel } from './model';
import { update as updateWorkbench } from './update';
import { view as viewWorkbench } from './view';

const Model = UiSchema.TaggedEnum({
  Preparing: {},
  Ready: { workbench: Schema.Unknown },
  Failed: {},
});
export const Lifecycle = UiSchema.TaggedEnum({
  SucceededIdentity: { namespace: Schema.String },
  FailedIdentity: {},
  ClickedRetryIdentity: {},
});
const Message = Schema.Union([Lifecycle, WorkbenchMessage]);
type Message = typeof Message.Type;

export const allocateIdentity = Command.make('AllocateIdentity', { args: {} }, () =>
  Effect.try(() => globalThis.crypto.randomUUID()).pipe(
    Effect.match({
      onSuccess: (namespace) => Lifecycle.SucceededIdentity({ namespace }),
      onFailure: () => Lifecycle.FailedIdentity(),
    }),
  ),
);

function mediaPreference(
  name: string,
  query: string,
  message: (value: boolean) => WorkbenchMessage,
) {
  return Subscription.make(
    name,
    Stream.callback<WorkbenchMessage>((queue) => {
      const watch = Effect.sync(() => {
        const media = window.matchMedia(query);
        const listener = () => Queue.offerUnsafe(queue, message(media.matches));
        media.addEventListener('change', listener);
        listener();
        return () => media.removeEventListener('change', listener);
      });
      return Effect.acquireRelease(watch, Effect.sync);
    }),
  );
}

const reducedMotion = mediaPreference(
  'reduced-motion',
  '(prefers-reduced-motion: reduce)',
  (reducedMotion) => WorkbenchMessage.ChangedPlaybackReducedMotion({ reducedMotion }),
);
const colorScheme = mediaPreference('color-scheme', '(prefers-color-scheme: dark)', (dark) =>
  WorkbenchMessage.ChangedSystemColorScheme({ colorScheme: dark ? 'dark' : 'light' }),
);
const visibility = Subscription.make(
  'visibility',
  Stream.suspend(() => {
    const snapshot = () =>
      WorkbenchMessage.ChangedPlaybackVisibility({
        visible: document.visibilityState === 'visible',
      });
    return Stream.concat(
      Stream.fromEffect(Effect.sync(snapshot)),
      Stream.map(Stream.fromEventListener(document, 'visibilitychange'), snapshot),
    );
  }),
);

function readWorkbench(model: typeof Model.Type): WorkbenchModel | null {
  // SAFETY: only a successful identity allocation creates a Ready workbench.
  return model._tag === 'Ready' ? (model.workbench as WorkbenchModel) : null;
}

export default Html.component({ name: 'ZlozArchitecture', model: Model, message: Message }).make({
  init: ($) => $.set(Model.Preparing()).run(allocateIdentity.make({})),
  update: ($, message) => {
    const model = $.model;
    if (message._tag === 'SucceededIdentity') {
      if (model._tag !== 'Preparing') return $.set(model);
      return $.set(Model.Ready({ workbench: initModel(message.namespace).model })).run(
        LoadThemePreference.make({}),
      );
    }
    if (message._tag === 'FailedIdentity') {
      return $.set(model._tag === 'Preparing' ? Model.Failed() : model);
    }
    if (message._tag === 'ClickedRetryIdentity') {
      if (model._tag !== 'Failed') return $.set(model);
      return $.set(Model.Preparing()).run(allocateIdentity.make({}));
    }
    const current = readWorkbench(model);
    if (!current) return $.set(model);
    const next = updateWorkbench(current, message);
    return $.set(next.model === current ? model : Model.Ready({ workbench: next.model })).run(
      ...(next.interrupts ?? []),
      ...(next.commands ?? []),
    );
  },
  subscriptions: ($) => {
    const workbench = readWorkbench($.model);
    if (!workbench) return [];
    const playback = workbench.historyPlayback?.cursor;
    const timer =
      playback?.status !== 'playing'
        ? []
        : [
            Subscription.make(
              'playback',
              [workbench.modelIdentity.id, workbench.playbackRun, playback.intervalMs],
              ([modelId, run, intervalMs]) =>
                Stream.tick(intervalMs).pipe(
                  Stream.drop(1),
                  Stream.map(() =>
                    WorkbenchMessage.AdvancedEditionPlayback({
                      modelId,
                      run,
                      milliseconds: intervalMs,
                    }),
                  ),
                ),
            ),
          ];
    return [reducedMotion, colorScheme, visibility, ...timer];
  },
  view: (h, model) =>
    Model.match(model, {
      Preparing: () => h.p.attr('role', 'status').children('Preparing workbench…'),
      Failed: () =>
        h.div.children(
          h.p
            .attr('role', 'alert')
            .children('Could not allocate a model identity. Your files remain unchanged.'),
          h.button
            .attr('type', 'button')
            .on('click', Lifecycle.ClickedRetryIdentity())
            .children('Try again'),
        ),
      Ready: ({ workbench }) => {
        // SAFETY: only the initializer and typed workbench reducer construct Ready.
        return viewWorkbench(workbench as WorkbenchModel, h, (message): Message => message);
      },
    }),
});
