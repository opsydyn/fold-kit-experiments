import { expect, test } from 'bun:test';

import { createGatedFrames, createManualFrames, createSceneClock } from '../src/kernel/index.ts';

test('a frozen scene clock resumes from where it stopped', () => {
  let now = 100;
  const clock = createSceneClock(() => now);
  now = 103;
  expect(clock.elapsedSeconds()).toBe(3);
  clock.setAnimating(false);
  clock.setAnimating(false);
  now = 110;
  expect(clock.elapsedSeconds()).toBe(3);
  expect(clock.animating()).toBe(false);
  clock.setAnimating(true);
  clock.setAnimating(true);
  now = 112;
  expect(clock.elapsedSeconds()).toBe(5);
  expect(clock.animating()).toBe(true);
});

test('gated frames pass only while open and unsubscribe from the base', () => {
  const base = createManualFrames();
  const gated = createGatedFrames(base);
  let frames = 0;
  const unsubscribe = gated.subscribe(() => {
    frames++;
  });
  base.step();
  gated.setOpen(false);
  base.step();
  gated.setOpen(true);
  base.step();
  expect(frames).toBe(2);
  unsubscribe();
  expect(base.subscribers()).toBe(0);
});
