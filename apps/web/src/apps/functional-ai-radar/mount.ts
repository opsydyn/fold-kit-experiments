/* DOM callbacks forward input facts at this scoped Mount boundary, not Model transitions. */
/* oxlint-disable linteffect/no-if-statement, linteffect/no-magic-domain-string, linteffect/no-return-in-arrow, linteffect/no-string-sentinel-const */
import { Effect, Match, type Scope } from 'effect';
import { CustomElement, Mount } from 'foldkit';

import { RADAR_BASE_RADIUS, RADAR_SIZE } from './geometry';
import { Message } from './message';

export const pointerEventName = 'foldkit-radar-pointer';
export const radarEvents = CustomElement.define({
  tag: 'foldkit-radar-input',
  properties: {},
  events: { [pointerEventName]: Message },
});
export const forwardRadarPointers = Effect.fn('forwardRadarPointers')(function* (
  element: Element,
): Effect.fn.Return<void, never, Scope.Scope> {
  const acquire = Effect.sync(() => {
    const listeners = [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
      'pointerleave',
    ].map((name): readonly [string, EventListener] => {
      const listener: EventListener = (event) => {
        if (!(event instanceof PointerEvent) || (name === 'pointerdown' && event.button !== 0))
          return;
        const identity = { pointerId: event.pointerId };
        const position = { ...identity, clientX: event.clientX, clientY: event.clientY };
        const message = Match.value(name).pipe(
          Match.when('pointerdown', () =>
            Message.StartedRadarPointer({
              ...position,
              renderedBaseRadius:
                (element.getBoundingClientRect().width * RADAR_BASE_RADIUS) / RADAR_SIZE,
            }),
          ),
          Match.when('pointermove', () => Message.MovedRadarPointer(position)),
          Match.orElse(() => Message.EndedRadarPointer(identity)),
        );
        element.dispatchEvent(new CustomEvent(pointerEventName, { detail: message }));
      };
      element.addEventListener(name, listener);
      return [name, listener];
    });
    return listeners;
  });
  yield* Effect.acquireRelease(acquire, (listeners) =>
    Effect.sync(() => {
      for (const [name, listener] of listeners) element.removeEventListener(name, listener);
    }),
  );
});
export const RadarPointerMount = Mount.define('RadarPointerMount', {
  messages: [Message.CompletedRadarPointerMount],
  execute: ({ element }) =>
    forwardRadarPointers(element).pipe(Effect.map(() => Message.CompletedRadarPointerMount())),
});
