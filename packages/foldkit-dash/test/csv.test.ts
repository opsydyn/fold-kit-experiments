import { describe, expect, test } from 'bun:test';

import { delimiterOf, parseDelimited, typed } from '../src/csv';

describe('CSV and TSV', () => {
  test('values are typed as d3-dsv autoType types them, dates kept as strings', () => {
    expect(typed('')).toBeNull();
    expect(typed('  ')).toBeNull();
    expect(typed('true')).toBe(true);
    expect(typed('false')).toBe(false);
    expect(typed(' 42 ')).toBe(42);
    expect(typed('-1.5e3')).toBe(-1500);
    expect(typed('007')).toBe(7);
    expect(typed('NaN')).toBeNull();
    expect(typed('2026-05-04')).toBe('2026-05-04');
    expect(typed('North West')).toBe('North West');
  });

  test('a header row names the fields; quotes may hold commas, quotes and line breaks', () => {
    const text = '﻿region,orders,note\r\nNorth,12,"one, two"\r\nSouth,,"said ""hi""\nthen left"\r\n';
    expect(parseDelimited(text, ',')).toEqual([
      { region: 'North', orders: 12, note: 'one, two' },
      { region: 'South', orders: null, note: 'said "hi"\nthen left' },
    ]);
  });

  test('a short record fills with null, a long one is cut, blank lines are skipped', () => {
    expect(parseDelimited('a\tb\n1\n\n2\t3\t4\n', '\t')).toEqual([
      { a: 1, b: null },
      { a: 2, b: 3 },
    ]);
  });

  test('the extension picks the delimiter', () => {
    expect(delimiterOf('sales.csv')).toBe(',');
    expect(delimiterOf('sales.tsv')).toBe('\t');
    expect(delimiterOf('sales.json')).toBeUndefined();
  });
});
