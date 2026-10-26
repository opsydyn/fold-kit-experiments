import { describe, expect, it } from 'bun:test';

import { categoryIds, ringIds, type RadarEntry, type Ring } from '../src/radar/data';
import {
  categoryCenter,
  countRings,
  filterPositions,
  layoutEntries,
  type RadarFilters,
} from '../src/radar/layout';

const filters: RadarFilters = { query: '', category: 'all', rings: ringIds };
function entry(id: string, ring: Ring = 'adopt'): RadarEntry {
  return {
    id,
    name: id,
    category: 'tools',
    ring,
    description: 'Typed functional tooling',
    sourceUrl: 'https://example.com/',
  };
}

describe('radar layout and filtering', () => {
  it('keeps category slots and display identities stable after reordering and filtering', () => {
    const input = Object.freeze(
      Array.from('abcdefgh', (id) => Object.freeze({ ...entry(id), description: 'Plain kit' })),
    );
    const positions = layoutEntries(input);
    expect(positions[0]).toMatchObject({ longitude: -75, latitude: 22, displayNumber: 1 });
    expect(positions[4]).toMatchObject({ longitude: -75, latitude: -22, displayNumber: 5 });
    expect(layoutEntries([...input].reverse())).toEqual(positions);
    expect(filterPositions(positions, { ...filters, query: ' e ' })).toEqual([positions[4]]);
    expect(categoryIds.map(categoryCenter)).toEqual([
      [-135, 20],
      [-45, 20],
      [45, 20],
      [135, 20],
    ]);
  });
  it('intersects name/description search, category and ring without hiding disabled-ring counts', () => {
    const positions = layoutEntries([
      entry('alpha'),
      entry('beta', 'trial'),
      { ...entry('gamma', 'assess'), category: 'platforms', description: 'A database' },
    ]);
    expect(
      filterPositions(positions, {
        ...filters,
        query: ' TYPED ',
        category: 'tools',
        rings: ['trial'],
      }).map((p) => p.entry.id),
    ).toEqual(['beta']);
    expect(countRings(positions, { ...filters, category: 'tools', rings: [] })).toEqual({
      adopt: 1,
      trial: 1,
      assess: 0,
      caution: 0,
    });
    expect(filterPositions(positions, { ...filters, rings: [] })).toEqual([]);
    expect(filterPositions(positions, { ...filters, query: 'absent' })).toEqual([]);
  });
});
