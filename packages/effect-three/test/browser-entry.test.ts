import { expect, test } from 'bun:test';

import { makeEnvironment } from '@opsydyn/effect-three/browser';

function frameHost() {
  const pending = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  function requestAnimationFrame(frame: FrameRequestCallback): number {
    const id = ++nextFrame;
    pending.set(id, frame);
    return id;
  }
  const host = {
    devicePixelRatio: 1,
    matchMedia: () => {
      throw new Error('creating an environment should not watch media queries');
    },
    requestAnimationFrame,
    cancelAnimationFrame: (id: number) => {
      pending.delete(id);
    },
  };
  return { host, pending };
}

test('a browser environment shares one frame loop and releases it after the final subscriber', () => {
  const { host, pending } = frameHost();
  const environment = makeEnvironment(host);
  const first = environment.frames.subscribe(() => {});
  const second = environment.frames.subscribe(() => {});
  expect(pending.size).toBe(1);
  first();
  expect(pending.size).toBe(1);
  second();
  expect(pending.size).toBe(0);
  environment.dispose();
});
