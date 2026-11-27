/** Connects an Effect UI mount scope and arguments to the browser scene host. */
import { Mount } from '@effect/ui';
import { SceneSchema, type SceneDescription } from '@opsydyn/effect-three';
import { mountSceneHost, type Environment } from '@opsydyn/effect-three/browser';
import { Effect, Schema, type Scope, Stream } from 'effect';

import { SceneLifecycle } from './element.ts';

/** Arguments supplied by a component whenever it renders the scene. */
export type SceneMountArgs = {
  readonly scene: SceneDescription;
  readonly live?: boolean;
};

export type SceneMount<R = never> = Mount.Factory<
  SceneMountArgs,
  SceneLifecycle,
  HTMLElement,
  R | Scope.Scope
>;

const lifecycleFailure = (reason: string) => SceneLifecycle.FailedScene({ reason });

const recoverStartup = {
  InvalidScene: ({ error }: { readonly error: { readonly _tag: string } }) =>
    Effect.succeed(lifecycleFailure(`invalid scene: ${error._tag}`)),
  RendererUnavailable: () => Effect.succeed(lifecycleFailure('renderer unavailable')),
  PhysicsUnavailable: () => Effect.succeed(lifecycleFailure('physics unavailable')),
};

const startScene = (
  environment: Environment,
  element: HTMLElement,
  { scene, live }: SceneMountArgs,
  changes: Stream.Stream<SceneMountArgs>,
) => {
  const updates = Stream.map(changes, (args) => args.scene);
  const liveChanges = Stream.map(changes, (args) => args.live ?? true);
  const startup = mountSceneHost({
    environment,
    element,
    initial: scene,
    initialLive: live ?? true,
    updates,
    liveChanges,
  });
  return startup.pipe(
    Effect.map(() => SceneLifecycle.StartedScene()),
    Effect.catchTags(recoverStartup),
  );
};

const mountArgs = { scene: SceneSchema.SceneDescription, live: Schema.optionalKey(Schema.Boolean) };

/**
 * Defines a scene mount with access to the component's environment. The provided
 * Effect can read a shared service or acquire an environment scoped to the scene.
 */
export const defineScopedSceneMount = <R>(
  // oxlint-disable-next-line linteffect/no-manual-effect-channels -- Retain the caller's environment requirements.
  environment: Effect.Effect<Environment, never, R>,
): SceneMount<R> =>
  Mount.make('EffectThreeScene', { args: mountArgs }, (element, args, changes) =>
    Effect.flatMap(environment, (resolved) => startScene(resolved, element, args, changes)),
  );

/** Defines a scene mount for a shared environment owned by the caller. */
export const makeSceneMount = (environment: Environment): SceneMount => {
  // oxlint-disable-next-line linteffect/no-effect-succeed-variable -- The caller has already acquired the shared environment.
  const shared = Effect.succeed(environment);
  return defineScopedSceneMount(shared);
};
