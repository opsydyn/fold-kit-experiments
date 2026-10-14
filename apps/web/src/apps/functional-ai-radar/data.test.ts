import { describe, expect, it } from 'vitest';

import { decodeRadarDataset, loadDemoRadar } from './data';
import { demoRadar } from './fixture';

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
