import { describe, expect, test } from 'bun:test';

import { heroMonths, heroSeries, chartPaths, histograms } from '../src/lib/charts';
import { resolveTheme } from '../src/lib/theme';

describe('theme preference', () => {
  test('saved choices override the system preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  test('missing and invalid saved choices follow the system', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
    expect(resolveTheme('sepia', true)).toBe('dark');
    expect(resolveTheme('', false)).toBe('light');
  });
});

describe('chart display contracts', () => {
  test('month totals include every series, not just the top band', () => {
    expect(heroMonths[0]?.total).toBe(74);
    expect(heroMonths[5]?.total).toBe(104);
    expect(heroMonths[11]?.total).toBe(130);
    expect(heroMonths).toHaveLength(12);
  });

  test('hero layers and gallery geometry are renderable SVG paths', () => {
    expect(heroSeries).toHaveLength(6);
    expect(chartPaths.length).toBeGreaterThan(50);
    for (const path of chartPaths) {
      expect(path).toMatch(/^M/);
      expect(path).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  test('histogram counts stay inside their labelled plot area', () => {
    for (const bucket of histograms.flat()) {
      expect(bucket.y).toBeGreaterThanOrEqual(20);
      expect(bucket.y + bucket.height).toBeCloseTo(197);
    }
  });

  test('histogram intervals reach the labelled 100 endpoint with a one-pixel gap', () => {
    const last = histograms[0]?.at(-1);
    expect(last).toBeDefined();
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBeCloseTo(299);
  });
});
