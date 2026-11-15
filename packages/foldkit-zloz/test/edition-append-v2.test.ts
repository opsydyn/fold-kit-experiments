import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  appendEditionV2,
  ZlozError,
  appendEdition,
  parseModelDocumentV2,
  parseConnectionDocument,
  captureModelDocumentV2,
  serializeModelDocumentV2,
  serializeEditionsV2,
  parseEditionsV2,
  compareEditionsV2,
  createModelEditorV2,
  createHistoryReviewV2,
  updateEditor,
  type ZlozConnectionMode,
  type ZlozEditionV2,
} from '../src';
import looseWire from './fixtures/connection-v2-loose.json';
import wire from './fixtures/model-v2-modes.json';

const source = () => parseModelDocumentV2(JSON.stringify(wire));
const edition = (mode: ZlozConnectionMode, id = 'checkpoint'): ZlozEditionV2 => ({
  id,
  name: 'Checkpoint',
  snapshot:
    mode === 'strict' ? source().snapshot : parseConnectionDocument(JSON.stringify(looseWire)),
});
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- Test-only structural freeze inspection of validated API results is not a domain decoder. */
function frozen(value: unknown): boolean {
  return (
    value === null ||
    typeof value !== 'object' ||
    (Object.isFrozen(value) && Object.values(value).every(frozen))
  );
}
/* oxlint-enable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof */

for (const existingMode of ['strict', 'loose'] as const)
  for (const proposedMode of ['strict', 'loose'] as const)
    test(`append preserves ${existingMode} archive and ${proposedMode} proposed checkpoint exactly`, () => {
      const existing = edition(existingMode, 'existing');
      const proposed = edition(proposedMode, 'new');
      const result = appendEditionV2([existing], proposed);
      if (result.type !== 'appended') throw new Error('Append blocked');
      expect(result.editions.map((item) => item.id)).toEqual(['existing', 'new']);
      expect(result.editions[0]).toEqual(existing);
      expect(result.editions[1]).toEqual(proposed);
      expect(result.editions[0]).not.toBe(existing);
      expect(result.editions[1]).not.toBe(proposed);
      expect(frozen(result)).toBe(true);
      expect(parseEditionsV2(serializeEditionsV2(result.editions))).toEqual(result.editions);
    });

test('empty archive keeps host identity/name verbatim and invents no checkpoint metadata', () => {
  const proposed = { ...edition('loose'), id: '  host-key  ', name: '  Workshop edition  ' };
  const result = appendEditionV2([], proposed);
  if (result.type !== 'appended') throw new Error('Append blocked');
  expect(result.editions).toHaveLength(1);
  expect(result.editions[0]).toEqual(proposed);
  expect(Object.keys(result.editions[0]!).sort()).toEqual(['id', 'name', 'snapshot']);
});

test('identical duplicate is explicit, including object-key reorder, without an archive to publish', () => {
  const existing = edition('strict');
  const proposed: ZlozEditionV2 = {
    snapshot: {
      graph: { edges: existing.snapshot.graph.edges, nodes: existing.snapshot.graph.nodes },
      connectionMode: existing.snapshot.connectionMode,
      viewport: existing.snapshot.viewport,
      version: 2,
    },
    name: existing.name,
    id: existing.id,
  };
  const result = appendEditionV2([existing], proposed);
  if (result.type !== 'blocked') throw new Error('Duplicate appended');
  expect(result.code).toBe('duplicate-edition');
  expect(result.reason.length).toBeGreaterThan(0);
  expect('editions' in result).toBe(false);
  expect(result.existing).toEqual(existing);
  expect(result.proposed).toEqual(proposed);
  expect(result.existing).not.toBe(existing);
  expect(result.proposed).not.toBe(proposed);
  expect(frozen(result)).toBe(true);
});

