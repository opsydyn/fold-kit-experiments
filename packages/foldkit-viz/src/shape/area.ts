import type { LineConfig } from './line';
import { line } from './line';

export type AreaConfig = LineConfig;

const r3 = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Generates a closed SVG path string for a filled area.
 *
 * D3 parity: d3-shape/src/area.js — topline is drawn forward with the chosen
 * curve, baseline is appended in reverse as straight segments, then closed.
 *
 * @param topline  [x, y1] points — the curved upper boundary
 * @param y0       Constant baseline y, or per-point [x, y0] array (straight baseline)
 */
export function area(
  topline: ReadonlyArray<readonly [number, number]>,
  y0: number | ReadonlyArray<readonly [number, number]>,
  config: AreaConfig = {},
): string | null {
  if (topline.length === 0) return null;

  const topPath = line(topline, config);
  if (!topPath) return null;

  const digits = config.digits ?? 3;
  const f = (n: number) => r3(n, digits);

  if (typeof y0 === 'number') {
    const first = topline[0];
    const last = topline[topline.length - 1];
    if (!first || !last) return null;
    const lx = f(last[0]);
    const fx = f(first[0]);
    const by = f(y0);
    return `${topPath} L${lx},${by} L${fx},${by} Z`;
  }

  if (y0.length === 0) return null;
  // Per-point baseline: reverse and append as straight segments (D3 area pattern)
  const baseSegments = [...y0]
    .reverse()
    .map(([x, y]) => `L${f(x)},${f(y)}`)
    .join(' ');
  return `${topPath} ${baseSegments} Z`;
}
