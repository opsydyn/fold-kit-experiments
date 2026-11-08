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
