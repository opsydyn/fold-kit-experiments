import { Mount, UiSchema } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { SceneSchema, type PhysicsEngine } from '@opsydyn/effect-three';
import {
  makeEnvironment,
  mountSceneHost,
  type Environment,
} from '@opsydyn/effect-three-foldkit/browser';
import { troikaLabels } from '@opsydyn/effect-three-troika/webgpu';
import { Effect, Schema, Stream } from 'effect';

import { rendererForPage } from './renderer';

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

/** Connects typed scene events to Effect UI without a registered custom element. */
export const EffectThreeStage = Html.customElement({
  tag: 'effect-three-scene',
  events: {
    'scene-click': SceneSchema.ButtonDetail,
    'scene-pointer-missed': SceneSchema.MissDetail,
    'scene-label-measured': SceneSchema.LabelMeasuredDetail,
    'scene-gesture': SceneSchema.GestureDetail,
    'scene-collision': SceneSchema.CollisionDetail,
    'scene-contact-force': SceneSchema.ContactForceDetail,
  },
});

export const defineLabelledSceneMount = (loadPhysics?: () => Promise<PhysicsEngine>) =>
  defineEffectThreeMount(() => {
    const options = { renderer: rendererForPage(window), labels: troikaLabels() };
    return makeEnvironment(
      window,
      loadPhysics === undefined
        ? options
        : {
            ...options,
            physics: loadPhysics(),
          },
    );
  });
