/* DOM callbacks are the scoped Mount I/O boundary, not Model transitions. */
/* oxlint-disable linteffect/no-if-statement, linteffect/no-magic-domain-string, linteffect/no-return-in-arrow, linteffect/no-string-sentinel-const */
import { Effect, Match } from 'effect';
import { CustomElement, Mount } from 'foldkit';

import { Message } from './message';

export const pointerEventName = 'foldkit-globe-pointer';
export const globeEvents = CustomElement.define({
  tag: 'foldkit-globe-input',
  properties: {},
  events: { [pointerEventName]: Message },
});

export const forwardGlobePointers = Effect.fn('forwardGlobePointers')(function* (element: Element) {
  const acquire = Effect.sync(() => {
    const listeners: ReadonlyArray<readonly [string, EventListener]> = [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'pointerleave',
    ].map((name) => [
      name,
      (event: Event) => {
        if (!(event instanceof PointerEvent)) return;
        if (name === 'pointerdown' && event.button !== 0) return;
        const identity = { pointerId: event.pointerId };
        const position = { ...identity, clientX: event.clientX, clientY: event.clientY };
        const message = Match.value(name).pipe(
          Match.when('pointerdown', () =>
            Message.StartedGlobePointer({
              ...position,
              renderedBaseRadius: (element.getBoundingClientRect().width * 260) / 600,
            }),
          ),
          Match.when('pointermove', () => Message.MovedGlobePointer(position)),
          Match.orElse(() => Message.EndedGlobePointer(identity)),
        );
        element.dispatchEvent(new CustomEvent(pointerEventName, { detail: message }));
      },
    ]);
    for (const [name, listener] of listeners) element.addEventListener(name, listener);
    return listeners;
  });
  yield* Effect.acquireRelease(acquire, (listeners) =>
    Effect.sync(() => {
      for (const [name, listener] of listeners) element.removeEventListener(name, listener);
    }),
  );
});
export const GlobePointerMount = Mount.define('GlobePointerMount', {
  messages: [Message.CompletedGlobePointerMount],
  execute: ({ element }) =>
    forwardGlobePointers(element).pipe(Effect.map(() => Message.CompletedGlobePointerMount())),
});
