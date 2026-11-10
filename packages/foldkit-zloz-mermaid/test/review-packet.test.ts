import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  createEventStormingPattern,
  serializeModelDocument,
  compareModelEventStormingRelationships,
  eventStormingRelationshipRules,
  type ZlozModelDocument,
} from '@opsydyn/foldkit-zloz';

import { createReviewPacket, type ZlozReviewPacket } from '../src/index';

function fixture(): ZlozModelDocument {
  const graph = createEventStormingPattern(),
    first = graph.edges[0];
  assert(first);
  const bad = {
    ...graph,
    edges: [
      {
        ...first,
        id: '支付:edge',
        label: 'Approval',
        architecture: {
          family: 'event-storming' as const,
          role: 'custom' as const,
          name: 'approves',
        },
      },
    ],
  };
  return {
    id: 'orders',
    name: 'Orders',
    origin: null,
    snapshot: { graph: bad, viewport: { x: 1, y: 2, zoom: 0.5 } },
    editions: [
      { id: 'before', name: 'Before', snapshot: { graph } },
      { id: 'after', name: 'After', snapshot: { graph: bad } },
      { id: 'unrelated', name: 'Not selected', snapshot: { graph: { nodes: [], edges: [] } } },
    ],
  };
}
test('portable packet includes only chosen snapshots, reproducible conventions, audit delta and both loss-aware projections', () => {
  const model = fixture(),
    original = serializeModelDocument(model);
  const result = createReviewPacket(
    model,
    { baselineId: 'before' },
    { lossPolicy: 'report', direction: 'TB' },
  );
  assert(result.status === 'created');
  const packet: ZlozReviewPacket = result.value;
  expect(packet.format).toBe('foldkit-zloz-review');
  expect(packet.version).toBe(1);
  expect(packet.scope).toBe('selected-snapshots');
  expect(packet.model).toEqual({ id: 'orders', name: 'Orders' });
  expect(packet.baseline.source).toEqual({ kind: 'edition', id: 'before', name: 'Before' });
  expect(packet.selected.source).toEqual({ kind: 'current' });
  expect(packet.selected.snapshot).toEqual(model.snapshot);
  expect(packet.selected.snapshot).not.toBe(model.snapshot);
  expect(packet.comparison.summary).toEqual({ introduced: 1, resolved: 0, persisting: 0 });
  expect(packet.conventions).toEqual({
    source: 'builtin',
    roleInterpretation: 'zloz-event-storming/v1',
    rules: eventStormingRelationshipRules,
  });
  expect(packet.projections.baseline.source).toStartWith('flowchart TB\n');
  expect(packet.projectionOptions).toEqual({ direction: 'TB', lossPolicy: 'report' });
  expect(packet.projections.selected.identity.edges[0]?.flowId).toBe('支付:edge');
  expect(
    packet.diagnostics.some((item) => item.side === 'selected' && item.code === 'viewport-omitted'),
  ).toBe(true);
  expect(
    packet.diagnostics.some((item) => item.side === 'baseline' && item.code === 'layout-omitted'),
  ).toBe(true);
  expect(JSON.stringify(packet)).not.toContain('Not selected');
  expect(JSON.stringify(packet)).not.toContain('"origin"');
  expect(serializeModelDocument(model)).toBe(original);
  expect(
    createReviewPacket(model, { baselineId: 'before' }, { lossPolicy: 'report', direction: 'TB' }),
  ).toEqual(result);
  const portable = JSON.parse(JSON.stringify(packet));
  const reproduced = compareModelEventStormingRelationships(
    {
      ...portable.model,
      origin: null,
      snapshot: portable.selected.snapshot,
      editions: [
        {
          id: portable.baseline.source.id,
          name: portable.baseline.source.name,
          snapshot: portable.baseline.snapshot,
        },
      ],
    },
    { baselineId: portable.baseline.source.id },
    { rules: portable.conventions.rules },
  );
  assert(reproduced.type === 'compared');
  expect(reproduced.comparison).toEqual(packet.comparison);
});
test('explicit edition and same-edition selection never follow current graph; custom conventions are detached data', () => {
  const model = fixture();
  const rule = {
    architecture: { family: 'event-storming' as const, role: 'custom' as const, name: 'approves' },
    sources: ['actor' as const],
    targets: ['command' as const],
    label: 'Approves',
  };
  const rules = [...eventStormingRelationshipRules, rule];
  const result = createReviewPacket(
    model,
    { baselineId: 'before', selectedId: 'after' },
    { lossPolicy: 'report', rules },
  );
  assert(result.status === 'created');
  expect(result.value.selected.source).toEqual({ kind: 'edition', id: 'after', name: 'After' });
  expect(result.value.selected.snapshot.viewport).toBeUndefined();
  expect(result.value.comparison.summary.introduced).toBe(0);
  expect(result.value.conventions.source).toBe('custom');
  rule.label = 'Changed later';
  expect(result.value.conventions.rules.at(-1)?.label).toBe('Approves');
  const same = createReviewPacket(
    model,
    { baselineId: 'after', selectedId: 'after' },
    { lossPolicy: 'report' },
  );
  assert(same.status === 'created');
  expect(same.value.comparison.summary).toEqual({ introduced: 0, resolved: 0, persisting: 1 });
});
test('projection losses reject by default and report mode never permits projection errors; selectors fail closed', () => {
  const model = fixture();
  const strict = createReviewPacket(model, { baselineId: 'before' });
  assert(strict.status === 'rejected');
  expect(strict.reason).toBe('projection');
  expect(
    strict.diagnostics.some((item) => item.side === 'baseline' && item.severity === 'loss'),
  ).toBe(true);
  expect(
    strict.diagnostics.some((item) => item.side === 'selected' && item.code === 'viewport-omitted'),
  ).toBe(true);
  for (const selection of [
    { baselineId: 'missing' },
    { baselineId: 'before', selectedId: 'missing' },
  ]) {
    const result = createReviewPacket(model, selection, { lossPolicy: 'report' });
    assert(result.status === 'rejected');
    expect(result.reason).toBe('input');
    expect(result.diagnostics[0]?.subject).toBe('missing');
  }
  const bad = {
    ...model,
    snapshot: {
      graph: {
        ...model.snapshot.graph,
        nodes: model.snapshot.graph.nodes.map((node) => ({ ...node, label: 'fa:house' })),
      },
    },
  };
  const rejected = createReviewPacket(bad, { baselineId: 'before' }, { lossPolicy: 'report' });
  assert(rejected.status === 'rejected');
  expect(rejected.reason).toBe('projection');
  expect(
    createReviewPacket(
      bad,
      { baselineId: 'before', selectedId: 'before' },
      { lossPolicy: 'report' },
    ).status,
  ).toBe('created');
  expect(
    rejected.diagnostics.some(
      (item) =>
        item.side === 'selected' &&
        item.code === 'unsupported-label-encoding' &&
        item.severity === 'error',
    ),
  ).toBe(true);
});
test('callbacks and unknown export options are rejected rather than silently changing portable semantics', () => {
  const model = fixture();
  let calls = 0;
  const options = {
    lossPolicy: 'report' as const,
    roleOf: () => {
      calls++;
      return null;
    },
  };
  const rejected = createReviewPacket(model, { baselineId: 'before' }, options);
  assert(rejected.status === 'rejected');
  expect(rejected.reason).toBe('input');
  expect(rejected.diagnostics[0]?.code).toBe('invalid-options');
  expect(calls).toBe(0);
  const firstRule = eventStormingRelationshipRules[0];
  assert(firstRule);
  expect(() =>
    createReviewPacket(model, { baselineId: 'before' }, { rules: [firstRule, firstRule] }),
  ).toThrow('unique descriptors');
  const empty = {
    ...model,
    snapshot: { graph: { nodes: [], edges: [] } },
    editions: [{ id: 'empty', name: 'Empty', snapshot: { graph: { nodes: [], edges: [] } } }],
  };
  const result = createReviewPacket(empty, { baselineId: 'empty' });
  assert(result.status === 'created');
  expect(result.value.diagnostics).toEqual([]);
  const cameraOnly = {
    ...empty,
    snapshot: { ...empty.snapshot, viewport: { x: 2, y: 3, zoom: 1 } },
  };
  const strictCamera = createReviewPacket(cameraOnly, { baselineId: 'empty' });
  assert(strictCamera.status === 'rejected');
  expect(strictCamera.reason).toBe('projection');
  expect(strictCamera.diagnostics.map((item) => [item.side, item.code])).toEqual([
    ['selected', 'viewport-omitted'],
  ]);
  expect(
    createReviewPacket(cameraOnly, { baselineId: 'empty' }, { lossPolicy: 'report' }).status,
  ).toBe('created');
  expect(() => createReviewPacket({ ...empty, id: '' }, { baselineId: 'empty' })).toThrow();
});
