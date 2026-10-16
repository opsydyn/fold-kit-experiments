/**
 * Moves the application's overlay HTML to where the scene placed each overlay, as Drei's
 * `Html` does every frame (`src/web/Html.tsx` at `bf6f4ad`): a translate to the point,
 * the distance scale, centring, the depth's z-index, and hiding when not visible.
 *
 * @module
 */
import type { OverlayPlacement } from '@opsydyn/effect-three';

/** The data attribute naming the overlay an element's HTML belongs to. */
export const overlayData = {
  key: 'effect-three-overlay',
  attribute: 'data-effect-three-overlay',
} as const;

const transformOf = (placement: OverlayPlacement): string =>
  `translate3d(${placement.x}px,${placement.y}px,0) scale(${placement.scale})${
    placement.center ? ' translate(-50%,-50%)' : ''
  }`;

/** Writes one placement, touching only the style values that changed. */
const write = (element: HTMLElement, placement: OverlayPlacement): void => {
  const { style } = element;
  const transform = transformOf(placement);
  if (style.transform !== transform) style.transform = transform;
  const zIndex = String(placement.zIndex);
  if (style.zIndex !== zIndex) style.zIndex = zIndex;
  const visibility = placement.visible ? 'visible' : 'hidden';
  if (style.visibility !== visibility) style.visibility = visibility;
};

export type OverlayWriter = {
  /** Takes the latest placements and writes them. */
  readonly place: (placements: ReadonlyArray<OverlayPlacement>) => void;
  /** Writes the latest placements again, for overlay elements the view has just made. */
  readonly rewrite: () => void;
};

/** Creates the writer for overlays rendered inside `host`. */
export const createOverlayWriter = (host: Element): OverlayWriter => {
  let latest: ReadonlyArray<OverlayPlacement> = [];
  const rewrite = (): void => {
    for (const placement of latest) {
      const element = host.querySelector(
        `[${overlayData.attribute}="${CSS.escape(placement.key)}"]`,
      );
      if (element instanceof HTMLElement) write(element, placement);
    }
  };
  return {
    place: (placements) => {
      latest = placements;
      rewrite();
    },
    rewrite,
  };
};

/** Makes the scene element the overlays' containing block, unless it already is one. */
export const containOverlays = (host: Element) => (): void => {
  if (!(host instanceof HTMLElement)) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
};
