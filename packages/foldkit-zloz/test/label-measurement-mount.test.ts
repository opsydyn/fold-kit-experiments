import { afterEach, expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Window } from 'happy-dom';

import { bindLabelMeasurement } from '../src/label-measurement-mount';

const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});
function fixture() {
  const window = new Window();
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
  const document = globalThis.document;
  const scope = document.createElement('div');
  scope.setAttribute('data-zloz-label-measurement-scope', '');
  scope.innerHTML =
    '<div data-zloz-measured-label="a"></div><div data-zloz-label-measurement-scope><div data-zloz-measured-label="a"></div></div><span></span>';
  document.body.append(scope);
  const target = scope.firstElementChild,
    probe = scope.lastElementChild;
  assert(target && probe);
  let callback: ResizeObserverCallback | undefined,
    disconnects = 0;
  const observed: Element[] = [];
  let instance: ResizeObserver | undefined;
  Object.defineProperty(window, 'ResizeObserver', {
    value: class implements ResizeObserver {
      constructor(next: ResizeObserverCallback) {
        callback = next;
        instance = this;
      }
      observe(element: Element) {
        observed.push(element);
      }
      unobserve() {}
      disconnect() {
        disconnects++;
      }
    },
  });
  let ready: () => void = () => {};
  Object.defineProperty(document, 'fonts', {
    value: {
      ready: new Promise<void>((resolve) => {
        ready = resolve;
      }),
    },
  });
  const batches: Parameters<Parameters<typeof bindLabelMeasurement>[2]>[0][] = [];
  const send = (inlineSize = 133.75, blockSize = 32.5) => {
    assert(callback && instance);
    const size = { inlineSize, blockSize };
    callback(
      [
        {
          target,
          borderBoxSize: [size],
          contentBoxSize: [{ inlineSize: inlineSize - 10, blockSize: blockSize - 6 }],
          devicePixelContentBoxSize: [],
          contentRect: {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: inlineSize - 10,
            bottom: blockSize - 6,
            width: inlineSize - 10,
            height: blockSize - 6,
            toJSON: () => ({}),
          },
        },
      ],
      instance,
    );
  };
  return {
    window,
    document,
    scope,
    target,
    probe,
    batches,
    ready,
    send,
    observed,
    disconnects: () => disconnects,
  };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
test('native measurement waits for fonts, uses fractional border boxes, isolates nested hosts and releases after one batch', async () => {
  const f = fixture(),
    release = bindLabelMeasurement(f.probe, ['a'], (batch) => f.batches.push(batch));
  expect(f.observed).toEqual([]);
  f.ready();
  await tick();
  expect(f.observed).toEqual([f.target]);
  f.send();
  expect(f.batches).toEqual([
    { type: 'measured', labels: [{ id: 'a', size: { width: 133.75, height: 32.5 } }] },
  ]);
  expect(f.disconnects()).toBe(1);
  f.send(999, 99);
  release();
  expect(f.batches).toHaveLength(1);
  expect(f.disconnects()).toBe(1);
});
test('cancel while fonts load never observes; timeout and missing/invalid targets fail without emitting usable bounds', async () => {
  const cancelled = fixture(),
    release = bindLabelMeasurement(cancelled.probe, ['a'], (batch) =>
      cancelled.batches.push(batch),
    );
  release();
  cancelled.ready();
  await tick();
  expect(cancelled.observed).toEqual([]);
  expect(cancelled.batches).toEqual([]);
  const timeout = fixture();
  bindLabelMeasurement(timeout.probe, ['a'], (batch) => timeout.batches.push(batch), 5);
  await new Promise((resolve) => setTimeout(resolve, 15));
  timeout.ready();
  await tick();
  expect(timeout.observed).toEqual([]);
  expect(timeout.batches).toEqual([
    { type: 'failed', reason: 'Label measurement timed out. Previous preview preserved.' },
  ]);
  const missing = fixture();
  bindLabelMeasurement(missing.probe, ['missing'], (batch) => missing.batches.push(batch));
  missing.ready();
  await tick();
  expect(missing.batches).toEqual([
    { type: 'failed', reason: 'Render every requested label before measuring.' },
  ]);
  const invalid = fixture();
  bindLabelMeasurement(invalid.probe, ['a'], (batch) => invalid.batches.push(batch));
  invalid.ready();
  await tick();
  invalid.send(0, 10);
  expect(invalid.batches).toEqual([
    { type: 'failed', reason: 'Label bounds must be visible, positive and finite.' },
  ]);
  expect(invalid.disconnects()).toBe(1);
});
test('vertical writing maps inline/block dimensions to physical world width and height', async () => {
  const f = fixture();
  f.target.setAttribute('style', 'writing-mode:vertical-rl');
  bindLabelMeasurement(f.probe, ['a'], (batch) => f.batches.push(batch));
  f.ready();
  await tick();
  f.send(31.25, 144.5);
  expect(f.batches).toEqual([
    { type: 'measured', labels: [{ id: 'a', size: { width: 144.5, height: 31.25 } }] },
  ]);
});
