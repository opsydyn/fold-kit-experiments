import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { Data, Effect, Exit, Fiber, Layer, ManagedRuntime, Scope } from 'effect';
import { TestClock } from 'effect/testing';

import {
  ambientLight,
  box,
  ease,
  type ManualFrames,
  mesh,
  recordingRendererFactory,
  type RendererFactory,
  scene,
  sharedGeometry,
  spin,
  standard,
  type Vec3,
} from '../src/kernel/index.ts';
import { FrameSource, ResourceRegistry, SceneRuntime } from '../src/runtime/index.ts';
import { raise } from './support/holds.ts';
import { advanceFrames, sceneTestRuntime } from './support/runtime.ts';

const viewport = { width: 800, height: 600, pixelRatio: 1 };

const cubeScene = (options: { readonly color: number; readonly position?: Vec3 }) =>
  scene({
    children: [
      ambientLight({ key: 'ambient' }),
      mesh({
        key: 'cube',
        geometry: box(),
        material: standard({ color: options.color }),
        interactive: true,
        position: options.position ?? [0, 0, 0],
        rotation: spin({ axis: 'y', radiansPerSecond: 1 }),
      }),
    ],
  });

const duplicateScene = scene({
  children: [
    mesh({ key: 'cube', geometry: box(), material: standard({ color: 0 }) }),
    mesh({ key: 'cube', geometry: box(), material: standard({ color: 0 }) }),
  ],
});

const sharedScene = scene({
  resources: { geometries: [{ id: 'shared-box', geometry: box() }] },
  children: [
    mesh({ key: 'cube', geometry: sharedGeometry('shared-box'), material: standard({ color: 1 }) }),
  ],
});

class BackendMissing extends Data.TaggedError('BackendMissing')<{ readonly backend: string }> {}

const failingRenderer: RendererFactory = {
  create: () => raise(new BackendMissing({ backend: 'webgl2' })),
};

function* rendersAndAnimatesWithoutEvents(frames: ManualFrames) {
  const renderers = recordingRendererFactory();
  const handle = yield* SceneRuntime.make({
    scene: cubeScene({ color: 0xff0000 }),
    renderer: renderers,
    viewport,
  });
  yield* advanceFrames(frames, 500, 20);
  expect(renderers.created()[0]?.renders()).toBe(500);
  expect(handle.graph.object('cube')?.rotation.y).toBeCloseTo(10, 9);
  expect(yield* handle.drainEvents).toEqual([]);
}

function* reducedMotionFreezesBehaviours(frames: ManualFrames) {
  const renderers = recordingRendererFactory();
  const handle = yield* SceneRuntime.make({
    scene: cubeScene({ color: 1 }),
    renderer: renderers,
    viewport,
  });
  yield* advanceFrames(frames, 50, 20);
  yield* handle.setAnimating(false);
  yield* advanceFrames(frames, 50, 20);
  expect(handle.graph.object('cube')?.rotation.y).toBeCloseTo(1, 9);
  // One frame draws the frozen pose; then, with nothing changing, the scene sleeps.
  expect(renderers.created()[0]?.renders()).toBe(51);
  expect(frames.subscribers()).toBe(0);
  yield* handle.setAnimating(true);
  expect(frames.subscribers()).toBe(1);
  yield* advanceFrames(frames, 50, 20);
  expect(handle.graph.object('cube')?.rotation.y).toBeCloseTo(2, 9);
}

const easedCube = (x: number) =>
  scene({
    children: [
      mesh({
        key: 'cube',
        geometry: box(),
        material: standard({ color: 0 }),
        position: [x, 0, 0],
        transition: ease({ seconds: 1, easing: 'linear' }),
      }),
    ],
  });

function* reducedMotionLandsTransitionsAtOnce(frames: ManualFrames) {
  const handle = yield* SceneRuntime.make({
    scene: easedCube(0),
    renderer: recordingRendererFactory(),
    viewport,
  });
  yield* handle.update(easedCube(4));
  yield* advanceFrames(frames, 25, 20);
  expect(handle.graph.object('cube')?.position.x).toBeCloseTo(2, 9);
  yield* handle.setAnimating(false);
  expect(handle.graph.object('cube')?.position.x).toBe(4);
  yield* handle.update(easedCube(-4));
  expect(handle.graph.object('cube')?.position.x).toBe(-4);
}

