import type { boxBounds } from './geometry';
import type { BoxSelectionPreview } from './selection-preview';
import type { BoxSelectionMatch, Viewport } from './types';

/** Normalized selection bounds in graph coordinates and the current camera. */
export type ZlozSelectionMarqueeContext = Readonly<
  BoxSelectionPreview & { match: BoxSelectionMatch; viewport: Viewport }
>;

/** Normalized world bounds of the pending camera fit. */
export type ZlozZoomAreaMarqueeContext = Readonly<{
  bounds: Readonly<ReturnType<typeof boxBounds>>;
  viewport: Viewport;
}>;

export function doubleClickZoomFactor(value: boolean | number | undefined): number | undefined {
  if (value === undefined || value === false) return undefined;
  const factor = value === true ? 1.25 : value;
  if (!Number.isFinite(factor) || factor <= 1)
    throw new RangeError('Double-click zoom factor must be finite and greater than 1');
  return factor;
}
