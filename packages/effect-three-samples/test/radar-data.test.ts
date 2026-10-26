import { describe, expect, it } from 'bun:test';

import { decodeRadarDataset, loadDemoRadar } from '../src/radar/data';
import { demoRadar } from '../src/radar/fixture';

const entry = Object.freeze({
  id: 'unison',
  name: 'Unison',
  category: 'languages-frameworks',
  ring: 'assess',
  description: 'Content-addressed functional programming.',
  sourceUrl: 'https://www.unison-lang.org/',
});
const valid = Object.freeze({ authoredOn: '2026-10-14', entries: Object.freeze([entry]) });

describe('radar dataset boundary', () => {
  it('preserves valid records without mutating the original fixture', () => {
    expect(decodeRadarDataset(valid)).toEqual({ _tag: 'Ready', dataset: valid });
    expect(valid.entries).toEqual([entry]);
  });
  it('distinguishes valid empty data from malformed input', () => {
    expect(decodeRadarDataset({ authoredOn: '2026-10-14', entries: [] })).toEqual({
      _tag: 'Ready',
      dataset: { authoredOn: '2026-10-14', entries: [] },
    });
    for (const input of [
      null,
      'radar',
      {},
      { entries: [] },
      { authoredOn: '2026-10-14', entries: null },
    ])
      expect(decodeRadarDataset(input)._tag).toBe('Failure');
  });
  it.each([
    { id: '' },
    { id: 'Unison' },
    { id: 'unison space' },
    { name: '  ' },
    { description: '\n' },
    { category: 'unknown' },
    { ring: 'experimental' },
    { sourceUrl: 'javascript:alert(1)' },
    { sourceUrl: 'http://example.com/' },
    { sourceUrl: 'https://user:password@example.com/' },
    { sourceUrl: 'not-a-url' },
    { sourceUrl: 42 },
    { name: 42 },
  ])('rejects a malformed row instead of hiding it: %j', (patch) => {
    expect(decodeRadarDataset({ ...valid, entries: [{ ...entry, ...patch }] })._tag).toBe(
      'Failure',
    );
  });
  it.each(['2026-02-30', '2026-13-01', '2026-1-01', 'yesterday', '2026-10-14T00:00:00Z'])(
    'rejects invalid authored date %s',
    (authoredOn) => {
      expect(decodeRadarDataset({ ...valid, authoredOn })._tag).toBe('Failure');
    },
  );
  it('rejects duplicate identities even when names differ', () => {
    expect(
      decodeRadarDataset({ ...valid, entries: [entry, { ...entry, name: 'Another name' }] })._tag,
    ).toBe('Failure');
  });
  it('rejects a ninth entry rather than producing overlapping slots', () => {
    const entries = Array.from({ length: 9 }, (_, i) => ({ ...entry, id: `entry-${i}` }));
    expect(decodeRadarDataset({ ...valid, entries })._tag).toBe('Failure');
    expect(decodeRadarDataset({ ...valid, entries: entries.slice(0, 8) })._tag).toBe('Ready');
  });
  it('loads exactly the original 32-entry roster with the specified illustrative placements', () => {
    const data = loadDemoRadar();
    if (data._tag !== 'Ready') throw new Error(data.reason);
    expect(data.dataset.authoredOn).toBe('2026-10-14');
    expect(data.dataset.entries.map(({ name, ring }) => [name, ring])).toEqual([
      ['Algebraic data types', 'adopt'],
      ['Property-based testing', 'adopt'],
      ['Retrieval-augmented generation', 'trial'],
      ['Structured model outputs', 'trial'],
      ['Relational programming', 'assess'],
      ['Proof-guided generation', 'assess'],
      ['Unreviewed generated changes', 'caution'],
      ['Unbounded agent authority', 'caution'],
      ['Bun', 'adopt'],
      ['Tree-sitter', 'adopt'],
      ['Ollama', 'trial'],
      ['Codex', 'trial'],
      ['Claude Code', 'trial'],
      ['Pi', 'trial'],
      ['llama.cpp', 'assess'],
      ['marimo', 'assess'],
      ['BEAM', 'adopt'],
      ['SQLite', 'adopt'],
      ['DuckDB', 'trial'],
      ['Cloudflare Workers', 'trial'],
      ['WebAssembly', 'assess'],
      ['Local-first sync', 'assess'],
      ['Unison Cloud', 'assess'],
      ['WebGPU', 'assess'],
      ['Effect', 'adopt'],
      ['FoldKit', 'adopt'],
      ['Clojure', 'trial'],
      ['Gleam', 'trial'],
      ['Elm', 'trial'],
      ['Unison', 'assess'],
      ['Futhark', 'assess'],
      ['Lean', 'assess'],
    ]);
    expect(new Set(data.dataset.entries.map(({ id }) => id)).size).toBe(32);
    for (const category of ['techniques', 'tools', 'platforms', 'languages-frameworks'])
      expect(data.dataset.entries.filter((item) => item.category === category)).toHaveLength(8);
    expect(decodeRadarDataset(demoRadar)._tag).toBe('Ready');
  });
});

