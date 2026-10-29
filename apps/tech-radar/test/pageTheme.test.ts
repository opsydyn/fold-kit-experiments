import { describe, expect, test } from 'bun:test';

import { declarations, pageThemeCss } from '../src/radar/pageTheme';

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};
const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
};
const value = (css: string, name: string) =>
  css.match(new RegExp(`${name}: (#[0-9a-f]{6})`))?.[1] ?? '';

describe("the pages' colours", () => {
  test('follow the radar: Night, Paper when light, High contrast when asked', () => {
    expect(pageThemeCss).toContain(':root { color-scheme: dark;');
    expect(pageThemeCss).toContain('@media (prefers-color-scheme: light)');
    expect(pageThemeCss).toContain('@media (prefers-contrast: more)');
    expect(value(declarations('night'), '--category-tools')).toBe('#008300');
  });

  test('keep links, text and muted text readable on every page (4.5:1)', () => {
    for (const theme of ['night', 'paper', 'contrast'] as const) {
      const css = declarations(theme);
      for (const name of ['--accent', '--text', '--muted'])
        expect(contrast(value(css, name), value(css, '--page'))).toBeGreaterThan(4.5);
    }
  });
});
