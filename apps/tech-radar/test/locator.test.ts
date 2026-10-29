import { describe, expect, test } from 'bun:test';

import { locatorFor } from '../src/radar/locator';
import { entriesAt } from '../src/radar/pages';
import { demoRadar } from '../src/test/fixture';

const entryOf = (id: string) => {
  const entry = demoRadar.entries.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(id);
  return entry;
};

describe('the locator', () => {
  const locator = locatorFor(demoRadar, 3, entryOf('foldkit'));

  test('draws the four ring bands, the entry’s own lit', () => {
    expect(locator.bands.map(({ ring, current }) => [ring, current])).toEqual([
      ['adopt', true],
      ['trial', false],
      ['assess', false],
      ['caution', false],
    ]);
  });

  test('shows every entry in the category at the edition, the entry itself once', () => {
    const inCategory = entriesAt(demoRadar, 3).filter(
      ({ entry }) => entry.category === 'languages-frameworks',
    );
    expect(locator.blips).toHaveLength(inCategory.length);
    expect(locator.blips.filter(({ current }) => current).map(({ id }) => id)).toEqual(['foldkit']);
  });

  test('keeps each dot inside its quarter and its band, and apart from the others', () => {
    const bounds = { adopt: [0, 102], trial: [102, 153], assess: [153, 204], caution: [204, 255] };
    for (const { x, y, ring } of locator.blips) {
      const distance = Math.hypot(x, y);
      expect(x).toBeGreaterThan(0);
      expect(y).toBeLessThan(0);
      expect(distance).toBeGreaterThan(bounds[ring][0]);
      expect(distance).toBeLessThan(bounds[ring][1]);
    }
    const gaps = locator.blips.flatMap((a, i) =>
      locator.blips.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y)),
    );
    expect(Math.min(...gaps)).toBeGreaterThan(14);
  });

  test("links each dot to that entry's page at the edition", () => {
    const earlier = locatorFor(demoRadar, 1, entryOf('foldkit'));
    expect(earlier.blips.find(({ id }) => id === 'foldkit')?.href).toBe(
      '/edition/2026-02-14/blip/foldkit/',
    );
  });
});
