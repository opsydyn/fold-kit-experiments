import type { EdgePathStyle, Point, Viewport } from './types';

/** Reserve a vertical band clear of reconnect handles, clipping long controls to a scroll region. */
export function edgeToolbarBand(height: number, handles: readonly number[], clearance: number) {
  const inset = Math.min(6, height / 2);
  const bottom = height - inset;
  let start = inset;
  let best = { top: inset, height: 0 };
  for (const y of [...handles].sort((a, b) => a - b)) {
    const end = Math.max(start, Math.min(bottom, y - clearance));
    if (end - start > best.height) best = { top: start, height: end - start };
    start = Math.max(start, Math.min(bottom, y + clearance));
  }
  if (bottom - start > best.height) best = { top: start, height: bottom - start };
  return { top: best.top, height: Math.min(280, best.height) };
}

export function edgeToolbarPosition(
  center: Point,
  viewport: Viewport,
  handles: readonly Point[],
  height: number,
): Point {
  const { x, y, zoom } = viewport;
  const centerY = y + center.y * zoom;
  const handleY = handles.map((point) => y + point.y * zoom);
  const clearance = 9 * zoom + 6;
  const below = Math.max(centerY + 26, ...handleY.map((point) => point + clearance));
  const above = Math.min(centerY - 26, ...handleY.map((point) => point - clearance)) - 82;
  return { x: x + center.x * zoom, y: below + 82 > height && above >= 6 ? above : below };
}

export const edgePathStyles: ReadonlyArray<{ label: string; style: EdgePathStyle | null }> = [
  { label: 'Automatic', style: null },
  { label: 'Straight', style: 'straight' },
  { label: 'Stepped', style: 'stepped' },
  { label: 'Smooth', style: 'smooth' },
];
