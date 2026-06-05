// D3 parity: d3-shape/src/areaRadial.js
// Polar area — each point defined by angle (radians) + inner/outer radius.
// 0 = top (12 o'clock), increasing clockwise.
// Cartesian transform: x = r * sin(θ), y = -r * cos(θ)
// Path is centered at origin; use SVG transform="translate(cx,cy)" to position.

import { path as makePath } from './path';

export interface AreaRadialPoint {
  /** Angle in radians (0 = top, clockwise) */
  readonly angle: number;
  /** Outer radius */
  readonly outerRadius: number;
  /** Inner radius (default 0 — fills to centre) */
  readonly innerRadius?: number;
}

export interface AreaRadialConfig {
  readonly digits?: number;
}

/**
 * Render a radial area (polar area / wind-rose segment).
 *
 * Points are traced outer-radius first (clockwise), then inner-radius in
 * reverse (to close the shape correctly).
 */
export function areaRadial(
  points: ReadonlyArray<AreaRadialPoint>,
  config: AreaRadialConfig = {},
): string | null {
  if (points.length === 0) return null;

  const { digits } = config;
  const buf = makePath(digits);

  // Outer arc (forward)
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (!pt) continue;
    const x = pt.outerRadius * Math.sin(pt.angle);
    const y = -pt.outerRadius * Math.cos(pt.angle);
    if (i === 0) buf.moveTo(x, y);
    else buf.lineTo(x, y);
  }

  // Inner arc (reverse) — traces back to close the shape
  for (let i = points.length - 1; i >= 0; i--) {
    const pt = points[i];
    if (!pt) continue;
    const r = pt.innerRadius ?? 0;
    const x = r * Math.sin(pt.angle);
    const y = -r * Math.cos(pt.angle);
    buf.lineTo(x, y);
  }

  buf.closePath();

  const result = buf.toString();
  return result === '' ? null : result;
}

/**
 * Render a single pie/donut wedge segment from `startAngle` to `endAngle`.
 * More efficient than `areaRadial` when building segmented polar charts.
 */
export function wedge(
  startAngle: number,
  endAngle: number,
  outerRadius: number,
  innerRadius = 0,
  steps = 32,
  digits?: number,
): string | null {
  if (steps < 1) return null;

  const buf = makePath(digits);
  const angleSpan = endAngle - startAngle;

  // Outer arc
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (i / steps) * angleSpan;
    const x = outerRadius * Math.sin(angle);
    const y = -outerRadius * Math.cos(angle);
    if (i === 0) buf.moveTo(x, y);
    else buf.lineTo(x, y);
  }

  // Inner arc (reverse) or straight to centre
  if (innerRadius > 0) {
    for (let i = steps; i >= 0; i--) {
      const angle = startAngle + (i / steps) * angleSpan;
      buf.lineTo(innerRadius * Math.sin(angle), -innerRadius * Math.cos(angle));
    }
  } else {
    buf.lineTo(0, 0);
  }

  buf.closePath();

  const result = buf.toString();
  return result === '' ? null : result;
}
