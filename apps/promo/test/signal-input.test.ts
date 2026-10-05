// Browser boundary doubles intentionally narrow the DOM interfaces consumed by this module.
/* oxlint-disable anti-slop/no-chained-type-assertions */
import { expect, test } from 'bun:test';

import { Effect, Fiber, Stream } from 'effect';

import { signalInputFacts } from '../src/examples/signals/input';
import type { Message } from '../src/examples/signals/message';
class SVGTarget extends EventTarget {
  surface = {};
  querySelector() {
    return this.surface;
  }
  width = 700;
  matrix: { a: number; b: number; c: number; d: number; e: number; f: number } | null = {
    a: 2,
    b: 0,
    c: 0,
    d: 3,
    e: 10,
    f: 30,
  };
  captured = new Set<number>();
  failCapture = false;
  added = 0;
  removed = 0;
  override addEventListener(...args: Parameters<EventTarget['addEventListener']>) {
    this.added++;
    super.addEventListener(...args);
  }
  override removeEventListener(...args: Parameters<EventTarget['removeEventListener']>) {
    this.removed++;
    super.removeEventListener(...args);
  }
  getScreenCTM() {
    return this.matrix;
  }
  getBoundingClientRect() {
    return { width: this.width };
  }
  setPointerCapture(id: number) {
    if (this.failCapture) throw new RangeError('Capture unavailable');
    this.captured.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captured.has(id);
  }
  releasePointerCapture(id: number) {
    this.captured.delete(id);
  }
  emit(type: string, pointerId = 1, owned = true) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      pointerId: { value: pointerId },
      clientX: { value: 30 },
      clientY: { value: 60 },
      button: { value: 0 },
      target: {
        value: owned ? this.surface : null,
      },
    });
    this.dispatchEvent(event);
    return event;
  }
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function harness(
  run: (svg: SVGTarget, facts: Message[], resize: () => void) => Promise<void>,
) {
  const previous = globalThis.ResizeObserver;
  let disconnected = false;
  let callback: (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void = () => {};
  class Observer {
    constructor(cb: typeof callback) {
      callback = cb;
    }
    observe() {}
    disconnect() {
      disconnected = true;
    }
  }
  // SAFETY: This instrumented browser boundary implements the exact fields consumed by input.
  globalThis.ResizeObserver = Observer as unknown as typeof ResizeObserver;
  const svg = new SVGTarget(),
    facts: Message[] = [];
  // SAFETY: SVGTarget supplies screen matrix, capture, resize and listener methods consumed by input.
  const fiber = Effect.runFork(
    Stream.runForEach(signalInputFacts(svg as unknown as SVGSVGElement, 'latency'), (m) =>
      Effect.sync(() => {
        facts.push(m);
      }),
    ),
  );
  await tick();
  await run(svg, facts, () => callback([{ contentRect: { width: svg.width } }])).finally(
    async () => {
      await Effect.runPromise(Fiber.interrupt(fiber));
      globalThis.ResizeObserver = previous;
    },
  );
  expect(disconnected).toBe(true);
  expect(svg.removed).toBe(svg.added);
  expect(svg.captured.size).toBe(0);
  const count = facts.length;
  svg.emit('pointermove');
  await tick();
  expect(facts).toHaveLength(count);
}
test('fresh SVG matrix conversion emits plain facts and recovers hidden input', async () => {
  await harness(async (svg, facts, resize) => {
    svg.emit('pointerdown');
    await tick();
    expect(facts.find((m) => m._tag === 'StartedChartPointer')).toEqual({
      _tag: 'StartedChartPointer',
      role: 'latency',
      pointerId: 1,
      x: 10,
      y: 10,
    });
    svg.matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    svg.emit('pointermove');
    await tick();
    expect(facts.at(-1)).toEqual({
      _tag: 'MovedChartPointer',
      role: 'latency',
      pointerId: 1,
      x: 30,
      y: 60,
    });
    svg.matrix = null;
    svg.emit('pointermove');
    await tick();
    expect(facts.at(-1)).toMatchObject({
      _tag: 'RecordedInputAvailability',
      status: 'Unavailable',
    });
    svg.matrix = { a: 1, b: 2, c: 2, d: 4, e: 0, f: 0 };
    svg.emit('pointermove');
    await tick();
    expect(facts.at(-1)).toMatchObject({ status: 'Unavailable' });
    svg.matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    svg.width = 0;
    resize();
    await tick();
    expect(facts.at(-1)).toMatchObject({ status: 'Unavailable' });
    svg.width = 390;
    resize();
    await tick();
    expect(facts).toContainEqual({ _tag: 'RecordedChartWidth', role: 'latency', width: 390 });
    expect(facts.at(-1)).toMatchObject({ status: 'Ready' });
  });
});
test('capture failures cancellation and second pointers stay facts and teardown releases resources', async () => {
  await harness(async (svg, facts) => {
    const margin = svg.emit('pointerdown', 1, false);
    await tick();
    expect(margin.defaultPrevented).toBe(false);
    expect(facts.some((m) => m._tag === 'StartedChartPointer')).toBe(false);
    svg.failCapture = true;
    svg.emit('pointerdown');
    await tick();
    expect(facts.at(-1)).toEqual({ _tag: 'CancelledChartPointer', role: 'latency', pointerId: 1 });
    svg.failCapture = false;
    const down = svg.emit('pointerdown');
    svg.emit('pointerdown', 2);
    await tick();
    expect(down.defaultPrevented).toBe(true);
    expect(facts.filter((m) => m._tag === 'StartedChartPointer')).toHaveLength(2);
    svg.emit('pointercancel', 2);
    await tick();
    expect(facts.at(-1)).toEqual({ _tag: 'CancelledChartPointer', role: 'latency', pointerId: 2 });
    svg.emit('pointerup', 1);
    svg.emit('lostpointercapture', 1);
    await tick();
    const ended = facts.findIndex((m) => m._tag === 'EndedChartPointer');
    const cancelled = facts.findLastIndex((m) => m._tag === 'CancelledChartPointer');
    expect(cancelled).toBeGreaterThan(ended);
    svg.emit('pointerdown', 3);
    await tick();
    expect(svg.captured.has(3)).toBe(true);
  });
});
