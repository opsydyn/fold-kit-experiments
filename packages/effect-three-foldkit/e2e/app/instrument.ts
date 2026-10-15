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
  /** GPU memory of the most recently created renderer. */
  rendererMemory: () => unknown;
  /** `defaultPrevented` of each context menu, read after the scene's listener ran. */
  contextMenus: Array<boolean>;
  /** Calls to `requestAnimationFrame`: they stop when no scene wants frames. */
  frameRequests: number;
};

export const probe: Probe = {
  updates: 0,
  resizeObservers: 0,
  intersectionObservers: 0,
  stats: () => undefined,
  rendererMemory: () => undefined,
  contextMenus: [],
  frameRequests: 0,
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

window.addEventListener('contextmenu', (event) => {
  probe.contextMenus.push(event.defaultPrevented);
});

const requestFrame = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (callback) => {
  probe.frameRequests++;
  return requestFrame(callback);
};
