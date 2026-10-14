import { describe, expect, it } from 'vitest';

import { categoryIds, ringIds, type RadarEntry, type Ring } from './data';
import {
  categoryCenter,
  countRings,
  filterPositions,
  layoutEntries,
  projectRadar,
  type RadarFilters,
  type RadarPosition,
} from './geometry';

const filters: RadarFilters = { query: '', category: 'all', rings: ringIds };
const view = { center: [0, 0], zoom: 1 } as const;
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
function position(id: string, ring: Ring, longitude: number, latitude = 0): RadarPosition {
  return { entry: entry(id, ring), longitude, latitude, displayNumber: 1 };
}

describe('radar layout and projection', () => {
  it('projects independent shell-radius witnesses and rejects the far hemisphere', () => {
    const scene = projectRadar(
      [
        position('adopt', 'adopt', 30),
        position('trial', 'trial', 30),
        position('rear', 'caution', 180),
      ],
      filters,
      view,
    );
    expect(scene.marks.map((mark) => mark.entry.id)).toEqual(['adopt', 'trial']);
    expect(scene.marks[0]?.x).toBeCloseTo(352, 10);
    expect(scene.marks[1]?.x).toBeCloseTo(378, 10);
    expect(scene.marks.map((mark) => mark.y)).toEqual([300, 300]);
    expect(scene.shells.map((shell) => shell.radius)).toEqual([104, 156, 208, 260]);
  });
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
  it('uses depth order with deterministic ties, even when distinct shells project to one point', () => {
    const marks = projectRadar(
      [position('z', 'trial', 0), position('b', 'adopt', 0), position('a', 'adopt', 0)],
      filters,
      view,
    ).marks;
    expect(marks.map((mark) => [mark.entry.id, mark.x, mark.y, mark.depth])).toEqual([
      ['a', 300, 300, 104],
      ['b', 300, 300, 104],
      ['z', 300, 300, 156],
    ]);
  });
  it('handles exact horizon and poles without invalid guide points', () => {
    const scene = projectRadar(
      [
        position('limb', 'caution', 90),
        position('behind', 'caution', 90.00001),
        position('north', 'caution', 0, 90),
      ],
      filters,
      view,
    );
    expect(scene.marks.find((mark) => mark.entry.id === 'limb')).toMatchObject({
      x: 560,
      y: 300,
      facing: 0,
    });
    expect(scene.marks.some((mark) => mark.entry.id === 'behind')).toBe(false);
    expect(scene.marks.find((mark) => mark.entry.id === 'north')).toMatchObject({ x: 300, y: 40 });
    for (const shell of scene.shells)
      for (const segment of shell.segments)
        for (const [x, y] of segment) {
          expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
          expect(Math.hypot(x - 300, y - 300)).toBeLessThanOrEqual(shell.radius + 1e-7);
        }
  });
  it('culls out-of-viewport marks at zoom without excluding them from the matching list', () => {
    const positions = [position('limb', 'caution', 90)];
    expect(projectRadar(positions, filters, { ...view, zoom: 2 }).marks).toEqual([]);
    expect(filterPositions(positions, filters)).toEqual(positions);
  });
  it.each([NaN, Infinity, 0, 0.9, 2.1])(
    'rejects invalid zoom %s instead of emitting invalid coordinates',
    (zoom) => {
      expect(() => projectRadar([], filters, { ...view, zoom })).toThrow(RangeError);
    },
  );
  it('rejects invalid latitude and non-finite centre', () => {
    expect(() => projectRadar([], filters, { center: [0, 91], zoom: 1 })).toThrow(RangeError);
    expect(() => projectRadar([], filters, { center: [Infinity, 0], zoom: 1 })).toThrow(RangeError);
  });
});
