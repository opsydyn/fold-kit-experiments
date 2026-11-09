import { Effect, Option, Schema, Stream } from 'effect';
import { Command, Dom, Subscription, Submodel } from 'foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { defineTaggedUnion } from 'foldkit/schema';
import { foldChild, type Return } from 'foldkit/update';

import { LoadThemePreference } from './command';
import * as Workbench from './message';
import { init as initModel, type Model as WorkbenchModel } from './model';
import { update as updateWorkbench } from './update';
import { view as viewWorkbench } from './view';

export const Model = defineTaggedUnion({
  Preparing: {},
  Ready: { workbench: Schema.Unknown },
  Failed: {},
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  SucceededIdentity: { namespace: Schema.String },
  FailedIdentity: {},
  ClickedRetryIdentity: {},
  GotWorkbenchMessage: { message: Workbench.Message },
});
export type Message = typeof Message.Type;
export const AllocateIdentity = Command.define('AllocateIdentity', {
  messages: [Message.SucceededIdentity, Message.FailedIdentity],
  execute: Effect.try(() => globalThis.crypto.randomUUID()).pipe(
    Effect.match({
      onSuccess: (namespace) => Message.SucceededIdentity({ namespace }),
      onFailure: () => Message.FailedIdentity(),
    }),
  ),
});
export const init = () => ({ model: Model.Preparing(), commands: [AllocateIdentity()] });
function readWorkbench(model: Model): Option.Option<WorkbenchModel> {
  return Model.match(model, {
    Preparing: () => Option.none(),
    Failed: () => Option.none(),
    Ready: ({ workbench }) => {
      // SAFETY: only SucceededIdentity constructs Ready with the typed editor initializer below.
      return Option.some(workbench as WorkbenchModel);
    },
  });
}
const foldWorkbench = foldChild<
  Model,
  Message,
  WorkbenchModel,
  Workbench.Message,
  Workbench.Message
>({
  update: updateWorkbench,
  read: readWorkbench,
  write: (_model: Model, workbench: WorkbenchModel) => Model.Ready({ workbench }),
  toParentMessage: (message: Workbench.Message) => Message.GotWorkbenchMessage({ message }),
});
export function update(model: Model, message: Message): Return<Model, Message> {
  return Message.match(message, {
    SucceededIdentity: ({ namespace }) =>
      model._tag !== 'Preparing'
        ? { model }
        : {
            model: Model.Ready({ workbench: initModel(namespace).model }),
            commands: [
              Command.mapMessage(LoadThemePreference(), (message) =>
                Message.GotWorkbenchMessage({ message }),
              ),
            ],
          },
    FailedIdentity: () => ({ model: model._tag === 'Preparing' ? Model.Failed() : model }),
    ClickedRetryIdentity: () => (model._tag === 'Failed' ? init() : { model }),
    GotWorkbenchMessage: ({ message: raw }) => {
      // SAFETY: h.submodel, Command.mapMessage and Subscription.lift wrap the child Message universe.
      return foldWorkbench(model, raw);
    },
  });
}
const workbenchView = Submodel.defineView<WorkbenchModel, Workbench.Message>(
  (model, h) => viewWorkbench(model, h).body,
);
export function view(model: Model, h: HtmlBuilder<Message>): Document {
  return {
    title: 'Foldkit Zloz',
    body: Model.match(model, {
      Preparing: () => h.p([h.Role('status')], ['Preparing workbench…']),
      Failed: () =>
        h.div(
          [],
          [
            h.p(
              [h.Role('alert')],
              ['Could not allocate a model identity. Your files remain unchanged.'],
            ),
            h.button([h.OnClick(Message.ClickedRetryIdentity())], ['Try again']),
          ],
        ),
      Ready: ({ workbench }) => {
        // SAFETY: Ready is initialized with WorkbenchModel and maintained only through foldWorkbench.
        return h.submodel({
          slotId: 'workbench',
          model: workbench as WorkbenchModel,
          view: workbenchView,
          toParentMessage: (message) => Message.GotWorkbenchMessage({ message }),
        });
      },
    }),
  };
}
const childSubscriptions = Subscription.make<WorkbenchModel, Workbench.Message>()((entry) => ({
  playback: entry(
    {
      playing: Schema.Boolean,
      modelId: Schema.String,
      run: Schema.Number,
      intervalMs: Schema.Number,
    },
    {
      modelToDependencies: (model) => ({
        playing: model.historyPlayback?.cursor.status === 'playing',
        modelId: model.modelIdentity.id,
        run: model.playbackRun,
        intervalMs: model.historyPlayback?.cursor.intervalMs ?? 2000,
      }),
      dependenciesToStream: ({ playing, modelId, run, intervalMs }) =>
        Stream.tick(intervalMs).pipe(
          Stream.drop(1),
          Stream.map(() =>
            Workbench.Message.AdvancedEditionPlayback({ modelId, run, milliseconds: intervalMs }),
          ),
          Stream.when(Effect.sync(() => playing)),
        ),
    },
  ),
  reducedMotion: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-reduced-motion: reduce)',
      mapMatches: (reducedMotion) =>
        Workbench.Message.ChangedPlaybackReducedMotion({ reducedMotion }),
    }),
  ),
  visibility: Subscription.persistentEntry(
    Stream.fromEffect(
      Effect.sync(() =>
        Workbench.Message.ChangedPlaybackVisibility({
          visible: document.visibilityState === 'visible',
        }),
      ),
    ).pipe(
      Stream.concat(
        Dom.streamFromEvent({
          target: () => document,
          type: 'visibilitychange',
          mapEvent: () =>
            Workbench.Message.ChangedPlaybackVisibility({
              visible: document.visibilityState === 'visible',
            }),
        }),
      ),
    ),
  ),
  systemColorScheme: Subscription.persistentEntry(
    Dom.streamFromMediaQuery({
      query: '(prefers-color-scheme: dark)',
      mapMatches: (dark) =>
        Workbench.Message.ChangedSystemColorScheme({ colorScheme: dark ? 'dark' : 'light' }),
    }),
  ),
}));
export const subscriptions = Subscription.lift(childSubscriptions)<Model, Message>({
  read: readWorkbench,
  toParentMessage: (message) => Message.GotWorkbenchMessage({ message }),
});
