/**
 * Test environment for the Effect runtime: a fresh resource registry, a manual frame
 * scheduler and the TestClock, so frames and time are fully deterministic.
 */
import { Duration, Layer, ManagedRuntime } from 'effect';
import { TestClock } from 'effect/testing';

import { createManualFrames, type ManualFrames } from '../../src/kernel/index.ts';
import { FrameSource, ResourceRegistry } from '../../src/runtime/index.ts';

export const environment = (frames: ManualFrames) =>
  Layer.mergeAll(ResourceRegistry.layer, FrameSource.layer(frames), TestClock.layer());

/** A fresh deterministic runtime and its manual frame scheduler. Dispose after each test. */
export const sceneTestRuntime = () => {
  const frames = createManualFrames();
  return { frames, runtime: ManagedRuntime.make(environment(frames)) };
};

/** Advances the clock by `milliseconds` and runs one frame, `count` times. */
export function* advanceFrames(frames: ManualFrames, count: number, milliseconds: number) {
  for (let frame = 0; frame < count; frame++) {
    yield* TestClock.adjust(Duration.millis(milliseconds));
    frames.step();
  }
}
