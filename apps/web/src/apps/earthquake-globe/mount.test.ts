import { Effect, Stream } from 'effect';
import { expect, it, vi } from 'vitest';

import { Message } from './message';
import { globeInput } from './mount';

it('streams pointer identities and fresh measurements, then releases all listeners', async () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let width = 300;
  svg.getBoundingClientRect = () => new DOMRect(0, 0, width, width);
  const added = vi.spyOn(svg, 'addEventListener');
  const removed = vi.spyOn(svg, 'removeEventListener');
  const facts = Effect.runPromise(globeInput(svg).pipe(Stream.take(3), Stream.runCollect));
  await vi.waitFor(() => expect(added).toHaveBeenCalledTimes(7));

  svg.dispatchEvent(
    new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 20, clientY: 30 }),
  );
  width = 600;
  svg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, button: 0 }));
  svg.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
  expect(await facts).toEqual([
    Message.StartedGlobePointer({
      pointerId: 1,
      clientX: 20,
      clientY: 30,
      renderedBaseRadius: 130,
    }),
    Message.StartedGlobePointer({ pointerId: 2, clientX: 0, clientY: 0, renderedBaseRadius: 260 }),
    Message.EndedGlobePointer({ pointerId: 1 }),
  ]);
  expect(removed.mock.calls).toEqual(added.mock.calls);
});
