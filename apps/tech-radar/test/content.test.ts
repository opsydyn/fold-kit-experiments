import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';

import { Result, Schema } from 'effect';

import { assembleRadar, type ContentFile, EntryFile } from '../src/radar/content';
import type { RadarDataset } from '../src/radar/three/data';
import { demoRadar } from '../src/test/fixture';

const contentDir = new URL('../src/content/', import.meta.url);

/** A folder's markdown as the content collection hands it over: file name and frontmatter. */
const read = (folder: string): ReadonlyArray<ContentFile> =>
  readdirSync(new URL(folder, contentDir))
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const text = readFileSync(new URL(`${folder}/${name}`, contentDir), 'utf8');
      const frontmatter = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
      return { id: name.slice(0, -'.md'.length), data: Bun.YAML.parse(frontmatter) };
    });

const markdown = { editions: read('editions'), entries: read('entries') };

const assembled = (files = markdown): RadarDataset =>
  Result.getOrThrowWith(assembleRadar(files), (reason) => new Error(reason));

const failure = (files: Parameters<typeof assembleRadar>[0]): string =>
  Result.match(assembleRadar(files), {
    onSuccess: () => 'assembled',
    onFailure: (reason) => reason,
  });

/** Lists whose order carries no meaning, in one order, so two datasets compare as sets. */
const sets = (dataset: RadarDataset) => ({
  authoredOn: dataset.authoredOn,
  entries: dataset.entries.toSorted((a, b) => a.id.localeCompare(b.id)),
  relationships: (dataset.relationships ?? [])
    .map(({ from, to, type, note }) => ({ from, to, type, note }))
    .toSorted((a, b) => `${a.from} ${a.to} ${a.type}`.localeCompare(`${b.from} ${b.to} ${b.type}`)),
  editions: (dataset.editions ?? []).map((edition) => ({
    ...edition,
    absent: edition.absent.toSorted(),
  })),
});

/** An entry's frontmatter, decoded, so an edit starts from a valid entry. */
const entryData = (id: string): EntryFile =>
  Schema.decodeUnknownSync(EntryFile)(markdown.entries.find((file) => file.id === id)?.data);

/** The markdown with one entry's frontmatter changed, perhaps into something invalid. */
const editEntry = (id: string, change: (data: EntryFile) => object) => ({
  ...markdown,
  entries: markdown.entries.map((file) =>
    file.id === id ? { id, data: change(entryData(id)) } : file,
  ),
});

describe('the radar markdown', () => {
  test('is the same radar as the fixture: entries, relationships and editions', () => {
    expect(sets(assembled())).toEqual(sets(demoRadar));
  });

  test('lists entries by category, then ring, then name', () => {
    const entries = assembled().entries;
    expect(entries.slice(0, 4).map(({ id }) => id)).toEqual([
      'algebraic-data-types',
      'property-based-testing',
      'retrieval-augmented-generation',
      'structured-model-outputs',
    ]);
    expect(entries.at(-1)?.id).toBe('unison');
  });

  test('takes the newest edition as the current one, in whatever order the files come', () => {
    const shuffled = { ...markdown, editions: markdown.editions.toReversed() };
    expect(assembled(shuffled).authoredOn).toBe('2026-10-14');
    expect(assembled(shuffled).editions?.map(({ label }) => label)).toEqual([
      'First edition',
      'Second edition',
      'Third edition',
    ]);
  });
});

describe('a bad edit names its file', () => {
  test('a missing field', () => {
    expect(failure(editEntry('bun', ({ ring: _, ...rest }) => rest))).toStartWith(
      'entries/bun.md: ',
    );
  });

  test('a ring that is not a ring', () => {
    expect(failure(editEntry('bun', (data) => ({ ...data, ring: 'hold' })))).toStartWith(
      'entries/bun.md: ',
    );
  });

  test('a source that is not an https address', () => {
    expect(failure(editEntry('bun', (data) => ({ ...data, source: 'http://bun.sh/' })))).toBe(
      'entries/bun.md: Radar sources require credential-free HTTPS URLs',
    );
  });

  test('history naming an edition that is not an earlier one', () => {
    expect(
      failure(
        editEntry('bun', (data) => ({
          ...data,
          history: [{ edition: '2026-10-14', ring: 'trial' }],
        })),
      ),
    ).toBe('entries/bun.md: history names 2026-10-14, which is not an earlier edition');
  });

  test('history naming an edition twice', () => {
    const twice = [
      { edition: '2025-10-14', ring: 'trial' },
      { edition: '2025-10-14', ring: 'adopt' },
    ];
    expect(failure(editEntry('bun', (data) => ({ ...data, history: twice })))).toBe(
      'entries/bun.md: history names an edition twice',
    );
  });

  test('a relationship to an entry that does not exist', () => {
    const related = [{ to: 'deno', type: 'alternative-to', note: 'Another runtime.' }];
    expect(failure(editEntry('bun', (data) => ({ ...data, related })))).toBe(
      'entries/bun.md: related names deno, which is not another entry',
    );
  });

  test('an edition whose date is not its file name', () => {
    const editions = markdown.editions.map((file) =>
      file.id === '2025-10-14' ? { id: '2025-10-15', data: file.data } : file,
    );
    expect(failure({ ...markdown, editions })).toBe(
      'editions/2025-10-15.md: its date, 2025-10-14, must be its file name',
    );
  });

  test('no editions at all', () => {
    expect(failure({ ...markdown, editions: [] })).toBe(
      'editions/: the radar needs at least one edition',
    );
  });

  test('a rule across files, such as a full category, names the radar', () => {
    const ninth = {
      id: 'ninth-tool',
      data: { ...entryData('bun'), name: 'Ninth' },
    };
    expect(failure({ ...markdown, entries: [...markdown.entries, ninth] })).toBe(
      'The radar: Radar category exceeds eight layout slots',
    );
  });
});
