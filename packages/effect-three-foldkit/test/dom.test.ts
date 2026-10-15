import { expect, test } from 'bun:test';

import {
  box,
  createResourceStore,
  createSceneGraph,
  mesh,
  scene,
  standard,
} from '@opsydyn/effect-three';

import { animationFrameScheduler } from '../src/dom/animationFrames.ts';
import { createLatch, whileOpen } from '../src/dom/latch.ts';
import { toNdc } from '../src/dom/pointer.ts';
import { interceptProperty } from '../src/dom/property.ts';
import { summarise } from '../src/dom/reconciled.ts';
import { markTyped, typedScene } from '../src/dom/typedScenes.ts';

test('client coordinates map to normalised device coordinates', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };
  expect(toNdc(rect, 100, 50)).toEqual({ x: -1, y: 1 });
  expect(toNdc(rect, 300, 150)).toEqual({ x: 1, y: -1 });
  expect(toNdc(rect, 200, 100)).toEqual({ x: 0, y: -0 });
  expect(toNdc({ left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toEqual({ x: 0, y: 0 });
});

test('property interception sees the initial value, every set, and restores a data property', () => {
  const element: Record<string, unknown> = { scene: 'first' };
  const seen: Array<unknown> = [];
  const intercepted = interceptProperty(element, 'scene', (value) => seen.push(value));
  expect(intercepted.initial).toBe('first');
  element['scene'] = 'second';
  element['scene'] = 'third';
  expect(seen).toEqual(['second', 'third']);
  expect(element['scene']).toBe('third');
  intercepted.restore();
  element['scene'] = 'fourth';
  expect(seen).toEqual(['second', 'third']);
  expect(Object.getOwnPropertyDescriptor(element, 'scene')).toMatchObject({ value: 'fourth' });
});

/** A fake `requestAnimationFrame` host whose frames run on demand. */
function fakeFrameHost() {
  const pending = new Map<number, () => void>();
  let nextHandle = 0;
  function requestAnimationFrame(callback: FrameRequestCallback): number {
    nextHandle++;
    pending.set(nextHandle, () => callback(0));
    return nextHandle;
  }
  function runFrame(): void {
    const callbacks = [...pending.values()];
    pending.clear();
    for (const callback of callbacks) callback();
  }
  const cancelAnimationFrame = (handle: number): void => {
    pending.delete(handle);
  };
  return { host: { requestAnimationFrame, cancelAnimationFrame }, runFrame, pending };
}

test('one animation-frame loop serves every subscriber and stops with the last', () => {
  const { host, runFrame, pending } = fakeFrameHost();
  const scheduler = animationFrameScheduler(host);
  let a = 0;
  let b = 0;
  const stopA = scheduler.subscribe(() => a++);
  const stopB = scheduler.subscribe(() => b++);
  expect(pending.size).toBe(1);
  runFrame();
  runFrame();
  stopA();
  runFrame();
  expect([a, b]).toEqual([2, 3]);
  stopB();
  expect(pending.size).toBe(0);
});

test('whileOpen drops calls while the latch is closed', () => {
  const latch = createLatch(true);
  const calls: Array<number> = [];
  const forward = whileOpen(latch, (value: number) => calls.push(value));
  forward(1);
  latch.set(false);
  forward(2);
  latch.set(true);
  forward(3);
  expect(calls).toEqual([1, 3]);
});

test('only scenes marked by the typed view skip decoding', () => {
  const marked = markTyped(scene({}));
  expect(typedScene(marked)).toBe(marked);
  expect(typedScene(scene({}))).toBeUndefined();
  expect(typedScene('not a scene')).toBeUndefined();
  expect(typedScene(null)).toBeUndefined();
});

test('reconciled summaries count operations by kind', () => {
  const store = createResourceStore();
  const graph = createSceneGraph({ store });
  const first = graph.reconcile(
    scene({ children: [mesh({ key: 'a', geometry: box(), material: standard({ color: 1 }) })] }),
  );
  if (first._tag !== 'Applied') throw new Error('expected Applied');
  expect(summarise(first.ops, store.stats())).toEqual({
    ops: { created: 1, updated: 0, moved: 0, removed: 0, replaced: 0, reordered: 0, configured: 2 },
    resources: {
      geometries: { live: 1, created: 1, disposed: 0 },
      materials: { live: 1, created: 1, disposed: 0 },
    },
  });
});
