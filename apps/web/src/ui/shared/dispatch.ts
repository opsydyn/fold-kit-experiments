/**
 * Linked-view dispatch — TEA pattern for cross-chart hover/selection sync.
 *
 * Instead of a global event bus, linked views work through the parent model:
 *
 *   1. Child charts emit their normal messages (HoveredBar, HoveredPoint, …).
 *   2. The parent wraps them in a chart-scoped message (GotChartA, GotChartB).
 *   3. The parent update function unwraps and also applies relevant side-effects
 *      to sibling charts — e.g. set the same hover index on chart B.
 *
 * `CrosshairState` is the shared cursor identity passed between charts.
 * It is keyed by a string (label, id, or formatted value) so charts with
 * different data shapes can still coordinate.
 */

export type CrosshairState = Readonly<{
  /** The string key that identifies the hovered datum across charts */
  key: string | null;
  /** SVG x coordinate in plot-area space (optional, for position-based linking) */
  x?: number;
  /** SVG y coordinate in plot-area space (optional) */
  y?: number;
}>;

export const CROSSHAIR_IDLE: CrosshairState = { key: null };

/** True when the crosshair is active */
export const crosshairActive = (c: CrosshairState): boolean => c.key !== null;

/**
 * Determine whether a datum identified by `key` should appear highlighted
 * given the current crosshair state.
 */
export function isHighlighted(state: CrosshairState, key: string): boolean {
  return state.key === key;
}

/**
 * Determine whether a datum should appear dimmed (crosshair is active but
 * this datum is not the highlighted one).
 */
export function isDimmed(state: CrosshairState, key: string): boolean {
  return state.key !== null && state.key !== key;
}
