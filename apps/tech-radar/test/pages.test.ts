import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { movementChart } from '../src/radar/movement';
import {
  byCategoryAndRing,
  changesAt,
  editionEntryPaths,
  editionsIn,
  entryHref,
  entryPage,
  radarHref,
} from '../src/radar/pages';
import { demoRadar } from '../src/test/fixture';

const editions = editionsIn(demoRadar, 'Fourth edition');
const page = (id: string, index: number) =>
  Option.getOrThrowWith(entryPage(demoRadar, editions, id, index), () => new Error(id));

describe('editions', () => {
  test('are oldest first, the current one last with its own label', () => {
    expect(editions.map(({ date, label, isCurrent }) => [date, label, isCurrent])).toEqual([
      ['2025-10-14', 'First edition', false],
      ['2026-02-14', 'Second edition', false],
      ['2026-06-14', 'Third edition', false],
      ['2026-10-14', 'Fourth edition', true],
    ]);
  });

  test('say what changed since the one before, and nothing for the first', () => {
    expect(changesAt(demoRadar, 0)).toEqual([]);
    expect(changesAt(demoRadar, 3)).toContain('Pi joined in Trial');
  });

  test('group their entries by category and ring, with the rings they held then', () => {
    const first = byCategoryAndRing(demoRadar, 0);
    const languages = first.find(({ category }) => category === 'languages-frameworks');
    const assess = languages?.rings.find(({ ring }) => ring === 'assess');
    expect(assess?.entries.map(({ id }) => id)).toContain('foldkit');
  });
});

describe("an entry's page", () => {
  test('shows its ring in the edition, and where it stood in every edition', () => {
    const foldkit = page('foldkit', 0);
    expect(foldkit.ring).toBe('assess');
    expect(foldkit.history.map(({ ring }) => Option.getOrNull(ring))).toEqual([
      'assess',
      'trial',
      'trial',
      'adopt',
    ]);
  });

  test('marks the editions an entry was absent from', () => {
    expect(page('codex', 3).history.map(({ ring }) => Option.getOrNull(ring))).toEqual([
      null,
      null,
      'assess',
      'trial',
    ]);
  });

  test('is none for an edition the entry was not on', () => {
    expect(entryPage(demoRadar, editions, 'codex', 0)).toEqual(Option.none());
  });

  test('reads relationships from its own side, both ways, linking in the same edition', () => {
    const elm = page('elm', 1);
    expect(elm.relations).toContainEqual(
      expect.objectContaining({ other: 'foldkit', name: 'FoldKit', label: 'Inspired' }),
    );
    expect(elm.relations[0]?.href).toBe('/edition/2026-02-14/blip/foldkit/');
  });

  test('links to its neighbours in its category at that edition', () => {
    const bun = page('bun', 3);
    expect(Option.map(bun.previous, ({ id }) => id)).toEqual(Option.none());
    expect(Option.map(bun.next, ({ id }) => id)).toEqual(Option.some('tree-sitter'));
  });
});

describe('addresses', () => {
  test('an entry on an earlier edition has that edition’s page; otherwise its current one', () => {
    expect(entryHref(demoRadar, 'foldkit', 1)).toBe('/edition/2026-02-14/blip/foldkit/');
    expect(entryHref(demoRadar, 'foldkit', 3)).toBe('/blip/foldkit/');
    expect(entryHref(demoRadar, 'codex', 1)).toBe('/blip/codex/');
  });

  test('the 3D radar opens on the entry, in the edition shown', () => {
    expect(radarHref(demoRadar, 'foldkit', 1)).toBe('/?entry=foldkit&edition=2026-02-14');
    expect(radarHref(demoRadar, 'foldkit', 3)).toBe('/?entry=foldkit');
  });

  test('every entry on every earlier edition gets an edition page', () => {
    const paths = editionEntryPaths(demoRadar, editions);
    const presentInFirst = demoRadar.entries.length - 7;
    expect(paths.filter(({ date }) => date === '2025-10-14')).toHaveLength(presentInFirst);
    expect(paths.some(({ date, id }) => date === '2025-10-14' && id === 'codex')).toBe(false);
  });
});

describe('the movement chart', () => {
  test('marks every edition the entry was on, Adopt highest, and breaks where it was absent', () => {
    const codex = movementChart(page('codex', 3).history);
    expect(codex.marks).toHaveLength(2);
    const [assess, trial] = codex.marks;
    expect((trial?.y ?? 0) < (assess?.y ?? 0)).toBe(true);
    expect(codex.marks.at(-1)?.current).toBe(true);
    // One unbroken run: Codex was absent from the first two editions only.
    expect(Option.getOrElse(codex.path, () => '').match(/M/g)).toHaveLength(1);
  });

  test('breaks the line in two around an absence in the middle', () => {
    const history = page('foldkit', 3).history.map((standing, index) =>
      index === 1 ? { ...standing, ring: Option.none() } : standing,
    );
    expect(Option.getOrElse(movementChart(history).path, () => '').match(/M/g)).toHaveLength(2);
  });
});
