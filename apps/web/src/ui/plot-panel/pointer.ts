import { pointerToPlot } from '@opsydyn/foldkit-viz/plot';
import { Schema } from 'effect';

/** A pointer move or press in the SVG's plot coordinates. */
export const PointerFact = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  pressed: Schema.Boolean,
});
export const POINTER_EVENT = 'plot-panel-pointer';
export const LEFT_EVENT = 'plot-panel-left';
export const RELEASED_EVENT = 'plot-panel-released';
export const EmptyPointerFact = Schema.Struct({});

export function attachPointer(element: Element, size: Readonly<{ width: number; height: number }>) {
  function forward(event: Event) {
    if (!(event instanceof PointerEvent)) return;
    const drawn = element.querySelector('svg') ?? element;
    const drawnSize =
      drawn instanceof SVGSVGElement && drawn.viewBox.baseVal.width > 0
        ? drawn.viewBox.baseVal
        : size;
    const point = pointerToPlot(
      { x: event.clientX, y: event.clientY },
      drawn.getBoundingClientRect(),
      drawnSize,
    );
    const pressed = event.type === 'pointerdown';
    // Pointer capture keeps brush input on the panel when a drag leaves the SVG.
    if (pressed && element instanceof HTMLElement && event.pointerId !== undefined)
      element.setPointerCapture?.(event.pointerId);
    element.dispatchEvent(new CustomEvent(POINTER_EVENT, { detail: { ...point, pressed } }));
  }
  const leave = () => element.dispatchEvent(new CustomEvent(LEFT_EVENT, { detail: {} }));
  const release = () => element.dispatchEvent(new CustomEvent(RELEASED_EVENT, { detail: {} }));
  element.addEventListener('pointerleave', leave);
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('pointermove', forward);
  element.addEventListener('pointerdown', forward);
  return () => {
    element.removeEventListener('pointerleave', leave);
    element.removeEventListener('pointerup', release);
    element.removeEventListener('pointercancel', release);
    element.removeEventListener('pointermove', forward);
    element.removeEventListener('pointerdown', forward);
  };
}