function* updatesInPlace() {
  const handle = yield* SceneRuntime.make({
    scene: cubeScene({ color: 0xff0000 }),
    renderer: recordingRendererFactory(),
    viewport,
  });
  const before = handle.graph.object('cube');
  yield* handle.update(cubeScene({ color: 0x0000ff }));
  expect(handle.graph.object('cube')).toBe(before);
  const failure = yield* Effect.flip(handle.update(duplicateScene));
  expect(failure).toMatchObject({
    _tag: 'InvalidScene',
    error: { _tag: 'DuplicateKey', key: 'cube' },
  });
  expect(handle.graph.object('cube')).toBe(before);
}

function* releasesEverythingWhenTheScopeCloses(frames: ManualFrames) {
  const { store } = yield* ResourceRegistry.ResourceRegistry;
  const renderers = recordingRendererFactory();
  const scope = yield* Scope.make();
  yield* SceneRuntime.make({ scene: cubeScene({ color: 1 }), renderer: renderers, viewport }).pipe(
    Scope.provide(scope),
  );
  expect(frames.subscribers()).toBe(1);
  expect(store.stats().geometries.live).toBe(1);
  yield* Scope.close(scope, Exit.void);
  expect(frames.subscribers()).toBe(0);
  expect(renderers.created()[0]?.disposed()).toBe(true);
  expect(store.stats().geometries).toEqual({ created: 1, disposed: 1, live: 0 });
  expect(store.stats().materials.live).toBe(0);
}

function* sharedResourcesSurviveUntilTheLastScene() {
  const { store } = yield* ResourceRegistry.ResourceRegistry;
  const first = yield* Scope.make();
  const second = yield* Scope.make();
  const options = { scene: sharedScene, renderer: recordingRendererFactory(), viewport };
  yield* Scope.provide(SceneRuntime.make(options), first);
  yield* Scope.provide(SceneRuntime.make(options), second);
  expect(store.stats().sharedGeometryUsers.get('shared-box')).toBe(2);
  yield* Scope.close(first, Exit.void);
  expect(store.stats().geometries.live).toBe(1);
  yield* Scope.close(second, Exit.void);
  expect(store.stats().geometries).toEqual({ created: 1, disposed: 1, live: 0 });
}

function* pointerInputEmitsTypedEvents() {
  const handle = yield* SceneRuntime.make({
    scene: cubeScene({ color: 1 }),
    renderer: recordingRendererFactory(),
    viewport,
  });
  handle.pointer({ _tag: 'PointerDown', x: 0, y: 0, button: 0 });
  handle.pointer({ _tag: 'PointerUp', x: 0, y: 0, button: 0 });
  handle.pointer({ _tag: 'PointerMove', x: 0.95, y: 0.95 });
  const events = yield* handle.drainEvents;
  expect(events.map((event) => event._tag)).toEqual([
    'PointerEnter',
    'PointerDown',
    'PointerUp',
    'Click',
    'PointerLeave',
  ]);
  expect(events[3]).toMatchObject({ _tag: 'Click', key: 'cube', button: 0 });
}

function* hoverFollowsObjectsUnderAStillPointer(frames: ManualFrames) {
  const handle = yield* SceneRuntime.make({
    scene: cubeScene({ color: 1 }),
    renderer: recordingRendererFactory(),
    viewport,
  });
  handle.pointer({ _tag: 'PointerMove', x: 0, y: 0 });
  frames.step();
  yield* handle.update(cubeScene({ color: 1, position: [10, 0, 0] }));
  frames.step();
  const events = yield* handle.drainEvents;
  expect(events.map((event) => [event._tag, 'key' in event && event.key])).toEqual([
    ['PointerEnter', 'cube'],
    ['PointerMove', 'cube'],
    ['PointerLeave', 'cube'],
  ]);
}

