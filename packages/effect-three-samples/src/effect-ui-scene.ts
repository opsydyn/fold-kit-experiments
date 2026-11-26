import { Mount, UiSchema } from '@effect/ui';
import { SceneSchema } from '@opsydyn/effect-three';
import { mountSceneHost, type Environment } from '@opsydyn/effect-three-foldkit/browser';
import { Effect, Schema, Stream } from 'effect';

export const SceneStart = UiSchema.TaggedEnum({
  StartedScene: {},
  FailedScene: { reason: Schema.String },
});

/** Mounts a scene in the element's scope and follows its description argument. */
export const defineEffectThreeMount = (createEnvironment: () => Environment) =>
  Mount.make(
    'EffectThreeScene',
    { args: { scene: SceneSchema.SceneDescription } },
    (element: HTMLElement, { scene }, changes) => {
      const acquire = Effect.sync(createEnvironment);
      const environment = Effect.acquireRelease(acquire, (created) => Effect.sync(created.dispose));
      const startup = environment.pipe(
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
      return startup.pipe(
        Effect.map(() => SceneStart.StartedScene()),
        Effect.catchTags({
          InvalidScene: ({ error }) =>
            Effect.succeed(SceneStart.FailedScene({ reason: error._tag })),
          RendererUnavailable: () =>
            Effect.succeed(SceneStart.FailedScene({ reason: 'renderer unavailable' })),
          PhysicsUnavailable: () =>
            Effect.succeed(SceneStart.FailedScene({ reason: 'physics unavailable' })),
        }),
      );
    },
  );
