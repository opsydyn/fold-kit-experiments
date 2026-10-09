import { assert, onTestFinished, vi } from 'vitest';

type Observation = {
  element: Element | null;
  disconnect: () => void;
  notify: (width: number) => void;
};

export function observeWidths() {
  const observations: Observation[] = [];
  class Observer implements ResizeObserver {
    entry: Observation;
    constructor(callback: ResizeObserverCallback) {
      this.entry = {
        element: null,
        disconnect: vi.fn(),
        notify: (width) => {
          assert(this.entry.element !== null);
          callback(
            [
              {
                target: this.entry.element,
                contentRect: new DOMRect(0, 0, width, 260),
                borderBoxSize: [],
                contentBoxSize: [],
                devicePixelContentBoxSize: [],
              },
            ],
            this,
          );
        },
      };
      observations.push(this.entry);
    }
    observe(element: Element) {
      this.entry.element = element;
    }
    disconnect() {
      this.entry.disconnect();
    }
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', Observer);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  return observations;
}
