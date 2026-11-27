import type { Html } from '@effect/ui/html';

import type { EditorEvent } from './types';
import type { ZlozViewportControl } from './viewport-controls';

/** A native button builder with accessible camera action and cancellation semantics. */
export function viewportControl<M>(
  h: Html.H<M>,
  action: ZlozViewportControl,
  onEvent: (event: EditorEvent) => M,
) {
  const button = h.button
    .key(action.event.type + ':' + action.label)
    .attr('type', 'button')
    .attr('aria-label', action.label)
    .attr('aria-pressed', action.pressed === undefined ? undefined : String(action.pressed))
    .disabled(action.disabled)
    .on('click', onEvent(action.event));
  if (action.event.type !== 'ZoomAreaModeToggled' || !action.pressed || action.disabled)
    return button;
  return button.on(
    'keydown',
    ({ key }) => (key === 'Escape' ? onEvent({ type: 'GestureCancelled' }) : undefined),
    { preventDefault: true },
  );
}
