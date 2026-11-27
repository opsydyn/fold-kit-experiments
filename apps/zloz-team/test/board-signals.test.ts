import { expect, test } from 'bun:test';

import { Effect, Stream } from 'effect';

import { motionChangeEvent, motionQuery } from '../src/appearance/preferences';
import { boardWidths, historyMotion, historyVisibility } from '../src/editor/browser-signals';

class WatchedTarget extends EventTarget {
  activeListeners = 0;

  override addEventListener(...args: Parameters<EventTarget['addEventListener']>) {
    this.activeListeners += 1;
    super.addEventListener(...args);
  }

  override removeEventListener(...args: Parameters<EventTarget['removeEventListener']>) {
    this.activeListeners -= 1;
    super.removeEventListener(...args);
  }
}

test('browser signals read their initial state, report changes, and release their listeners', async () => {
  const initialWindow = globalThis.window;
  const initialDocument = globalThis.document;
  const compact = Object.assign(new WatchedTarget(), { matches: false });
  const systemMotion = Object.assign(new WatchedTarget(), { matches: false });
  const page = Object.assign(new WatchedTarget(), {
    visibilityState: 'visible',
    documentElement: { dataset: {} },
    querySelector: () => null,
  });
  // SAFETY: borrow the browser APIs used by the streams for this fixture.
  Object.assign(globalThis, {
    window: { matchMedia: (query: string) => (query === motionQuery ? systemMotion : compact) },
    document: page,
  });

  const collect = (stream: Stream.Stream<boolean>, initial: boolean) => {
    const first = Promise.withResolvers<boolean>();
    const run = Effect.runPromise(
      stream.pipe(
        Stream.take(2),
        Stream.tap((value) => Effect.sync(() => first.resolve(value))),
        Stream.runCollect,
      ),
    );
    return { first: first.promise.then((value) => expect(value).toBe(initial)), run };
  };

  // oxlint-disable-next-line linteffect/no-try-catch -- restore the borrowed browser APIs.
  try {
    const widths = collect(boardWidths(), false);
    const motion = collect(historyMotion(), false);
    const visibility = collect(historyVisibility(), true);
    await Promise.all([widths.first, motion.first, visibility.first]);

    compact.matches = true;
    compact.dispatchEvent(new Event('change'));
    page.dispatchEvent(new CustomEvent(motionChangeEvent, { detail: 'reduce' }));
    page.visibilityState = 'hidden';
    page.dispatchEvent(new Event('visibilitychange'));

    expect(await widths.run).toEqual([false, true]);
    expect(await motion.run).toEqual([false, true]);
    expect(await visibility.run).toEqual([true, false]);
    expect(compact.activeListeners).toBe(0);
    expect(systemMotion.activeListeners).toBe(0);
    expect(page.activeListeners).toBe(0);
  } finally {
    Object.assign(globalThis, { window: initialWindow, document: initialDocument });
  }
}, 3000);
