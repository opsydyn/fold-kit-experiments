import { Effect, Schema } from 'effect';
import { expect, it } from 'vitest';

import { Message } from './message';
import { forwardRadarPointers, pointerEventName } from './mount';

it('measures each start, forwards pointer facts and removes all listeners with its scope', async () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let width = 300;
  svg.getBoundingClientRect = () => new DOMRect(0, 0, width, width);
  const messages: Message[] = [];
  svg.addEventListener(pointerEventName, (event) => {
    if (event instanceof CustomEvent)
      messages.push(Schema.decodeUnknownSync(Message)(event.detail));
  });
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* forwardRadarPointers(svg);
      svg.dispatchEvent(
        new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 20, clientY: 30 }),
      );
      width = 600;
      svg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, button: 0 }));
      svg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, button: 2 }));
      svg.dispatchEvent(
        new PointerEvent('pointermove', { pointerId: 1, clientX: 25, clientY: 35 }),
      );
      svg.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
      svg.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 2 }));
    }).pipe(Effect.scoped),
  );
  expect(messages).toEqual([
    Message.StartedRadarPointer({
      pointerId: 1,
      clientX: 20,
      clientY: 30,
      renderedBaseRadius: 130,
    }),
    Message.StartedRadarPointer({ pointerId: 2, clientX: 0, clientY: 0, renderedBaseRadius: 260 }),
    Message.MovedRadarPointer({ pointerId: 1, clientX: 25, clientY: 35 }),
    Message.EndedRadarPointer({ pointerId: 1 }),
    Message.EndedRadarPointer({ pointerId: 2 }),
  ]);
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave'])
    svg.dispatchEvent(new PointerEvent(type, { pointerId: 4, button: 0 }));
  expect(messages).toHaveLength(5);
});
