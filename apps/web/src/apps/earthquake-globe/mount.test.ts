import { Effect, Schema } from 'effect';
import { expect, it } from 'vitest';

import { Message } from './message';
import { forwardGlobePointers, pointerEventName } from './mount';

it('forwards real pointer identities and fresh measurements, then removes all listeners', async () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let width = 300;
  svg.getBoundingClientRect = () => new DOMRect(0, 0, width, width);
  const messages: Message[] = [];
  svg.addEventListener(pointerEventName, (event) => {
    if (event instanceof CustomEvent)
      messages.push(Schema.decodeUnknownSync(Message)(event.detail));
  });
  const exercise = Effect.gen(function* () {
    yield* forwardGlobePointers(svg);
    svg.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 20, clientY: 30 }),
    );
    width = 600;
    svg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, button: 0 }));
    svg.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
    expect(messages).toEqual([
      Message.StartedGlobePointer({
        pointerId: 1,
        clientX: 20,
        clientY: 30,
        renderedBaseRadius: 130,
      }),
      Message.StartedGlobePointer({
        pointerId: 2,
        clientX: 0,
        clientY: 0,
        renderedBaseRadius: 260,
      }),
      Message.EndedGlobePointer({ pointerId: 1 }),
    ]);
  });
  await Effect.runPromise(exercise.pipe(Effect.scoped));
  svg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, button: 0 }));
  expect(messages).toHaveLength(3);
});
