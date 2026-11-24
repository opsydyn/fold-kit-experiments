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
