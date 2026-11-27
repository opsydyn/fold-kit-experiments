import { Mount } from '@effect/ui';
import { Effect, Queue, Stream } from 'effect';

import { Message } from './message';

export const CarouselInput = Mount.makeStream('CarouselInput', { args: {} }, (element) => {
  if (!(element instanceof HTMLElement)) return Stream.empty;
  return Stream.callback<Message>((queue) => {
    const acquire = Effect.sync(() => {
      const document = element.ownerDocument;
      const track = element.querySelector('[data-carousel-track-id]') ?? element;
      let active:
        | { id: number; startX: number; lastX: number; time: number; velocityX: number }
        | undefined;
      const emit = (message: Message) => Queue.offerUnsafe(queue, message);

      function start(event: Event) {
        if (!(event instanceof PointerEvent) || event.button !== 0 || active) return;
        active = {
          id: event.pointerId,
          startX: event.clientX,
          lastX: event.clientX,
          time: event.timeStamp,
          velocityX: 0,
        };
        emit(Message.PressedSlide());
      }

      function move(event: PointerEvent) {
        if (active?.id !== event.pointerId) return;
        active.velocityX =
          (event.clientX - active.lastX) / Math.max(event.timeStamp - active.time, 1);
        active.lastX = event.clientX;
        active.time = event.timeStamp;
        emit(Message.MovedDragPointer({ deltaX: event.clientX - active.startX }));
      }

      function release(event: PointerEvent) {
        if (active?.id !== event.pointerId) return;
        const { startX, velocityX } = active;
        active = undefined;
        emit(
          Message.ReleasedDragPointer({
            deltaX: event.clientX - startX,
            velocityX,
            trackWidth: track.getBoundingClientRect().width,
          }),
        );
      }

      function cancel() {
        if (!active) return;
        active = undefined;
        emit(Message.CancelledDrag());
      }

      function cancelPointer(event: PointerEvent) {
        if (active?.id === event.pointerId) cancel();
      }

      function cancelFromKeyboard(event: KeyboardEvent) {
        if (event.key === 'Escape') cancel();
      }

      function navigate(event: KeyboardEvent) {
        if (
          event.target !== element ||
          event.isComposing ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
        )
          return;
        event.preventDefault();
        emit(Message.PressedNavigationKey({ key: event.key }));
      }

      track.addEventListener('pointerdown', start);
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', release);
      document.addEventListener('pointercancel', cancelPointer);
      document.addEventListener('keydown', cancelFromKeyboard);
      document.defaultView?.addEventListener('blur', cancel);
      element.addEventListener('keydown', navigate);
      return () => {
        track.removeEventListener('pointerdown', start);
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', release);
        document.removeEventListener('pointercancel', cancelPointer);
        document.removeEventListener('keydown', cancelFromKeyboard);
        document.defaultView?.removeEventListener('blur', cancel);
        element.removeEventListener('keydown', navigate);
      };
    });
    const scoped = Effect.acquireRelease(acquire, Effect.sync);
    // Keep the stream open until the mount releases the listeners.
    // oxlint-disable-next-line linteffect/no-effect-never
    return Effect.andThen(scoped, Effect.never);
  });
});
