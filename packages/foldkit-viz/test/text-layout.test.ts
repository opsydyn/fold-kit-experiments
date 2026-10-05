import { expect, it } from 'bun:test';

import { wrapText } from '../src/layout/text';
const measure = (text: string) => Array.from(text).length * 10;
it('wraps on words while preserving newlines and blank lines', () => {
  expect(wrapText('one two three\n\nfour', measure, { width: 70 }).lines).toEqual([
    'one two',
    'three',
    '',
    'four',
  ]);
});
it('breaks long words without splitting Unicode code points', () => {
  expect(wrapText('😀😀😀', measure, { width: 20 }).lines).toEqual(['😀😀', '😀']);
});
it('reports line-budget and unfit-glyph overflow', () => {
  const result = wrapText('one two three', measure, { width: 40, maxLines: 2 });
  expect(result.lines).toEqual(['one', 'two']);
  expect(result.overflow).toBe(true);
  expect(wrapText('😀', measure, { width: 5 }).overflow).toBe(true);
  expect(wrapText('', measure, { width: 10 }).lines).toEqual([]);
});
it('rejects invalid width, budgets and measurement results', () => {
  expect(() => wrapText('hello', measure, { width: 0 })).toThrow();
  expect(() => wrapText('hello', measure, { width: 40, maxLines: 0 })).toThrow();
  expect(() => wrapText('hello', () => NaN, { width: 40 })).toThrow();
});
