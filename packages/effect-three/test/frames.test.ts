/** Frame modes: an idle `demand` scene unsubscribes; changes and animation wake it. */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { Effect } from 'effect';

import {
  box,
  ease,
  fixed,
  type FrameMode,
  type ManualFrames,
  mesh,
  recordingRendererFactory,
  type Rotation,
  renderSettings,
  scene,
  sharedMaterial,
  spin,
  standard,
} from '../src/kernel/index.ts';
import { SceneRuntime } from '../src/runtime/index.ts';
import { advanceFrames, sceneTestRuntime } from './support/runtime.ts';

const viewport = { width: 800, height: 600, pixelRatio: 1 };

const still = fixed([0, 0, 0]);
const spinning = spin({ axis: 'y', radiansPerSecond: 1 });

const cube = (options: {
  readonly x?: number;
  readonly frames?: FrameMode;
  readonly rotation?: Rotation;
}) =>
  scene({
    render: renderSettings({ frames: options.frames ?? 'demand' }),
    children: [
      mesh({
        key: 'cube',
        geometry: box(),
        material: standard({ color: 0x3366ff }),
        position: [options.x ?? 0, 0, 0],
        rotation: options.rotation ?? still,
        transition: ease({ seconds: 0.5, easing: 'linear' }),
      }),
    ],
  });

function* idleSceneSleepsUntilSomethingChanges(frames: ManualFrames) {
  const renderers = recordingRendererFactory();
  const renders = () => renderers.created()[0]?.renders() ?? 0;
  const handle = yield* SceneRuntime.make({ scene: cube({}), renderer: renderers, viewport });
  yield* advanceFrames(frames, 10, 16);
  expect(renders()).toBe(1);
  expect(frames.subscribers()).toBe(0);

  // A structurally equal scene changes nothing and wakes nothing.
  yield* handle.update(cube({}));
  expect(frames.subscribers()).toBe(0);

  // An eased move wakes the scene, draws until the tween lands, then sleeps again.
  yield* handle.update(cube({ x: 2 }));
  expect(frames.subscribers()).toBe(1);
  yield* advanceFrames(frames, 60, 16);
  expect(handle.graph.object('cube')?.position.x).toBe(2);
  expect(frames.subscribers()).toBe(0);
  const afterTween = renders();
  expect(afterTween).toBeGreaterThan(30);
  expect(afterTween).toBeLessThan(40);

  // A resize draws exactly one frame.
  yield* handle.resize({ width: 400, height: 300, pixelRatio: 1 });
  yield* advanceFrames(frames, 5, 16);
  expect(renders()).toBe(afterTween + 1);
}

function* alwaysAndNeverModes(frames: ManualFrames) {
  const renderers = recordingRendererFactory();
  const renders = () => renderers.created()[0]?.renders() ?? 0;
  const handle = yield* SceneRuntime.make({
    scene: cube({ frames: 'always' }),
    renderer: renderers,
    viewport,
  });
  yield* advanceFrames(frames, 10, 16);
  expect(renders()).toBe(10);

  yield* handle.update(cube({ frames: 'never', rotation: spinning }));
  yield* advanceFrames(frames, 10, 16);
  // Switching to never draws the frame already queued, then stops, even while spinning.
  expect(renders()).toBe(11);
  expect(frames.subscribers()).toBe(0);
  yield* handle.advance;
  yield* handle.advance;
  expect(renders()).toBe(13);
  expect(frames.subscribers()).toBe(0);

  // Back on demand, a spinning cube keeps frames coming.
  yield* handle.update(cube({ frames: 'demand', rotation: spinning }));
  yield* advanceFrames(frames, 10, 16);
  expect(renders()).toBe(23);
  expect(frames.subscribers()).toBe(1);
}

function* sharedChangeElsewhereWakesASleepingScene(frames: ManualFrames) {
  const painted = (color: number) =>
    scene({
      resources: { materials: [{ id: 'paint', material: standard({ color }) }] },
      children: [mesh({ key: 'm', geometry: box(), material: sharedMaterial('paint') })],
    });
  const renderers = recordingRendererFactory();
  yield* SceneRuntime.make({ scene: painted(0xff0000), renderer: renderers, viewport });
  const other = yield* SceneRuntime.make({
    scene: painted(0xff0000),
    renderer: renderers,
    viewport,
  });
  yield* advanceFrames(frames, 3, 16);
  expect(frames.subscribers()).toBe(0);

  // Only the other scene reconciles, but the first one draws the shared change too.
  yield* other.update(painted(0x00ff00));
  expect(frames.subscribers()).toBe(2);
  yield* advanceFrames(frames, 3, 16);
  expect(renderers.created().map((renderer) => renderer.renders())).toEqual([2, 2]);
}

function frameModeTests() {
  let current = sceneTestRuntime();
  beforeEach(() => {
    current = sceneTestRuntime();
  });
  afterEach(() => current.runtime.dispose());

  test('an idle demand scene unsubscribes; changes and tweens wake it, and it sleeps again', () =>
    current.runtime.runPromise(
      Effect.gen(() => idleSceneSleepsUntilSomethingChanges(current.frames)).pipe(Effect.scoped),
    ));
  test('always draws every frame; never draws only on advance', () =>
    current.runtime.runPromise(
      Effect.gen(() => alwaysAndNeverModes(current.frames)).pipe(Effect.scoped),
    ));
  test('a shared resource changed by another scene wakes a sleeping scene', () =>
    current.runtime.runPromise(
      Effect.gen(() => sharedChangeElsewhereWakesASleepingScene(current.frames)).pipe(
        Effect.scoped,
      ),
    ));
}

describe('frame modes', frameModeTests);
