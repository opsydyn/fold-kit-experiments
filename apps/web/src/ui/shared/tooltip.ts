import type { Html, html } from 'foldkit/html';
import { r3 } from './math';

type H<M> = ReturnType<typeof html<M>>;

export type TooltipStyle = Readonly<{
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  offsetY?: number;
}>;

const DEFAULTS: Required<TooltipStyle> = {
  color: 'var(--chart-accent, #4338ca)',
  fontSize: '0.75rem',
  fontWeight: '600',
  offsetY: 10,
};

/**
 * A simple SVG text tooltip rendered above a point.
 * x/y are in plot-area coordinates (already offset by margins).
 */
export function valueTooltip<M>(
  h: H<M>,
  x: number,
  y: number,
  label: string,
  style: TooltipStyle = {},
): Html {
  const s = { ...DEFAULTS, ...style };
  return h.text(
    [
      h.X(String(r3(x))),
      h.Y(String(r3(y - s.offsetY))),
      h.Style({
        'text-anchor': 'middle',
        'dominant-baseline': 'auto',
        'font-size': s.fontSize,
        'font-weight': s.fontWeight,
        fill: s.color,
        'pointer-events': 'none',
      }),
    ],
    [label],
  );
}
