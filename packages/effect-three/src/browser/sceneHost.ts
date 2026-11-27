import { type Cause, Data, Effect, Queue, Stream } from 'effect';

/** Scoped browser scene lifecycle shared by UI adapters. */
import {
  createGatedFrames,
  FrameSource,
  type GatedFrames,
  type PhysicsEngine,
  type PointerInput,
  ResourceRegistry,
  type SceneEvent,
  type SceneDescription,
  SceneRuntime,
} from '../index.ts';
import {
  canvasIn,
  reconciledDispatch,
  removal,
  sceneErrorDispatch,
  sceneEventDispatch,
  dispatchAssetNotice,
} from './dom/canvas.ts';
import { applying, createLatch, type Latch, routedWhileOpen } from './dom/latch.ts';
import { containOverlays, createOverlayWriter, type OverlayWriter } from './dom/overlays.ts';
import { claimsGestures, listenForPointer, touchActionSync } from './dom/pointer.ts';
import { afterUpdate } from './dom/updates.ts';
import {
  measureViewport,
  observePixelRatio,
  observeReducedMotion,
  observeSize,
  observeVisibility,
} from './dom/viewport.ts';
import { createFrameGate, type FrameGate, xrTarget } from './dom/xrTarget.ts';
import type { Environment } from './environment.ts';

type SceneHandle = SceneRuntime.SceneHandle;

/** Everything one mounted scene needs, gathered so helpers take one argument. */
type Mounted = {
  readonly environment: Environment;
  readonly element: Element;
  readonly canvas: HTMLCanvasElement;
  readonly overlays: OverlayWriter;
  readonly handle: SceneHandle;
  readonly live: Latch;
  readonly frames: GatedFrames;
  readonly gate: FrameGate;
};

const acquireCanvas = (element: Element) => {
  const create = Effect.sync(canvasIn(element));
  return Effect.acquireRelease(create, (canvas) => Effect.sync(removal(canvas)));
};

const pointerListening =
  (
    canvas: HTMLElement,
    onInput: (input: PointerInput) => ReadonlyArray<SceneEvent>,
    claimsGestures: () => boolean,
  ) =>
  () =>
    listenForPointer(canvas, onInput, claimsGestures);

const acquirePointer = (canvas: HTMLElement, mounted: Mounted) => {
  const listen = Effect.sync(
    pointerListening(
      canvas,
      routedWhileOpen(mounted.live, mounted.handle.pointer),
      claimsGestures(mounted.handle.graph),
    ),
  );
  return Effect.acquireRelease(listen, Effect.sync);
};

/** Makes the scene presentable in the page's immersive sessions while it is mounted. */
const xrRegistration = (mounted: Mounted) => () =>
  mounted.environment.xrHub.register(
    xrTarget({
      element: mounted.element,
      canvas: mounted.canvas,
      live: mounted.live,
      gate: mounted.gate,
      settings: mounted.handle.graph.xr,
      draw: mounted.handle.drawNow,
      scene: mounted.handle.graph.scene,
      follow: mounted.handle.graph.follow,
      lend: mounted.handle.graph.store.lendGeometry,
      object: mounted.handle.graph.object,
      input: mounted.handle.xrInput,
    }),
  );

