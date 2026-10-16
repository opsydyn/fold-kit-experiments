/**
 * A running scene: a kernel scene graph, a renderer and a frame subscription, all owned
 * by the caller's `Scope`. Closing the scope stops the frame loop, then releases the
 * event queue, the renderer and every resource the scene acquired, in that order.
 *
 * @module
 */
import { Clock, Effect, Exit, Match, Queue, Result, Scope, Stream } from 'effect';

import {
  createSceneClock,
  createSceneGraph,
  createFramePacer,
  createSceneLoop,
  type Op,
  type ReconcileResult,
  type RendererFactory,
  type SceneDescription,
  type SceneEvent,
  type SceneClock,
  type SceneGraph,
  type SceneRenderer,
  type Viewport,
} from '../kernel/index.ts';
import { InvalidScene, RendererUnavailable } from './errors.ts';
import { FrameSource } from './FrameSource.ts';
import { ResourceRegistry } from './ResourceRegistry.ts';

export type SceneRuntimeOptions = {
  readonly scene: SceneDescription;
  readonly renderer: RendererFactory;
  readonly viewport: Viewport;
  /** Events kept when the consumer falls behind; older events are dropped. Default 64. */
  readonly eventCapacity?: number;
};

const defaultEventCapacity = 64;
const nanosPerMillisecond = 1_000_000;
const nanosPerSecond = 1_000_000_000;

const toResult = (result: ReconcileResult): Result.Result<ReadonlyArray<Op>, InvalidScene> =>
  Match.valueTags(result, {
    Applied: (applied) => Result.succeed(applied.ops),
    Invalid: ({ error }) => Result.fail(new InvalidScene({ error })),
  });

const applyViewport = (graph: SceneGraph, renderer: SceneRenderer, viewport: Viewport): void => {
  graph.resize(viewport.width, viewport.height);
  renderer.setViewport(viewport);
};

const sceneGraph = (registry: ResourceRegistry['Service']) => () =>
  createSceneGraph({ store: registry.store });

/**
 * Reconciles at the current scene time. An idle scene draws no frames, so its last tick
 * can be long past; catching up first makes new transitions start now, not back then.
 */
const reconcileNow = (graph: SceneGraph, sceneClock: SceneClock, scene: SceneDescription) => {
  graph.tick(sceneClock.elapsedSeconds());
  return graph.reconcile(scene);
};

const viewportChange = (graph: SceneGraph, renderer: SceneRenderer, viewport: Viewport) => () =>
  applyViewport(graph, renderer, viewport);

const animationChange = (sceneClock: SceneClock, graph: SceneGraph, animating: boolean) => () => {
  sceneClock.setAnimating(animating);
  graph.setAnimating(animating);
};

const acquireGraph = (registry: ResourceRegistry['Service']) => {
  const create = Effect.sync(sceneGraph(registry));
  return Effect.acquireRelease(create, (graph) => Effect.sync(graph.dispose));
};

const acquireRenderer = (factory: RendererFactory) => {
  const create = Effect.try({
    try: factory.create,
    catch: (cause) => new RendererUnavailable({ cause }),
  });
  return Effect.acquireRelease(create, (renderer) => Effect.sync(renderer.dispose));
};

const invalidationListening = (graph: SceneGraph, onInvalidated: () => void) => () =>
  graph.onInvalidated(onInvalidated);

const acquireInvalidation = (graph: SceneGraph, onInvalidated: () => void) => {
  const listen = Effect.sync(invalidationListening(graph, onInvalidated));
  return Effect.acquireRelease(listen, Effect.sync);
};

const acquireEvents = (capacity: number) => {
  const create = Queue.sliding<SceneEvent>(capacity);
  return Effect.acquireRelease(create, Queue.shutdown);
};

function* startScene(options: SceneRuntimeOptions) {
  const registry = yield* ResourceRegistry;
  const frames = yield* FrameSource;
  const clock = yield* Clock.Clock;

  const graph = yield* acquireGraph(registry);
  const startupOps = yield* Effect.fromResult(toResult(graph.reconcile(options.scene)));
  const renderer = yield* acquireRenderer(options.renderer);
  applyViewport(graph, renderer, options.viewport);
  const events = yield* acquireEvents(options.eventCapacity ?? defaultEventCapacity);

  const sceneClock = createSceneClock(
    () => Number(clock.monotonicTimeNanosUnsafe()) / nanosPerSecond,
  );
  const loop = createSceneLoop({
    graph,
    renderer,
    elapsedSeconds: sceneClock.elapsedSeconds,
    emit: (event) => {
      Queue.offerUnsafe(events, event);
    },
    now: () => Number(clock.monotonicTimeNanosUnsafe()) / nanosPerMillisecond,
  });
  const pacer = createFramePacer(loop);
  pacer.attach(yield* frames.subscribe(pacer.frame));
  yield* acquireInvalidation(graph, pacer.wake);

  return {
    /** The hosted scene graph, for inspection. */
    graph,
    /** The operations that built the initial scene. */
    startupOps,
    /**
     * Applies a new description and returns the operations it took. Structurally equal
     * descriptions return no operations and cost no host changes.
     */
    update: (scene: SceneDescription) =>
      Effect.suspend(() => Effect.fromResult(toResult(reconcileNow(graph, sceneClock, scene)))),
    /** Resizes the camera aspect and the renderer's drawing surface. */
    resize: (viewport: Viewport) => Effect.sync(viewportChange(graph, renderer, viewport)),
    /** Freezes (`false`) or resumes (`true`) behaviours; frozen, transitions land at once. */
    setAnimating: (animating: boolean) =>
      Effect.sync(animationChange(sceneClock, graph, animating)),
    /**
     * Draws one frame now, whatever the frame mode: React Three Fiber's `advance`, for
     * `frames: 'never'` scenes and frame-exact capture.
     */
    advance: Effect.sync(pacer.advance),
    /** Routes pointer input. Synchronous, so DOM listeners can call it directly. */
    pointer: loop.pointer,
    /** Scene events, newest kept when the consumer falls behind. */
    events: Stream.fromQueue(events),
    /** Removes and returns every pending event without waiting. */
    drainEvents: Queue.clear(events),
  };
}

// Startup is atomic: everything is acquired into a child of the caller's scope, which is
// closed immediately if startup fails or is interrupted. Otherwise a partial scene would
// stay allocated until the caller's scope closed (under Foldkit: until unmount).
function* startAtomically(options: SceneRuntimeOptions) {
  const parent = yield* Effect.scope;
  const child = yield* Scope.fork(parent);
  return yield* Effect.gen(() => startScene(options)).pipe(
    Scope.provide(child),
    Effect.onError((cause) => Scope.close(child, Exit.failCause(cause))),
  );
}

/**
 * Starts a scene in the current scope. Fails with `InvalidScene` if the initial
 * description is rejected and `RendererUnavailable` if the renderer can't be created.
 * A failed or interrupted start releases everything it acquired before returning.
 */
export const make = (options: SceneRuntimeOptions) => {
  const program = Effect.gen(() => startAtomically(options));
  return program.pipe(Effect.withSpan('effect-three/SceneRuntime.make'));
};

/** The handle `make` returns. */
export type SceneHandle = Effect.Success<ReturnType<typeof make>>;
