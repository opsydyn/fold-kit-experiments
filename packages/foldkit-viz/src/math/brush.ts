/**
 * TEA-compatible brush primitive — range selection over a continuous axis.
 * Modelled after D3's brush but as pure state + messages with no DOM dependency.
 *
 * Usage pattern:
 *   1. Add `brush: BrushState` to your chart's Model
 *   2. Add brush messages to your Message union
 *   3. In update(), delegate to `brushUpdate(model.brush, msg)`
 *   4. In view(), render the brush overlay + wire pointer events
 *   5. Use `brushExtent(model.brush)` to filter/highlight data
 */

// ── State ─────────────────────────────────────────────────────────────────────

export type BrushState = Readonly<{
  /** Pixel coordinate where drag started (in plot-area space) */
  anchor: number;
  /** Pixel coordinate of current drag position */
  extent: number;
  /** True while the user is actively dragging */
  active: boolean;
}>;

export const BRUSH_IDLE: BrushState = { anchor: 0, extent: 0, active: false };

// ── Messages ──────────────────────────────────────────────────────────────────

export type BrushMessage =
  | { readonly _tag: 'StartedBrush'; readonly x: number }
  | { readonly _tag: 'MovedBrush'; readonly x: number }
  | { readonly _tag: 'EndedBrush'; readonly x: number }
  | { readonly _tag: 'ClearedBrush' };

export const StartedBrush = (x: number): BrushMessage => ({ _tag: 'StartedBrush', x });
export const MovedBrush = (x: number): BrushMessage => ({ _tag: 'MovedBrush', x });
export const EndedBrush = (x: number): BrushMessage => ({ _tag: 'EndedBrush', x });
export const ClearedBrush = (): BrushMessage => ({ _tag: 'ClearedBrush' });

// ── Update ────────────────────────────────────────────────────────────────────

export function brushUpdate(state: BrushState, msg: BrushMessage): BrushState {
  switch (msg._tag) {
    case 'StartedBrush':
      return { anchor: msg.x, extent: msg.x, active: true };
    case 'MovedBrush':
      return state.active ? { ...state, extent: msg.x } : state;
    case 'EndedBrush':
      return { anchor: state.anchor, extent: msg.x, active: false };
    case 'ClearedBrush':
      return BRUSH_IDLE;
  }
}

// ── Query ─────────────────────────────────────────────────────────────────────

/**
 * Returns the selected pixel range as [lo, hi] (always lo ≤ hi).
 * Returns null when the brush is idle / has zero width.
 */
export function brushExtent(state: BrushState): readonly [number, number] | null {
  const lo = Math.min(state.anchor, state.extent);
  const hi = Math.max(state.anchor, state.extent);
  if (hi - lo < 2) return null;
  return [lo, hi];
}

/**
 * Returns true if `x` falls within the brush selection.
 * Always false when the brush is idle.
 */
export function brushContains(state: BrushState, x: number): boolean {
  const ext = brushExtent(state);
  if (!ext) return false;
  return x >= ext[0] && x <= ext[1];
}

/**
 * Map brush pixel extent back to domain values using an invert function.
 * Provide the `.invert()` of a `linearInvertible` scale.
 */
export function brushDomain(
  state: BrushState,
  invert: (px: number) => number,
): readonly [number, number] | null {
  const ext = brushExtent(state);
  if (!ext) return null;
  return [invert(ext[0]), invert(ext[1])];
}
