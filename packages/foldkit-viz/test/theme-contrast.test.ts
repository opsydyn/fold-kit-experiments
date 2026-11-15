import { describe, expect, it } from 'bun:test';

import { chartThemes, darkTheme, highContrastDarkTheme, highContrastLightTheme, lightTheme } from '../src/chart/theme.js';
import type { ChartTheme, ThemeName } from '../src/chart/theme.js';
import { contrastRatio } from '../src/math/color.js';

describe('contrastRatio', () => {
  it('measures WCAG 2 contrast between two hex colours', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
    // WebAIM's checker gives 4.54:1 for #767676 on white.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('accepts three-digit hex and rejects anything else', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
    expect(() => contrastRatio('red', '#000000')).toThrow(RangeError);
    expect(() => contrastRatio('#12345', '#000000')).toThrow(RangeError);
  });
});

/** WCAG 2.2: 4.5:1 for text (1.4.3), 3:1 for graphics a reader needs, such as axes and focus rings (1.4.11). */
const AA = { text: 4.5, graphics: 3 };
/** WCAG 2.2 AAA (1.4.6): 7:1 for text; axes and focus held to the AA text bar. */
const AAA = { text: 7, graphics: 4.5 };

function failures(theme: ChartTheme, bar: typeof AA): ReadonlyArray<string> {
  const checks: ReadonlyArray<readonly [string, string, string, number]> = [
    ['text', theme.text, theme.background, bar.text],
    ['mutedText', theme.mutedText, theme.background, bar.text],
    ['tooltipText', theme.tooltipText, theme.tooltipBackground, bar.text],
    ['axis', theme.axis, theme.background, bar.graphics],
    ['focus', theme.focus, theme.background, bar.graphics],
    ['series', theme.series.stroke, theme.background, bar.graphics],
  ];
  return checks
    .filter(([, fg, bg, min]) => contrastRatio(fg, bg) < min)
    .map(([name, fg, bg]) => `${name} ${contrastRatio(fg, bg).toFixed(2)}`);
}

describe('chart themes', () => {
  it('names every theme, for JSON, Python and notebooks', () => {
    expect(Object.keys(chartThemes).sort()).toEqual<ThemeName[]>([
      'dark',
      'high-contrast-dark',
      'high-contrast-light',
      'light',
    ]);
    expect(chartThemes.light).toBe(lightTheme);
    expect(chartThemes.dark).toBe(darkTheme);
    expect(chartThemes['high-contrast-light']).toBe(highContrastLightTheme);
    expect(chartThemes['high-contrast-dark']).toBe(highContrastDarkTheme);
  });

  for (const [name, theme] of Object.entries(chartThemes))
    it(`${name} meets WCAG AA for text and graphics`, () => {
      expect(failures(theme, AA)).toEqual([]);
    });

  for (const theme of [highContrastLightTheme, highContrastDarkTheme])
    it(`${theme === highContrastLightTheme ? 'high-contrast-light' : 'high-contrast-dark'} meets AAA for text, and AA text contrast for graphics`, () => {
      expect(failures(theme, AAA)).toEqual([]);
      // A grid a reader can follow, still quieter than the axes.
      expect(contrastRatio(theme.grid, theme.background)).toBeGreaterThanOrEqual(2);
      expect(contrastRatio(theme.grid, theme.background)).toBeLessThan(contrastRatio(theme.axis, theme.background));
    });

  it('sets high-contrast labels larger and marks heavier than the standard themes', () => {
    for (const theme of [highContrastLightTheme, highContrastDarkTheme]) {
      expect(theme.labelSize).toBeGreaterThan(lightTheme.labelSize);
      expect(theme.series.strokeWidth).toBeGreaterThan(lightTheme.series.strokeWidth);
    }
  });
});
