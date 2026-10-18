import { expect, test } from 'bun:test';

import { glide } from '@opsydyn/effect-three';

import { floorFacing, glideFrame, startGlider } from '../src/dom/xrGlide.ts';

const ahead = floorFacing({ x: 0, y: 0, z: 0, w: 1 });
const rest = { move: [0, 0], turn: [0, 0] } as const;
const near = (values: ReadonlyArray<number>) => values.map((v) => Math.round(v * 1e9) / 1e9 || 0);

test('the head looking ahead faces −z on the floor; turned left, −x', () => {
  expect(near(ahead)).toEqual([0, -1]);
  // A quarter turn left about y.
  expect(near(floorFacing({ x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }))).toEqual([-1, 0]);
});

test('the left stick glides along where the head faces, at speed', () => {
  const start = startGlider({ origin: [0, 0, 0], heading: 0 });
  const forward = glideFrame(start, glide(), { ...rest, move: [0, -1] }, ahead, 0.5);
  // 2 m/s for half a second, straight ahead.
  expect(near(forward.glider.pose.origin)).toEqual([0, 0, -1]);
  expect(forward.stopped).toBeUndefined();
  const right = glideFrame(start, glide(), { ...rest, move: [1, 0] }, ahead, 0.5);
  expect(near(right.glider.pose.origin)).toEqual([1, 0, 0]);
  // A stick resting a little off centre does nothing.
  const drift = glideFrame(start, glide(), { ...rest, move: [0.05, -0.1] }, ahead, 0.5);
  expect(drift.glider.pose).toEqual(start.pose);
});

test('letting go reports where the glide ended, once', () => {
  const start = startGlider({ origin: [0, 0, 0], heading: 0 });
  const gliding = glideFrame(start, glide(), { ...rest, move: [0, -1] }, ahead, 0.5).glider;
  const stopped = glideFrame(gliding, glide(), rest, ahead, 1 / 60);
  expect(stopped.stopped).toEqual({ origin: [0, 0, -1], heading: 0 });
  expect(glideFrame(stopped.glider, glide(), rest, ahead, 1 / 60).stopped).toBeUndefined();
});

test('snap turns turn once per push; smooth turns turn with time', () => {
  const start = startGlider({ origin: [0, 0, 0], heading: 0 });
  const pushed = glideFrame(start, glide(), { ...rest, turn: [1, 0] }, ahead, 1 / 60).glider;
  expect(pushed.pose.heading).toBeCloseTo(-Math.PI / 4, 9);
  const held = glideFrame(pushed, glide(), { ...rest, turn: [1, 0] }, ahead, 1 / 60);
  expect(held.glider.pose.heading).toBeCloseTo(-Math.PI / 4, 9);
  // Back to the middle: the snap is reported, and ready again.
  const released = glideFrame(held.glider, glide(), rest, ahead, 1 / 60);
  expect(released.stopped?.heading).toBeCloseTo(-Math.PI / 4, 9);
  const again = glideFrame(released.glider, glide(), { ...rest, turn: [-1, 0] }, ahead, 1 / 60);
  expect(again.glider.pose.heading).toBeCloseTo(0, 9);

  const smooth = glideFrame(
    start,
    glide({ turn: 'smooth' }),
    { ...rest, turn: [1, 0] },
    ahead,
    0.5,
  );
  expect(smooth.glider.pose.heading).toBeCloseTo(-1, 9);
});
