import { describe, expect, it } from 'bun:test';

import { appendPoints, columnStore, columnTable, compilePlot } from '../src/plot/index.js';
import type { Column, ColumnTable, PlotGeometry, PlotSpec } from '../src/plot/index.js';

/** A column's values as numbers, checking it is the Float64Array the table promises. */
const floats = (column: Column | undefined): ReadonlyArray<number> => {
  if (!(column instanceof Float64Array)) throw new Error('expected a Float64Array column');
  return [...column];
};

const chunk = (from: number, count: number): ColumnTable =>
  columnTable({
    latency: Float64Array.from({ length: count }, (_, i) => ((from + i) * 37) % 2000),
    payload: Float64Array.from({ length: count }, (_, i) => ((from + i) * 13) % 300),
    kind: Array.from(
      { length: count },
      (_, i) => ['read', 'write', 'delete'][(from + i) % 3] ?? null,
    ),
  });

const spec: PlotSpec = {
  width: 400,
  height: 300,
  x: { domain: [0, 2000] },
  y: { domain: [0, 300] },
  color: { domain: ['read', 'write', 'delete'] },
  marks: [{ mark: 'dot', x: 'latency', y: 'payload', fill: 'kind', dense: true }],
};

const points = (geometry: PlotGeometry) => {
  const g = geometry.facets[0]?.marks[0]?.graphics[0];
  if (g?.kind !== 'points') throw new Error('expected packed points');
  return g;
};

describe('columnStore', () => {
  it('grows a column table chunk by chunk, each table a view of what has arrived', () => {
    const store = columnStore();
    const first = store.append(chunk(0, 3));
    const second = store.append(chunk(3, 4));
    expect(first.length).toBe(3);
    expect(second.length).toBe(7);
    expect(second.columns.latency).toBeInstanceOf(Float64Array);
    expect(floats(second.columns.latency)).toEqual(floats(chunk(0, 7).columns.latency));
    expect(second.columns.kind).toEqual(chunk(0, 7).columns.kind);
    // An earlier table is unchanged by later appends.
    expect(first.columns.latency?.length).toBe(3);
    expect(first.columns.kind).toEqual(chunk(0, 3).columns.kind);
    expect(store.table()).toBe(second);
  });

  it('keeps growing past its capacity without losing values', () => {
    const store = columnStore();
    for (let i = 0; i < 100; i += 1) store.append(chunk(i * 1000, 1000));
    const table = store.table();
    expect(table.length).toBe(100_000);
    expect(table.columns.payload?.[99_999]).toBe((99_999 * 13) % 300);
  });

  it('turns nulls into NaN in a numeric column, as duckdbColumns does', () => {
    const store = columnStore();
    store.append(columnTable({ x: Float64Array.of(1, 2) }));
    const table = store.append(columnTable({ x: [null, 4] }));
    expect(floats(table.columns.x)).toEqual([1, 2, Number.NaN, 4]);
  });

  it('refuses a chunk with different columns', () => {
    const store = columnStore();
    store.append(chunk(0, 2));
    expect(() => store.append(columnTable({ latency: Float64Array.of(1) }))).toThrow(
      'append: the chunk has columns latency; the store has latency, payload, kind',
    );
  });
});

describe('appendPoints', () => {
  it('appends a chunk to dense points without recompiling what is there, matching a full compile', () => {
    const store = columnStore();
    let geometry = compilePlot({ ...spec, data: store.append(chunk(0, 500)) });
    for (let at = 500; at < 3000; at += 500) {
      const next = chunk(at, 500);
      geometry = appendPoints(geometry, spec, next, { rowOffset: store.table().length });
      store.append(next);
    }
    const full = points(compilePlot({ ...spec, data: chunk(0, 3000) }));
    const grown = points(geometry);
    expect(grown.count).toBe(3000);
    expect([...grown.xs]).toEqual([...full.xs]);
    expect([...grown.ys]).toEqual([...full.ys]);
    expect([...grown.rows]).toEqual([...full.rows]);
    const colours = (g: typeof full) => [...g.paint].map((p) => g.palette[p]);
    expect(colours(grown)).toEqual(colours(full));
  });

  it('drops a highlight, which the caller restyles for the new rows', () => {
    const geometry = compilePlot({ ...spec, data: chunk(0, 10) });
    const dimmed = {
      ...geometry,
      facets: geometry.facets.map((f) => ({
        ...f,
        marks: f.marks.map((m) => ({
          ...m,
          graphics: m.graphics.map((g) =>
            g.kind === 'points' ? { ...g, dimmed: new Uint8Array(g.count).fill(1) } : g,
          ),
        })),
      })),
    };
    expect(
      points(appendPoints(dimmed, spec, chunk(10, 5), { rowOffset: 10 })).dimmed,
    ).toBeUndefined();
  });

  it('refuses a spec whose scales a new chunk could change', () => {
    const geometry = compilePlot({ ...spec, data: chunk(0, 10) });
    const { x: _x, ...noX } = spec;
    expect(() => appendPoints(geometry, noX, chunk(10, 5), { rowOffset: 10 })).toThrow(
      'appendPoints: x needs a fixed domain, or a new chunk could move every point; recompile instead',
    );
    const { color: _color, ...noColour } = spec;
    expect(() => appendPoints(geometry, noColour, chunk(10, 5), { rowOffset: 10 })).toThrow(
      'appendPoints: color needs a fixed domain',
    );
  });

  it('refuses marks other than dense dots, which need all their rows', () => {
    const lines: PlotSpec = { ...spec, marks: [{ mark: 'line', x: 'latency', y: 'payload' }] };
    const geometry = compilePlot({ ...lines, data: chunk(0, 10) });
    expect(() => appendPoints(geometry, lines, chunk(10, 5), { rowOffset: 10 })).toThrow(
      'appendPoints: marks[0] is a line mark; only dense dot marks append',
    );
  });
});
