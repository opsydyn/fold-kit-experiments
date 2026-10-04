import { describe, expect, it } from 'bun:test';

import {
  lightTheme,
  darkTheme,
  createSeriesStyles,
  resolveSeriesStyle,
  themeProperties,
} from '../src/chart/theme.js';

describe('chart appearance', () => {
  it('retains opaque CSS paint and independent opacity', () => {
    const style = resolveSeriesStyle(
      lightTheme,
      { stroke: 'var(--brand)', fill: 'currentColor', opacity: 0.25 },
      {},
      {},
    );
    expect(style.stroke).toBe('var(--brand)');
    expect(style.fill).toBe('currentColor');
    expect(style.opacity).toBe(0.25);
  });
  it('resolves theme then chart then keyed series then datum overrides', () => {
    const theme = { ...lightTheme, series: { ...lightTheme.series, pointRadius: 3 } };
    const style = resolveSeriesStyle(
      theme,
      { pointRadius: 4 },
      { pointRadius: 5 },
      { pointRadius: 6 },
    );
    expect(style.pointRadius).toBe(6);
    expect(style.stroke).toBe(theme.series.stroke);
    expect(theme.series.pointRadius).toBe(3);
  });
  it('keeps keyed colours when marks are filtered and reordered', () => {
    const styles = createSeriesStyles(['alpha', 'beta'], ['red', 'blue']);
    const visible = ['beta'];
    expect(visible.map((key) => styles.get(key)?.fill)).toEqual(['blue']);
    expect(['beta', 'alpha'].map((key) => styles.get(key)?.stroke)).toEqual(['blue', 'red']);
  });
  it('cycles palettes without duplicate domain entries consuming slots', () => {
    const styles = createSeriesStyles(['a', 'a', 'b', 'c'], ['red', 'blue']);
    expect(Array.from(styles.values(), (style) => style.fill)).toEqual(['red', 'blue', 'red']);
    expect(() => createSeriesStyles(['a'], [])).toThrow(/palette/i);
  });
  it('applies keyed symbols and paint overrides', () => {
    const styles = createSeriesStyles(
      ['a'],
      ['red'],
      new Map([['a', { symbol: 'square', fill: 'rgb(1,2,3)' }]]),
    );
    expect(styles.get('a')?.symbol).toBe('square');
    expect(styles.get('a')?.fill).toBe('rgb(1,2,3)');
    expect(styles.get('a')?.stroke).toBe('red');
  });
  it('rejects invalid opacity and mark sizes', () => {
    for (const opacity of [-1, 1.1, NaN])
      expect(() => resolveSeriesStyle(lightTheme, { opacity }, {}, {})).toThrow(/opacity/i);
    expect(() => resolveSeriesStyle(lightTheme, { pointRadius: -1 }, {}, {})).toThrow(
      /size|radius/i,
    );
    expect(() => resolveSeriesStyle(lightTheme, { strokeWidth: Infinity }, {}, {})).toThrow(
      /size|width/i,
    );
  });
  it('exposes mode-specific semantic properties and pixel-sized labels', () => {
    expect(
      themeProperties({ ...darkTheme, focus: 'var(--brand)', labelSize: 14 })['--chart-focus'],
    ).toBe('var(--brand)');
    expect(themeProperties(lightTheme)['--chart-label-size']).toBe('12px');
    expect(lightTheme.text).not.toBe(darkTheme.text);
    expect(lightTheme.background).not.toBe(darkTheme.background);
  });
});
