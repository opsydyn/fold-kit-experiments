/** Connects FoldKit’s scene property and view state to the browser scene host. */
import { SceneSchema } from '@opsydyn/effect-three';
import { sceneErrorDispatch } from '@opsydyn/effect-three/browser';
import type { Environment } from '@opsydyn/effect-three/browser';
import { mountSceneHost } from '@opsydyn/effect-three/browser';
import { Effect, Option, Queue, Result, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import type { ViewState } from 'foldkit/mount';

import { interceptProperty } from './dom/property.ts';
import { typedScene } from './dom/typedScenes.ts';
import { SceneLifecycle } from './element.ts';

const decodeUnknownScene = Schema.decodeUnknownEffect(SceneSchema.SceneDescription);

/** Typed scenes from `view` skip validation; anything else is Schema-decoded. */
const decodeScene = (value: unknown) =>
  Option.fromNullishOr(typedScene(value)).pipe(
    Option.match({ onNone: () => decodeUnknownScene(value), onSome: Effect.succeed }),
  );

const isLive = Schema.is(Schema.Literal('Live'));

const interception = (element: Element, updates: Queue.Queue<unknown>) => () =>
  interceptProperty(element, 'scene', (value) => Queue.offerUnsafe(updates, value));

const acquireInterception = (element: Element, updates: Queue.Queue<unknown>) => {
  const intercept = Effect.sync(interception(element, updates));
  return Effect.acquireRelease(intercept, (intercepted) => Effect.sync(intercepted.restore));
};

const failure = (reason: string) => SceneLifecycle.FailedScene({ reason });

const recoverStart = {
  SchemaError: (error: Schema.SchemaError) =>
    Effect.succeed(failure(`malformed scene: ${error.message}`)),
  InvalidScene: ({ error }: { readonly error: { readonly _tag: string } }) =>
    Effect.succeed(failure(`invalid scene: ${error._tag}`)),
  RendererUnavailable: () => Effect.succeed(failure('renderer unavailable')),
  PhysicsUnavailable: () => Effect.succeed(failure('physics unavailable')),
};

type ExecuteInput = {
  readonly element: Element;
  readonly viewStateChanges: Stream.Stream<ViewState>;
};

const skipMalformed =
  (reportError: ReturnType<typeof sceneErrorDispatch>) => (error: Schema.SchemaError) => {
    const dispatch = Effect.sync(reportError({ _tag: 'MalformedScene', issue: error.message }));
    return dispatch.pipe(Effect.map(() => Result.failVoid));
  };

const decodeUpdate = (element: Element) => (value: unknown) =>
  decodeScene(value).pipe(
    Effect.map(Result.succeed),
    Effect.catchTag('SchemaError', skipMalformed(sceneErrorDispatch(element))),
  );

function* runMount(environment: Environment, { element, viewStateChanges }: ExecuteInput) {
  const updates = yield* Effect.acquireRelease(Queue.sliding<unknown>(1), Queue.shutdown);
  const intercepted = yield* acquireInterception(element, updates);
  const initial = yield* decodeScene(intercepted.initial);
  const sceneValues = Stream.fromQueue(updates);
  const decode = decodeUpdate(element);
  const scenes = Stream.filterMapEffect(sceneValues, decode);
  yield* mountSceneHost({
    environment,
    element,
    initial,
    updates: scenes,
    liveChanges: Stream.map(viewStateChanges, isLive),
  });
  return SceneLifecycle.StartedScene();
}

const mountScene = (environment: Environment) => (input: ExecuteInput) => {
  const start = Effect.gen(() => runMount(environment, input));
  return start.pipe(Effect.catchTags(recoverStart));
};

/**
 * Defines the scene Mount for an environment. Call once at the application entry point
 * and pass the result to `view` as `mount`.
 */
export const makeSceneMount = (environment: Environment) =>
  Mount.define('EffectThreeScene', {
    messages: [SceneLifecycle.StartedScene, SceneLifecycle.FailedScene],
    execute: mountScene(environment),
  });

export type SceneMount = ReturnType<typeof makeSceneMount>;
