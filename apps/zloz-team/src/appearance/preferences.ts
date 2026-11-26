import { Schema } from 'effect';

export const ThemePreference = Schema.Literals(['system', 'light', 'dark']);
export type ThemePreference = typeof ThemePreference.Type;
export const themeCookie = 'zloz-team-theme';
export function themePreference(value: string | undefined): ThemePreference {
  return Schema.is(ThemePreference)(value) ? value : 'system';
}

export const ToolLabels = Schema.Literals(['icons', 'labelled']);
export type ToolLabels = typeof ToolLabels.Type;
export const toolLabelsCookie = 'zloz-team-tool-labels';
export function toolLabelsPreference(value: string | undefined): ToolLabels {
  return Schema.is(ToolLabels)(value) ? value : 'icons';
}

export const MotionPreference = Schema.Literals(['system', 'reduce']);
export type MotionPreference = typeof MotionPreference.Type;
export const motionCookie = 'zloz-team-motion';
export const motionChangeEvent = 'zloz:motion-preference';
export const motionQuery = '(prefers-reduced-motion: reduce)';
export function motionPreference(value: string | undefined): MotionPreference {
  return value === 'reduce' ? 'reduce' : 'system';
}
export function prefersReducedMotion() {
  const controller = document.querySelector<HTMLElement>('[data-motion-preference]');
  return (
    (controller?.dataset.motionPreference ?? document.documentElement.dataset.teamMotion) ===
      'reduce' || window.matchMedia(motionQuery).matches
  );
}
