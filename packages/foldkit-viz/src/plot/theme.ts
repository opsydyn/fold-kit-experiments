import { chartThemes } from '../chart/theme.js';
import type { ThemeName } from '../chart/theme.js';
import type { PlotPalette } from './render.js';

/** A theme by name, such as `'dark'`, or any palette, such as a ChartTheme or `currentColorPalette`. */
export type PlotTheme = ThemeName | PlotPalette;

/** A theme name read from JSON or Python is a string; anything else is already a palette. */
const isThemeName = (theme: PlotTheme): theme is ThemeName => typeof theme === 'string';

/** The palette a theme names. An unknown name is an error, as a spec's unknown scheme is. */
export function paletteOf(theme: PlotTheme): PlotPalette {
  if (!isThemeName(theme)) return theme;
  const palette = chartThemes[theme];
  if (palette === undefined)
    throw new RangeError(`theme: "${theme}" is not one of ${Object.keys(chartThemes).join(', ')}`);
  return palette;
}
