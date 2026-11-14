import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  resolveConnectionPortPair,
  captureConnectionDocument,
  parseConnectionDocument,
  serializeConnectionDocument,
  planConnectionDocumentDowngrade,
  parseGraph,
  parseSnapshot,
  serializeSnapshot,
  createEditor,
  validateGraph,
  type Port,
  type ZlozNode,
  type ZlozConnectionMode,
} from '../src/index';
import legacyWire from './fixtures/connection-v1-strict.json';
import loose from './fixtures/connection-v2-loose.json';

const legacy = JSON.stringify(legacyWire);
const kinds: readonly Port['kind'][] = ['input', 'output'];
for (const mode of ['strict', 'loose'] as const)
  for (const sourceKind of kinds)
    for (const targetKind of kinds) {
      test(`${mode} endpoint matrix: ${sourceKind} to ${targetKind}`, () => {
        const expected =
          mode === 'loose' || (sourceKind === 'output' && targetKind === 'input')
            ? 'compatible'
            : 'incompatible';
        expect(resolveConnectionPortPair({ mode, sourceKind, targetKind }).type).toBe(expected);
        const wire = structuredClone(loose);
        wire.connectionMode = mode;
        wire.graph.nodes[0]!.ports[0]!.kind = sourceKind;
        wire.graph.nodes[1]!.ports[0]!.kind = targetKind;
        if (expected === 'compatible')
          expect(parseConnectionDocument(JSON.stringify(wire)).connectionMode).toBe(mode);
        else expect(() => parseConnectionDocument(JSON.stringify(wire))).toThrow();
      });
    }
test('strict is the construction/matrix default; loose never accepts missing endpoints or an unknown mode', () => {
  expect(resolveConnectionPortPair({ sourceKind: 'input', targetKind: 'input' })).toMatchObject({
    type: 'incompatible',
    code: 'port-kinds',
  });
  for (const mode of ['strict', 'loose'] as const) {
    expect(
      resolveConnectionPortPair({ mode, sourceKind: undefined, targetKind: 'input' }),
    ).toMatchObject({ type: 'incompatible', code: 'source-missing' });
    expect(
      resolveConnectionPortPair({ mode, sourceKind: 'output', targetKind: undefined }),
    ).toMatchObject({ type: 'incompatible', code: 'target-missing' });
  }
  expect(captureConnectionDocument(parseSnapshot(legacy)).connectionMode).toBe('strict');
  // @ts-expect-error Deliberate malformed caller: future modes are not part of this contract.
  const futureMode: ZlozConnectionMode = 'future';
  expect(() =>
    captureConnectionDocument({ ...parseSnapshot(legacy), connectionMode: futureMode }),
  ).toThrow();
});
test('literal loose v2 detaches and freezes all authored data, retaining order, geometry, ports and camera', () => {
  const document = parseConnectionDocument(JSON.stringify(loose));
  assert.deepEqual(document, loose);
  expect(Object.isFrozen(document.graph.nodes[0]?.data)).toBe(true);
  expect(Object.isFrozen(document.graph.edges[0]?.source)).toBe(true);
  expect(Object.isFrozen(loose)).toBe(false);
  assert.deepEqual(parseConnectionDocument(serializeConnectionDocument(document)), loose);
  expect(captureConnectionDocument(document).connectionMode).toBe('loose');
  expect(document.graph.nodes[0]?.ports[0]?.kind).toBe('input');
  expect(document.graph.edges[0]?.source.node).toBe('a');
});
test('v1 codecs and editors remain strict; explicit upgrade preserves the legacy snapshot and editor', () => {
  const snapshot = parseSnapshot(legacy),
    editor = createEditor(snapshot.graph),
    before = JSON.stringify(editor);
  const upgraded = captureConnectionDocument(snapshot);
  expect(upgraded.version).toBe(2);
  expect(upgraded.graph).toEqual(snapshot.graph);
  expect(upgraded.viewport).toEqual(snapshot.viewport);
  expect(JSON.stringify(editor)).toBe(before);
  expect(JSON.parse(serializeSnapshot(snapshot)).version).toBe(1);
  expect(() => parseGraph(serializeConnectionDocument(upgraded))).toThrow();
  expect(() => parseConnectionDocument(legacy)).toThrow();
  const looseDocument = parseConnectionDocument(JSON.stringify(loose));
  expect(() => validateGraph(looseDocument.graph)).toThrow();
  expect(() => createEditor(looseDocument.graph)).toThrow();
  expect(() => serializeSnapshot(looseDocument)).toThrow();
});
test('downgrade is read-only planning: loose-only edges block without a partial v1 snapshot or kind rewrites', () => {
  const source = parseConnectionDocument(JSON.stringify(loose)),
    before = JSON.stringify(source);
  const plan = planConnectionDocumentDowngrade(source);
  assert(plan.type === 'blocked');
  expect(plan.incompatibleEdges).toEqual(['orders-billing']);
  expect('snapshot' in plan).toBe(false);
  expect(JSON.stringify(source)).toBe(before);
  const compatible = captureConnectionDocument({
    ...parseSnapshot(legacy),
    connectionMode: 'loose',
  });
  const review = planConnectionDocumentDowngrade(compatible);
  assert(review.type === 'reviewable');
  expect(review.losses).toEqual([expect.objectContaining({ code: 'loose-mode-removed' })]);
  expect(review.snapshot.graph).toEqual(compatible.graph);
  expect(parseSnapshot(serializeSnapshot(review.snapshot))).toEqual(parseSnapshot(legacy));
  const strict = planConnectionDocumentDowngrade(captureConnectionDocument(parseSnapshot(legacy)));
  assert(strict.type === 'reviewable');
  expect(strict.losses).toEqual([]);
});
test('strict v2 boundary rejects missing/unknown modes, future versions, unknown envelope fields and invalid graph/camera data', () => {
  const missing = JSON.parse(JSON.stringify(loose));
  delete missing.connectionMode;
  const missingPort = JSON.parse(JSON.stringify(loose));
  missingPort.graph.edges[0].target.port = 'absent';
  const duplicate = JSON.parse(JSON.stringify(loose));
  duplicate.graph.nodes.push(duplicate.graph.nodes[0]);
  const portedGroup = JSON.parse(JSON.stringify(loose));
  portedGroup.graph.nodes[0].kind = 'group';
  for (const wire of [
    missing,
    missingPort,
    duplicate,
    portedGroup,
    { ...loose, connectionMode: 'future' },
    { ...loose, version: 3 },
    { ...loose, extra: true },
    { ...loose, viewport: { x: 0, y: 0, zoom: 0 } },
  ])
    expect(() => parseConnectionDocument(JSON.stringify(wire))).toThrow();
  for (const text of ['{', 'null', '[]']) expect(() => parseConnectionDocument(text)).toThrow();
});

