/**
 * Element size, visibility and motion preference.
 *
 * @module
 */
import type { Viewport } from '@opsydyn/effect-three';

/** Device pixel ratios above this cost GPU time with little visible gain. */
export const defaultMaxPixelRatio = 2;

/** The element's current viewport, with the pixel ratio capped. */
export const measureViewport = (
  element: Element,
  devicePixelRatio: number,
  maxPixelRatio: number = defaultMaxPixelRatio,
): Viewport => {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    pixelRatio: Math.min(devicePixelRatio, maxPixelRatio),
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