test('same ID with different mode, name, camera, meaning, geometry or authored order conflicts atomically', () => {
  const existing = edition('strict');
  const variants: readonly ZlozEditionV2[] = [
    { ...existing, snapshot: { ...existing.snapshot, connectionMode: 'loose' } },
    { ...existing, name: 'Renamed' },
    { ...existing, snapshot: { ...existing.snapshot, viewport: { x: 42, y: 80, zoom: 2 } } },
    {
      ...existing,
      snapshot: {
        ...existing.snapshot,
        graph: {
          ...existing.snapshot.graph,
          nodes: existing.snapshot.graph.nodes.map((node) =>
            node.id === 'a' ? { ...node, label: 'Renamed' } : node,
          ),
        },
      },
    },
    {
      ...existing,
      snapshot: {
        ...existing.snapshot,
        graph: {
          ...existing.snapshot.graph,
          nodes: existing.snapshot.graph.nodes.map((node) =>
            node.id === 'a' ? { ...node, position: { x: 42, y: 80 } } : node,
          ),
        },
      },
    },
    {
      ...existing,
      snapshot: {
        ...existing.snapshot,
        graph: { ...existing.snapshot.graph, nodes: [...existing.snapshot.graph.nodes].reverse() },
      },
    },
  ];
  const original = JSON.stringify(existing);
  for (const proposed of variants) {
    const result = appendEditionV2([existing], proposed);
    if (result.type !== 'blocked') throw new Error('Conflict appended');
    expect(result.code).toBe('edition-conflict');
    expect(result.existing).toEqual(existing);
    expect(result.proposed).toEqual(proposed);
    expect('editions' in result).toBe(false);
    expect(frozen(result)).toBe(true);
    expect(JSON.stringify(existing)).toBe(original);
  }
  const modeConflict = appendEditionV2([existing], variants[0]!);
  if (modeConflict.type !== 'blocked') throw new Error('Missing conflict');
  const comparison = compareEditionsV2(modeConflict.existing, modeConflict.proposed);
  expect(comparison.modeChange).toEqual({ kind: 'changed', before: 'strict', after: 'loose' });
  expect(comparison.nodes).toHaveLength(0);
  expect(comparison.edges).toHaveLength(0);
});

test('validates the complete existing archive and candidate before resolving duplicate identities', () => {
  const existing = edition('strict');
  const broken = {
    ...edition('strict', 'unrelated'),
    snapshot: { ...existing.snapshot, graph: { nodes: [], edges: existing.snapshot.graph.edges } },
  };
  expect(() => appendEditionV2([existing, broken], existing)).toThrow(ZlozError);
  expect(() => appendEditionV2([existing, existing], edition('loose', 'new'))).toThrow(ZlozError);
  expect(() => appendEditionV2([existing], { ...existing, name: ' ' })).toThrow(ZlozError);
  expect(() => appendEditionV2([existing], { ...existing, id: '' })).toThrow(ZlozError);
  expect(() => appendEditionV2([existing], broken)).toThrow(ZlozError);
  const legacy = { ...existing, snapshot: { graph: existing.snapshot.graph } };
  const invalidMode = { ...existing, snapshot: { ...existing.snapshot, connectionMode: 'auto' } };
  // @ts-expect-error A v1-shaped existing checkpoint must be upgraded explicitly.
  expect(() => appendEditionV2([legacy], edition('strict', 'new'))).toThrow(ZlozError);
  // @ts-expect-error Unknown modes are invalid even for a duplicate ID.
  expect(() => appendEditionV2([existing], invalidMode)).toThrow(ZlozError);
  expect(existing.snapshot.graph.nodes).toHaveLength(2);
});

