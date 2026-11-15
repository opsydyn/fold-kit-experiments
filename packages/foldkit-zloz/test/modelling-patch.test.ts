import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  captureModellingPatch,
  dryRunModellingPatch,
  createEditor,
  updateEditor,
  type ZlozModellingPatch,
  type ZlozNode,
} from '../src/index';
import literal from './fixtures/modelling-patch-v1.json';
const node = (id: string): ZlozNode => ({
  id,
  label: id,
  position: { x: 0, y: 0 },
  size: { width: 100, height: 80 },
  ports: [
    { id: 'out', kind: 'output', side: 'right', offset: 0.5 },
    { id: 'in', kind: 'input', side: 'left', offset: 0.5 },
  ],
});
const patch = () => captureModellingPatch(literal);
test('literal proposal returns exact authored graph, provenance and loss fields without touching the editor', () => {
  const input = patch();
  const editor = createEditor(input.source.graph);
  const result = dryRunModellingPatch(input.source, input);
  assert(result.type === 'reviewable');
  expect(result.graph.nodes[0]?.label).toBe('Order management');
  expect(result.graph.nodes[0]?.architecture).toEqual({ family: 'ddd', role: 'bounded-context' });
  expect(result.graph.nodes[0]?.data).toEqual({ owner: 'commerce' });
  expect(result.patch.provenance.references).toEqual([
    { kind: 'review-packet', id: 'commerce-review-1' },
  ]);
  expect(result.changes).toEqual([
    {
      operationId: 'rename-orders',
      entity: 'node',
      id: 'orders',
      before: input.source.graph.nodes[0] ?? null,
      after: result.graph.nodes[0] ?? null,
    },
  ]);
  expect(result.losses).toEqual([
    {
      operationId: 'rename-orders',
      entity: 'node',
      id: 'orders',
      code: 'fields-replaced',
      fields: ['label'],
    },
  ]);
  expect(editor.graph.nodes[0]?.label).toBe('Orders');
  expect(editor.past).toEqual([]);
  expect(editor.revision).toBe(0);
  expect(Object.isFrozen(result.graph.nodes[0]?.data)).toBe(true);
  expect(result.graph).not.toBe(input.source.graph);
});
test('identity, session, revision and complete graph all pin the reviewed source', () => {
  const input = patch();
  for (const source of [
    { ...input.source, modelId: 'other' },
    { ...input.source, sessionId: 'session-2' },
    { ...input.source, revision: 8 },
    {
      ...input.source,
      graph: {
        ...input.source.graph,
        nodes: [{ ...input.source.graph.nodes[0]!, label: 'Diverged' }],
      },
    },
  ]) {
    const result = dryRunModellingPatch(source, input);
    expect(result.type).toBe('rejected');
    expect(result.findings[0]?.code).toBe('source-changed');
    expect('graph' in result).toBe(false);
  }
  const changed = updateEditor(createEditor(input.source.graph), {
    type: 'SelectionNudged',
    id: 'orders',
    delta: { x: 1, y: 0 },
  });
  const undone = updateEditor(changed, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(input.source.graph);
  expect(undone.revision).toBeGreaterThan(0);
  // A matching graph does not make a later revision the reviewed revision.
  expect(
    dryRunModellingPatch(
      { ...input.source, revision: input.source.revision + undone.revision },
      input,
    ).type,
  ).toBe('rejected');
});
test('all six operations form one final graph; ordering does not require transient validity', () => {
  const source = {
    modelId: 'm',
    sessionId: 's',
    revision: 0,
    graph: {
      nodes: [node('a'), node('b')],
      edges: [{ id: 'old', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
    },
  };
  const input: ZlozModellingPatch = {
    ...patch(),
    source,
    operations: [
      {
        id: 'add-wire',
        type: 'edge.add',
        edge: { id: 'new', source: { node: 'c', port: 'out' }, target: { node: 'b', port: 'in' } },
      },
      { id: 'remove-a', type: 'node.remove', nodeId: 'a' },
      { id: 'add-c', type: 'node.add', node: node('c') },
      { id: 'change-b', type: 'node.replace', node: { ...node('b'), label: 'B' } },
      { id: 'remove-wire', type: 'edge.remove', edgeId: 'old' },
    ],
  };
  const result = dryRunModellingPatch(source, input);
  assert(result.type === 'reviewable');
  expect(result.graph.nodes.map((n) => n.id)).toEqual(['b', 'c']);
  expect(result.graph.edges.map((e) => e.id)).toEqual(['new']);
  const replaced = dryRunModellingPatch(
    { ...source, graph: result.graph },
    {
      ...input,
      source: { ...source, graph: result.graph },
      operations: [
        {
          id: 'redirect',
          type: 'edge.replace',
          edge: {
            id: 'new',
            source: { node: 'b', port: 'out' },
            target: { node: 'c', port: 'in' },
          },
        },
      ],
    },
  );
  assert(replaced.type === 'reviewable');
  expect(replaced.graph.edges[0]?.source.node).toBe('b');
  expect(replaced.losses[0]?.fields).toEqual(['source', 'target']);
});
test('deletion never silently cascades; conflicting IDs, missing targets and invalid wiring reject atomically', () => {
  const source = {
    modelId: 'm',
    sessionId: 's',
    revision: 0,
    graph: {
      nodes: [node('a'), node('b')],
      edges: [{ id: 'e', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
    },
  };
  for (const operations of [
    [{ id: 'x', type: 'node.remove', nodeId: 'a' }],
    [{ id: 'x', type: 'node.replace', node: node('absent') }],
    [{ id: 'x', type: 'node.add', node: node('a') }],
    [
      { id: 'x', type: 'node.add', node: node('c') },
      { id: 'y', type: 'node.remove', nodeId: 'c' },
    ],
    [
      {
        id: 'x',
        type: 'edge.add',
        edge: { id: 'bad', source: { node: 'a', port: 'in' }, target: { node: 'b', port: 'in' } },
      },
    ],
  ]) {
    const result = dryRunModellingPatch(source, { ...patch(), source, operations });
    expect(result.type).toBe('rejected');
    expect('graph' in result).toBe(false);
  }
  expect(source.graph.nodes.length).toBe(2);
  expect(source.graph.edges[0]?.id).toBe('e');
});
test('live policies disclose blockers while preserving the complete frozen preview and losses', () => {
  const input = patch();
  const result = dryRunModellingPatch(input.source, input, {
    blockedReason: 'Review locked',
    canChange: (change) => (change.entity === 'node' ? 'Owner protected' : null),
    canPatch: (preview) => {
      expect(Object.isFrozen(preview.graph.nodes)).toBe(true);
      return '';
    },
  });
  assert(result.type === 'blocked');
  expect(result.graph.nodes[0]?.label).toBe('Order management');
  expect(result.findings.filter((f) => f.severity === 'error').map((f) => f.message)).toEqual([
    'Review locked',
    'Owner protected',
    'Modelling patch is protected.',
  ]);
  expect(result.losses.length).toBe(1);
  expect(dryRunModellingPatch(input.source, input).type).toBe('reviewable');
});
test('capture owns data; empty and equal proposals report no-op and no invented losses', () => {
  const raw = structuredClone(literal);
  const captured = captureModellingPatch(raw);
  raw.provenance.actor.id = 'changed';
  raw.source.graph.nodes[0]!.label = 'Changed';
  expect(captured.provenance.actor.id).toBe('reviewer');
  expect(captured.source.graph.nodes[0]?.label).toBe('Orders');
  for (const operations of [
    [],
    [{ id: 'same', type: 'node.replace', node: captured.source.graph.nodes[0]! }],
  ]) {
    const result = dryRunModellingPatch(captured.source, { ...captured, operations });
    assert(result.type === 'reviewable');
    expect(result.changes).toEqual([]);
    expect(result.losses).toEqual([]);
    expect(result.findings.some((f) => f.code === 'no-op')).toBe(true);
  }
});

test('malformed envelopes, non-data values, accessors and resource excess reject without callbacks', () => {
  const valid = patch();
  let calls = 0,
    getterCalls = 0;
  const accessor = structuredClone(literal);
  Object.defineProperty(accessor.provenance, 'reason', {
    enumerable: true,
    get() {
      getterCalls++;
      return 'executed';
    },
  });
  const sparse = Array(2);
  sparse[1] = { kind: 'ticket', id: 'x' };
  type RecursiveFixture = { self?: RecursiveFixture; next?: RecursiveFixture };
  const cycle: RecursiveFixture = {};
  cycle.self = cycle;
  const inputs: unknown[] = [
    { ...valid, version: 2 },
    { ...valid, unexpected: true },
    { ...valid, operations: [{ id: 'x', type: 'node.merge', node: node('a') }] },
    { ...valid, operations: [valid.operations[0], valid.operations[0]] },
    { ...valid, source: { ...valid.source, revision: -1 } },
    {
      ...valid,
      provenance: {
        ...valid.provenance,
        reason: () => {
          calls++;
          return 'not data';
        },
      },
    },
    { ...valid, provenance: { ...valid.provenance, reason: undefined } },
    { ...valid, provenance: { ...valid.provenance, references: sparse } },
    { ...valid, provenance: { ...valid.provenance, reason: NaN } },
    accessor,
    { ...valid, provenance: { ...valid.provenance, references: cycle } },
    { ...valid, provenance: { ...valid.provenance, references: new Date(0) } },
    { ...valid, provenance: { ...valid.provenance, reason: 'x'.repeat(2000001) } },
    {
      ...valid,
      operations: Array.from({ length: 1001 }, (_, i) => ({
        id: String(i),
        type: 'node.add',
        node: node(String(i)),
      })),
    },
    { ...valid, [Symbol('hidden')]: true },
  ];
  let deep: RecursiveFixture = {};
  for (let i = 0; i < 66; i++) deep = { next: deep };
  inputs.push({ ...valid, provenance: { ...valid.provenance, references: deep } });
  inputs.push({
    ...valid,
    provenance: { ...valid.provenance, references: Array(100001).fill(null) },
  });
  for (const input of inputs) {
    const result = dryRunModellingPatch(valid.source, input, {
      canPatch: () => {
        calls++;
        return null;
      },
    });
    expect(result.type).toBe('rejected');
    expect(result.findings[0]?.code).toBe('invalid-patch');
    expect('graph' in result).toBe(false);
  }
  expect(calls).toBe(0);
  expect(getterCalls).toBe(0);
});
test('group dependencies, payload validation and destructive field omission stay explicit', () => {
  const parent = { ...node('group'), kind: 'group' as const, ports: [] };
  const child = { ...node('child'), parentId: 'group' };
  const source = {
    modelId: 'm',
    sessionId: 's',
    revision: 0,
    graph: { nodes: [parent, child], edges: [] },
  };
  expect(
    dryRunModellingPatch(source, {
      ...patch(),
      source,
      operations: [{ id: 'remove-parent', type: 'node.remove', nodeId: 'group' }],
    }).type,
  ).toBe('rejected');
  const deleted = dryRunModellingPatch(source, {
    ...patch(),
    source,
    operations: [
      { id: 'remove-parent', type: 'node.remove', nodeId: 'group' },
      { id: 'remove-child', type: 'node.remove', nodeId: 'child' },
    ],
  });
  assert(deleted.type === 'reviewable');
  expect(deleted.graph).toEqual({ nodes: [], edges: [] });
  expect(deleted.losses.map((l) => l.code)).toEqual(['entity-removed', 'entity-removed']);
  const valid = patch();
  const baseNode = valid.source.graph.nodes[0];
  assert(baseNode);
  const { architecture: _architecture, data: _data, ...plain } = baseNode;
  const omission = dryRunModellingPatch(valid.source, {
    ...valid,
    operations: [{ id: 'omit', type: 'node.replace', node: plain }],
  });
  assert(omission.type === 'reviewable');
  expect(omission.losses[0]?.fields).toEqual(['architecture', 'data']);
  const malformed = dryRunModellingPatch(valid.source, {
    ...valid,
    operations: [
      { id: 'bad', type: 'node.replace', node: { ...baseNode, size: { width: 0, height: 100 } } },
    ],
  });
  expect(malformed.type).toBe('rejected');
  expect(malformed.findings[0]?.path).toBe('/operations/0/node');
});
test('key order is not graph freshness; additions-only fields are not reported as loss', () => {
  const input = patch();
  const first = input.source.graph.nodes[0];
  assert(first);
  const reordered = { edges: input.source.graph.edges, nodes: input.source.graph.nodes };
  const result = dryRunModellingPatch(
    { ...input.source, graph: reordered },
    {
      ...input,
      operations: [{ id: 'addition', type: 'node.replace', node: { ...first, extent: undefined } }],
    },
  );
  // Undefined is not a deletion instruction in the data-only proposal contract.
  expect(result.type).toBe('rejected');
  const added = dryRunModellingPatch(
    { ...input.source, graph: reordered },
    {
      ...input,
      operations: [
        {
          id: 'addition',
          type: 'node.replace',
          node: { ...first, resizeLimits: { minWidth: 80 } },
        },
      ],
    },
  );
  assert(added.type === 'reviewable');
  expect(added.losses).toEqual([]);
  expect(added.changes.length).toBe(1);
  const reason = () => {
    throw new Error('policy defect');
  };
  expect(() => dryRunModellingPatch(input.source, input, { canPatch: reason })).toThrow(
    'policy defect',
  );
});

test('Unicode-equivalent keys retain distinct values independently of object insertion order', () => {
  const input = patch(),
    first = input.source.graph.nodes[0];
  assert(first);
  const source = {
    ...input.source,
    graph: { nodes: [{ ...first, data: { é: 1, 'e\u0301': 2 } }], edges: [] },
  };
  const expected = {
    ...source,
    graph: { nodes: [{ ...first, data: { 'e\u0301': 2, é: 1 } }], edges: [] },
  };
  const result = dryRunModellingPatch(source, { ...input, source: expected, operations: [] });
  expect(result.type).toBe('reviewable');
});

test('depth and value budgets reject otherwise valid payloads at the data boundary', () => {
  const input = patch();
  type Payload = { next?: Payload };
  let deep: Payload = {};
  for (let i = 0; i < 66; i++) deep = { next: deep };
  const depth = dryRunModellingPatch(input.source, {
    ...input,
    operations: [{ id: 'deep', type: 'node.add', node: { ...node('deep'), data: deep } }],
  });
  expect(depth.type).toBe('rejected');
  expect(depth.findings[0]?.message).toContain('depth 64');
  expect(depth.findings[0]?.path).toStartWith('/operations/0/node/data');
  const wide = dryRunModellingPatch(input.source, {
    ...input,
    operations: [
      { id: 'wide', type: 'node.add', node: { ...node('wide'), data: Array(100001).fill(0) } },
    ],
  });
  expect(wide.type).toBe('rejected');
  expect(wide.findings[0]?.message).toContain('100000');
  expect(wide.findings[0]?.path).toBe('/operations/0/node/data');
  let bounded: Payload = {};
  for (let i = 0; i < 40; i++) bounded = { next: bounded };
  const valid = dryRunModellingPatch(input.source, {
    ...input,
    operations: [{ id: 'bounded', type: 'node.add', node: { ...node('bounded'), data: bounded } }],
  });
  expect(valid.type).toBe('reviewable');
});

test('graph-level JSON extensions survive empty and changing proposals', () => {
  const input = patch();
  const source = {
    ...input.source,
    graph: { ...input.source.graph, metadata: { producer: 'host-extension' } },
  };
  for (const operations of [[], input.operations]) {
    const result = dryRunModellingPatch(source, { ...input, source, operations });
    assert(result.type === 'reviewable');
    expect(Object.keys(result.graph)).toContain('metadata');
    expect(JSON.stringify(result.graph)).toContain('"metadata":{"producer":"host-extension"}');
    expect(result.losses.some((loss) => loss.fields.includes('metadata'))).toBe(false);
  }
});
