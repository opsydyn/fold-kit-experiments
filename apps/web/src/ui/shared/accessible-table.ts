import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';

const srOnly = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: '0',
} satisfies Html.Style;

/** Expose the current chart readout to screen readers without moving focus. */
export function withAriaLive<M>(h: Html.H<M>, chart: View.Input<M>, liveText: string) {
  return h.div
    .style({ position: 'relative' })
    .children(
      chart,
      h.div
        .attr('aria-live', 'polite')
        .attr('aria-atomic', 'true')
        .style(srOnly)
        .children(liveText),
    );
}
