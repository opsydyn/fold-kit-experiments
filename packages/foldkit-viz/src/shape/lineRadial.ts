// D3 parity: d3-shape/src/lineRadial.js + curve/radial.js
// angle: radians, 0 = top (12 o'clock), increasing clockwise
// Cartesian transform: x = r * sin(θ), y = -r * cos(θ)
// Path is centered at origin; use SVG transform="translate(cx,cy)" to position.

import { path as makePath } from './path';

export interface LineRadialConfig {
  readonly closed?: boolean;
  readonly digits?: number;
}

export function lineRadial(
  points: ReadonlyArray<readonly [angle: number, radius: number]>,
  config: LineRadialConfig = {},
): string | null {
  const { closed = false, digits } = config;
  if (points.length === 0) return null;

  const buf = makePath(digits);

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt === undefined) continue;
    const [angle, radius] = pt;
    const x = radius * Math.sin(angle);
    const y = -radius * Math.cos(angle);
    if (i === 0) buf.moveTo(x, y);
    else buf.lineTo(x, y);
  }

  if (closed) buf.closePath();

  const result = buf.toString();
  return result === '' ? null : result;
}
