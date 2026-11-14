import type { Html, HtmlBuilder } from 'foldkit/html';

type H<M> = HtmlBuilder<M>;

/**
 * CSS class applied to the wrapper — positions the element off-screen
 * so it is available to screen readers but invisible to sighted users.
 * Applied via inline style to avoid requiring a global stylesheet.
 */
const SR_ONLY_STYLE = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  'white-space': 'nowrap',
  border: '0',
} satisfies Readonly<Record<string, string>>;

/**
 * Wrap a chart SVG in a `<div style="position:relative">` that also contains
 * an `aria-live="polite"` region. Screen readers announce `liveText` whenever
 * it changes (e.g. on hover) without moving keyboard focus.
 *
 * `liveText` should be derived from the current hover state in `view()`:
 * ```typescript
 * const liveText = isActive ? `${bar.label}: ${bar.value}` : '';
 * withAriaLive(h, svgEl, liveText);
 * ```
 */
export function withAriaLive<M>(h: H<M>, chart: Html, liveText: string): Html {
  return h.div(
    [h.Style({ position: 'relative' })],
    [
      chart,
      h.div(
        [
          h.Attribute('aria-live', 'polite'),
          h.Attribute('aria-atomic', 'true'),
          h.Style(SR_ONLY_STYLE),
        ],
        [liveText],
      ),
    ],
  );
}
