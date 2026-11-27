import { expect, test } from 'bun:test';

import { animationFrameScheduler } from '../src/browser/dom/animationFrames.ts';
import { createLatch, routedWhileOpen } from '../src/browser/dom/latch.ts';
import { toNdc, toPointerInput } from '../src/browser/dom/pointer.ts';
import { summarise } from '../src/browser/dom/reconciled.ts';
import { observePixelRatio, resolvePixelRatio } from '../src/browser/dom/viewport.ts';
import { box, createResourceStore, createSceneGraph, mesh, scene, standard } from '../src/index.ts';

test('client coordinates map to normalised device coordinates', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };
  expect(toNdc(rect, 100, 50)).toEqual({ x: -1, y: 1 });
  expect(toNdc(rect, 300, 150)).toEqual({ x: 1, y: -1 });
  expect(toNdc(rect, 200, 100)).toEqual({ x: 0, y: -0 });
  expect(toNdc({ left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toEqual({ x: 0, y: 0 });
});

/** A stand-in PointerEvent, as bun has no DOM: only what the conversion reads. */
class StandInPointerEvent {
  readonly type = 'pointerdown';
  readonly clientX = 200;
  readonly clientY = 100;
  readonly button = 0;
  readonly pointerId = 1;
  readonly shiftKey = false;
  readonly ctrlKey = false;
  readonly metaKey = false;
  readonly altKey = false;
  readonly pointerType: string;
  constructor(pointerType: string) {
    this.pointerType = pointerType;
  }
}

/** The device a press of this `pointerType` is converted with. */
function deviceOf(pointerType: string) {
  // SAFETY: the stand-in carries every MouseEvent field toPointerInput reads.
  const event = new StandInPointerEvent(pointerType) as unknown as MouseEvent;
  const input = toPointerInput(event, { left: 100, top: 50, width: 200, height: 100 });
  return input?._tag === 'PointerDown' ? input.device : undefined;
}

test('a press says what pressed: a finger, a pen, or otherwise a mouse', () => {
  const original = globalThis.PointerEvent;
  globalThis.PointerEvent = StandInPointerEvent as unknown as typeof PointerEvent;
  const devices = ['touch', 'pen', 'mouse', ''].map(deviceOf);
  globalThis.PointerEvent = original;
  expect(devices).toEqual(['touch', 'pen', 'mouse', 'mouse']);
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

test('routedWhileOpen drops input while the latch is closed and returns what it routed', () => {
  const latch = createLatch(true);
  const calls: Array<number> = [];
  const record = (value: number): ReadonlyArray<number> => [calls.push(value) && value * 10];
  const route = routedWhileOpen(latch, record);
  expect(route(1)).toEqual([10]);
  latch.set(false);
  expect(route(2)).toEqual([]);
  latch.set(true);
  expect(route(3)).toEqual([30]);
  expect(calls).toEqual([1, 3]);
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

test('pixel ratios resolve as React Three Fiber resolves dpr', () => {
  expect(resolvePixelRatio(3, [1, 2])).toBe(2);
  expect(resolvePixelRatio(0.5, [1, 2])).toBe(1);
  expect(resolvePixelRatio(1.5, [1, 2])).toBe(1.5);
  expect(resolvePixelRatio(3, 1)).toBe(1);
});

test('a pixel ratio change is reported and the watch re-arms for the new ratio', () => {
  const listeners = new Map<string, () => void>();
  const view = {
    devicePixelRatio: 1,
    matchMedia: (query: string) => ({
      addEventListener: (_type: string, listener: () => void) => listeners.set(query, listener),
      removeEventListener: (_type: string, listener: () => void) => {
        if (listeners.get(query) === listener) listeners.delete(query);
      },
    }),
  };
  let changes = 0;
  const stop = observePixelRatio(view, () => changes++);
  expect([...listeners.keys()]).toEqual(['(resolution: 1dppx)']);
  view.devicePixelRatio = 2;
  listeners.get('(resolution: 1dppx)')?.();
  expect(changes).toBe(1);
  expect([...listeners.keys()]).toEqual(['(resolution: 2dppx)']);
  stop();
  expect(listeners.size).toBe(0);
});
