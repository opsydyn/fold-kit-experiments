import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  compareModelEventStormingRelationships,
  createEventStormingPattern,
  serializeModelDocument,
  eventStormingRelationshipRules,
  type ZlozModelDocument,
  type ZlozGraph,
} from '../src/index';

function fixture(): ZlozModelDocument {
  const graph = createEventStormingPattern();
  const first = graph.edges[0];
  const second = graph.edges[1];
  assert(first && second);
  const bad = {
    ...first,
    architecture: { family: 'event-storming' as const, role: 'emits' as const },
  };
  const baseline: ZlozGraph = {
    ...graph,
    edges: ['persist', 'fixed', 'removed', 'recoded'].map((id) => ({ ...bad, id })),
  };
  const selected: ZlozGraph = {
    ...graph,
    edges: [
      { ...bad, id: 'persist', label: 'Updated label', target: second.target },
      { ...first, id: 'fixed' },
      { ...bad, id: 'added' },
      {
        ...first,
        id: 'recoded',
        architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
      },
    ],
  };
  return {
    id: 'orders',
    name: 'Orders',
    snapshot: { graph: selected },
    origin: null,
    editions: [
      { id: 'before', name: 'Before', snapshot: { graph: baseline } },
      { id: 'after', name: 'After', snapshot: { graph: selected } },
    ],
  };
}

test('edition audit comparison reports independently expected introduced, resolved and persisting findings without mutating the model', () => {
  const model = fixture(),
    before = serializeModelDocument(model);
  const result = compareModelEventStormingRelationships(model, { baselineId: 'before' });
  assert(result.type === 'compared');
  const { comparison } = result;
  expect(comparison.status).toBe('regressed');
  expect(comparison.modelId).toBe('orders');
  expect(comparison.baseline.source).toEqual({ kind: 'edition', id: 'before', name: 'Before' });
  expect(comparison.selected.source).toEqual({ kind: 'current' });
  expect(comparison.summary).toEqual({ introduced: 2, resolved: 3, persisting: 1 });
  expect(comparison.introduced.map(({ edgeId, code }) => [edgeId, code])).toEqual([
    ['added', 'incompatible-roles'],
    ['recoded', 'unknown-relationship'],
  ]);
  expect(comparison.resolved.map(({ edgeId, code }) => [edgeId, code])).toEqual([
    ['fixed', 'incompatible-roles'],
    ['recoded', 'incompatible-roles'],
    ['removed', 'incompatible-roles'],
  ]);
  expect(
    comparison.persisting.map(({ before, after }) => [before.edgeId, after.edgeLabel]),
  ).toEqual([['persist', 'Updated label']]);
  expect(comparison.selected.audit.summary.blocked).toBe(3);
  const persisted = comparison.persisting[0];
  assert(persisted);
  expect(persisted.before.message).not.toBe(persisted.after.message);
  expect(persisted.before.target).not.toEqual(persisted.after.target);
  expect(serializeModelDocument(model)).toBe(before);
  const reordered = {
    ...model,
    snapshot: {
      graph: { ...model.snapshot.graph, edges: [...model.snapshot.graph.edges].reverse() },
    },
    editions: [...model.editions].reverse(),
  };
  expect(compareModelEventStormingRelationships(reordered, { baselineId: 'before' })).toEqual(
    result,
  );
});

test('explicit target edition never silently selects current; same-side and reverse comparisons have defined results', () => {
  const model = fixture();
  const same = compareModelEventStormingRelationships(model, {
    baselineId: 'before',
    selectedId: 'before',
  });
  assert(same.type === 'compared');
  expect(same.comparison.status).toBe('no-new-findings');
  expect(same.comparison.summary).toEqual({ introduced: 0, resolved: 0, persisting: 4 });
  expect(same.comparison.selected.audit.status).toBe('incompatible');
  const archived = compareModelEventStormingRelationships(
    { ...model, snapshot: { graph: { nodes: [], edges: [] } } },
    { baselineId: 'before', selectedId: 'after' },
  );
  assert(archived.type === 'compared');
  expect(archived.comparison.selected.source).toEqual({
    kind: 'edition',
    id: 'after',
    name: 'After',
  });
  expect(archived.comparison.summary).toEqual({ introduced: 2, resolved: 3, persisting: 1 });
  const reversed = compareModelEventStormingRelationships(model, {
    baselineId: 'after',
    selectedId: 'before',
  });
  assert(reversed.type === 'compared');
  expect(reversed.comparison.summary).toEqual({ introduced: 3, resolved: 2, persisting: 1 });
});

test('unknown selectors fail closed and origin editions are not implicitly available', () => {
  const model = fixture();
  expect(compareModelEventStormingRelationships(model, { baselineId: 'missing' })).toMatchObject({
    type: 'blocked',
    code: 'unknown-baseline',
    editionId: 'missing',
  });
  expect(
    compareModelEventStormingRelationships(model, { baselineId: 'before', selectedId: 'missing' }),
  ).toMatchObject({ type: 'blocked', code: 'unknown-edition', editionId: 'missing' });
  const originEdition = model.editions[0];
  assert(originEdition);
  const originOnly = {
    ...model,
    editions: [],
    origin: { modelId: 'parent', modelName: 'Parent', edition: originEdition },
  };
  expect(compareModelEventStormingRelationships(originOnly, { baselineId: 'before' }).type).toBe(
    'blocked',
  );
});

test('one custom convention audits both sides; inferred, unrelated and presentation changes do not invent findings', () => {
  const model = fixture();
  const result = compareModelEventStormingRelationships(
    model,
    { baselineId: 'before' },
    {
      rules: [
        ...eventStormingRelationshipRules,
        {
          architecture: { family: 'event-storming', role: 'custom', name: 'approves' },
          sources: ['actor'],
          targets: ['command'],
          label: 'Approves',
        },
      ],
    },
  );
  assert(result.type === 'compared');
  expect(result.comparison.summary).toEqual({ introduced: 1, resolved: 3, persisting: 1 });
  const graph = createEventStormingPattern();
  const untyped = {
    ...graph,
    edges: graph.edges.map(({ architecture: _architecture, ...edge }) => edge),
  };
  const plain = {
    ...untyped,
    nodes: untyped.nodes.map(({ architecture: _architecture, ...node }) => ({
      ...node,
      position: { x: 90, y: 10 },
    })),
  };
  const clean = compareModelEventStormingRelationships(
    {
      ...model,
      snapshot: { graph: plain },
      editions: [{ id: 'clean', name: 'Clean', snapshot: { graph: untyped } }],
    },
    { baselineId: 'clean' },
  );
  assert(clean.type === 'compared');
  expect(clean.comparison.summary).toEqual({ introduced: 0, resolved: 0, persisting: 0 });
  expect(clean.comparison.baseline.audit.summary.inferred).toBe(4);
  expect(clean.comparison.selected.audit.summary.unrelated).toBe(4);
  const rule = eventStormingRelationshipRules[0];
  assert(rule);
  expect(() =>
    compareModelEventStormingRelationships(
      model,
      { baselineId: 'before' },
      { rules: [rule, rule] },
    ),
  ).toThrow('unique descriptors');
});
