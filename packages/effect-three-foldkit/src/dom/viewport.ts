/**
 * Element size, visibility and motion preference.
 *
 * @module
 */
import type { Viewport } from '@opsydyn/effect-three';

/**
 * The drawing buffer's pixel ratio: a fixed number, or `[min, max]` to follow the device
 * within bounds. React Three Fiber's `dpr`, with its `[1, 2]` default (`calculateDpr` in
 * `core/utils.tsx` at `d74622e`): ratios above 2 cost GPU time for little visible gain.
 */
export type PixelRatio = number | readonly [min: number, max: number];

export const defaultPixelRatio: PixelRatio = [1, 2];

/** Resolves a pixel ratio setting against the device's ratio. */
export const resolvePixelRatio = (devicePixelRatio: number, setting: PixelRatio): number =>
  typeof setting === 'number'
    ? setting
    : Math.min(Math.max(setting[0], devicePixelRatio), setting[1]);

/** The element's current viewport, with the pixel ratio resolved. */
export const measureViewport = (
  element: Element,
  devicePixelRatio: number,
  pixelRatio: PixelRatio = defaultPixelRatio,
): Viewport => {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    pixelRatio: resolvePixelRatio(devicePixelRatio, pixelRatio),
  };
};

/** Calls `onResize` whenever the element's size changes. Returns a disconnect function. */
export const observeSize = (element: Element, onResize: () => void): (() => void) => {
  const observer = new ResizeObserver(onResize);
  observer.observe(element);
  return () => observer.disconnect();
};

/** Calls `onVisible` with whether any part of the element is on screen. */
export const observeVisibility = (
  element: Element,
  onVisible: (visible: boolean) => void,
): (() => void) => {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) onVisible(entry.isIntersecting);
  });
  observer.observe(element);
  return () => observer.disconnect();
};

/** Calls `onChange` with the current reduced-motion preference, then on every change. */
export const observeReducedMotion = (
  view: Pick<Window, 'matchMedia'>,
  onChange: (reduced: boolean) => void,
): (() => void) => {
  const query = view.matchMedia('(prefers-reduced-motion: reduce)');
  const listener = (event: MediaQueryListEvent): void => onChange(event.matches);
  onChange(query.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};

/** The media query calls the pixel-ratio watch needs; `window` provides them. */
type ChangeTarget = {
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
};

export type PixelRatioHost = {
  readonly devicePixelRatio: number;
  readonly matchMedia: (query: string) => ChangeTarget;
};

/**
 * Calls `onChange` whenever the device pixel ratio changes (moving to another display, or
 * zooming), which resizes nothing. As React Three Fiber's `watchDpr`: a media query for
 * the current resolution, re-armed for the new ratio after each change.
 */
export const observePixelRatio = (view: PixelRatioHost, onChange: () => void): (() => void) => {
  let query: ChangeTarget | undefined;
  const listener = (): void => {
    query?.removeEventListener('change', listener);
    arm();
    onChange();
  };
  const arm = (): void => {
    query = view.matchMedia(`(resolution: ${view.devicePixelRatio}dppx)`);
    query.addEventListener('change', listener);
  };
  arm();
  return () => query?.removeEventListener('change', listener);
};
