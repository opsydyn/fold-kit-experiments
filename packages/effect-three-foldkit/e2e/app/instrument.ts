/**
 * Test instrumentation, loaded before the app: counts active DOM observers and exposes
 * counters the browser test reads through `window.__probe`. Pointer listeners are read
 * through the Chrome DevTools Protocol instead.
 */

export type Probe = {
  updates: number;
  resizeObservers: number;
  intersectionObservers: number;
  stats: () => unknown;
};

export const probe: Probe = {
  updates: 0,
  resizeObservers: 0,
  intersectionObservers: 0,
  stats: () => undefined,
};

Reflect.set(globalThis, '__probe', probe);

class CountingResizeObserver extends ResizeObserver {
  override observe(target: Element, options?: ResizeObserverOptions): void {
    probe.resizeObservers++;
    super.observe(target, options);
  }
  override disconnect(): void {
    probe.resizeObservers--;
    super.disconnect();
  }
}

class CountingIntersectionObserver extends IntersectionObserver {
  override observe(target: Element): void {
    probe.intersectionObservers++;
    super.observe(target);
  }
  override disconnect(): void {
    probe.intersectionObservers--;
    super.disconnect();
  }
}

globalThis.ResizeObserver = CountingResizeObserver;
globalThis.IntersectionObserver = CountingIntersectionObserver;
