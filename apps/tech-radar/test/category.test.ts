import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { categoryPage, trailOf } from '../src/radar/category';
import { categoryLocator } from '../src/radar/locator';
import { editionsIn, entriesAt } from '../src/radar/pages';
import { demoRadar } from '../src/test/fixture';

const editions = editionsIn(demoRadar, 'Fourth edition');
const current = editions.length - 1;
const pageOf = (category: Parameters<typeof categoryPage>[2], index = current) =>
  Option.getOrThrowWith(categoryPage(demoRadar, editions, category, index), () => new Error());

describe('a category page', () => {
  const page = pageOf('languages-frameworks');
  const cards = page.rings.flatMap(({ cards: inRing }) => inRing);

  test('holds every entry in the category at the edition, a ring at a time', () => {
    const there = entriesAt(demoRadar, current).filter(
      ({ entry }) => entry.category === 'languages-frameworks',
    );
    expect(page.count).toBe(there.length);
    expect(page.rings.map(({ ring }) => ring)).toEqual(['adopt', 'trial', 'assess', 'caution']);
    expect(cards.map(({ number }) => number)).toEqual(cards.map((_, at) => at + 1));
  });

  test('numbers its cards as its map numbers its dots', () => {
    const map = categoryLocator(demoRadar, current, 'languages-frameworks', Option.none());
    const numbers = new Map(map.blips.map(({ id, number }) => [id, number]));
    expect(cards.map(({ entry, number }) => numbers.get(entry.id) === number)).not.toContain(false);
    expect(map.blips.some(({ current: lit }) => lit)).toBe(false);
  });

  test('says what changed in the category, in words without the edition', () => {
    expect(page.changes.find(({ name }) => name === 'FoldKit')).toMatchObject({
      glyph: '▲',
      text: 'Moved in from Trial to Adopt',
      href: '/blip/foldkit/',
    });
    expect(page.changes.every(({ text }) => !text.includes('edition'))).toBe(true);
  });

  test('lists nothing as changed in the first edition', () => {
    expect(pageOf('languages-frameworks', 0).changes).toEqual([]);
  });

  test('counts its entries in each ring in every edition', () => {
    expect(page.composition.map(({ edition }) => edition.index)).toEqual(
      editions.map(({ index }) => index),
    );
    for (const { edition, total, rings } of page.composition) {
      expect(rings.reduce((sum, { count }) => sum + count, 0)).toBe(total);
      expect(total).toBe(pageOf('languages-frameworks', edition.index).count);
    }
  });
});

describe('a card’s trail', () => {
  const history = editions.map((edition, at) => ({
    edition,
    ring:
      [Option.none(), Option.some('trial' as const), Option.some('adopt' as const)][at] ??
      Option.some('adopt' as const),
  }));

  test('marks each edition the entry was on, the one shown filled', () => {
    const trail = trailOf(history, 2);
    expect(trail.marks).toHaveLength(3);
    expect(trail.marks.filter(({ current: shown }) => shown)).toHaveLength(1);
  });

  test('starts its line again after an absence, and puts Adopt above Trial', () => {
    const trail = trailOf(history, 3);
    expect(trail.path.startsWith('M')).toBe(true);
    expect(trail.path.match(/M/g)).toHaveLength(1);
    const [trial, adopt] = trail.marks;
    expect(adopt?.y ?? 0).toBeLessThan(trial?.y ?? 0);
  });
});
