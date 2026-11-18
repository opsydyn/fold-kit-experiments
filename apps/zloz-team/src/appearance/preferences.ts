import { Schema } from 'effect';

export const ThemePreference = Schema.Literals(['system', 'light', 'dark']);
export type ThemePreference = typeof ThemePreference.Type;
export const themeCookie = 'zloz-team-theme';
export function themePreference(value: string | undefined): ThemePreference {
  return Schema.is(ThemePreference)(value) ? value : 'system';
}