function* failedStartsLeakNothing(frames: ManualFrames) {
  const { store } = yield* ResourceRegistry.ResourceRegistry;
  const renderers = recordingRendererFactory();
  const invalid = yield* Effect.flip(
    SceneRuntime.make({ scene: duplicateScene, renderer: renderers, viewport }),
  );
  expect(invalid._tag).toBe('InvalidScene');
  expect(renderers.created()).toEqual([]);
  const unavailable = yield* Effect.flip(
    SceneRuntime.make({ scene: cubeScene({ color: 1 }), renderer: failingRenderer, viewport }),
  );
  expect(unavailable._tag).toBe('RendererUnavailable');
  expect(store.stats().geometries).toEqual({ created: 1, disposed: 1, live: 0 });
  expect(frames.subscribers()).toBe(0);
}

// A frame source whose subscription never completes: startup parks inside `make`.
const noControl = { wake: () => undefined, sleep: () => undefined };
const stalledFrames = Layer.succeed(FrameSource.FrameSource, {
  subscribe: () => Effect.sleep('1 hour').pipe(Effect.map(() => noControl)),
});

const stalledEnvironment = Layer.mergeAll(ResourceRegistry.layer, stalledFrames, TestClock.layer());

function* interruptedStartLeaksNothing() {
  const { store } = yield* ResourceRegistry.ResourceRegistry;
  const renderers = recordingRendererFactory();
  const fiber = yield* Effect.forkChild(
    SceneRuntime.make({ scene: cubeScene({ color: 1 }), renderer: renderers, viewport }),
  );
  yield* TestClock.adjust('1 millis');
  expect(store.stats().geometries.live).toBe(1);
  expect(renderers.created().length).toBe(1);
  yield* Fiber.interrupt(fiber);
  expect(store.stats().geometries).toEqual({ created: 1, disposed: 1, live: 0 });
  expect(renderers.created()[0]?.disposed()).toBe(true);
}

function interruptionTests() {
  let runtime = ManagedRuntime.make(stalledEnvironment);
  beforeEach(() => {
    runtime = ManagedRuntime.make(stalledEnvironment);
  });
  afterEach(() => runtime.dispose());
  test('interrupting a start releases everything it acquired', () =>
    runtime.runPromise(Effect.gen(interruptedStartLeaksNothing).pipe(Effect.scoped)));
}

function sceneRuntimeTests() {
  let current = sceneTestRuntime();
  beforeEach(() => {
    current = sceneTestRuntime();
  });
  afterEach(() => current.runtime.dispose());

  test('renders and animates 500 frames without emitting events', () =>
    current.runtime.runPromise(
      Effect.gen(() => rendersAndAnimatesWithoutEvents(current.frames)).pipe(Effect.scoped),
    ));
  test('reduced motion freezes behaviours, then the still scene stops drawing', () =>
    current.runtime.runPromise(
      Effect.gen(() => reducedMotionFreezesBehaviours(current.frames)).pipe(Effect.scoped),
    ));
  test('reduced motion lands eased changes at once, including any in flight', () =>
    current.runtime.runPromise(
      Effect.gen(() => reducedMotionLandsTransitionsAtOnce(current.frames)).pipe(Effect.scoped),
    ));
  test('updates reuse objects and invalid updates change nothing', () =>
    current.runtime.runPromise(Effect.gen(updatesInPlace).pipe(Effect.scoped)));
  test('closing the scope stops frames and releases the renderer and resources', () =>
    current.runtime.runPromise(
      Effect.gen(() => releasesEverythingWhenTheScopeCloses(current.frames)).pipe(Effect.scoped),
    ));
  test('shared resources survive until the last scene closes', () =>
    current.runtime.runPromise(
      Effect.gen(sharedResourcesSurviveUntilTheLastScene).pipe(Effect.scoped),
    ));
  test('pointer input emits typed events, including Click', () =>
    current.runtime.runPromise(Effect.gen(pointerInputEmitsTypedEvents).pipe(Effect.scoped)));
  test('hover follows objects moving under a still pointer', () =>
    current.runtime.runPromise(
      Effect.gen(() => hoverFollowsObjectsUnderAStillPointer(current.frames)).pipe(Effect.scoped),
    ));
  test('failed starts release everything they acquired', () =>
    current.runtime.runPromise(
      Effect.gen(() => failedStartsLeakNothing(current.frames)).pipe(Effect.scoped),
    ));
}

describe('SceneRuntime', sceneRuntimeTests);
describe('SceneRuntime interruption', interruptionTests);
