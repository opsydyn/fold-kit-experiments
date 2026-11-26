import { Mount, UiSchema } from '@effect/ui';
import { Effect, Schema, Stream } from 'effect';

import type { Environment } from '../../../packages/effect-three-foldkit/src/environment.ts';
import { mountSceneHost } from '../../../packages/effect-three-foldkit/src/sceneHost.ts';
import { SceneSchema } from '../../../packages/effect-three/src/index.ts';

const SceneStart = UiSchema.TaggedEnum({
  StartedScene: {},
  FailedScene: { reason: Schema.String },
});

/** Mounts a scene in the element's scope and follows its description argument. */
export const makeEffectThreeMount = (environment: Environment) =>
  Mount.make(
    'EffectThreeScene',
    { args: { scene: SceneSchema.SceneDescription } },
    (element: HTMLElement, { scene }, changes) =>
      mountSceneHost({
        environment,
        element,
        initial: scene,
        updates: Stream.map(changes, (args) => args.scene),
        liveChanges: Stream.empty,
      }).pipe(
        Effect.map(() => SceneStart.StartedScene()),
        Effect.catchTags({
          InvalidScene: ({ error }) =>
            Effect.succeed(SceneStart.FailedScene({ reason: error._tag })),
          RendererUnavailable: () =>
            Effect.succeed(SceneStart.FailedScene({ reason: 'renderer unavailable' })),
          PhysicsUnavailable: () =>
            Effect.succeed(SceneStart.FailedScene({ reason: 'physics unavailable' })),
        }),
      ),
  );