describe('radar relationships boundary', () => {
  const other = Object.freeze({ ...entry, id: 'unison-cloud', name: 'Unison Cloud' });
  const withRelationships = (relationships: ReadonlyArray<unknown>) => ({
    authoredOn: '2026-10-14',
    entries: [entry, other],
    relationships,
  });
  const builds = { from: 'unison-cloud', to: 'unison', type: 'builds-on', note: 'Runs Unison.' };

  it('accepts relationships between known entries, and datasets without any', () => {
    expect(decodeRadarDataset(withRelationships([builds]))._tag).toBe('Ready');
    expect(decodeRadarDataset({ authoredOn: '2026-10-14', entries: [entry] })._tag).toBe('Ready');
  });

  it.each([
    [
      'an unknown entry',
      [{ ...builds, to: 'missing' }],
      'Radar relationships must name known entries',
    ],
    ['itself', [{ ...builds, to: 'unison-cloud' }], 'Radar relationships need two entries'],
    ['a blank note', [{ ...builds, note: '  ' }], 'Radar relationships need a note'],
    ['a repeat', [builds, builds], 'Duplicate radar relationships'],
    [
      'a peer relationship reversed',
      [
        { ...builds, type: 'complements' },
        { ...builds, from: 'unison', to: 'unison-cloud', type: 'complements' },
      ],
      'Duplicate radar relationships',
    ],
  ])('rejects a relationship to %s', (_, relationships, reason) => {
    expect(decodeRadarDataset(withRelationships(relationships))).toEqual({
      _tag: 'Failure',
      reason,
    });
  });

  it('allows a one-way relationship in both directions, and rejects unknown types', () => {
    const back = { ...builds, from: 'unison', to: 'unison-cloud' };
    expect(decodeRadarDataset(withRelationships([builds, back]))._tag).toBe('Ready');
    expect(decodeRadarDataset(withRelationships([{ ...builds, type: 'depends-on' }]))._tag).toBe(
      'Failure',
    );
  });

  it('ships sixteen relationships, FoldKit inspired by Elm among them', () => {
    const data = loadDemoRadar();
    if (data._tag !== 'Ready') throw new Error(data.reason);
    expect(data.dataset.relationships).toHaveLength(16);
    expect(data.dataset.relationships).toContainEqual(
      expect.objectContaining({ from: 'foldkit', to: 'elm', type: 'inspired-by' }),
    );
  });
});

describe('radar editions boundary', () => {
  const other = Object.freeze({ ...entry, id: 'unison-cloud', name: 'Unison Cloud' });
  const withEditions = (editions: ReadonlyArray<unknown>) => ({
    authoredOn: '2026-10-14',
    entries: [entry, other],
    editions,
  });
  const first = {
    authoredOn: '2026-01-01',
    label: 'First',
    rings: { unison: 'trial' },
    absent: [],
  };

  it('accepts earlier editions in order that name known entries', () => {
    const second = {
      ...first,
      authoredOn: '2026-05-01',
      label: 'Second',
      absent: ['unison-cloud'],
    };
    expect(decodeRadarDataset(withEditions([first, second]))._tag).toBe('Ready');
  });

  it.each([
    [
      'out of order',
      [{ ...first, authoredOn: '2026-05-01' }, first],
      'Radar editions must be in order, before the current one',
    ],
    [
      'not before the current edition',
      [{ ...first, authoredOn: '2026-10-14' }],
      'Radar editions must be in order, before the current one',
    ],
    [
      'an invalid date',
      [{ ...first, authoredOn: '2026-02-30' }],
      'Invalid radar edition date or label',
    ],
    ['a blank label', [{ ...first, label: ' ' }], 'Invalid radar edition date or label'],
    [
      'an unknown entry',
      [{ ...first, absent: ['missing'] }],
      'Radar editions must name known entries',
    ],
  ])('rejects editions %s', (_, editions, reason) => {
    expect(decodeRadarDataset(withEditions(editions))).toEqual({ _tag: 'Failure', reason });
  });

  it('ships three earlier editions before the current one', () => {
    const data = loadDemoRadar();
    if (data._tag !== 'Ready') throw new Error(data.reason);
    expect(data.dataset.editions?.map(({ authoredOn }) => authoredOn)).toEqual([
      '2025-10-14',
      '2026-02-14',
      '2026-06-14',
    ]);
  });
});
