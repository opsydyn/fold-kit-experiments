import { Effect, Stream } from 'effect';
import { expect, it, vi } from 'vitest';

import { Message } from './message';
import { radarInput } from './mount';

it('measures each start, streams qualified pointer facts, and tears down the SVG input', async () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  let width = 300;
  svg.getBoundingClientRect = () => new DOMRect(0, 0, width, width);
  const added = vi.spyOn(svg, 'addEventListener');
  const removed = vi.spyOn(svg, 'removeEventListener');
  const facts = Effect.runPromise(radarInput(svg).pipe(Stream.take(6), Stream.runCollect));
  await vi.waitFor(() => expect(added).toHaveBeenCalledTimes(7));

  svg.dispatchEvent(
    new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 20, clientY: 30 }),
  );
  width = 600;
  svg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, button: 0 }));
  svg.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, button: 2 }));
  svg.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 25, clientY: 35 }));
  svg.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
  svg.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 2 }));
  const marker = document.createElementNS(svg.namespaceURI, 'g');
  marker.setAttribute('data-blip-id', 'entry');
  svg.append(marker);
  marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(await facts).toEqual([
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
    Message.ClickedBlip({ id: 'entry', keyboard: false }),
  ]);
  expect(removed.mock.calls).toEqual(added.mock.calls);
});

it('cancels the default action only for navigation keys on the SVG itself', async () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const child = document.createElementNS(svg.namespaceURI, 'g');
  svg.append(child);
  const added = vi.spyOn(svg, 'addEventListener');
  const facts = Effect.runPromise(radarInput(svg).pipe(Stream.take(2), Stream.runCollect));
  await vi.waitFor(() => expect(added).toHaveBeenCalledTimes(7));
  function press(target: Element, key: string, options: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }
  expect(press(svg, 'x')).toBe(false);
  expect(press(svg, '+', { ctrlKey: true })).toBe(false);
  expect(press(svg, '-', { metaKey: true })).toBe(false);
  expect(press(svg, 'ArrowLeft', { altKey: true })).toBe(false);
  expect(press(child, 'ArrowLeft')).toBe(false);
  expect(press(svg, 'ArrowRight')).toBe(true);
  expect(press(svg, '+', { shiftKey: true })).toBe(true);
  expect(await facts).toEqual([
    Message.PressedRadarKey({ key: 'ArrowRight' }),
    Message.PressedRadarKey({ key: '+' }),
  ]);
  expect(press(svg, 'ArrowRight')).toBe(false);
});