test('detaches all success and blocked pins without freezing or mutating caller-owned inputs', () => {
  const existing = structuredClone(edition('strict', 'existing'));
  const proposed = structuredClone(edition('loose', 'new'));
  const current = [existing];
  const previous = JSON.stringify([current, proposed]);
  const result = appendEditionV2(current, proposed);
  if (result.type !== 'appended') throw new Error('Append blocked');
  expect(JSON.stringify([current, proposed])).toBe(previous);
  expect(Object.isFrozen(current)).toBe(false);
  expect(Object.isFrozen(existing.snapshot.graph.nodes[0])).toBe(false);
  expect(Object.isFrozen(proposed.snapshot.graph.nodes[0])).toBe(false);
  Reflect.set(existing.snapshot.graph.nodes[0]!, 'label', 'Changed outside');
  Reflect.set(proposed.snapshot.graph.nodes[0]!, 'label', 'Changed outside');
  expect(result.editions[0]?.snapshot.graph.nodes[0]?.label).toBe('A');
  expect(result.editions[1]?.snapshot.graph.nodes[0]?.label).toBe('Orders');
  const conflict = structuredClone(edition('strict', 'existing'));
  const blocked = appendEditionV2(current, conflict);
  if (blocked.type !== 'blocked') throw new Error('Conflict appended');
  Reflect.set(conflict.snapshot.graph.nodes[0]!, 'label', 'Later');
  expect(blocked.proposed.snapshot.graph.nodes[0]?.label).toBe('A');
  expect(blocked.existing.snapshot.graph.nodes[0]?.label).toBe('Changed outside');
  expect(Object.isFrozen(conflict.snapshot.graph)).toBe(false);
});

test('composes into a v2 model without changing current/origin modes, review history or working Undo', () => {
  const model = source();
  const working = updateEditor(createModelEditorV2(model), {
    type: 'NodeLabelChanged',
    id: 'a',
    label: 'Working',
  });
  const original = serializeModelDocumentV2(model);
  const result = appendEditionV2(model.editions, edition('loose', 'workshop'));
  if (result.type !== 'appended') throw new Error('Append blocked');
  const updated = captureModelDocumentV2({ ...model, editions: result.editions });
  expect(updated.snapshot).toEqual(model.snapshot);
  expect(updated.origin).toEqual(model.origin);
  expect(updated.editions.map((item) => item.snapshot.connectionMode)).toEqual(['loose', 'loose']);
  assert.deepEqual(parseModelDocumentV2(serializeModelDocumentV2(updated)), updated);
  const review = createHistoryReviewV2(updated.editions[1]!, working);
  expect(review.editor.connectionMode).toBe('loose');
  expect(review.editor.readOnly).toBe(true);
  expect(review.editor.past).toHaveLength(0);
  expect(working.connectionMode).toBe('strict');
  expect(working.graph.nodes[0]?.label).toBe('Working');
  expect(working.past).toHaveLength(1);
  expect(serializeModelDocumentV2(model)).toBe(original);
});

test('v1 append retains its legacy strict boundary and duplicate rejection', () => {
  const snapshot = { graph: source().snapshot.graph };
  const legacy = { id: 'legacy', name: 'Legacy', snapshot };
  expect(appendEdition([], legacy)[0]?.snapshot).toEqual(snapshot);
  expect(() => appendEdition([legacy], legacy)).toThrow('Duplicate edition');
  expect(() => appendEdition([], edition('strict'))).toThrow('v2');
  expect(() => appendEdition([], edition('loose'))).toThrow('v2');
});

test('distinct Unicode JSON keys remain order-insensitive even when locale collation treats them equally', () => {
  const base = edition('strict');
  const composed = '\u00e9';
  const decomposed = 'e\u0301';
  const withData = (data: Record<string, string>): ZlozEditionV2 => ({
    ...base,
    snapshot: {
      ...base.snapshot,
      graph: {
        ...base.snapshot.graph,
        nodes: base.snapshot.graph.nodes.map((node) =>
          node.id === 'a' ? { ...node, data } : node,
        ),
      },
    },
  });
  const existing = withData({ [composed]: 'NFC', [decomposed]: 'NFD' });
  const proposed = withData({ [decomposed]: 'NFD', [composed]: 'NFC' });
  const result = appendEditionV2([existing], proposed);
  if (result.type !== 'blocked') throw new Error('Duplicate appended');
  expect(result.code).toBe('duplicate-edition');
  expect(result.existing.snapshot.graph.nodes[0]?.data).toEqual({
    [composed]: 'NFC',
    [decomposed]: 'NFD',
  });
});
