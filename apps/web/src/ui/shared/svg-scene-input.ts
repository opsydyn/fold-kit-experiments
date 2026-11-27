import { Effect, flow, Option, Queue, Schema, Stream } from 'effect';

type PointerIdentity = Readonly<{ pointerId: number }>;
type PointerPosition = PointerIdentity & Readonly<{ clientX: number; clientY: number }>;

type SceneInput<Message> = Readonly<{
  baseRadius: number;
  viewBoxWidth: number;
  started: (pointer: PointerPosition & { readonly renderedBaseRadius: number }) => Message;
  moved: (pointer: PointerPosition) => Message;
  ended: (pointer: PointerIdentity) => Message;
  pressed: (key: { readonly key: string }) => Message;
  markerAttribute: string;
  clicked: (id: string) => Message;
}>;

const navigationKeys = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  '+',
  '=',
  '-',
  'Home',
]);

/** Keyboard cancellation is synchronous. The scoped stream only delivers facts. */
export function svgSceneInput<Message>(element: Element, input: SceneInput<Message>) {
  return Stream.callback<Message>((queue) => {
    const acquire = Effect.sync(() => {
      function pointer(event: Event) {
        if (!(event instanceof PointerEvent)) return;
        const { pointerId, clientX, clientY } = event;
        if (event.type === 'pointermove') {
          Queue.offerUnsafe(queue, input.moved({ pointerId, clientX, clientY }));
        } else if (event.type !== 'pointerdown') {
          Queue.offerUnsafe(queue, input.ended({ pointerId }));
        } else if (event.button === 0) {
          const renderedBaseRadius =
            (element.getBoundingClientRect().width * input.baseRadius) / input.viewBoxWidth;
          Queue.offerUnsafe(
            queue,
            input.started({ pointerId, clientX, clientY, renderedBaseRadius }),
          );
        }
      }
      function keyboard(event: Event) {
        if (
          !(event instanceof KeyboardEvent) ||
          event.target !== element ||
          event.isComposing ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          !navigationKeys.has(event.key)
        )
          return;
        event.preventDefault();
        Queue.offerUnsafe(queue, input.pressed({ key: event.key }));
      }
      function click(event: Event) {
        if (!(event.target instanceof Element)) return;
        const marker = event.target.closest(`[${input.markerAttribute}]`);
        const id = marker?.getAttribute(input.markerAttribute);
        if (marker !== null && element.contains(marker) && id != null) {
          Queue.offerUnsafe(queue, input.clicked(id));
        }
      }
      const pointerEvents = [
        'pointerdown',
        'pointermove',
        'pointerup',
        'pointercancel',
        'pointerleave',
      ];
      for (const event of pointerEvents) element.addEventListener(event, pointer);
      element.addEventListener('keydown', keyboard);
      element.addEventListener('click', click);
      return () => {
        for (const event of pointerEvents) element.removeEventListener(event, pointer);
        element.removeEventListener('keydown', keyboard);
        element.removeEventListener('click', click);
      };
    });
    const scoped = Effect.acquireRelease(acquire, Effect.sync);
    // Keep the stream open until the mount disposes its DOM listeners.
    // oxlint-disable-next-line linteffect/no-effect-never
    return Effect.andThen(scoped, Effect.never);
  });
}

const decodeKey = Schema.decodeUnknownOption(
  Schema.Struct({ key: Schema.String, composing: Schema.Boolean }),
);

export const svgMarkerActivation = <Message>(message: Message) =>
  flow(
    decodeKey,
    Option.filter(({ key, composing }) => !composing && (key === 'Enter' || key === ' ')),
    Option.map(() => message),
    Option.getOrUndefined,
  );
