import { expect, test } from 'bun:test';

import { createPerformanceMonitor, type PerformanceChange } from '../src/kernel/index.ts';

/** Feeds `frames` frames `intervalMs` apart from `start`; returns every change and the end time. */
const run = (
  monitor: ReturnType<typeof createPerformanceMonitor>,
  start: number,
  frames: number,
  intervalMs: number,
): { readonly changes: ReadonlyArray<PerformanceChange>; readonly end: number } => {
  const changes: Array<PerformanceChange> = [];
  let time = start;
  for (let i = 0; i < frames; i++) {
    time += intervalMs;
    const change = monitor.sample(time);
    if (change !== undefined) changes.push(change);
  }
  return { changes, end: time };
};

test('slow frames step the factor down once per decision; fast frames step it back up', () => {
  const monitor = createPerformanceMonitor({ idleMs: 1000 });
  // 30 fps: each 250 ms window takes 8 frames, so 200 frames make two decisions of ten.
  const slow = run(monitor, 0, 200, 1000 / 30);
  expect(slow.changes.map((change) => change.factor)).toEqual([0.9, 0.8]);
  expect(slow.changes[0]?.fps).toBeLessThan(40);

  // 60 fps recovers it: the refresh rate seen is 60, so the upper bound is 60.
  // (The first decision still holds a few slow windows, so recovery takes a little longer.)
  const fast = run(monitor, slow.end, 600, 1000 / 61);
  expect(fast.changes.map((change) => change.factor)).toEqual([0.9, 1]);
  expect(monitor.factor()).toBe(1);
});

test('between the bounds nothing changes, and the factor never rises above 1', () => {
  const monitor = createPerformanceMonitor();
  expect(run(monitor, 0, 300, 20).changes).toEqual([]);
  expect(run(monitor, 6000, 600, 1000 / 70).changes).toEqual([]);
});

test('an idle pause restarts measurement instead of counting as one slow frame', () => {
  const monitor = createPerformanceMonitor();
  let time = 0;
  const changes: Array<PerformanceChange> = [];
  // Bursts of 60 fps with long sleeps between them, as an on-demand scene draws.
  for (let burst = 0; burst < 40; burst++) {
    const { changes: found, end } = run(monitor, time, 30, 1000 / 60);
    changes.push(...found);
    time = end + 2000;
  }
  expect(changes).toEqual([]);
  expect(monitor.factor()).toBe(1);
});
