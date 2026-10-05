import { clientToLocal } from '@opsydyn/foldkit-viz/interaction/coordinates';
import { Effect, Option, Queue, Stream } from 'effect';
import { defineStream } from 'foldkit/mount';

import { Message } from './message';
import { ChartRole } from './model';

type InputFact = Extract<
  Message,
  {
    _tag:
      | 'RecordedChartWidth'
      | 'RecordedInputAvailability'
      | 'StartedChartPointer'
      | 'MovedChartPointer'
      | 'EndedChartPointer'
      | 'CancelledChartPointer';
  }
>;

/** Scoped browser resource acquisition; semantic gestures live only in Model. */
export function signalInputFacts(
  element: SVGSVGElement,
  role: ChartRole,
): Stream.Stream<InputFact> {
  return Stream.callback<InputFact>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const offer = (message: InputFact) => {
          Queue.offerUnsafe(queue, message);
        };
        const availability = (status: 'Ready' | 'Unavailable') =>
          offer(Message.RecordedInputAvailability({ role, status }));
        // This set tracks owned native capture resources for teardown, not gesture state.
        const captures = new Set<number>();
        function release(pointerId: number) {
          Effect.runSync(
            Effect.try(() => {
              if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
            }).pipe(Effect.match({ onFailure: () => undefined, onSuccess: () => undefined })),
          );
        }
        const coordinates = (event: PointerEvent) => {
          const matrix = element.getScreenCTM();
          if (matrix === null) {
            availability('Unavailable');
            return Option.none();
          }
          const numeric = {
            a: matrix.a,
            b: matrix.b,
            c: matrix.c,
            d: matrix.d,
            e: matrix.e,
            f: matrix.f,
          };
          if (![event.clientX, event.clientY, ...Object.values(numeric)].every(Number.isFinite)) {
            availability('Unavailable');
            return Option.none();
          }
          const point = clientToLocal({ x: event.clientX, y: event.clientY }, numeric);
          if (point === null) {
            availability('Unavailable');
            return Option.none();
          }
          availability('Ready');
          return Option.some({ ...point, role, pointerId: event.pointerId });
        };
        const owned = (event: PointerEvent) =>
          element.querySelector('[data-signal-gesture]') === event.target;
        const cancelled = (event: PointerEvent) => {
          offer(Message.CancelledChartPointer({ role, pointerId: event.pointerId }));
          release(event.pointerId);
          captures.delete(event.pointerId);
        };
        const down = (event: PointerEvent) => {
          if (event.button !== 0 || !owned(event)) return;
          const point = coordinates(event);
          if (Option.isNone(point)) return;
          event.preventDefault();
          const captured = Effect.runSync(
            Effect.try(() => element.setPointerCapture(event.pointerId)).pipe(
              Effect.match({ onFailure: () => false, onSuccess: () => true }),
            ),
          );
          if (!captured) {
            cancelled(event);
            return;
          }
          captures.add(event.pointerId);
          offer(Message.StartedChartPointer(point.value));
        };
        const move = (event: PointerEvent) => {
          if (!owned(event) && !element.hasPointerCapture(event.pointerId)) return;
          const point = coordinates(event);
          if (Option.isSome(point)) offer(Message.MovedChartPointer(point.value));
        };
        const up = (event: PointerEvent) => {
          if (!captures.has(event.pointerId)) return;
          const point = coordinates(event);
          if (Option.isSome(point)) offer(Message.EndedChartPointer(point.value));
          else offer(Message.CancelledChartPointer({ role, pointerId: event.pointerId }));
          release(event.pointerId);
          captures.delete(event.pointerId);
        };
        const listeners: ReadonlyArray<readonly [string, (event: PointerEvent) => void]> = [
          ['pointerdown', down],
          ['pointermove', move],
          ['pointerup', up],
          ['pointercancel', cancelled],
          ['lostpointercapture', cancelled],
        ];
        // SAFETY: Only pointer event names are paired with these pointer listeners.
        for (const [name, listener] of listeners) {
          // SAFETY: The registered names are pointer events with PointerEvent payloads.
          element.addEventListener(name, listener as EventListener);
        }
        const measured = (width: number) => {
          offer(Message.RecordedChartWidth({ role, width }));
          const matrix = element.getScreenCTM();
          const usable =
            matrix !== null &&
            [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(Number.isFinite) &&
            clientToLocal(
              { x: 0, y: 0 },
              { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f },
            ) !== null;
          availability(Number.isFinite(width) && width > 76 && usable ? 'Ready' : 'Unavailable');
        };
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) measured(entry.contentRect.width);
        });
        observer.observe(element);
        measured(element.getBoundingClientRect().width);
        return () => {
          // SAFETY: These are the same pointer event/listener pairs acquired above.
          for (const [name, listener] of listeners) {
            // SAFETY: Teardown uses the acquired pointer event/listener pairs.
            element.removeEventListener(name, listener as EventListener);
          }
          observer.disconnect();
          for (const id of captures) release(id);
          captures.clear();
        };
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(
      // The stream owns listeners until Mount scope closes.
      // oxlint-disable-next-line linteffect/no-effect-never
      Effect.andThen(Effect.never),
    ),
  );
}
export const ObserveSignalInput = defineStream('ObserveSignalInput', {
  args: { role: ChartRole },
  messages: [
    Message.RecordedChartWidth,
    Message.RecordedInputAvailability,
    Message.StartedChartPointer,
    Message.MovedChartPointer,
    Message.EndedChartPointer,
    Message.CancelledChartPointer,
  ],
  // SAFETY: The tag guard below narrows the actual mounted SVG element.
  execute: ({ element, role }) =>
    element.tagName.toLowerCase() === 'svg'
      ? signalInputFacts(element as SVGSVGElement, role)
      : Stream.make(Message.RecordedInputAvailability({ role, status: 'Unavailable' })),
});
