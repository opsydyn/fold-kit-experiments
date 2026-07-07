import { bisect } from '@opsydyn/foldkit-viz/math/array';
import type { Html, html } from 'foldkit/html';

import { r3 } from './math';

type H<M> = ReturnType<typeof html<M>>;

/**
 * Find the index of the datum closest to a pointer x position.
 * `sortedX` must be a sorted array of x pixel coordinates (ascending).
 * Returns -1 if the array is empty.
 */
export function nearestIndex(sortedX: ReadonlyArray<number>, pointerX: number): number {
  const n = sortedX.length;
  if (n === 0) return -1;
  const i = bisect(sortedX, pointerX);
  if (i === 0) return 0;
  if (i === n) return n - 1;
  const lo = sortedX[i - 1] ?? 0;
  const hi = sortedX[i] ?? 0;
  return pointerX - lo < hi - pointerX ? i - 1 : i;
}

/**
 * Find the nearest [x, y] coordinate pair to a pointer position.
 * Uses Euclidean distance — useful for 2D scatter charts.
 */
export function nearestPoint(
  coords: ReadonlyArray<readonly [number, number]>,
  px: number,
  py: number,
): number {
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < coords.length; i++) {
    const [cx, cy] = coords[i] ?? [0, 0];
    const dx = cx - px;
    const dy = cy - py;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export type CursorTooltipStyle = Readonly<{
  textColor?: string;
  bgColor?: string;
  fontSize?: string;
  padding?: number;
  offsetY?: number;
}>;

const TOOLTIP_DEFAULTS: Required<CursorTooltipStyle> = {
  textColor: 'var(--chart-tooltip-text, #e2e2e2)',
  bgColor: 'var(--chart-tooltip-bg, rgba(24,24,28,0.92))',
  fontSize: '0.72rem',
  padding: 5,
  offsetY: 14,
};

/**
 * SVG tooltip group with a background rect and text label.
 * x/y are in plot-area coordinates.
 * Returns a single `<g>` element — drop it directly into the chart SVG.
 */
export function cursorTooltip<M>(
  h: H<M>,
  x: number,
  y: number,
  lines: ReadonlyArray<string>,
  style: CursorTooltipStyle = {},
): Html {
  const s = { ...TOOLTIP_DEFAULTS, ...style };
  const lineH = 14;
  const boxW = Math.max(...lines.map((l) => l.length)) * 5.5 + s.padding * 2;
  const boxH = lines.length * lineH + s.padding * 2;
  const tx = r3(x - boxW / 2);
  const ty = r3(y - s.offsetY - boxH);

  return h.g(
    [h.Transform(`translate(${tx},${ty})`), h.Style({ 'pointer-events': 'none' })],
    [
      h.rect(
        [
          h.X('0'),
          h.Y('0'),
          h.Width(String(r3(boxW))),
          h.Height(String(r3(boxH))),
          h.Fill(s.bgColor),
          h.Attribute('rx', '3'),
        ],
        [],
      ),
      ...lines.map((line, i) =>
        h.text(
          [
            h.X(String(r3(boxW / 2))),
            h.Y(String(r3(s.padding + (i + 0.75) * lineH))),
            h.Style({
              'text-anchor': 'middle',
              'dominant-baseline': 'middle',
              'font-size': s.fontSize,
              fill: s.textColor,
            }),
          ],
          [line],
        ),
      ),
    ],
  );
}