test('serialization revalidates typed values before JSON encoding and never normalizes corrupt payloads', () => {
  const document = parseConnectionDocument(JSON.stringify(loose));
  const invalid = {
    ...document,
    graph: {
      ...document.graph,
      nodes: document.graph.nodes.map((node) => ({ ...node, data: { invalid: Number.NaN } })),
    },
  };
  expect(() => serializeConnectionDocument(invalid)).toThrow();
  expect(() => captureConnectionDocument({ ...invalid, connectionMode: 'loose' })).toThrow();
  const invalidGraph = { ...loose, graph: { ...loose.graph, hiddenMode: 'loose' } };
  const invalidCamera = { ...loose, viewport: { ...loose.viewport, animation: true } };
  expect(() => parseConnectionDocument(JSON.stringify(invalidGraph))).toThrow();
  expect(() => parseConnectionDocument(JSON.stringify(invalidCamera))).toThrow();
});

test('loose mode preserves ordered reverse and self connections without symmetric meaning or port retyping', () => {
  const source = parseConnectionDocument(JSON.stringify(loose));
  const wire = {
    ...source,
    graph: {
      ...source.graph,
      edges: [
        ...source.graph.edges,
        {
          id: 'reverse',
          source: { node: 'b', port: 'shared' },
          target: { node: 'a', port: 'shared' },
        },
        {
          id: 'self',
          source: { node: 'a', port: 'shared' },
          target: { node: 'a', port: 'shared' },
        },
      ],
    },
  };
  const document = parseConnectionDocument(JSON.stringify(wire));
  expect(document.graph.edges.map((edge) => [edge.id, edge.source.node, edge.target.node])).toEqual(
    [
      ['orders-billing', 'a', 'b'],
      ['reverse', 'b', 'a'],
      ['self', 'a', 'a'],
    ],
  );
  expect(planConnectionDocumentDowngrade(document).type).toBe('blocked');
});
test('v2 retains existing nested world geometry, portless boundaries and declared parent constraints', () => {
  const source = parseConnectionDocument(JSON.stringify(loose));
  const group: ZlozNode = {
    id: 'frame',
    kind: 'group',
    label: 'Context',
    position: { x: 0, y: 0 },
    size: { width: 700, height: 400 },
    ports: [],
  };
  const graph = {
    ...source.graph,
    nodes: [
      group,
      ...source.graph.nodes.map(
        (node): ZlozNode => ({ ...node, parentId: 'frame', extent: 'parent' }),
      ),
    ],
  };
  const captured = captureConnectionDocument({
    graph,
    viewport: source.viewport,
    connectionMode: 'loose',
  });
  expect(captured.graph).toEqual(graph);
  expect(captured.graph.nodes[1]?.position).toEqual(source.graph.nodes[0]?.position);
});
