import { expect, it } from 'bun:test';

import { wordCloud } from '../src/layout/wordcloud';
const first = { id: '0', text: 'word0', width: 100, height: 25, angle: 45 };
const data = Array.from({ length: 24 }, (_, i) => ({
  id: String(i),
  text: `word${i}`,
  width: 100 - i * 2,
  height: 25,
  angle: i % 3 === 0 ? 45 : 0,
}));
const accessors = {
  key: (d: (typeof data)[number]) => d.id,
  text: (d: (typeof data)[number]) => d.text,
  width: (d: (typeof data)[number]) => d.width,
  height: (d: (typeof data)[number]) => d.height,
  rotation: (d: (typeof data)[number]) => d.angle,
};
it.each(['archimedean', 'rectangular'] as const)(
  'places measured rotated words deterministically without overlaps using %s',
  (spiral) => {
    const config = { width: 500, height: 300, padding: 3, spiral };
    const cloud = wordCloud(data, accessors, config);
    expect(cloud).toEqual(wordCloud(data, accessors, config));
    expect(cloud.words.length).toBeGreaterThan(10);
    expect(cloud.words.length + cloud.omitted.length).toBe(data.length);
    for (const [i, word] of cloud.words.entries()) {
      expect(word.bounds.left).toBeGreaterThanOrEqual(0);
      expect(word.bounds.top).toBeGreaterThanOrEqual(0);
      expect(word.bounds.right).toBeLessThanOrEqual(500);
      expect(word.bounds.bottom).toBeLessThanOrEqual(300);
      for (const other of cloud.words.slice(i + 1)) {
        expect(
          word.bounds.right <= other.bounds.left ||
            other.bounds.right <= word.bounds.left ||
            word.bounds.bottom <= other.bounds.top ||
            other.bounds.bottom <= word.bounds.top,
        ).toBe(true);
      }
    }
  },
);
it('returns oversized words as omissions and never mutates input', () => {
  const input = Object.freeze([Object.freeze({ ...first, width: 800 })]);
  const result = wordCloud(input, accessors, { width: 200, height: 100 });
  expect(result.words).toEqual([]);
  expect(result.omitted).toEqual(input);
});
it('rejects duplicate keys, non-finite metrics and invalid budgets', () => {
  const config = { width: 300, height: 200 };
  expect(() => wordCloud([first, first], accessors, config)).toThrow('Duplicate');
  expect(() => wordCloud([{ ...first, width: NaN }], accessors, config)).toThrow();
  expect(() => wordCloud(data, accessors, { ...config, padding: -1 })).toThrow();
  expect(() => wordCloud(data, accessors, { ...config, maxSteps: 0 })).toThrow();
  expect(() => wordCloud([], accessors, { ...config, width: Infinity })).toThrow();
});