const acquireXrTarget = (mounted: Mounted) => {
  const register = Effect.sync(xrRegistration(mounted));
  return Effect.acquireRelease(register, Effect.sync);
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

/** What the scene asks for now, given to the environment's asset registry. */
const asking = (mounted: Mounted, scene: SceneDescription) => () =>
  mounted.environment.assetRegistry.want(mounted.element, scene.assets, (notice) =>
    dispatchAssetNotice(mounted.element, notice),
  );

const lettingGo = (mounted: Mounted) => () =>
  mounted.environment.assetRegistry.release(mounted.element);

/** The scene's assets, asked for while it is mounted: going, it asks for none. */
const acquireAssets = (mounted: Mounted, initial: SceneDescription) => {
  const ask = Effect.sync(asking(mounted, initial));
  return Effect.acquireRelease(ask, () => Effect.sync(lettingGo(mounted)));
};

/** An update applied, then what it asks for given to the registry (a refused one asks nothing). */
const updated = (mounted: Mounted) => (scene: SceneDescription) => {
  const ask = Effect.sync(asking(mounted, scene));
  return Effect.tap(mounted.handle.update(scene), () => ask);
};

const applyUpdate = (mounted: Mounted) => (scene: SceneDescription) => {
  const reportError = sceneErrorDispatch(mounted.element);
  const reportReconciled = afterUpdate(
    reconciledDispatch(mounted.element, mounted.environment.store),
    [touchActionSync(mounted.canvas, mounted.handle.graph), mounted.overlays.rewrite],
  );
  const applied = updated(mounted)(scene).pipe(
    Effect.flatMap((ops) => Effect.sync(reportReconciled(ops))),
  );
  return applied.pipe(
    Effect.catchTags({
      InvalidScene: ({ error }) => Effect.sync(reportError(error)),
    }),
  );
};

const resize = (mounted: Mounted) => () =>
  mounted.handle.resize(
    measureViewport(
      mounted.element,
      mounted.environment.host.devicePixelRatio,
      mounted.environment.pixelRatio,
    ),
  );

const watchers = (
  mounted: Mounted,
  updates: Stream.Stream<SceneDescription>,
  liveChanges: Stream.Stream<boolean>,
) => {
  const dispatchEvent = sceneEventDispatch(mounted.element, mounted.live);
  const sizes = observed<void>((emit) => observeSize(mounted.element, emit));
  const ratios = observed<void>((emit) => observePixelRatio(mounted.environment.host, emit));
  const visibility = observed<boolean>((emit) => observeVisibility(mounted.element, emit));
  const reducedMotion = observed<boolean>((emit) =>
    observeReducedMotion(mounted.environment.host, emit),
  );
  return [
    Stream.runForEach(updates, applyUpdate(mounted)),
    Stream.runForEach(mounted.handle.events, (event) => Effect.sync(dispatchEvent(event))),
    Stream.runForEach(liveChanges, (live) => Effect.sync(applying(mounted.live.set, live))),
    Stream.runForEach(sizes, resize(mounted)),
    Stream.runForEach(ratios, resize(mounted)),
    Stream.runForEach(visibility, (visible) =>
      Effect.sync(applying(mounted.gate.setVisible, visible)),
    ),
    Stream.runForEach(reducedMotion, (reduced) => mounted.handle.setAnimating(!reduced)),
  ];
};

/** The physics engine could not be loaded (Rapier's WebAssembly, say). */
class PhysicsUnavailable extends Data.TaggedError('PhysicsUnavailable')<{
  readonly cause: unknown;
}> {}

const sceneRuntimeFor =
  (
    environment: Environment,
    element: Element,
    canvas: HTMLCanvasElement,
    overlays: OverlayWriter,
    physics: PhysicsEngine | undefined,
  ) =>
  (scene: SceneDescription) => {
    const frames = createGatedFrames(environment.frames);
    const started = SceneRuntime.make({
      scene,
      renderer: environment.renderer(canvas),
      behaviours: environment.behaviours,
      physics,
      labels: environment.labels,
      placeOverlays: overlays.place,
      viewport: measureViewport(element, environment.host.devicePixelRatio, environment.pixelRatio),
    }).pipe(
      Effect.provideService(FrameSource.FrameSource, FrameSource.fromScheduler(frames)),
      Effect.provideService(ResourceRegistry.ResourceRegistry, { store: environment.store }),
    );
    return Effect.map(started, (handle) => ({ handle, frames }));
  };

type SceneHostInput = {
  readonly environment: Environment;
  readonly element: Element;
  readonly initial: SceneDescription;
  readonly updates: Stream.Stream<SceneDescription>;
  readonly liveChanges: Stream.Stream<boolean>;
};

function* runScene({ environment, element, initial, updates, liveChanges }: SceneHostInput) {
  const canvas = yield* acquireCanvas(element);
  const overlays = createOverlayWriter(element);
  yield* Effect.sync(containOverlays(element));
  const physics = yield* Effect.tryPromise({
    try: () => environment.physics,
    catch: (cause) => new PhysicsUnavailable({ cause }),
  });
  const { handle, frames } = yield* sceneRuntimeFor(
    environment,
    element,
    canvas,
    overlays,
    physics,
  )(initial);
  const mounted: Mounted = {
    environment,
    element,
    canvas,
    overlays,
    handle,
    frames,
    gate: createFrameGate(frames),
    live: createLatch(true),
  };
  yield* acquireAssets(mounted, initial);
  yield* acquirePointer(canvas, mounted);
  yield* acquireXrTarget(mounted);
  yield* Effect.sync(touchActionSync(canvas, handle.graph));
  yield* Effect.sync(reconciledDispatch(element, environment.store)(handle.startupOps));
  const forks = watchers(mounted, updates, liveChanges).map((watcher) =>
    Effect.forkScoped(watcher),
  );
  yield* Effect.all(forks, { concurrency: 'unbounded' });
}

/** Starts a browser scene and releases it when the caller's mount scope closes. */
export const mountSceneHost = Effect.fnUntraced(runScene);
