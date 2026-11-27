/** Exercises the public mount when the component pauses and resumes scene input. */
import { UiSchema } from '@effect/ui';
import { BrowserHost, Html } from '@effect/ui/html';
import { Effect, Layer, Schema } from 'effect';

import { makeEnvironment, makeSceneMount, SceneLifecycle, view } from '../../src/index.ts';
import { sceneFor } from './scene.ts';

const environment = makeEnvironment(window);
const mount = makeSceneMount(environment);
const scene = sceneFor('red');
const Model = Schema.Struct({ live: Schema.Boolean, clicks: Schema.Number, ready: Schema.Boolean });
const Message = UiSchema.TaggedEnum({
  SetLive: { live: Schema.Boolean },
  Clicked: {},
  ReportedLifecycle: { ready: Schema.Boolean },
});

const Fixture = Html.component({ name: 'PausedScene', model: Model, message: Message }).make({
  init: () => ({ live: false, clicks: 0, ready: false }),
  update: ({ model }, message) =>
    Message.match(message, {
      SetLive: ({ live }) => ({ ...model, live }),
      Clicked: () => ({ ...model, clicks: model.clicks + 1 }),
      ReportedLifecycle: ({ ready }) => ({ ...model, ready }),
    }),
  view: (h, model) =>
    view(
      {
        scene,
        mount,
        live: model.live,
        className: 'scene',
        onClick: () => Message.Clicked(),
        onLifecycle: (lifecycle) =>
          SceneLifecycle.match(lifecycle, {
            StartedScene: () => Message.ReportedLifecycle({ ready: true }),
            FailedScene: () => Message.ReportedLifecycle({ ready: false }),
          }),
      },
      h,
    ),
});

const mounted = BrowserHost.mountEffect(Fixture, {}, document.body);
const exposeProbe = Effect.map(mounted, (root) =>
  Reflect.set(globalThis, '__pause', {
    setLive: (live: boolean) => root.send(Message.SetLive({ live })),
    clicks: () => root.model()?.clicks ?? 0,
    ready: () => root.model()?.ready ?? false,
  }),
);
const browser = Layer.effectDiscard(exposeProbe);
Effect.runFork(Layer.launch(browser));
