/**
 * The scene Mount (ADR-002): runs one scene for the lifetime of its element inside
 * Foldkit's runtime. Everything acquired here is released, in reverse order, when the
 * element unmounts.
 *
 * @module
 */
import {
  createGatedFrames,
  FrameSource,
  type GatedFrames,
  type PointerInput,
  ResourceRegistry,
  type SceneDescription,
  SceneRuntime,
  SceneSchema,
} from '@opsydyn/effect-three';
import { type Cause, Effect, Queue, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import type { ViewState } from 'foldkit/mount';

import { canvasIn, removal, sceneErrorDispatch, sceneEventDispatch } from './dom/canvas.ts';
import { applying, createLatch, type Latch, whileOpen } from './dom/latch.ts';
import { listenForPointer } from './dom/pointer.ts';
import { interceptProperty } from './dom/property.ts';
import {
  measureViewport,
  observeReducedMotion,
  observeSize,
  observeVisibility,
} from './dom/viewport.ts';
import { SceneLifecycle } from './element.ts';
import type { Environment } from './environment.ts';

type SceneHandle = SceneRuntime.SceneHandle;

/** Everything one mounted scene needs, gathered so helpers take one argument. */
type Mounted = {
  readonly environment: Environment;
  readonly element: Element;
  readonly handle: SceneHandle;
  readonly live: Latch;
  readonly frames: GatedFrames;
};

const decodeScene = Schema.decodeUnknownEffect(SceneSchema.SceneDescription);
const isLive = Schema.is(Schema.Literal('Live'));

const acquireCanvas = (element: Element) => {
  const create = Effect.sync(canvasIn(element));
  return Effect.acquireRelease(create, (canvas) => Effect.sync(removal(canvas)));
};

const acquireSceneUpdates = () => {
  const create = Queue.sliding<unknown>(1);
  return Effect.acquireRelease(create, Queue.shutdown);
};

const interception = (element: Element, updates: Queue.Queue<unknown>) => () =>
  interceptProperty(element, 'scene', (value) => Queue.offerUnsafe(updates, value));

const acquireInterception = (element: Element, updates: Queue.Queue<unknown>) => {
  const intercept = Effect.sync(interception(element, updates));
  return Effect.acquireRelease(intercept, (intercepted) => Effect.sync(intercepted.restore));
};

const pointerListening = (canvas: HTMLElement, onInput: (input: PointerInput) => void) => () =>
  listenForPointer(canvas, onInput);

const acquirePointer = (canvas: HTMLElement, mounted: Mounted) => {
  const listen = Effect.sync(
    pointerListening(canvas, whileOpen(mounted.live, mounted.handle.pointer)),
  );
  return Effect.acquireRelease(listen, Effect.sync);
};

/** A stream of values from a DOM observer that returns a disconnect function. */
const connectObserver =
  <A>(observe: (emit: (value: A) => void) => () => void) =>
  (queue: Queue.Queue<A, Cause.Done>) => {
    const connect = Effect.sync(applying(observe, (value: A) => Queue.offerUnsafe(queue, value)));
    return Effect.acquireRelease(connect, Effect.sync);
  };

const observed = <A>(observe: (emit: (value: A) => void) => () => void) =>
  Stream.callback<A>(connectObserver(observe));

const applyUpdate = (mounted: Mounted) => (value: unknown) => {
  const reportError = sceneErrorDispatch(mounted.element);
  const decoded = decodeScene(value);
  const applied = decoded.pipe(Effect.flatMap(mounted.handle.update));
  return applied.pipe(
    Effect.catchTags({
      SchemaError: (error) =>
        Effect.sync(reportError({ _tag: 'MalformedScene', issue: error.message })),
      InvalidScene: ({ error }) => Effect.sync(reportError(error)),
    }),
  );
};

const resize = (mounted: Mounted) => () =>
  mounted.handle.resize(
    measureViewport(mounted.element, mounted.environment.host.devicePixelRatio),
  );

const watchers = (
  mounted: Mounted,
  updates: Queue.Queue<unknown>,
  viewStateChanges: Stream.Stream<ViewState>,
) => {
  const dispatchEvent = sceneEventDispatch(mounted.element, mounted.live);
  const sizes = observed<void>((emit) => observeSize(mounted.element, emit));
  const visibility = observed<boolean>((emit) => observeVisibility(mounted.element, emit));
  const reducedMotion = observed<boolean>((emit) =>
    observeReducedMotion(mounted.environment.host, emit),
  );
  return [
    Stream.runForEach(Stream.fromQueue(updates), applyUpdate(mounted)),
    Stream.runForEach(mounted.handle.events, (event) => Effect.sync(dispatchEvent(event))),
    Stream.runForEach(viewStateChanges, (state) =>
      Effect.sync(applying(mounted.live.set, isLive(state))),
    ),
    Stream.runForEach(sizes, resize(mounted)),
    Stream.runForEach(visibility, (visible) =>
      Effect.sync(applying(mounted.frames.setOpen, visible)),
    ),
    Stream.runForEach(reducedMotion, (reduced) => mounted.handle.setAnimating(!reduced)),
  ];
};

const sceneRuntimeFor =
  (environment: Environment, element: Element, canvas: HTMLCanvasElement) =>
  (scene: SceneDescription) => {
    const frames = createGatedFrames(environment.frames);
    const started = SceneRuntime.make({
      scene,
      renderer: environment.renderer(canvas),
      viewport: measureViewport(element, environment.host.devicePixelRatio),
    }).pipe(
      Effect.provideService(FrameSource.FrameSource, FrameSource.fromScheduler(frames)),
      Effect.provideService(ResourceRegistry.ResourceRegistry, { store: environment.store }),
    );
    return Effect.map(started, (handle) => ({ handle, frames }));
  };

function* runScene(
  environment: Environment,
  element: Element,
  viewStateChanges: Stream.Stream<ViewState>,
) {
  const canvas = yield* acquireCanvas(element);
  const updates = yield* acquireSceneUpdates();
  const intercepted = yield* acquireInterception(element, updates);
  const initial = yield* decodeScene(intercepted.initial);
  const { handle, frames } = yield* sceneRuntimeFor(environment, element, canvas)(initial);
  const mounted: Mounted = { environment, element, handle, frames, live: createLatch(true) };
  yield* acquirePointer(canvas, mounted);
  const forks = watchers(mounted, updates, viewStateChanges).map((watcher) =>
    Effect.forkScoped(watcher),
  );
  yield* Effect.all(forks, { concurrency: 'unbounded' });
  return SceneLifecycle.StartedScene();
}

const failure = (reason: string) => SceneLifecycle.FailedScene({ reason });

const recoverStart = {
  SchemaError: (error: Schema.SchemaError) =>
    Effect.succeed(failure(`malformed scene: ${error.message}`)),
  InvalidScene: ({ error }: { readonly error: { readonly _tag: string } }) =>
    Effect.succeed(failure(`invalid scene: ${error._tag}`)),
  RendererUnavailable: () => Effect.succeed(failure('renderer unavailable')),
};

type ExecuteInput = {
  readonly element: Element;
  readonly viewStateChanges: Stream.Stream<ViewState>;
};

const mountScene =
  (environment: Environment) =>
  ({ element, viewStateChanges }: ExecuteInput) => {
    const scene = Effect.gen(() => runScene(environment, element, viewStateChanges));
    return scene.pipe(Effect.catchTags(recoverStart));
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
