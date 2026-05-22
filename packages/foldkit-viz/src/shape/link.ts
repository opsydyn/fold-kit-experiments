// D3 parity: d3-shape linkVertical / linkHorizontal / linkRadial
// Cubic Bézier connectors for node-link diagrams.
// Functional API: pass {source, target} point pairs, get SVG path string back.

export type Point = Readonly<{ x: number; y: number }>;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

// Vertical link: source on top, target below.
// Control points split the y-midpoint: C sx,my sx,my tx,ty → C sx,my tx,my tx,ty
export function linkVertical(source: Point, target: Point): string {
  const my = r3((source.y + target.y) / 2);
  const sx = r3(source.x);
  const sy = r3(source.y);
  const tx = r3(target.x);
  const ty = r3(target.y);
  return `M${sx},${sy}C${sx},${my} ${tx},${my} ${tx},${ty}`;
}

// Horizontal link: source on left, target on right.
// Control points split the x-midpoint.
export function linkHorizontal(source: Point, target: Point): string {
  const mx = r3((source.x + target.x) / 2);
  const sx = r3(source.x);
  const sy = r3(source.y);
  const tx = r3(target.x);
  const ty = r3(target.y);
  return `M${sx},${sy}C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
}

// Radial link: source/target as {angle, radius} (angle in radians from 12 o'clock).
// Returns SVG path string centered at origin.
export type RadialPoint = Readonly<{ angle: number; radius: number }>;

function toCartesian(angle: number, radius: number): readonly [number, number] {
  return [radius * Math.sin(angle), -radius * Math.cos(angle)];
}

export function linkRadial(source: RadialPoint, target: RadialPoint): string {
  const midR = (source.radius + target.radius) / 2;
  const [sx, sy] = toCartesian(source.angle, source.radius);
  const [c1x, c1y] = toCartesian(source.angle, midR);
  const [c2x, c2y] = toCartesian(target.angle, midR);
  const [tx, ty] = toCartesian(target.angle, target.radius);
  return `M${r3(sx)},${r3(sy)}C${r3(c1x)},${r3(c1y)} ${r3(c2x)},${r3(c2y)} ${r3(tx)},${r3(ty)}`;
}
