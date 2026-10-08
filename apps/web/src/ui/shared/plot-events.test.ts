import { Effect, Exit, Scope, Stream } from 'effect';
import { expect, it, onTestFinished, vi } from 'vitest';

import { pointerPositions, widthChanges } from './plot-events';

it('samples the current client rectangle on every event and removes its scoped listener', async () => {
  const element = document.createElement('div');
  let rect = new DOMRect(300, 200, 400, 180);
  vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => rect);
  const added = vi.spyOn(element, 'addEventListener');
  const removed = vi.spyOn(element, 'removeEventListener');
  const values: unknown[] = [];
  const scope = Effect.runSync(Scope.make());
  onTestFinished(() => Effect.runPromise(Scope.close(scope, Exit.void)));
  Effect.runFork(
    Stream.runForEach(pointerPositions(element), (value) =>
      Effect.sync(() => values.push(value)),
    ).pipe(Effect.forkIn(scope)),
  );
  await vi.waitFor(() => expect(added).toHaveBeenCalled());
  element.dispatchEvent(
    new PointerEvent('pointermove', { clientX: 350, clientY: 240, screenX: 999, screenY: 888 }),
  );
  await vi.waitFor(() => expect(values).toHaveLength(1));
  rect = new DOMRect(20, 10, 200, 90);
  element.dispatchEvent(
    new PointerEvent('pointermove', { clientX: 350, clientY: 240, screenX: 999, screenY: 888 }),
  );
  await vi.waitFor(() =>
    expect(values).toEqual([
      { clientX: 350, clientY: 240, left: 300, top: 200, width: 400, height: 180 },
      { clientX: 350, clientY: 240, left: 20, top: 10, width: 200, height: 90 },
    ]),
  );
  await Effect.runPromise(Scope.close(scope, Exit.void));
  expect(removed).toHaveBeenCalledWith(
    'pointermove',
    added.mock.calls[0]?.[1],
    added.mock.calls[0]?.[2],
  );
  element.dispatchEvent(new PointerEvent('pointermove'));
  expect(values).toHaveLength(2);
});

it('recovers from zero width, filters invalid measurements and disconnects on scope close', async () => {
  const element = document.createElement('div');
  let callback: ResizeObserverCallback = () => {};
  const disconnect = vi.fn();
  const observe = vi.fn();
  class Observer {
    constructor(cb: ResizeObserverCallback) {
      callback = cb;
    }
    observe = observe;
    disconnect = disconnect;
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', Observer);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  const values: number[] = [];
  const scope = Effect.runSync(Scope.make());
  onTestFinished(() => Effect.runPromise(Scope.close(scope, Exit.void)));
  Effect.runFork(
    Stream.runForEach(widthChanges(element), (width) => Effect.sync(() => values.push(width))).pipe(
      Effect.forkIn(scope),
    ),
  );
  await vi.waitFor(() => expect(observe).toHaveBeenCalledWith(element));
  const notifyWidth = (width: number) =>
    callback(
      [
        {
          target: element,
          contentRect: new DOMRect(0, 0, width, 100),
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      { observe, disconnect, unobserve() {} },
    );
  for (const width of [0, -1, NaN, Infinity, 320]) notifyWidth(width);
  await vi.waitFor(() => expect(values).toEqual([320]));
  notifyWidth(390);
  await vi.waitFor(() => expect(values).toEqual([320, 390]));
  await Effect.runPromise(Scope.close(scope, Exit.void));
  expect(disconnect).toHaveBeenCalledTimes(1);
});
