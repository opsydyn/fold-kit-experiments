import { Mount, UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { SceneSchema } from '@opsydyn/effect-three';
import { troikaLabels } from '@opsydyn/effect-three-troika/webgpu';
import { makeEnvironment, mountSceneHost, sceneEventSchemas } from '@opsydyn/effect-three/browser';
import { Effect, Schema, Stream } from 'effect';

import { rendererForPage } from './renderer';

export const SceneStart = UiSchema.TaggedEnum({
  StartedScene: {},
  FailedScene: { reason: Schema.String },
});

const createEnvironment = Effect.sync(() =>
  makeEnvironment(window, { renderer: rendererForPage(window), labels: troikaLabels() }),
);

const scopedEnvironment = Effect.acquireRelease(createEnvironment, (environment) =>
  Effect.sync(environment.dispose),
);

export const sceneMount = Mount.make(
  'RadarScene',
  { args: { scene: SceneSchema.SceneDescription } },
  (element: HTMLElement, { scene }, changes) => {
    const start = scopedEnvironment.pipe(
      Effect.flatMap((environment) =>
        mountSceneHost({
          environment,
          element,
          initial: scene,
          updates: Stream.map(changes, (args) => args.scene),
          liveChanges: Stream.empty,
        }),
      ),
    );
    return start.pipe(
      Effect.map(SceneStart.StartedScene),
      Effect.catchTags({
        InvalidScene: ({ error }) => Effect.succeed(SceneStart.FailedScene({ reason: error._tag })),
        RendererUnavailable: () =>
          Effect.succeed(SceneStart.FailedScene({ reason: 'renderer unavailable' })),
        PhysicsUnavailable: () =>
          Effect.succeed(SceneStart.FailedScene({ reason: 'physics unavailable' })),
      }),
    );
  },
);

export const EffectThreeStage = Html.customElement({
  tag: 'effect-three-scene',
  events: sceneEventSchemas,
});
