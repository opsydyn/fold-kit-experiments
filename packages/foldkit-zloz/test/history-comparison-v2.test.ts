import { describe, expect, test } from 'bun:test';
import { deepStrictEqual } from 'node:assert';

import {
  compareEditionsV2,
  compareEditions,
  parseModelDocumentV2,
  parseConnectionDocument,
} from '../src';
import type { ZlozConnectionMode, ZlozEditionV2 } from '../src';
import looseWire from './fixtures/connection-v2-loose.json';
import modelWire from './fixtures/model-v2-modes.json';

const seed = parseModelDocumentV2(JSON.stringify(modelWire)).editions[0]!;
const edition = (mode: ZlozConnectionMode): ZlozEditionV2 => ({
  ...seed,
  snapshot: { ...seed.snapshot, connectionMode: mode },
});

describe('v2 edition comparison', () => {
  for (const before of ['strict', 'loose'] as const)
    for (const after of ['strict', 'loose'] as const)
      test(`${before} → ${after} without invented graph changes`, () => {
        const result = compareEditionsV2(edition(before), edition(after));
        deepStrictEqual(
          result.modeChange,
          before === after
            ? { kind: 'unchanged', mode: before }
            : { kind: 'changed', before, after },
        );
        expect(result.nodes).toEqual([]);
        expect(result.edges).toEqual([]);
        expect(result.semanticChanged).toBe(before !== after);
        expect(result.layoutChanged).toBe(false);
      });

  test('meaning and geometry remain independent of mode changes', () => {
    const baseline = edition('strict');
    const selected: ZlozEditionV2 = {
      ...edition('loose'),
      snapshot: {
        ...edition('loose').snapshot,
        graph: {
          ...seed.snapshot.graph,
          nodes: seed.snapshot.graph.nodes.map((node) =>
            node.id === 'a' ? { ...node, label: 'Renamed', position: { x: 50, y: 10 } } : node,
          ),
        },
      },
    };
    const result = compareEditionsV2(baseline, selected);
    expect(
      result.nodes.map(({ id, semanticChanged, layoutChanged }) => ({
        id,
        semanticChanged,
        layoutChanged,
      })),
    ).toEqual([{ id: 'a', semanticChanged: true, layoutChanged: true }]);
    expect(
      result.edges.map(({ id, semanticChanged, layoutChanged }) => ({
        id,
        semanticChanged,
        layoutChanged,
      })),
    ).toEqual([{ id: 'e', semanticChanged: false, layoutChanged: true }]);
    expect(result.semanticChanged).toBe(true);
    expect(result.layoutChanged).toBe(true);
  });

  test('graph-only layout and semantic deltas aggregate without mode changes', () => {
    const baseline = edition('strict');
    for (const layout of [false, true]) {
      const selected: ZlozEditionV2 = {
        ...baseline,
        snapshot: {
          ...baseline.snapshot,
          graph: {
            ...baseline.snapshot.graph,
            nodes: baseline.snapshot.graph.nodes.map((node) =>
              node.id !== 'a'
                ? node
                : layout
                  ? { ...node, position: { x: 20, y: 10 } }
                  : { ...node, label: 'Changed' },
            ),
          },
        },
      };
      const result = compareEditionsV2(baseline, selected);
      expect(result.modeChange).toEqual({ kind: 'unchanged', mode: 'strict' });
      expect(result.semanticChanged).toBe(!layout);
      expect(result.layoutChanged).toBe(layout);
    }
  });

  test('added and removed IDs remain ordered without rewriting endpoints', () => {
    const baseline = edition('loose');
    const selected: ZlozEditionV2 = {
      ...baseline,
      snapshot: {
        ...baseline.snapshot,
        graph: { nodes: [{ ...baseline.snapshot.graph.nodes[0]!, id: 'z' }], edges: [] },
      },
    };
    const result = compareEditionsV2(baseline, selected);
    expect(result.nodes.map((change) => [change.id, change.kind])).toEqual([
      ['a', 'removed'],
      ['b', 'removed'],
      ['z', 'added'],
    ]);
    expect(result.edges.map((change) => [change.id, change.kind])).toEqual([['e', 'removed']]);
    expect(result.edges[0]?.before?.source).toEqual({ node: 'a', port: 'out' });
    expect(result.semanticChanged).toBe(true);
    expect(result.layoutChanged).toBe(true);
  });

  test('loose-only input connections retain identity and are validated in their own mode', () => {
    const baseline = {
      id: 'loose',
      name: 'Loose',
      snapshot: parseConnectionDocument(JSON.stringify(looseWire)),
    };
    const result = compareEditionsV2(baseline, baseline);
    expect(result.baseline.snapshot.graph.edges[0]?.id).toBe('orders-billing');
    expect(result.nodes).toEqual([]);
    expect(() =>
      compareEditionsV2(baseline, {
        ...baseline,
        snapshot: { ...baseline.snapshot, connectionMode: 'strict' },
      }),
    ).toThrow();
  });

  test('camera and edition metadata are pinned but excluded from graph flags', () => {
    const baseline = edition('strict');
    const selected = {
      ...baseline,
      id: 'another',
      name: 'Another',
      snapshot: {
        ...baseline.snapshot,
        viewport: { x: 50, y: 60, zoom: 2 },
        graph: {
          nodes: [...baseline.snapshot.graph.nodes].reverse(),
          edges: baseline.snapshot.graph.edges,
        },
      },
    };
    const result = compareEditionsV2(baseline, selected);
    expect(result.selected.snapshot.viewport).toEqual({ x: 50, y: 60, zoom: 2 });
    expect(result.selected.id).toBe('another');
    expect(result.semanticChanged).toBe(false);
    expect(result.layoutChanged).toBe(false);
  });

  test('detaches and freezes pins, change records and arrays without freezing callers', () => {
    const baseline = structuredClone(edition('loose'));
    const selected = structuredClone(baseline);
    Reflect.set(selected.snapshot.graph.nodes[0]!, 'label', 'Changed');
    const result = compareEditionsV2(baseline, selected);
    Reflect.set(baseline.snapshot.graph.nodes[0]!, 'label', 'Later');
    expect(result.baseline.snapshot.graph.nodes[0]!.label).toBe('A');
    for (const value of [
      result,
      result.modeChange,
      result.nodes,
      result.edges,
      result.nodes[0],
      result.nodes[0]?.after,
      result.baseline.snapshot.graph.nodes[0],
    ])
      expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(baseline.snapshot.graph)).toBe(false);
  });

  test('rejects missing/unknown modes, v1 snapshots and malformed graphs', () => {
    for (const snapshot of [
      { graph: seed.snapshot.graph },
      { ...seed.snapshot, connectionMode: 'auto' },
      { ...seed.snapshot, graph: { nodes: [], edges: seed.snapshot.graph.edges } },
    ]) {
      // @ts-expect-error Deliberately invalid wire input must fail at the public boundary.
      expect(() => compareEditionsV2(seed, { ...seed, snapshot })).toThrow();
      // @ts-expect-error Validate the baseline boundary independently as well.
      expect(() => compareEditionsV2({ ...seed, snapshot }, seed)).toThrow();
    }
  });

  test('legacy comparison rejects explicit v2 but preserves ordinary v1 result references', () => {
    const strictV2 = edition('strict');
    expect(() => compareEditions(strictV2, strictV2)).toThrow('v2');
    expect(() => compareEditions(seed, seed)).toThrow('v2');
    const legacy = { id: 'v1', name: 'V1', snapshot: { graph: seed.snapshot.graph } };
    expect(() => compareEditions(legacy, strictV2)).toThrow('v2');
    expect(() => compareEditions(strictV2, legacy)).toThrow('v2');
    const result = compareEditions(legacy, legacy);
    expect(result.baseline).toBe(legacy);
    expect(result.selected).toBe(legacy);
    expect(result.nodes).toEqual([]);
  });
});
